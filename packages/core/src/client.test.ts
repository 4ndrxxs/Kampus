import { describe, expect, it, vi } from 'vitest';
import { KampusClient } from './client.js';
import { normalizePeriod } from './normalize.js';
import { UNKNOWN_SUBJECT, type KampusProvider, type SchoolSearchResult } from './types.js';

function createNeisSchool(): SchoolSearchResult {
  return {
    name: 'Sample High School',
    region: 'Gyeonggi',
    schoolType: 'High School',
    providerRefs: {
      neis: {
        officeCode: 'J10',
        schoolCode: '7530123',
      },
    },
    sourceProviders: ['neis'],
  };
}

function createComciganSchool(): SchoolSearchResult {
  return {
    name: 'Sample High School',
    region: 'Gyeonggi',
    schoolType: 'High School',
    providerRefs: {
      comcigan: {
        schoolCode: 112233,
      },
    },
    sourceProviders: ['comcigan'],
  };
}

describe('normalizePeriod', () => {
  it('marks teacher-only periods as occupied with the unknown subject placeholder', () => {
    const period = normalizePeriod({
      period: 3,
      teacher: 'Kim',
      source: { provider: 'comcigan' },
    });

    expect(period.subject).toBe(UNKNOWN_SUBJECT);
    expect(period.status).toBe('unknown-subject');
    expect(period.isFreePeriod).toBe(false);
  });
});

describe('KampusClient', () => {
  it('merges search results across providers and enriches downstream calls', async () => {
    const neisSchool = createNeisSchool();
    const comciganSchool = createComciganSchool();

    const getSchoolInfo = vi.fn(async (school) => ({
      ...school,
      address: '1 Test Road',
    }));

    const getWeekTimetable = vi.fn(async ({ school, grade, classNo }) => ({
      school,
      grade,
      classNo,
      weekStart: '2026-03-09',
      days: [],
    }));

    const neisProvider: KampusProvider = {
      name: 'neis',
      capabilities: new Set(['schoolSearch', 'schoolInfo', 'meals']),
      searchSchools: vi.fn(async () => [neisSchool]),
      getSchoolInfo,
    };

    const comciganProvider: KampusProvider = {
      name: 'comcigan',
      capabilities: new Set([
        'schoolSearch',
        'studentTimetable',
        'teacherTimetable',
        'teacherInfo',
        'classTimes',
      ]),
      searchSchools: vi.fn(async () => [comciganSchool]),
      getWeekTimetable,
    };

    const client = new KampusClient({
      providers: [comciganProvider, neisProvider],
    });

    const searchResults = await client.searchSchools('Sample High School');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].providerRefs.neis?.schoolCode).toBe('7530123');
    expect(searchResults[0].providerRefs.comcigan?.schoolCode).toBe(112233);

    await client.getSchoolInfo({
      name: 'Sample High School',
      region: 'Gyeonggi',
      providerRefs: {},
    });
    expect(getSchoolInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRefs: expect.objectContaining({
          neis: {
            officeCode: 'J10',
            schoolCode: '7530123',
          },
        }),
      }),
    );

    await client.getWeekTimetable({
      school: {
        name: 'Sample High School',
        region: 'Gyeonggi',
        providerRefs: {
          neis: neisSchool.providerRefs.neis,
        },
      },
      grade: 3,
      classNo: 2,
    });
    expect(getWeekTimetable).toHaveBeenCalledWith(
      expect.objectContaining({
        school: expect.objectContaining({
          providerRefs: expect.objectContaining({
            neis: {
              officeCode: 'J10',
              schoolCode: '7530123',
            },
            comcigan: {
              schoolCode: 112233,
            },
          }),
        }),
      }),
    );
  });

  it('keeps school search working when one search provider fails', async () => {
    const neisProvider: KampusProvider = {
      name: 'neis',
      capabilities: new Set(['schoolSearch', 'schoolInfo', 'meals']),
      searchSchools: vi.fn(async () => [createNeisSchool()]),
    };

    const comciganProvider: KampusProvider = {
      name: 'comcigan',
      capabilities: new Set([
        'schoolSearch',
        'studentTimetable',
        'teacherTimetable',
        'teacherInfo',
        'classTimes',
      ]),
      searchSchools: vi.fn(async () => {
        throw new Error('search failed');
      }),
    };

    const client = new KampusClient({
      providers: [comciganProvider, neisProvider],
    });

    const results = await client.searchSchools('Sample High School');
    expect(results).toHaveLength(1);
    expect(results[0].providerRefs.neis?.schoolCode).toBe('7530123');
  });
});
