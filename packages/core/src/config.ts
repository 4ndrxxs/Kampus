import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { InvalidInputError } from './errors.js';
import { normalizeRegionName, normalizeSchoolName } from './normalize.js';
import {
  getPreferredSecretStorage,
  protectSecret,
  resolveSecret,
  type KampusSecretStorage,
} from './secret.js';
import {
  KAMPUS_DEVELOPER_INFO,
  KAMPUS_PROJECT_INFO,
  type KampusDeveloperInfo,
  type KampusProjectInfo,
} from './metadata.js';
import type { AccessMode, ProviderRefs, SchoolRef } from './types.js';

export interface KampusCachePolicy {
  datasetTtlMinutes?: number;
  staleIfErrorHours?: number;
  maxEntries?: number;
}

export interface KampusNeisApiKeyStatus {
  checkedAt?: string;
  ok?: boolean;
  accessMode?: AccessMode;
  message?: string;
  source?: 'env' | 'config';
}

export interface KampusConfig {
  neisApiKey?: string;
  neisApiKeyStoredValue?: string;
  neisApiKeyStorage?: KampusSecretStorage;
  neisApiKeyReadable?: boolean;
  neisApiKeyError?: string;
  neisApiKeyStatus?: KampusNeisApiKeyStatus;
  defaultSchool?: KampusStoredSchool;
  recentSchools?: KampusStoredSchool[];
  profiles?: Record<string, KampusProfile>;
  activeProfile?: string;
  cachePolicy?: KampusCachePolicy;
}

export interface KampusStoredSchool extends SchoolRef {
  lastUsedAt?: string;
}

export interface KampusProfile {
  name: string;
  school?: KampusStoredSchool;
  grade?: number;
  classNo?: number;
  teacherName?: string;
  notes?: string;
  updatedAt?: string;
}

export interface KampusProfileInput {
  name: string;
  school?: SchoolRef;
  grade?: number;
  classNo?: number;
  teacherName?: string;
  notes?: string;
  updatedAt?: string;
}

export interface KampusConfigOptions {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

export interface KampusConfigStatus {
  configPath: string;
  neisApiKeyConfigured: boolean;
  neisApiKeyStored: boolean;
  neisApiKeyReadable: boolean;
  neisApiKeySource: 'env' | 'config' | 'none';
  neisApiKeyStorage?: KampusSecretStorage;
  neisApiKeyPreview?: string;
  neisApiKeyError?: string;
  neisApiKeyStatus?: KampusNeisApiKeyStatus;
  projectInfo?: KampusProjectInfo;
  developerInfo?: KampusDeveloperInfo;
  defaultSchool?: KampusStoredSchool;
  recentSchools: KampusStoredSchool[];
  activeProfile?: KampusProfile;
  profiles: KampusProfile[];
  cachePolicy: Required<KampusCachePolicy>;
}

const KAMPUS_DIR = 'Kampus';
const CONFIG_FILE = 'config.json';
const UTF8_BOM = '\uFEFF';

export const DEFAULT_CACHE_POLICY: Required<KampusCachePolicy> = {
  datasetTtlMinutes: 15,
  staleIfErrorHours: 24,
  maxEntries: 250,
};

export function resolveKampusConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const appData = env.APPDATA?.trim();
  if (appData) {
    return join(appData, KAMPUS_DIR, CONFIG_FILE);
  }

  return join(homedir(), '.kampus', CONFIG_FILE);
}

export function resolveKampusDataDir(env: NodeJS.ProcessEnv = process.env): string {
  return dirname(resolveKampusConfigPath(env));
}

export function loadKampusConfig(options?: KampusConfigOptions): KampusConfig {
  const configPath = options?.configPath ?? resolveKampusConfigPath(options?.env);
  if (!existsSync(configPath)) {
    return {};
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (error) {
    throw new InvalidInputError(
      `Unable to read Kampus config at "${configPath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!raw.trim()) {
    return {};
  }

  raw = stripUtf8Bom(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InvalidInputError(
      `Kampus config at "${configPath}" is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidInputError(`Kampus config at "${configPath}" must be a JSON object.`);
  }

  const config = parsed as {
    neisApiKey?: unknown;
    neisApiKeyStorage?: unknown;
    neisApiKeyStatus?: unknown;
    defaultSchool?: unknown;
    recentSchools?: unknown;
    profiles?: unknown;
    activeProfile?: unknown;
    cachePolicy?: unknown;
  };
  const rawNeisApiKey = typeof config.neisApiKey === 'string' ? config.neisApiKey.trim() : undefined;
  const neisApiKeyStorage = normalizeSecretStorage(config.neisApiKeyStorage) ?? (rawNeisApiKey ? 'plain-text' : undefined);
  const resolvedNeisApiKey = resolveSecret(rawNeisApiKey, neisApiKeyStorage);
  const profiles = normalizeProfiles(config.profiles);
  const activeProfileKey = normalizeProfileKey(
    typeof config.activeProfile === 'string' ? config.activeProfile : undefined,
  );

  return {
    neisApiKey: resolvedNeisApiKey.value,
    neisApiKeyStoredValue: rawNeisApiKey || undefined,
    neisApiKeyStorage,
    neisApiKeyReadable: resolvedNeisApiKey.readable,
    neisApiKeyError: resolvedNeisApiKey.error,
    neisApiKeyStatus: normalizeNeisApiKeyStatus(config.neisApiKeyStatus),
    defaultSchool: normalizeStoredSchool(config.defaultSchool),
    recentSchools: normalizeStoredSchools(config.recentSchools),
    profiles,
    activeProfile: activeProfileKey && profiles?.[activeProfileKey] ? activeProfileKey : undefined,
    cachePolicy: normalizeCachePolicy(config.cachePolicy),
  };
}

export function saveKampusConfig(config: KampusConfig, options?: KampusConfigOptions): KampusConfig {
  const configPath = options?.configPath ?? resolveKampusConfigPath(options?.env);
  mkdirSync(dirname(configPath), { recursive: true });

  const normalized = normalizeConfig(config);
  writeFileSync(configPath, `${UTF8_BOM}${JSON.stringify(toPersistedConfig(normalized), null, 2)}\n`, 'utf8');
  return loadKampusConfig(options);
}

export function resolveNeisApiKey(options?: KampusConfigOptions): string | undefined {
  const envKey = options?.env?.NEIS_API_KEY?.trim() ?? process.env.NEIS_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }

  return loadKampusConfig(options).neisApiKey;
}

export function getKampusConfigStatus(options?: KampusConfigOptions): KampusConfigStatus {
  const configPath = options?.configPath ?? resolveKampusConfigPath(options?.env);
  const config = loadKampusConfig(options);
  const envKey = options?.env?.NEIS_API_KEY?.trim() ?? process.env.NEIS_API_KEY?.trim();
  const stored = Boolean(config.neisApiKeyStoredValue || config.neisApiKey);
  const readable = Boolean(config.neisApiKey || envKey);
  const keyStatus = envKey
    ? {
        ...(config.neisApiKeyStatus ?? {}),
        source: 'env' as const,
      }
    : config.neisApiKeyStatus;

  if (envKey) {
    return {
      configPath,
      neisApiKeyConfigured: true,
      neisApiKeyStored: stored,
      neisApiKeyReadable: true,
      neisApiKeySource: 'env',
      neisApiKeyStorage: config.neisApiKeyStorage,
      neisApiKeyPreview: maskSecret(envKey),
      neisApiKeyError: config.neisApiKeyError,
      neisApiKeyStatus: keyStatus,
      projectInfo: KAMPUS_PROJECT_INFO,
      developerInfo: KAMPUS_DEVELOPER_INFO,
      defaultSchool: config.defaultSchool,
      recentSchools: config.recentSchools ?? [],
      activeProfile: getActiveProfile(config),
      profiles: listProfiles(config),
      cachePolicy: resolveCachePolicy(config),
    };
  }

  if (config.neisApiKey) {
    return {
      configPath,
      neisApiKeyConfigured: true,
      neisApiKeyStored: stored,
      neisApiKeyReadable: true,
      neisApiKeySource: 'config',
      neisApiKeyStorage: config.neisApiKeyStorage,
      neisApiKeyPreview: maskSecret(config.neisApiKey),
      neisApiKeyError: config.neisApiKeyError,
      neisApiKeyStatus: keyStatus,
      projectInfo: KAMPUS_PROJECT_INFO,
      developerInfo: KAMPUS_DEVELOPER_INFO,
      defaultSchool: config.defaultSchool,
      recentSchools: config.recentSchools ?? [],
      activeProfile: getActiveProfile(config),
      profiles: listProfiles(config),
      cachePolicy: resolveCachePolicy(config),
    };
  }

  return {
    configPath,
    neisApiKeyConfigured: false,
    neisApiKeyStored: stored,
    neisApiKeyReadable: readable,
    neisApiKeySource: stored ? 'config' : 'none',
    neisApiKeyStorage: config.neisApiKeyStorage,
    neisApiKeyError: config.neisApiKeyError,
    neisApiKeyStatus: keyStatus,
    projectInfo: KAMPUS_PROJECT_INFO,
    developerInfo: KAMPUS_DEVELOPER_INFO,
    defaultSchool: config.defaultSchool,
    recentSchools: config.recentSchools ?? [],
    activeProfile: getActiveProfile(config),
    profiles: listProfiles(config),
    cachePolicy: resolveCachePolicy(config),
  };
}

export function toStoredSchool(school: SchoolRef, lastUsedAt = new Date().toISOString()): KampusStoredSchool {
  return {
    name: school.name.trim(),
    region: school.region?.trim() || undefined,
    schoolType: school.schoolType?.trim() || undefined,
    providerRefs: normalizeProviderRefs(school.providerRefs),
    lastUsedAt,
  };
}

export function rememberRecentSchool(
  config: KampusConfig,
  school: SchoolRef,
  options?: { now?: string; limit?: number },
): KampusConfig {
  const stored = toStoredSchool(school, options?.now);
  const recent = [stored, ...(config.recentSchools ?? [])].filter((candidate, index, values) => {
    return values.findIndex((value) => schoolConfigKey(value) === schoolConfigKey(candidate)) === index;
  });

  return {
    ...config,
    recentSchools: recent.slice(0, options?.limit ?? 10),
  };
}

export function setDefaultSchool(
  config: KampusConfig,
  school: SchoolRef,
  options?: { now?: string; recentLimit?: number },
): KampusConfig {
  const stored = toStoredSchool(school, options?.now);
  return {
    ...rememberRecentSchool(config, school, {
      now: options?.now,
      limit: options?.recentLimit,
    }),
    defaultSchool: stored,
  };
}

export function clearDefaultSchool(config: KampusConfig): KampusConfig {
  return {
    ...config,
    defaultSchool: undefined,
  };
}

export function removeRecentSchool(
  config: KampusConfig,
  school: Pick<SchoolRef, 'name' | 'region'>,
): KampusConfig {
  const recentSchools = (config.recentSchools ?? []).filter((candidate) => {
    return schoolConfigKey(candidate) !== schoolConfigKey({
      name: school.name,
      region: school.region,
    });
  });

  return {
    ...config,
    recentSchools: recentSchools.length ? recentSchools : undefined,
  };
}

export function setNeisApiKeyStatus(
  config: KampusConfig,
  status: KampusNeisApiKeyStatus | undefined,
): KampusConfig {
  return {
    ...config,
    neisApiKeyStatus: normalizeNeisApiKeyStatus(status),
  };
}

export function getActiveProfile(config: KampusConfig = loadKampusConfig()): KampusProfile | undefined {
  const activeKey = normalizeProfileKey(config.activeProfile);
  if (!activeKey) {
    return undefined;
  }

  return config.profiles?.[activeKey];
}

export function listProfiles(config: KampusConfig = loadKampusConfig()): KampusProfile[] {
  return Object.values(config.profiles ?? {}).sort((left, right) => left.name.localeCompare(right.name));
}

export function upsertProfile(config: KampusConfig, profile: KampusProfileInput): KampusConfig {
  const normalized = normalizeProfileInput({
    ...profile,
    updatedAt: profile.updatedAt ?? new Date().toISOString(),
  });
  if (!normalized) {
    throw new InvalidInputError('Profile name is required.');
  }
  const profileKey = normalizeProfileKey(normalized.name);
  if (!profileKey) {
    throw new InvalidInputError('Profile name is required.');
  }

  return {
    ...config,
    profiles: {
      ...(config.profiles ?? {}),
      [profileKey]: normalized,
    },
  };
}

export function removeProfile(config: KampusConfig, name: string): KampusConfig {
  const profileKey = normalizeProfileKey(name);
  if (!profileKey || !config.profiles?.[profileKey]) {
    return config;
  }

  const nextProfiles = { ...config.profiles };
  delete nextProfiles[profileKey];

  return {
    ...config,
    profiles: Object.keys(nextProfiles).length ? nextProfiles : undefined,
    activeProfile: config.activeProfile === profileKey ? undefined : config.activeProfile,
  };
}

export function setActiveProfile(config: KampusConfig, name: string | undefined): KampusConfig {
  const profileKey = normalizeProfileKey(name);
  if (!profileKey) {
    return {
      ...config,
      activeProfile: undefined,
    };
  }
  if (!config.profiles?.[profileKey]) {
    throw new InvalidInputError(`Profile "${name}" does not exist.`);
  }

  return {
    ...config,
    activeProfile: profileKey,
  };
}

export function resolveCachePolicy(config: KampusConfig = loadKampusConfig()): Required<KampusCachePolicy> {
  return {
    ...DEFAULT_CACHE_POLICY,
    ...(config.cachePolicy ?? {}),
  };
}

export function maskSecret(secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function normalizeConfig(config: KampusConfig): KampusConfig {
  const profiles = normalizeProfiles(config.profiles);
  const activeProfile = normalizeProfileKey(config.activeProfile);
  const neisApiKey = config.neisApiKey?.trim() || undefined;
  const neisApiKeyStoredValue = config.neisApiKeyStoredValue?.trim() || undefined;
  const neisApiKeyStorage =
    normalizeSecretStorage(config.neisApiKeyStorage) ??
    (neisApiKey || neisApiKeyStoredValue ? getPreferredSecretStorage() : undefined);

  return {
    neisApiKey,
    neisApiKeyStoredValue,
    neisApiKeyStorage,
    neisApiKeyReadable: neisApiKey ? true : Boolean(config.neisApiKeyReadable),
    neisApiKeyError: typeof config.neisApiKeyError === 'string' ? config.neisApiKeyError.trim() || undefined : undefined,
    neisApiKeyStatus: normalizeNeisApiKeyStatus(config.neisApiKeyStatus),
    defaultSchool: normalizeStoredSchool(config.defaultSchool),
    recentSchools: normalizeStoredSchools(config.recentSchools),
    profiles,
    activeProfile: activeProfile && profiles?.[activeProfile] ? activeProfile : undefined,
    cachePolicy: normalizeCachePolicy(config.cachePolicy),
  };
}

function toPersistedConfig(config: KampusConfig) {
  const persistedKey = persistNeisApiKey(config);

  return {
    neisApiKey: persistedKey?.value,
    neisApiKeyStorage: persistedKey?.storage,
    neisApiKeyStatus: normalizeNeisApiKeyStatus(config.neisApiKeyStatus),
    defaultSchool: normalizeStoredSchool(config.defaultSchool),
    recentSchools: normalizeStoredSchools(config.recentSchools),
    profiles: normalizeProfiles(config.profiles),
    activeProfile: normalizeProfileKey(config.activeProfile),
    cachePolicy: normalizeCachePolicy(config.cachePolicy),
  };
}

function normalizeStoredSchools(value: unknown): KampusStoredSchool[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => normalizeStoredSchool(entry))
    .filter((entry): entry is KampusStoredSchool => entry != null);

  if (!normalized.length) {
    return undefined;
  }

  return normalized.filter((candidate, index, values) => {
    return values.findIndex((value) => schoolConfigKey(value) === schoolConfigKey(candidate)) === index;
  });
}

function persistNeisApiKey(
  config: KampusConfig,
): { value: string; storage: KampusSecretStorage } | undefined {
  if (config.neisApiKey) {
    const protectedSecret = protectSecret(config.neisApiKey, {
      storage: config.neisApiKeyStorage,
    });
    return {
      value: protectedSecret.value,
      storage: protectedSecret.storage,
    };
  }

  if (config.neisApiKeyStoredValue && config.neisApiKeyStorage) {
    return {
      value: config.neisApiKeyStoredValue,
      storage: config.neisApiKeyStorage,
    };
  }

  return undefined;
}

function normalizeStoredSchool(value: unknown): KampusStoredSchool | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as {
    name?: unknown;
    region?: unknown;
    schoolType?: unknown;
    providerRefs?: unknown;
    lastUsedAt?: unknown;
  };
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return undefined;
  }

  return {
    name,
    region: typeof raw.region === 'string' ? raw.region.trim() || undefined : undefined,
    schoolType: typeof raw.schoolType === 'string' ? raw.schoolType.trim() || undefined : undefined,
    providerRefs: normalizeProviderRefs(raw.providerRefs),
    lastUsedAt: typeof raw.lastUsedAt === 'string' ? raw.lastUsedAt.trim() || undefined : undefined,
  };
}

function normalizeProviderRefs(value: unknown): ProviderRefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const raw = value as {
    comcigan?: { schoolCode?: unknown };
    neis?: { officeCode?: unknown; schoolCode?: unknown };
  };

  return {
    comcigan:
      raw.comcigan && Number.isFinite(Number(raw.comcigan.schoolCode))
        ? {
            schoolCode: Number(raw.comcigan.schoolCode),
          }
        : undefined,
    neis:
      raw.neis &&
      typeof raw.neis.officeCode === 'string' &&
      raw.neis.officeCode.trim() &&
      typeof raw.neis.schoolCode === 'string' &&
      raw.neis.schoolCode.trim()
        ? {
            officeCode: raw.neis.officeCode.trim(),
            schoolCode: raw.neis.schoolCode.trim(),
          }
        : undefined,
  };
}

function schoolConfigKey(school: Pick<KampusStoredSchool, 'name' | 'region'>): string {
  return `${normalizeSchoolName(school.name)}::${normalizeRegionName(school.region) ?? ''}`;
}

function stripUtf8Bom(value: string): string {
  return value.startsWith(UTF8_BOM) ? value.slice(UTF8_BOM.length) : value;
}

function normalizeNeisApiKeyStatus(value: unknown): KampusNeisApiKeyStatus | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as {
    checkedAt?: unknown;
    ok?: unknown;
    accessMode?: unknown;
    message?: unknown;
    source?: unknown;
  };

  const checkedAt = typeof raw.checkedAt === 'string' ? raw.checkedAt.trim() || undefined : undefined;
  const accessMode = isAccessMode(raw.accessMode) ? raw.accessMode : undefined;
  const message = typeof raw.message === 'string' ? raw.message.trim() || undefined : undefined;
  const source = raw.source === 'env' || raw.source === 'config' ? raw.source : undefined;
  const ok = typeof raw.ok === 'boolean' ? raw.ok : undefined;

  if (!checkedAt && ok == null && !accessMode && !message && !source) {
    return undefined;
  }

  return {
    checkedAt,
    ok,
    accessMode,
    message,
    source,
  };
}

function normalizeProfiles(value: unknown): Record<string, KampusProfile> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const profiles = Object.entries(value as Record<string, unknown>)
    .map(([, entry]) => normalizeProfileInput(entry))
    .filter((entry): entry is KampusProfile => entry != null);

  if (!profiles.length) {
    return undefined;
  }

  return Object.fromEntries(
    profiles.map((profile) => [normalizeProfileKey(profile.name)!, profile]),
  );
}

function normalizeProfileInput(value: unknown): KampusProfile | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as {
    name?: unknown;
    school?: unknown;
    grade?: unknown;
    classNo?: unknown;
    teacherName?: unknown;
    notes?: unknown;
    updatedAt?: unknown;
  };

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return undefined;
  }

  return {
    name,
    school: normalizeStoredSchool(raw.school),
    grade: normalizePositiveInteger(raw.grade),
    classNo: normalizePositiveInteger(raw.classNo),
    teacherName: typeof raw.teacherName === 'string' ? raw.teacherName.trim() || undefined : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes.trim() || undefined : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt.trim() || undefined : undefined,
  };
}

function normalizeProfileKey(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

function normalizeCachePolicy(value: unknown): KampusCachePolicy | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as {
    datasetTtlMinutes?: unknown;
    staleIfErrorHours?: unknown;
    maxEntries?: unknown;
  };

  const normalized: KampusCachePolicy = {
    datasetTtlMinutes: normalizePositiveInteger(raw.datasetTtlMinutes),
    staleIfErrorHours: normalizePositiveInteger(raw.staleIfErrorHours),
    maxEntries: normalizePositiveInteger(raw.maxEntries),
  };

  if (
    normalized.datasetTtlMinutes == null &&
    normalized.staleIfErrorHours == null &&
    normalized.maxEntries == null
  ) {
    return undefined;
  }

  return normalized;
}

function normalizeSecretStorage(value: unknown): KampusSecretStorage | undefined {
  return value === 'plain-text' || value === 'windows-dpapi' ? value : undefined;
}

function isAccessMode(value: unknown): value is AccessMode {
  return value === 'official-full' || value === 'official-limited' || value === 'unofficial';
}

