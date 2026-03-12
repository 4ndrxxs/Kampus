import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComciganProvider } from './provider.js';

const KEY_SCHOOL_SEARCH = '\uD559\uAD50\uAC80\uC0C9';
const KEY_CLASS_COUNTS = '\uD559\uAE09\uC218';
const KEY_TEACHERS = '\uC790\uB8CC446';
const KEY_SUBJECTS = '\uC790\uB8CC492';
const KEY_ORIGINAL_TIMETABLE = '\uC790\uB8CC481';
const KEY_CURRENT_TIMETABLE = '\uC790\uB8CC147';
const KEY_SPLIT = '\uBD84\uB9AC';
const KEY_TOTAL_GRADES = '\uC804\uCCB4\uD559\uB144';
const KEY_CLASS_TIMES = '\uC77C\uACFC\uC2DC\uAC04';

const BASE_URL = 'http://comci.test';
const ROUTE_SOURCE = `
  function school_ra(sc){$.ajax({ url:'./98765?43210l'+sc,});}
  $('#scnm').empty().append(scnm);sc_data('55555_',sc,1,'0');
`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ComciganProvider', () => {
  it('uses the timetable school code from search results and dynamic routes from /st', async () => {
    const fetchMock = mockFetch({
      [`${BASE_URL}/st`]: ROUTE_SOURCE,
      [`${BASE_URL}/98765?43210l%B0%E6%B1%E2%BA%CF%B0%FA%C7%D0%B0%ED`]:
        JSON.stringify({
          [KEY_SCHOOL_SEARCH]: [[24966, '\uACBD\uAE30', '\uACBD\uAE30\uBD81\uACFC\uD559\uACE0\uB4F1\uD559\uAD50', 12045]],
        }) + '\u0000\u0000',
    });

    const provider = new ComciganProvider({ baseUrl: BASE_URL });
    const results = await provider.searchSchools('\uACBD\uAE30\uBD81\uACFC\uD559\uACE0');

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${BASE_URL}/st`);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${BASE_URL}/98765?43210l%B0%E6%B1%E2%BA%CF%B0%FA%C7%D0%B0%ED`,
    );
    expect(results).toEqual([
      {
        name: '\uACBD\uAE30\uBD81\uACFC\uD559\uACE0\uB4F1\uD559\uAD50',
        region: '\uACBD\uAE30',
        providerRefs: {
          comcigan: {
            schoolCode: 12045,
          },
        },
        sourceProviders: ['comcigan'],
      },
    ]);
  });

  it('prefers current timetable data, decodes split-aware subjects, and parses string class times', async () => {
    mockFetch({
      [`${BASE_URL}/st`]: ROUTE_SOURCE,
      [`${BASE_URL}/98765_T?NTU1NTVfMTIwNDVfMF8x`]:
        JSON.stringify({
          [KEY_CLASS_COUNTS]: [0, 1],
          [KEY_TEACHERS]: ['*', 'Kim', 'Lee'],
          [KEY_SUBJECTS]: [3, '\uAD6D\uC5B4', '\uC218\uD559', '\uC0DD\uBB3C'],
          [KEY_ORIGINAL_TIMETABLE]: [1, [1, [5, [1, 0], [1, 0], [1, 0], [1, 0], [1, 0]]]],
          [KEY_CURRENT_TIMETABLE]: [
            1,
            [
              1,
              [
                5,
                [1, 1003002],
                [1, 3001],
                [1, 0],
                [1, 0],
                [1, 0],
              ],
            ],
          ],
          [KEY_TOTAL_GRADES]: 1,
          [KEY_SPLIT]: 1000,
          [KEY_CLASS_TIMES]: ['1(09:10)', '2(10:10)', '3(11:10)'],
        }) + '\u0000',
    });

    const provider = new ComciganProvider({ baseUrl: BASE_URL });
    const school = {
      name: '\uD14C\uC2A4\uD2B8\uACE0',
      region: '\uACBD\uAE30',
      providerRefs: {
        comcigan: {
          schoolCode: 12045,
        },
      },
    };

    const week = await provider.getWeekTimetable({
      school,
      grade: 1,
      classNo: 1,
    });
    const classTimes = await provider.getClassTimes(school);

    expect(week.days[0].periods).toHaveLength(1);
    expect(week.days[0].periods[0]).toMatchObject({
      period: 1,
      subject: 'A_\uC0DD\uBB3C',
      teacher: 'Lee',
      source: {
        rawCodes: {
          encoded: 1003002,
          originalEncoded: '',
          subjectIdx: 3,
          teacherIdx: 2,
          splitValue: 1000,
          subjectSection: 1,
        },
      },
    });
    expect(week.days[1].periods[0]).toMatchObject({
      subject: '\uC0DD\uBB3C',
      teacher: 'Kim',
    });
    expect(classTimes).toEqual([
      { period: 1, startTime: '09:10', endTime: '10:10' },
      { period: 2, startTime: '10:10', endTime: '11:10' },
      { period: 3, startTime: '11:10', endTime: '11:10' },
    ]);
  });

  it('falls back to the legacy split=100 encoding when payload does not expose the new format', async () => {
    mockFetch({
      [`${BASE_URL}/st`]: ROUTE_SOURCE,
      [`${BASE_URL}/98765_T?NTU1NTVfMTAwMDBfMF8x`]:
        JSON.stringify({
          [KEY_CLASS_COUNTS]: [0, 1],
          [KEY_TEACHERS]: ['*', 'Kim', 'Lee'],
          [KEY_SUBJECTS]: [3, '\uAD6D\uC5B4', '\uC218\uD559', '\uACFC\uD559'],
          [KEY_ORIGINAL_TIMETABLE]: [1, [1, [5, [1, 203], [1, 0], [1, 0], [1, 0], [1, 0]]]],
          [KEY_TOTAL_GRADES]: 1,
          [KEY_SPLIT]: 100,
        }),
    });

    const provider = new ComciganProvider({ baseUrl: BASE_URL });
    const week = await provider.getWeekTimetable({
      school: {
        name: '\uB808\uAC70\uC2DC\uACE0',
        providerRefs: {
          comcigan: {
            schoolCode: 10000,
          },
        },
      },
      grade: 1,
      classNo: 1,
    });

    expect(week.days[0].periods[0]).toMatchObject({
      subject: '\uACFC\uD559',
      teacher: 'Lee',
      source: {
        rawCodes: {
          encoded: 203,
          subjectIdx: 3,
          teacherIdx: 2,
          splitValue: 100,
          subjectSection: 0,
        },
      },
    });
  });
});

function mockFetch(routes: Record<string, string>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const body = routes[url];
    if (body == null) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(body, { status: 200 });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
