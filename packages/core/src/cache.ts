import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { InvalidInputError } from './errors.js';

export interface KampusCacheEntry<T = unknown> {
  key: string;
  value: T;
  storedAt: string;
  expiresAt?: string;
  staleUntil?: string;
  hits?: number;
  lastAccessedAt?: string;
  meta?: Record<string, unknown>;
}

export interface KampusCacheFile {
  entries: Record<string, KampusCacheEntry>;
}

export interface KampusCacheOptions {
  cachePath?: string;
  env?: NodeJS.ProcessEnv;
}

export interface KampusCacheReadResult<T = unknown> {
  state: 'missing' | 'fresh' | 'stale' | 'expired';
  entry?: KampusCacheEntry<T>;
}

const KAMPUS_DIR = 'Kampus';
const CACHE_FILE = 'cache.json';
const UTF8_BOM = '\uFEFF';

export function resolveKampusCachePath(env: NodeJS.ProcessEnv = process.env): string {
  const appData = env.APPDATA?.trim();
  if (appData) {
    return join(appData, KAMPUS_DIR, CACHE_FILE);
  }

  return join(homedir(), '.kampus', CACHE_FILE);
}

export function loadKampusCache(options?: KampusCacheOptions): KampusCacheFile {
  const cachePath = options?.cachePath ?? resolveKampusCachePath(options?.env);
  if (!existsSync(cachePath)) {
    return { entries: {} };
  }

  let raw: string;
  try {
    raw = readFileSync(cachePath, 'utf8');
  } catch (error) {
    throw new InvalidInputError(
      `Unable to read Kampus cache at "${cachePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!raw.trim()) {
    return { entries: {} };
  }

  raw = raw.startsWith(UTF8_BOM) ? raw.slice(UTF8_BOM.length) : raw;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InvalidInputError(
      `Kampus cache at "${cachePath}" is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidInputError(`Kampus cache at "${cachePath}" must be a JSON object.`);
  }

  const rawEntries = (parsed as { entries?: unknown }).entries;
  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return { entries: {} };
  }

  return {
    entries: Object.fromEntries(
      Object.entries(rawEntries as Record<string, unknown>)
        .map(([key, value]) => [key, normalizeCacheEntry(key, value)])
        .filter((entry): entry is [string, KampusCacheEntry] => entry[1] != null),
    ),
  };
}

export function saveKampusCache(cache: KampusCacheFile, options?: KampusCacheOptions): KampusCacheFile {
  const cachePath = options?.cachePath ?? resolveKampusCachePath(options?.env);
  mkdirSync(dirname(cachePath), { recursive: true });

  const normalized: KampusCacheFile = {
    entries: Object.fromEntries(
      Object.entries(cache.entries ?? {})
        .map(([key, value]) => [key, normalizeCacheEntry(key, value)])
        .filter((entry): entry is [string, KampusCacheEntry] => entry[1] != null),
    ),
  };

  writeFileSync(cachePath, `${UTF8_BOM}${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export function readKampusCacheEntry<T = unknown>(
  key: string,
  options?: KampusCacheOptions & { now?: Date },
): KampusCacheReadResult<T> {
  const cache = loadKampusCache(options);
  const entry = cache.entries[key] as KampusCacheEntry<T> | undefined;
  if (!entry) {
    return { state: 'missing' };
  }

  const now = options?.now ?? new Date();
  const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : undefined;
  const staleUntil = entry.staleUntil ? new Date(entry.staleUntil) : undefined;

  if (expiresAt && expiresAt.getTime() > now.getTime()) {
    return { state: 'fresh', entry };
  }

  if (staleUntil && staleUntil.getTime() > now.getTime()) {
    return { state: 'stale', entry };
  }

  return { state: 'expired', entry };
}

export function writeKampusCacheEntry<T = unknown>(
  entry: KampusCacheEntry<T>,
  options?: KampusCacheOptions & { maxEntries?: number },
): KampusCacheEntry<T> {
  const cache = loadKampusCache(options);
  const normalizedEntry = normalizeCacheEntry(entry.key, entry) as KampusCacheEntry<T>;
  cache.entries[entry.key] = normalizedEntry;

  const keysByFreshness = Object.entries(cache.entries)
    .sort((left, right) => {
      const leftTime = Date.parse(left[1].lastAccessedAt ?? left[1].storedAt ?? '') || 0;
      const rightTime = Date.parse(right[1].lastAccessedAt ?? right[1].storedAt ?? '') || 0;
      return rightTime - leftTime;
    })
    .map(([key]) => key);

  const maxEntries = Math.max(1, options?.maxEntries ?? Number.MAX_SAFE_INTEGER);
  for (const key of keysByFreshness.slice(maxEntries)) {
    delete cache.entries[key];
  }

  saveKampusCache(cache, options);
  return normalizedEntry;
}

export function touchKampusCacheEntry(
  key: string,
  options?: KampusCacheOptions & { now?: Date },
): KampusCacheEntry | undefined {
  const cache = loadKampusCache(options);
  const entry = cache.entries[key];
  if (!entry) {
    return undefined;
  }

  entry.hits = (entry.hits ?? 0) + 1;
  entry.lastAccessedAt = (options?.now ?? new Date()).toISOString();
  saveKampusCache(cache, options);
  return entry;
}

function normalizeCacheEntry(key: string, value: unknown): KampusCacheEntry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as {
    value?: unknown;
    storedAt?: unknown;
    expiresAt?: unknown;
    staleUntil?: unknown;
    hits?: unknown;
    lastAccessedAt?: unknown;
    meta?: unknown;
  };

  return {
    key,
    value: raw.value,
    storedAt:
      typeof raw.storedAt === 'string' && raw.storedAt.trim()
        ? raw.storedAt.trim()
        : new Date().toISOString(),
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt.trim() || undefined : undefined,
    staleUntil: typeof raw.staleUntil === 'string' ? raw.staleUntil.trim() || undefined : undefined,
    hits: Number.isInteger(raw.hits) ? Number(raw.hits) : undefined,
    lastAccessedAt:
      typeof raw.lastAccessedAt === 'string' ? raw.lastAccessedAt.trim() || undefined : undefined,
    meta:
      raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)
        ? (raw.meta as Record<string, unknown>)
        : undefined,
  };
}
