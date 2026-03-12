import { clamp } from './shortcuts.js';
import type {
  HumanSessionContext,
  SettingsActionId,
  SettingsActionItem,
  SettingsDialog,
  SettingsSection,
  SettingsState,
} from './types.js';

const SETTINGS_SECTIONS: SettingsSection[] = ['profiles', 'recent-schools', 'actions'];

export function buildSettingsActions(
  session: HumanSessionContext,
  state: SettingsState,
): SettingsActionItem[] {
  const selectedProfile = session.configStatus.profiles[state.profileIndex];
  const selectedRecentSchool = session.recentSchools[state.recentSchoolIndex];
  const canSaveSession = Boolean(
    session.selectedSchool || session.grade || session.classNo || session.teacherName,
  );

  return [
    {
      id: 'save-active-profile',
      label: 'Save current setup to active profile',
      description: session.activeProfile
        ? `Overwrite "${session.activeProfile.name}" with the current school, class, and teacher state.`
        : 'No active profile is selected right now.',
      disabled: !session.activeProfile || !canSaveSession,
    },
    {
      id: 'save-shell-profile',
      label: 'Save current setup to human-shell',
      description: canSaveSession
        ? 'Create or update the "human-shell" profile from the current shell state.'
        : 'Pick a school or class setup first, then save it as a reusable profile.',
      disabled: !canSaveSession,
    },
    {
      id: 'clear-active-profile',
      label: 'Clear active profile',
      description: session.activeProfile
        ? `Stop using "${session.activeProfile.name}" as the active profile.`
        : 'No active profile is selected right now.',
      disabled: !session.activeProfile,
    },
    {
      id: 'clear-default-school',
      label: 'Clear default school',
      description: session.configStatus.defaultSchool
        ? `Remove "${session.configStatus.defaultSchool.name}" as the saved default school.`
        : 'No default school is saved right now.',
      disabled: !session.configStatus.defaultSchool,
    },
    {
      id: 'remove-selected-profile',
      label: 'Remove selected profile',
      description: selectedProfile
        ? `Delete "${selectedProfile.name}" from the saved profile list.`
        : 'No profile is currently selected.',
      disabled: !selectedProfile,
    },
    {
      id: 'remove-selected-recent-school',
      label: 'Remove selected recent school',
      description: selectedRecentSchool
        ? `Remove "${selectedRecentSchool.name}" from recent schools.`
        : 'No recent school is currently selected.',
      disabled: !selectedRecentSchool,
    },
    {
      id: 'refresh-session',
      label: 'Refresh shell session',
      description: 'Reload current config, defaults, and profile state.',
      disabled: false,
    },
  ];
}

export function cycleSettingsSection(current: SettingsSection): SettingsSection {
  const currentIndex = SETTINGS_SECTIONS.indexOf(current);
  const nextIndex = (currentIndex + 1) % SETTINGS_SECTIONS.length;
  return SETTINGS_SECTIONS[nextIndex] ?? SETTINGS_SECTIONS[0];
}

export function moveSettingsSelection(
  state: SettingsState,
  session: HumanSessionContext,
  delta: number,
): SettingsState {
  switch (state.section) {
    case 'profiles':
      return {
        ...state,
        profileIndex: clamp(
          state.profileIndex + delta,
          0,
          Math.max(0, session.configStatus.profiles.length - 1),
        ),
      };
    case 'recent-schools':
      return {
        ...state,
        recentSchoolIndex: clamp(
          state.recentSchoolIndex + delta,
          0,
          Math.max(0, session.recentSchools.length - 1),
        ),
      };
    case 'actions':
      return {
        ...state,
        actionIndex: clamp(
          state.actionIndex + delta,
          0,
          Math.max(0, buildSettingsActions(session, state).length - 1),
        ),
      };
  }
}

export function buildSettingsDialog(
  actionId: SettingsActionId,
  session: HumanSessionContext,
  state: SettingsState,
): SettingsDialog | undefined {
  switch (actionId) {
    case 'clear-active-profile':
      return session.activeProfile
        ? {
            actionId,
            title: 'Clear active profile?',
            description: `This will stop using "${session.activeProfile.name}" as the active profile.`,
            confirmLabel: 'Press Enter to clear it.',
          }
        : undefined;
    case 'clear-default-school':
      return session.configStatus.defaultSchool
        ? {
            actionId,
            title: 'Clear default school?',
            description: `This will remove "${session.configStatus.defaultSchool.name}" as the saved default school.`,
            confirmLabel: 'Press Enter to clear it.',
          }
        : undefined;
    case 'remove-selected-profile': {
      const selectedProfile = session.configStatus.profiles[state.profileIndex];
      return selectedProfile
        ? {
            actionId,
            title: 'Remove selected profile?',
            description: `This will permanently remove "${selectedProfile.name}" from saved profiles.`,
            confirmLabel: 'Press Enter to remove it.',
          }
        : undefined;
    }
    case 'remove-selected-recent-school': {
      const selectedRecentSchool = session.recentSchools[state.recentSchoolIndex];
      return selectedRecentSchool
        ? {
            actionId,
            title: 'Remove selected recent school?',
            description: `This will remove "${selectedRecentSchool.name}" from the recent-school list.`,
            confirmLabel: 'Press Enter to remove it.',
          }
        : undefined;
    }
    default:
      return undefined;
  }
}

export function isDestructiveSettingsAction(actionId: SettingsActionId): boolean {
  return (
    actionId === 'clear-active-profile' ||
    actionId === 'clear-default-school' ||
    actionId === 'remove-selected-profile' ||
    actionId === 'remove-selected-recent-school'
  );
}
