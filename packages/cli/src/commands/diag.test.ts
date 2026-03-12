import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../program.js';

const COMCIGAN_BASE = 'http://comci.net:4082';
const COMCIGAN_ROUTE_SOURCE = `
  function school_ra(sc){$.ajax({ url:'./98765?43210l'+sc,});}
  $('#scnm').empty().append(scnm);sc_data('55555_',sc,1,'0');
`;
const SMOKE_KEYWORD = '\uACBD\uAE30\uBD81\uACFC\uD559\uACE0';
const SMOKE_SEARCH_URL = `${COMCIGAN_BASE}/98765?43210l%B0%E6%B1%E2%BA%CF%B0%FA%C7%D0%B0%ED`;
const HIGH_SCHOOL = '\uACE0\uB4F1\uD559\uAD50';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('doctor command', () => {
  it('reports official timetable lag warnings in live JSON output', async () => {
    vi.stubEnv('APPDATA', mkdtempSync(join(tmpdir(), 'kampus-cli-diag-')));
    vi.stubEnv('NEIS_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => mockFetchResponse(String(input))));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const program = createProgram();

    await program.parseAsync(['node', 'kps', 'doctor', '--live', '--json']);

    expect(logSpy).toHaveBeenCalled();
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? '{}'));
    expect(payload.ok).toBe(true);
    expect(payload.live).toBe(true);
    expect(payload.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'neis',
          configured: true,
          expectedAccessMode: 'official-full',
          live: expect.objectContaining({
            ok: true,
            subchecks: expect.arrayContaining([
              expect.objectContaining({
                name: 'official-timetable-probe',
                ok: true,
                dataStatus: expect.objectContaining({
                  warnings: expect.arrayContaining([
                    expect.objectContaining({ code: 'NEIS_TIMETABLE_NO_DATA' }),
                    expect.objectContaining({ code: 'NEIS_TIMETABLE_YEAR_LAG' }),
                  ]),
                }),
              }),
            ]),
          }),
        }),
      ]),
    );
    expect(payload.recommendations).toContain(
      'Official NEIS timetable data appears to lag behind the current academic year for the smoke school.',
    );
  });

  it('recommends migrating plain-text config keys on Windows doctor output', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'kampus-cli-diag-plain-'));
    const kampusDir = join(appData, 'Kampus');
    mkdirSync(kampusDir, { recursive: true });
    writeFileSync(
      join(kampusDir, 'config.json'),
      `${'\uFEFF'}${JSON.stringify({ neisApiKey: 'legacy-key', neisApiKeyStorage: 'plain-text' }, null, 2)}\n`,
      'utf8',
    );

    vi.stubEnv('APPDATA', appData);
    vi.stubEnv('NEIS_API_KEY', '');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const program = createProgram();
    await program.parseAsync(['node', 'kps', 'doctor', '--json']);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? '{}'));
    if (process.platform === 'win32') {
      expect(payload.recommendations).toContain(
        'The saved NEIS key is still plain text. Run "kps auth migrate" to upgrade it to Windows DPAPI protection.',
      );
    } else {
      expect(payload.recommendations).toContain(
        'The saved NEIS key is stored as plain text on this platform. Prefer NEIS_API_KEY environment variables or an external secret manager for production use.',
      );
    }
  });
});

function mockFetchResponse(url: string): Response {
  if (url === `${COMCIGAN_BASE}/st`) {
    return new Response(COMCIGAN_ROUTE_SOURCE, { status: 200 });
  }

  if (url === SMOKE_SEARCH_URL) {
    return new Response(
      JSON.stringify({
        '\uD559\uAD50\uAC80\uC0C9': [[24966, '\uACBD\uAE30', '\uACBD\uAE30\uBD81\uACFC\uD559\uACE0\uB4F1\uD559\uAD50', 12045]],
      }),
      { status: 200 },
    );
  }

  const requestUrl = new URL(url);
  if (requestUrl.origin !== 'https://open.neis.go.kr') {
    return new Response('Not Found', { status: 404 });
  }

  if (requestUrl.pathname.endsWith('/schoolInfo') && requestUrl.searchParams.get('SCHUL_NM') === SMOKE_KEYWORD) {
    return new Response(
      JSON.stringify({
        schoolInfo: [
          {
            head: [
              { list_total_count: 1 },
              { RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' } },
            ],
          },
          {
            row: [
              {
                ATPT_OFCDC_SC_CODE: 'J10',
                SD_SCHUL_CODE: '7530851',
                SCHUL_NM: '\uACBD\uAE30\uBD81\uACFC\uD559\uACE0\uB4F1\uD559\uAD50',
                SCHUL_KND_SC_NM: HIGH_SCHOOL,
                LCTN_SC_NM: '\uACBD\uAE30\uB3C4',
              },
            ],
          },
        ],
      }),
      { status: 200 },
    );
  }

  if (requestUrl.pathname.endsWith('/hisTimetable')) {
    const academicYear = requestUrl.searchParams.get('AY');
    if (academicYear === '2025') {
      return new Response(
        JSON.stringify({
          hisTimetable: [
            {
              head: [
                { list_total_count: 1 },
                { RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' } },
              ],
            },
            {
              row: [
                {
                  AY: '2025',
                  ALL_TI_YMD: '20250303',
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        RESULT: {
          CODE: 'INFO-200',
          MESSAGE: 'no data',
        },
      }),
      { status: 200 },
    );
  }

  return new Response('Not Found', { status: 404 });
}
