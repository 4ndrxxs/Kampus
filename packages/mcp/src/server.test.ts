import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvalidInputError, type KampusClient } from '@kampus/core';
import { createServer } from './server.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('createServer', () => {
  it('registers the expected MCP tools', () => {
    const server = createServer({} as KampusClient) as unknown as {
      _registeredTools: Record<string, unknown>;
    };

    expect(Object.keys(server._registeredTools)).toEqual(
      expect.arrayContaining([
        'search_schools',
        'get_school_info',
        'get_student_timetable_today',
        'get_student_timetable_day',
        'get_student_timetable_week',
        'get_teacher_timetable',
        'get_teacher_info',
        'get_next_class',
        'get_class_times',
        'get_meals_today',
        'get_meals_week',
        'get_neis_dataset',
        'diff_timetable_snapshots',
      ]),
    );
  });

  it('returns structured success payloads from tool handlers', async () => {
    const client = {
      searchSchools: async () => [
        {
          name: 'Sample High School',
          region: 'Seoul',
          schoolType: 'High School',
          providerRefs: {},
          sourceProviders: [],
        },
      ],
    } as unknown as KampusClient;

    const server = createServer(client) as unknown as {
      _registeredTools: Record<string, { handler: (input: unknown) => Promise<{ structuredContent: unknown }> }>;
    };

    const result = await server._registeredTools.search_schools.handler({ keyword: 'Sample' });
    expect(result.structuredContent).toEqual({
      ok: true,
      schools: [
        {
          name: 'Sample High School',
          region: 'Seoul',
          schoolType: 'High School',
          providerRefs: {},
          sourceProviders: [],
        },
      ],
    });
  });

  it('returns structured error payloads from tool handlers', async () => {
    const client = {
      searchSchools: async () => {
        throw new InvalidInputError('bad keyword');
      },
    } as unknown as KampusClient;

    const server = createServer(client) as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (input: unknown) => Promise<{ isError?: boolean; structuredContent: unknown }>;
        }
      >;
    };

    const result = await server._registeredTools.search_schools.handler({ keyword: '' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'bad keyword',
      },
    });
  });

  it('returns dataset metadata in structured NEIS payloads', async () => {
    vi.stubEnv('APPDATA', mkdtempSync(join(tmpdir(), 'kampus-mcp-neis-')));
    vi.stubEnv('NEIS_API_KEY', '');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          acaInsTiInfo: [
            {
              head: [
                { list_total_count: 1 },
                { RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' } },
              ],
            },
            {
              row: [{ ACA_NM: 'Sample Academy' }],
            },
          ],
        }),
      }),
    );

    const server = createServer({} as KampusClient) as unknown as {
      _registeredTools: Record<string, { handler: (input: unknown) => Promise<{ structuredContent: unknown }> }>;
    };

    const result = await server._registeredTools.get_neis_dataset.handler({
      dataset: 'acaInsTiInfo',
      filters: { ACA_NM: 'Sample Academy' },
    });

    expect(result.structuredContent).toEqual({
      ok: true,
      dataset: 'acaInsTiInfo',
      rows: [{ ACA_NM: 'Sample Academy' }],
      totalCount: 1,
      providerMetadata: expect.objectContaining({
        provider: 'neis',
        fetchedAt: expect.any(String),
      }),
      dataStatus: {
        accessMode: 'official-limited',
        complete: true,
        sourceProviders: ['neis'],
        warnings: expect.arrayContaining([
          expect.objectContaining({ code: 'NEIS_KEYLESS_LIMITED' }),
        ]),
      },
    });
  });
});
