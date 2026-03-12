import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  clearDefaultSchool,
  getActiveProfile,
  getKampusConfigStatus,
  listProfiles,
  loadKampusConfig,
  removeProfile,
  removeRecentSchool,
  rememberRecentSchool,
  resolveKampusConfigPath,
  resolveNeisApiKey,
  saveKampusConfig,
  setActiveProfile,
  setDefaultSchool,
  setNeisApiKeyStatus,
  upsertProfile,
} from './config.js';
import { KAMPUS_DEVELOPER_INFO, KAMPUS_PROJECT_INFO } from './metadata.js';

describe('kampus config', () => {
  it('prefers APPDATA when resolving the default config path', () => {
    const path = resolveKampusConfigPath({ APPDATA: 'C:\\Users\\tester\\AppData\\Roaming' });
    expect(path).toContain('C:\\Users\\tester\\AppData\\Roaming');
    expect(path).toContain('Kampus');
    expect(path.endsWith('config.json')).toBe(true);
  });

  it('loads and saves a normalized config file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kampus-config-'));
    const configPath = join(dir, 'config.json');

    saveKampusConfig(
      {
        neisApiKey: '  secret-key  ',
        neisApiKeyStorage: 'plain-text',
        defaultSchool: {
          name: ' Sample High School ',
          region: ' Seoul ',
          providerRefs: {
            neis: {
              officeCode: 'B10',
              schoolCode: '1234567',
            },
          },
        },
      },
      { configPath },
    );

    const savedText = readFileSync(configPath, 'utf8');
    expect(savedText.startsWith('\uFEFF')).toBe(true);
    expect(JSON.parse(savedText.replace(/^\uFEFF/, ''))).toEqual({
      neisApiKey: 'secret-key',
      neisApiKeyStorage: 'plain-text',
      defaultSchool: {
        name: 'Sample High School',
        region: 'Seoul',
        providerRefs: {
          neis: {
            officeCode: 'B10',
            schoolCode: '1234567',
          },
        },
      },
    });
    expect(loadKampusConfig({ configPath })).toEqual({
      neisApiKey: 'secret-key',
      neisApiKeyStoredValue: 'secret-key',
      neisApiKeyStorage: 'plain-text',
      neisApiKeyReadable: true,
      neisApiKeyError: undefined,
      defaultSchool: {
        name: 'Sample High School',
        region: 'Seoul',
        schoolType: undefined,
        providerRefs: {
          neis: {
            officeCode: 'B10',
            schoolCode: '1234567',
          },
        },
        lastUsedAt: undefined,
      },
      recentSchools: undefined,
    });
  });

  it('reports embedded project and developer metadata through config status', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kampus-config-'));
    const configPath = join(dir, 'config.json');

    saveKampusConfig({}, { configPath });

    expect(getKampusConfigStatus({ configPath, env: {} })).toMatchObject({
      projectInfo: KAMPUS_PROJECT_INFO,
      developerInfo: KAMPUS_DEVELOPER_INFO,
    });
  });

  it('ignores legacy project and developer metadata stored in user config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kampus-config-'));
    const configPath = join(dir, 'config.json');

    writeFileSync(
      configPath,
      `${'\uFEFF'}${JSON.stringify(
        {
          projectInfo: {
            name: 'Fake Project',
            repositoryUrl: 'https://example.com/fake',
          },
          developerInfo: {
            name: 'Fake Developer',
            email: 'fake@example.com',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    expect(loadKampusConfig({ configPath })).not.toHaveProperty('projectInfo');
    expect(loadKampusConfig({ configPath })).not.toHaveProperty('developerInfo');
    expect(getKampusConfigStatus({ configPath, env: {} })).toMatchObject({
      projectInfo: KAMPUS_PROJECT_INFO,
      developerInfo: KAMPUS_DEVELOPER_INFO,
    });
  });

  it('resolves the NEIS API key from env before config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kampus-config-'));
    const configPath = join(dir, 'config.json');
    saveKampusConfig({ neisApiKey: 'config-key', neisApiKeyStorage: 'plain-text' }, { configPath });

    expect(resolveNeisApiKey({ configPath, env: { NEIS_API_KEY: 'env-key' } })).toBe('env-key');
    expect(resolveNeisApiKey({ configPath, env: {} })).toBe('config-key');
  });

  it('stores default school and keeps recent schools deduplicated', () => {
    const config = setDefaultSchool(
      {},
      {
        name: 'Sample High School',
        region: 'Seoul',
        providerRefs: {
          neis: {
            officeCode: 'B10',
            schoolCode: '1234567',
          },
        },
      },
      { now: '2026-03-12T00:00:00.000Z' },
    );

    const updated = rememberRecentSchool(
      config,
      {
        name: 'Sample High School',
        region: 'Seoul',
        providerRefs: {
          comcigan: {
            schoolCode: 12045,
          },
        },
      },
      { now: '2026-03-12T00:05:00.000Z' },
    );

    expect(updated.defaultSchool).toMatchObject({
      name: 'Sample High School',
      region: 'Seoul',
    });
    expect(updated.recentSchools).toHaveLength(1);
    expect(updated.recentSchools?.[0]).toMatchObject({
      name: 'Sample High School',
      lastUsedAt: '2026-03-12T00:05:00.000Z',
    });
  });

  it('can clear the default school and remove a recent school entry', () => {
    const config = {
      defaultSchool: {
        name: 'Sample High School',
        region: 'Seoul',
        providerRefs: {},
      },
      recentSchools: [
        {
          name: 'Sample High School',
          region: 'Seoul',
          providerRefs: {},
        },
        {
          name: 'Another High School',
          region: 'Busan',
          providerRefs: {},
        },
      ],
    };

    const cleared = clearDefaultSchool(config);
    const pruned = removeRecentSchool(cleared, {
      name: 'Sample High School',
      region: 'Seoul',
    });

    expect(pruned.defaultSchool).toBeUndefined();
    expect(pruned.recentSchools).toEqual([
      {
        name: 'Another High School',
        region: 'Busan',
        providerRefs: {},
      },
    ]);
  });

  it('reports config status including default and recent schools', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kampus-config-'));
    const configPath = join(dir, 'config.json');
    saveKampusConfig(
      {
        neisApiKey: 'config-key',
        neisApiKeyStorage: 'plain-text',
        defaultSchool: {
          name: 'Sample High School',
          region: 'Seoul',
          providerRefs: {},
        },
        recentSchools: [
          {
            name: 'Sample High School',
            region: 'Seoul',
            providerRefs: {},
          },
        ],
      },
      { configPath },
    );

    expect(getKampusConfigStatus({ configPath, env: { NEIS_API_KEY: 'env-key' } })).toMatchObject({
      neisApiKeyConfigured: true,
      neisApiKeyStored: true,
      neisApiKeyReadable: true,
      neisApiKeySource: 'env',
      defaultSchool: {
        name: 'Sample High School',
      },
      recentSchools: [
        {
          name: 'Sample High School',
        },
      ],
    });
    expect(getKampusConfigStatus({ configPath, env: {} })).toMatchObject({
      neisApiKeyConfigured: true,
      neisApiKeyStored: true,
      neisApiKeyReadable: true,
      neisApiKeySource: 'config',
      neisApiKeyStorage: 'plain-text',
      defaultSchool: {
        name: 'Sample High School',
      },
      recentSchools: [
        {
          name: 'Sample High School',
        },
      ],
    });
  });

  it('stores, activates, and removes named profiles', () => {
    const config = upsertProfile(
      {},
      {
        name: 'science-3-5',
        school: {
          name: 'Sample High School',
          region: 'Seoul',
          providerRefs: {
            neis: {
              officeCode: 'B10',
              schoolCode: '1234567',
            },
          },
        },
        grade: 3,
        classNo: 5,
        teacherName: 'Kim',
      },
    );

    const activated = setActiveProfile(config, 'science-3-5');
    expect(getActiveProfile(activated)).toMatchObject({
      name: 'science-3-5',
      grade: 3,
      classNo: 5,
      teacherName: 'Kim',
      school: {
        name: 'Sample High School',
      },
    });
    expect(listProfiles(activated)).toHaveLength(1);

    const removed = removeProfile(activated, 'science-3-5');
    expect(getActiveProfile(removed)).toBeUndefined();
    expect(listProfiles(removed)).toEqual([]);
  });

  it('persists NEIS key validation status metadata', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kampus-config-'));
    const configPath = join(dir, 'config.json');

    saveKampusConfig(
      setNeisApiKeyStatus(
        {
          neisApiKey: 'config-key',
          neisApiKeyStorage: 'plain-text',
        },
        {
          checkedAt: '2026-03-12T00:00:00.000Z',
          ok: true,
          accessMode: 'official-full',
          message: 'validated',
          source: 'config',
        },
      ),
      { configPath },
    );

    expect(loadKampusConfig({ configPath }).neisApiKeyStatus).toEqual({
      checkedAt: '2026-03-12T00:00:00.000Z',
      ok: true,
      accessMode: 'official-full',
      message: 'validated',
      source: 'config',
    });
  });

  it('round-trips a Windows DPAPI stored key when available', () => {
    if (process.platform !== 'win32') {
      return;
    }

    const dir = mkdtempSync(join(tmpdir(), 'kampus-config-'));
    const configPath = join(dir, 'config.json');
    const saved = saveKampusConfig(
      {
        neisApiKey: 'dpapi-key',
        neisApiKeyStorage: 'windows-dpapi',
      },
      { configPath },
    );

    expect(saved.neisApiKey).toBe('dpapi-key');
    expect(saved.neisApiKeyStorage).toBe('windows-dpapi');
    expect(saved.neisApiKeyReadable).toBe(true);

    const raw = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
    expect(raw.neisApiKeyStorage).toBe('windows-dpapi');
    expect(raw.neisApiKey).not.toBe('dpapi-key');
  }, 20000);
});

