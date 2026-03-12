import type {
  HumanDiagnosticsData,
  HumanHomeData,
  HumanMealsData,
  HumanSessionContext,
  HumanTeacherData,
  HumanTimetableData,
} from '../usecases/human.js';

export type {
  HumanDiagnosticsData,
  HumanHomeData,
  HumanMealsData,
  HumanSessionContext,
  HumanTeacherData,
  HumanTimetableData,
  InteractiveMode,
} from '../usecases/human.js';

export type HumanPageId =
  | 'home'
  | 'schools'
  | 'timetable'
  | 'meals'
  | 'teacher'
  | 'diagnostics'
  | 'settings'
  | 'help';

export type AsyncDataPageId = 'home' | 'timetable' | 'meals' | 'teacher' | 'diagnostics';

export interface HumanPage {
  id: HumanPageId;
  label: string;
  description: string;
}

export interface SearchState {
  query: string;
  dirty: boolean;
  loading: boolean;
  error?: string;
  results: HumanSessionContext['recentSchools'];
  selectedIndex: number;
}

export interface EasyState {
  step: 'welcome' | 'search' | 'class' | 'teacher' | 'saving';
  query: string;
  dirty: boolean;
  loading: boolean;
  error?: string;
  results: HumanSessionContext['recentSchools'];
  selectedIndex: number;
  grade: number;
  classNo: number;
  teacherName: string;
}

export interface SettingsState {
  section: SettingsSection;
  profileIndex: number;
  recentSchoolIndex: number;
  actionIndex: number;
}

export type SettingsSection = 'profiles' | 'recent-schools' | 'actions';

export type SettingsActionId =
  | 'save-active-profile'
  | 'save-shell-profile'
  | 'clear-active-profile'
  | 'clear-default-school'
  | 'remove-selected-profile'
  | 'remove-selected-recent-school'
  | 'refresh-session';

export interface SettingsActionItem {
  id: SettingsActionId;
  label: string;
  description: string;
  disabled?: boolean;
}

export interface SettingsDialog {
  actionId:
    | 'clear-active-profile'
    | 'clear-default-school'
    | 'remove-selected-profile'
    | 'remove-selected-recent-school';
  title: string;
  description: string;
  confirmLabel: string;
}

export interface KeyLike {
  ctrl?: boolean;
  meta?: boolean;
  return?: boolean;
  escape?: boolean;
  backspace?: boolean;
  delete?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  tab?: boolean;
}

export interface AsyncPageDataMap {
  home: HumanHomeData;
  timetable: HumanTimetableData;
  meals: HumanMealsData;
  teacher: HumanTeacherData;
  diagnostics: HumanDiagnosticsData;
}

export type AsyncPageState<K extends AsyncDataPageId> = {
  loading: boolean;
  error?: string;
  data?: AsyncPageDataMap[K];
};

export type AsyncPageStateMap = {
  [K in AsyncDataPageId]: AsyncPageState<K>;
};

export const HUMAN_PAGES: HumanPage[] = [
  { id: 'home', label: 'Home', description: 'See the current school snapshot at a glance.' },
  { id: 'schools', label: 'Schools', description: 'Search schools and choose the active default.' },
  { id: 'timetable', label: 'Timetable', description: 'Browse the weekly student timetable.' },
  { id: 'meals', label: 'Meals', description: 'Check meal summaries for the current week.' },
  { id: 'teacher', label: 'Teacher', description: 'Open teacher info and timetable summaries.' },
  { id: 'diagnostics', label: 'Diagnostics', description: 'Inspect key state and provider access modes.' },
  { id: 'settings', label: 'Settings', description: 'Review profiles, key storage, and cache policy.' },
  { id: 'help', label: 'Help', description: 'Show shortcuts and raw-command reminders.' },
];

export function createInitialAsyncPageStates(): AsyncPageStateMap {
  return {
    home: { loading: false },
    timetable: { loading: false },
    meals: { loading: false },
    teacher: { loading: false },
    diagnostics: { loading: false },
  };
}

export function createInitialSettingsState(): SettingsState {
  return {
    section: 'profiles',
    profileIndex: 0,
    recentSchoolIndex: 0,
    actionIndex: 0,
  };
}

export function isAsyncDataPage(page: HumanPageId): page is AsyncDataPageId {
  return (
    page === 'home' ||
    page === 'timetable' ||
    page === 'meals' ||
    page === 'teacher' ||
    page === 'diagnostics'
  );
}
