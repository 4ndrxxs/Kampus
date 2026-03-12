import { describe, expect, it } from 'vitest';
import { alignSettingsState, applyQueryEdit } from './index.js';
import { createInitialSettingsState, type HumanSessionContext } from './types.js';

describe('tui settings alignment', () => {
  it('aligns to the active profile and current school after session refresh', () => {
    const session = createSessionContext();

    const aligned = alignSettingsState(createInitialSettingsState(), session);

    expect(aligned.profileIndex).toBe(1);
    expect(aligned.recentSchoolIndex).toBe(1);
    expect(aligned.section).toBe('profiles');
  });

  it('keeps recent-schools focus when recent schools exist', () => {
    const session = createSessionContext();

    const aligned = alignSettingsState(
      {
        section: 'recent-schools',
        profileIndex: 0,
        recentSchoolIndex: 0,
        actionIndex: 0,
      },
      session,
    );

    expect(aligned.section).toBe('recent-schools');
    expect(aligned.recentSchoolIndex).toBe(1);
  });

  it('clears stale search results when the query changes', () => {
    const next = applyQueryEdit(
      {
        query: '경기북과학고',
        dirty: false,
        results: [
          {
            name: '경기북과학고등학교',
            region: '경기',
            providerRefs: {},
            sourceProviders: ['neis'],
          },
        ],
        selectedIndex: 1,
      },
      '',
    );

    expect(next).toMatchObject({
      query: '',
      dirty: true,
      results: [],
      selectedIndex: 0,
      error: undefined,
    });
  });
});

function createSessionContext(): HumanSessionContext {
  return {
    checkedAt: '2026-03-12T00:00:00.000Z',
    configStatus: {
      configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Kampus\\config.json',
      neisApiKeyConfigured: true,
      neisApiKeyStored: true,
      neisApiKeyReadable: true,
      neisApiKeySource: 'config',
      recentSchools: [],
      profiles: [
        {
          name: 'default',
          grade: 1,
          classNo: 1,
        },
        {
          name: 'science-3-5',
          grade: 3,
          classNo: 5,
        },
      ],
      activeProfile: {
        name: 'science-3-5',
        grade: 3,
        classNo: 5,
      },
      cachePolicy: {
        datasetTtlMinutes: 15,
        staleIfErrorHours: 24,
        maxEntries: 250,
      },
    },
    activeProfile: {
      name: 'science-3-5',
      grade: 3,
      classNo: 5,
      school: {
        name: 'Sample Science High School',
        region: 'Seoul',
        providerRefs: {},
      },
    },
    selectedSchool: {
      name: 'Sample Science High School',
      region: 'Seoul',
      providerRefs: {},
      sourceProviders: ['neis'],
    },
    grade: 3,
    classNo: 5,
    teacherName: 'Kim',
    recentSchools: [
      {
        name: 'Another High School',
        region: 'Seoul',
        providerRefs: {},
        sourceProviders: ['comcigan'],
      },
      {
        name: 'Sample Science High School',
        region: 'Seoul',
        providerRefs: {},
        sourceProviders: ['neis'],
      },
    ],
    notes: [],
  };
}
