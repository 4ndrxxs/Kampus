import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderUnavailableError } from '@kampus/core';
import { NeisProvider } from './provider.js';

const HIGH_SCHOOL = '\uACE0\uB4F1\uD559\uAD50';
const MIDDLE_SCHOOL = '\uC911\uD559\uAD50';
const DAY_COURSE = '\uC8FC\uAC04';
const GENERAL_TRACK = '\uC77C\uBC18';
const SCIENCE_DEPARTMENT = '\uACFC\uD559\uACFC';
const MATH_SUBJECT = '\uC218\uD559';

describe('NeisProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses official limited mode without a key for search and marks truncation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schoolInfo: [
          {
            head: [
              { list_total_count: 8 },
              { RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' } },
            ],
          },
          {
            row: [
              {
                SCHUL_NM: 'Sample High School',
                LCTN_SC_NM: 'Seoul',
                SCHUL_KND_SC_NM: HIGH_SCHOOL,
                ATPT_OFCDC_SC_CODE: 'B10',
                SD_SCHUL_CODE: '1234567',
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new NeisProvider({ apiKey: '' });
    const schools = await provider.searchSchools('Sample');
    const dataset = await provider.getDatasetResult('schoolInfo', {
      SCHUL_NM: 'Sample',
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/schoolInfo?Type=json'));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('KEY='));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(schools).toEqual([
      {
        name: 'Sample High School',
        region: 'Seoul',
        schoolType: HIGH_SCHOOL,
        providerRefs: {
          neis: {
            officeCode: 'B10',
            schoolCode: '1234567',
          },
        },
        sourceProviders: ['neis'],
      },
    ]);
    expect(dataset.dataStatus).toMatchObject({
      accessMode: 'official-limited',
      complete: false,
    });
    expect(dataset.dataStatus.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NEIS_KEYLESS_LIMITED' }),
        expect.objectContaining({ code: 'NEIS_TRUNCATED' }),
      ]),
    );
  });

  it('auto-pages keyed dataset requests until the total count is satisfied', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('pIndex=2')) {
        return {
          ok: true,
          json: async () => ({
            schoolInfo: [
              {
                head: [
                  { list_total_count: 2 },
                  { RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' } },
                ],
              },
              {
                row: [
                  {
                    SCHUL_NM: 'Sample High School 2',
                    LCTN_SC_NM: 'Seoul',
                    SCHUL_KND_SC_NM: 'High School',
                    ATPT_OFCDC_SC_CODE: 'B10',
                    SD_SCHUL_CODE: '2345678',
                  },
                ],
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          schoolInfo: [
            {
              head: [
                { list_total_count: 2 },
                { RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' } },
              ],
            },
            {
              row: [
                {
                  SCHUL_NM: 'Sample High School 1',
                  LCTN_SC_NM: 'Seoul',
                  SCHUL_KND_SC_NM: 'High School',
                  ATPT_OFCDC_SC_CODE: 'B10',
                  SD_SCHUL_CODE: '1234567',
                },
              ],
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new NeisProvider({ apiKey: 'test-key' });
    const result = await provider.getDatasetResult('schoolInfo', {
      SCHUL_NM: 'Sample',
      pSize: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('pIndex=2');
    expect(result.rows).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.dataStatus).toMatchObject({
      accessMode: 'official-full',
      complete: true,
    });
  });

  it('maps classInfo rows into normalized records and preserves full mode metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        classInfo: [
          {
            head: [
              { list_total_count: 1 },
              { RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' } },
            ],
          },
          {
            row: [
              {
                AY: '2026',
                GRADE: '3',
                CLASS_NM: '5',
                SCHUL_CRSE_SC_NM: HIGH_SCHOOL,
                DGHT_CRSE_SC_NM: DAY_COURSE,
                ORD_SC_NM: GENERAL_TRACK,
                DDDEP_NM: SCIENCE_DEPARTMENT,
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new NeisProvider({ apiKey: 'test-key' });
    const result = await provider.getClassInfoResult({
      school: {
        name: 'Sample High School',
        schoolType: HIGH_SCHOOL,
        providerRefs: {
          neis: {
            officeCode: 'J10',
            schoolCode: '7530000',
          },
        },
      },
      year: '2026',
      grade: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('KEY=test-key'));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/classInfo?'));
    expect(result.dataStatus).toMatchObject({
      accessMode: 'official-full',
      complete: true,
    });
    expect(result.rows).toEqual([
      expect.objectContaining({
        year: '2026',
        grade: 3,
        className: '5',
        schoolCourseName: HIGH_SCHOOL,
        dayNightCourseName: DAY_COURSE,
        trackName: GENERAL_TRACK,
        departmentName: SCIENCE_DEPARTMENT,
      }),
    ]);
  });

  it('selects the official timetable endpoint from the school type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        misTimetable: [
          {
            head: [
              { list_total_count: 1 },
              { RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' } },
            ],
          },
          {
            row: [
              {
                ALL_TI_YMD: '20260312',
                GRADE: '2',
                CLASS_NM: '3',
                PERIO: '4',
                ITRT_CNTNT: MATH_SUBJECT,
                CLRM_NM: '2-3',
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new NeisProvider({ apiKey: 'test-key' });
    const result = await provider.getOfficialTimetableResult({
      school: {
        name: 'Test Middle School',
        schoolType: MIDDLE_SCHOOL,
        providerRefs: {
          neis: {
            officeCode: 'J10',
            schoolCode: '7530001',
          },
        },
      },
      date: '2026-03-12',
      grade: 2,
      className: '3',
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/misTimetable?'));
    expect(result.rows).toEqual([
      expect.objectContaining({
        date: '2026-03-12',
        grade: 2,
        className: '3',
        period: 4,
        content: MATH_SUBJECT,
        classroomName: '2-3',
      }),
    ]);
  });

  it('surfaces invalid API keys as provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        RESULT: {
          CODE: 'ERROR-290',
          MESSAGE: 'invalid key',
        },
      }),
    }));

    const provider = new NeisProvider({ apiKey: 'bad-key' });
    await expect(provider.getDatasetResult('schoolInfo', { SCHUL_NM: 'Sample' })).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('treats INFO-200 as an empty dataset instead of a provider failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        RESULT: {
          CODE: 'INFO-200',
          MESSAGE: 'no data',
        },
      }),
    }));

    const provider = new NeisProvider({ apiKey: 'test-key' });
    const result = await provider.getDatasetResult('hisTimetable', {
      ATPT_OFCDC_SC_CODE: 'J10',
      SD_SCHUL_CODE: '7530851',
    });

    expect(result.rows).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.dataStatus).toMatchObject({
      accessMode: 'official-full',
      complete: true,
    });
  });

  it('adds a year-lag warning when the previous academic year exists', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(url);
      if (requestUrl.searchParams.get('AY') === '2025' && requestUrl.searchParams.get('pSize') === '1') {
        return {
          ok: true,
          json: async () => ({
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
        };
      }

      return {
        ok: true,
        json: async () => ({
          RESULT: {
            CODE: 'INFO-200',
            MESSAGE: 'no data',
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new NeisProvider({ apiKey: 'test-key' });
    const result = await provider.getOfficialTimetableResult({
      school: {
        name: 'Sample High School',
        schoolType: 'High School',
        providerRefs: {
          neis: {
            officeCode: 'J10',
            schoolCode: '7530851',
          },
        },
      },
      year: '2026',
      grade: 3,
      className: '5',
      date: '2026-03-12',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.rows).toEqual([]);
    expect(result.dataStatus.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NEIS_TIMETABLE_NO_DATA' }),
        expect.objectContaining({ code: 'NEIS_TIMETABLE_YEAR_LAG' }),
      ]),
    );
  });

  it('adds a filter warning when the same academic year has school-wide timetable rows', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(url);
      if (requestUrl.searchParams.get('AY') === '2025' && requestUrl.searchParams.get('pSize') === '1') {
        return {
          ok: true,
          json: async () => ({
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
                    ALL_TI_YMD: '20250317',
                  },
                ],
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          RESULT: {
            CODE: 'INFO-200',
            MESSAGE: 'no data',
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new NeisProvider({ apiKey: 'test-key' });
    const result = await provider.getOfficialTimetableResult({
      school: {
        name: 'Sample High School',
        schoolType: 'High School',
        providerRefs: {
          neis: {
            officeCode: 'J10',
            schoolCode: '7530851',
          },
        },
      },
      year: '2025',
      grade: 9,
      className: '99',
      date: '2025-03-12',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.rows).toEqual([]);
    expect(result.dataStatus.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NEIS_TIMETABLE_NO_DATA' }),
        expect.objectContaining({ code: 'NEIS_TIMETABLE_FILTER_NO_MATCH' }),
      ]),
    );
  });

  it('returns a stale cached dataset when the live request fails', async () => {
    const cachePath = join(mkdtempSync(join(tmpdir(), 'kampus-neis-cache-')), 'cache.json');
    const successFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
                SCHUL_NM: 'Cached High School',
                LCTN_SC_NM: 'Seoul',
                SCHUL_KND_SC_NM: 'High School',
                ATPT_OFCDC_SC_CODE: 'B10',
                SD_SCHUL_CODE: '1234567',
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', successFetch);

    const warmProvider = new NeisProvider({
      apiKey: 'test-key',
      cachePath,
      cacheTtlMs: 10,
      staleIfErrorMs: 60_000,
    });
    await warmProvider.getDatasetResult('schoolInfo', { SCHUL_NM: 'Cached' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const staleProvider = new NeisProvider({
      apiKey: 'test-key',
      cachePath,
      cacheTtlMs: 0,
      staleIfErrorMs: 60_000,
    });
    const result = await staleProvider.getDatasetResult('schoolInfo', { SCHUL_NM: 'Cached' });

    expect(result.rows).toHaveLength(1);
    expect(result.providerMetadata).toMatchObject({
      cached: true,
    });
    expect(result.dataStatus.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NEIS_STALE_CACHE' }),
      ]),
    );
  });
});
