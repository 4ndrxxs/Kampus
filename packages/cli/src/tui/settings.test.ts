import { describe, expect, it } from 'vitest';
import {
  buildSettingsActions,
  buildSettingsDialog,
  cycleSettingsSection,
  isDestructiveSettingsAction,
  moveSettingsSelection,
} from './settings.js';
import type { HumanSessionContext } from './types.js';

describe('tui settings helpers', () => {
  it('cycles through settings sections in a stable order', () => {
    expect(cycleSettingsSection('profiles')).toBe('recent-schools');
    expect(cycleSettingsSection('recent-schools')).toBe('actions');
    expect(cycleSettingsSection('actions')).toBe('profiles');
  });

  it('moves the focused cursor inside the active section only', () => {
    const session = createSessionContext();

    expect(
      moveSettingsSelection(
        { section: 'profiles', profileIndex: 0, recentSchoolIndex: 0, actionIndex: 0 },
        session,
        1,
      ),
    ).toMatchObject({ profileIndex: 1, recentSchoolIndex: 0, actionIndex: 0 });

    expect(
      moveSettingsSelection(
        { section: 'recent-schools', profileIndex: 0, recentSchoolIndex: 0, actionIndex: 0 },
        session,
        1,
      ),
    ).toMatchObject({ profileIndex: 0, recentSchoolIndex: 1, actionIndex: 0 });

    expect(
      moveSettingsSelection(
        { section: 'actions', profileIndex: 0, recentSchoolIndex: 0, actionIndex: 0 },
        session,
        2,
      ),
    ).toMatchObject({ profileIndex: 0, recentSchoolIndex: 0, actionIndex: 2 });
  });

  it('builds action items with disabled state from the session context', () => {
    const session = createSessionContext();
    const actions = buildSettingsActions(session, {
      section: 'actions',
      profileIndex: 1,
      recentSchoolIndex: 0,
      actionIndex: 0,
    });

    expect(actions.map((action) => action.id)).toEqual([
      'save-active-profile',
      'save-shell-profile',
      'clear-active-profile',
      'clear-default-school',
      'remove-selected-profile',
      'remove-selected-recent-school',
      'refresh-session',
    ]);
    expect(actions.find((action) => action.id === 'save-active-profile')?.disabled).toBe(false);
    expect(actions.find((action) => action.id === 'save-shell-profile')?.disabled).toBe(false);
    expect(actions.find((action) => action.id === 'clear-active-profile')?.disabled).toBe(false);
    expect(actions.find((action) => action.id === 'remove-selected-profile')?.description).toContain(
      'science-3-5',
    );
  });

  it('builds confirmation dialogs only for destructive actions', () => {
    const session = createSessionContext();
    const state = {
      section: 'actions' as const,
      profileIndex: 1,
      recentSchoolIndex: 0,
      actionIndex: 0,
    };

    expect(isDestructiveSettingsAction('remove-selected-profile')).toBe(true);
    expect(isDestructiveSettingsAction('save-shell-profile')).toBe(false);
    expect(buildSettingsDialog('remove-selected-profile', session, state)).toMatchObject({
      title: 'Remove selected profile?',
      description: expect.stringContaining('science-3-5'),
    });
    expect(buildSettingsDialog('save-shell-profile', session, state)).toBeUndefined();
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
      defaultSchool: {
        name: 'Sample Science High School',
        region: 'Seoul',
        providerRefs: {},
      },
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
