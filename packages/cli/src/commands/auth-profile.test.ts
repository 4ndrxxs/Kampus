import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCliInProcess } from '../test-helpers.js';

describe('CLI auth and profile contracts', () => {
  it('stores auth status with a structured login payload', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'kampus-cli-auth-'));
    const login = await runCliInProcess(
      ['auth', 'login', '--api-key', 'test-key', '--skip-validate', '--json'],
      { APPDATA: appData, NEIS_API_KEY: '' },
    );
    expect(login.status).toBe(0);

    const payload = JSON.parse(login.stdout);
    expect(payload).toMatchObject({
      ok: true,
      configured: true,
      preview: 'te***ey',
    });
    const expectsDpapi = process.platform === 'win32' && payload.storageMode === 'windows-dpapi';
    expect(['plain-text', 'windows-dpapi']).toContain(payload.storageMode);
    if (expectsDpapi) {
      expect(payload.warnings).toEqual([]);
    } else {
      expect(payload.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('plain-text config')]),
      );
    }

    const status = await runCliInProcess(['auth', 'status', '--json'], { APPDATA: appData, NEIS_API_KEY: '' });
    expect(status.status).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      configured: true,
      stored: true,
      readable: true,
      source: 'config',
      storageMode: payload.storageMode,
    });

    const config = JSON.parse(
      readFileSync(join(appData, 'Kampus', 'config.json'), 'utf8').replace(/^\uFEFF/, ''),
    );
    expect(config.neisApiKeyStorage).toBe(payload.storageMode);
    if (payload.storageMode === 'windows-dpapi') {
      expect(config.neisApiKey).not.toBe('test-key');
    } else {
      expect(config.neisApiKey).toBe('test-key');
    }
  }, 20000);

  it('migrates a legacy plain-text config key through auth migrate', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'kampus-cli-auth-migrate-'));
    const configPath = join(appData, 'Kampus', 'config.json');
    mkdirSync(join(appData, 'Kampus'), { recursive: true });
    writeFileSync(
      configPath,
      `${'\uFEFF'}${JSON.stringify({ neisApiKey: 'legacy-key', neisApiKeyStorage: 'plain-text' }, null, 2)}\n`,
      'utf8',
    );

    const migrate = await runCliInProcess(['auth', 'migrate', '--json'], { APPDATA: appData, NEIS_API_KEY: '' });
    expect(migrate.status).toBe(0);
    expect(JSON.parse(migrate.stdout)).toMatchObject({
      ok: true,
      configured: true,
    });

    const stored = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
    expect(['plain-text', 'windows-dpapi']).toContain(stored.neisApiKeyStorage);
    if (stored.neisApiKeyStorage === 'windows-dpapi') {
      expect(stored.neisApiKey).not.toBe('legacy-key');
      return;
    }

    expect(stored.neisApiKey).toBe('legacy-key');
  });

  it('reports embedded project and developer metadata as read-only config output', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'kampus-cli-config-meta-'));

    const show = await runCliInProcess(['config', 'show', '--json'], { APPDATA: appData, NEIS_API_KEY: '' });
    expect(show.status).toBe(0);
    expect(JSON.parse(show.stdout)).toMatchObject({
      projectInfo: {
        name: 'Kampus',
        repositoryUrl: 'https://github.com/4ndrxxs/Kampus',
      },
      developerInfo: {
        name: 'Juwon Seo',
        email: 'contact@seojuwon.com',
        url: 'https://github.com/4ndrxxs',
      },
    });
  }, 20000);

  it('supports structured profile commands and yaml output', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'kampus-cli-profile-'));
    const save = await runCliInProcess(
      ['profile', 'save', 'demo', '--grade', '3', '--class', '5', '--teacher', 'Kim', '--activate', '--json'],
      { APPDATA: appData, NEIS_API_KEY: '' },
    );
    expect(save.status).toBe(0);
    expect(JSON.parse(save.stdout)).toMatchObject({
      ok: true,
      active: true,
      profile: {
        name: 'demo',
        grade: 3,
        classNo: 5,
        teacherName: 'Kim',
      },
    });

    const show = await runCliInProcess(['profile', 'show', '--json'], { APPDATA: appData, NEIS_API_KEY: '' });
    expect(show.status).toBe(0);
    expect(JSON.parse(show.stdout)).toMatchObject({
      name: 'demo',
      grade: 3,
      classNo: 5,
      teacherName: 'Kim',
    });

    const list = await runCliInProcess(['profile', 'list', '--format', 'yaml'], { APPDATA: appData, NEIS_API_KEY: '' });
    expect(list.status).toBe(0);
    expect(list.stdout).toContain('activeProfile: "demo"');
    expect(list.stdout).toContain('name: "demo"');
  }, 20000);
});
