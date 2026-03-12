import { KampusClient, resolveCachePolicy, resolveKampusCachePath, resolveNeisApiKey } from '@kampus/core';
import { ComciganProvider } from '@kampus/provider-comcigan';
import { NeisProvider } from '@kampus/provider-neis';

let cachedClient: KampusClient | null = null;

/**
 * Create or return a cached KampusClient with default providers.
 */
export function createClient(): KampusClient {
  if (cachedClient) return cachedClient;

  const cachePolicy = resolveCachePolicy();
  const comcigan = new ComciganProvider();
  const neis = new NeisProvider({
    apiKey: resolveNeisApiKey(),
    cachePath: resolveKampusCachePath(),
    cacheTtlMs: cachePolicy.datasetTtlMinutes * 60 * 1000,
    staleIfErrorMs: cachePolicy.staleIfErrorHours * 60 * 60 * 1000,
    cacheMaxEntries: cachePolicy.maxEntries,
  });

  cachedClient = new KampusClient({
    providers: [comcigan, neis],
  });

  return cachedClient;
}
