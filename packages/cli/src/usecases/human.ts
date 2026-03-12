import {
  clearDefaultSchool,
  getKampusConfigStatus,
  loadKampusConfig,
  providerIdsFromRefs,
  removeProfile,
  removeRecentSchool,
  saveKampusConfig,
  setActiveProfile,
  setDefaultSchool,
  type ClassTimeSlot,
  type DailyMeals,
  type DayTimetable,
  type KampusConfigStatus,
  type KampusProfile,
  type KampusStoredSchool,
  type PeriodItem,
  type SchoolRef,
  type SchoolSearchResult,
  type TeacherInfo,
  type TeacherTimetable,
  type WeekTimetable,
  type WeeklyMeals,
  upsertProfile,
} from '@kampus/core';
import { createClient } from '../client-factory.js';

export type InteractiveMode = 'human' | 'easy';

export interface HumanSessionContext {
  checkedAt: string;
  configStatus: KampusConfigStatus;
  activeProfile?: KampusProfile;
  selectedSchool?: SchoolSearchResult;
  grade?: number;
  classNo?: number;
  teacherName?: string;
  recentSchools: SchoolSearchResult[];
  notes: string[];
}

export interface HumanIssue {
  section: string;
  message: string;
}

export interface HumanHomeData {
  loadedAt: string;
  todayTimetable?: DayTimetable;
  todayMeals?: DailyMeals;
  classTimes?: ClassTimeSlot[];
  nextClass?: {
    period: PeriodItem;
    minutesUntil?: number;
  } | null;
  issues: HumanIssue[];
  notes: string[];
}

export interface HumanTimetableData {
  loadedAt: string;
  week?: WeekTimetable;
  issues: HumanIssue[];
  notes: string[];
}

export interface HumanMealsData {
  loadedAt: string;
  week?: WeeklyMeals;
  issues: HumanIssue[];
  notes: string[];
}

export interface HumanTeacherData {
  loadedAt: string;
  info?: TeacherInfo;
  timetable?: TeacherTimetable;
  issues: HumanIssue[];
  notes: string[];
}

export interface HumanDiagnosticsData {
  loadedAt: string;
  configStatus: KampusConfigStatus;
  expectedModes: Array<{ provider: 'comcigan' | 'neis'; accessMode: string; note: string }>;
  warnings: string[];
}

export interface EasyProfileInput {
  school: SchoolRef;
  grade: number;
  classNo: number;
  teacherName?: string;
  profileName?: string;
}

export async function loadHumanSessionContext(): Promise<HumanSessionContext> {
  const configStatus = getKampusConfigStatus();
  const activeProfile = configStatus.activeProfile;
  const selectedSchool = activeProfile?.school
    ? storedSchoolToSearchResult(activeProfile.school)
    : configStatus.defaultSchool
      ? storedSchoolToSearchResult(configStatus.defaultSchool)
      : undefined;
  const recentSchools = configStatus.recentSchools.map(storedSchoolToSearchResult);
  const notes = buildSessionNotes({
    selectedSchool,
    grade: activeProfile?.grade,
    classNo: activeProfile?.classNo,
    teacherName: activeProfile?.teacherName,
    neisConfigured: configStatus.neisApiKeyConfigured,
  });

  return {
    checkedAt: new Date().toISOString(),
    configStatus,
    activeProfile,
    selectedSchool,
    grade: activeProfile?.grade,
    classNo: activeProfile?.classNo,
    teacherName: activeProfile?.teacherName,
    recentSchools,
    notes,
  };
}

export async function searchHumanSchools(keyword: string): Promise<SchoolSearchResult[]> {
  const client = createClient();
  return client.searchSchools(keyword);
}

export async function saveHumanDefaultSchoolSelection(
  school: SchoolSearchResult,
): Promise<HumanSessionContext> {
  let nextConfig = setDefaultSchool(loadKampusConfig(), school);
  const activeProfileKey = nextConfig.activeProfile;
  const activeProfile = activeProfileKey ? nextConfig.profiles?.[activeProfileKey] : undefined;

  if (activeProfile) {
    nextConfig = upsertProfile(nextConfig, {
      ...activeProfile,
      name: activeProfile.name,
      school,
    });
  }

  saveKampusConfig(nextConfig);
  return loadHumanSessionContext();
}

export async function activateHumanProfileSelection(
  profileName: string,
): Promise<HumanSessionContext> {
  const nextConfig = setActiveProfile(loadKampusConfig(), profileName);
  saveKampusConfig(nextConfig);
  return loadHumanSessionContext();
}

export async function clearHumanActiveProfileSelection(): Promise<HumanSessionContext> {
  const nextConfig = setActiveProfile(loadKampusConfig(), undefined);
  saveKampusConfig(nextConfig);
  return loadHumanSessionContext();
}

export async function clearHumanDefaultSchoolSelection(): Promise<HumanSessionContext> {
  const nextConfig = clearDefaultSchool(loadKampusConfig());
  saveKampusConfig(nextConfig);
  return loadHumanSessionContext();
}

export async function saveHumanSessionProfile(
  session: HumanSessionContext,
  profileName: string,
  options?: { activate?: boolean },
): Promise<HumanSessionContext> {
  let nextConfig = upsertProfile(loadKampusConfig(), {
    name: profileName,
    school: session.selectedSchool,
    grade: session.grade,
    classNo: session.classNo,
    teacherName: session.teacherName,
    notes: 'Saved from Kampus human shell.',
  });

  if (options?.activate) {
    nextConfig = setActiveProfile(nextConfig, profileName);
  }

  saveKampusConfig(nextConfig);
  return loadHumanSessionContext();
}

export async function removeHumanProfileSelection(
  profileName: string,
): Promise<HumanSessionContext> {
  const nextConfig = removeProfile(loadKampusConfig(), profileName);
  saveKampusConfig(nextConfig);
  return loadHumanSessionContext();
}

export async function removeHumanRecentSchoolSelection(
  school: SchoolSearchResult,
): Promise<HumanSessionContext> {
  const nextConfig = removeRecentSchool(loadKampusConfig(), school);
  saveKampusConfig(nextConfig);
  return loadHumanSessionContext();
}

export async function saveEasyProfile(input: EasyProfileInput): Promise<HumanSessionContext> {
  const profileName = input.profileName?.trim() || 'easy-default';
  let nextConfig = setDefaultSchool(loadKampusConfig(), input.school);
  nextConfig = upsertProfile(nextConfig, {
    name: profileName,
    school: input.school,
    grade: input.grade,
    classNo: input.classNo,
    teacherName: input.teacherName?.trim() || undefined,
    notes: 'Created from Kampus easy mode.',
  });
  nextConfig = setActiveProfile(nextConfig, profileName);
  saveKampusConfig(nextConfig);
  return loadHumanSessionContext();
}

export async function loadHumanHomeData(context: HumanSessionContext): Promise<HumanHomeData> {
  const loadedAt = new Date().toISOString();
  const issues: HumanIssue[] = [];
  const notes: string[] = [];
  const school = context.selectedSchool;

  if (!school) {
    notes.push('Choose a school first to load timetable, meals, and class-time cards.');
    return { loadedAt, issues, notes };
  }

  const client = createClient();
  let todayTimetable: DayTimetable | undefined;
  let todayMeals: DailyMeals | undefined;
  let classTimes: ClassTimeSlot[] | undefined;
  let nextClass: { period: PeriodItem; minutesUntil?: number } | null | undefined;

  const tasks: Promise<void>[] = [];

  tasks.push(
    safeLoad('today-meals', async () => {
      todayMeals = await client.getMealsToday({ school });
    }, issues),
  );

  tasks.push(
    safeLoad('class-times', async () => {
      classTimes = await client.getClassTimes(school);
    }, issues),
  );

  if (context.grade && context.classNo) {
    tasks.push(
      safeLoad('today-timetable', async () => {
        todayTimetable = await client.getTodayTimetable({
          school,
          grade: context.grade!,
          classNo: context.classNo!,
        });
      }, issues),
    );

    tasks.push(
      safeLoad('next-class', async () => {
        nextClass = await client.getNextClass({
          school,
          grade: context.grade!,
          classNo: context.classNo!,
        });
      }, issues),
    );
  } else {
    notes.push('Add grade and class to unlock the today timetable and next class cards.');
  }

  await Promise.all(tasks);

  if (!context.teacherName) {
    notes.push('Add a teacher name to make the teacher page ready for direct use.');
  }

  return {
    loadedAt,
    todayTimetable,
    todayMeals,
    classTimes,
    nextClass: nextClass ?? null,
    issues,
    notes,
  };
}

export async function loadHumanWeekTimetable(
  context: HumanSessionContext,
): Promise<HumanTimetableData> {
  const loadedAt = new Date().toISOString();
  const issues: HumanIssue[] = [];
  const notes: string[] = [];

  if (!context.selectedSchool) {
    notes.push('Choose a school before loading the weekly timetable.');
    return { loadedAt, issues, notes };
  }
  if (!context.grade || !context.classNo) {
    notes.push('A saved grade and class are required before the weekly timetable can load.');
    return { loadedAt, issues, notes };
  }

  const client = createClient();
  let week: WeekTimetable | undefined;
  await safeLoad('week-timetable', async () => {
    week = await client.getWeekTimetable({
      school: context.selectedSchool!,
      grade: context.grade!,
      classNo: context.classNo!,
    });
  }, issues);

  return { loadedAt, week, issues, notes };
}

export async function loadHumanWeeklyMeals(
  context: HumanSessionContext,
): Promise<HumanMealsData> {
  const loadedAt = new Date().toISOString();
  const issues: HumanIssue[] = [];
  const notes: string[] = [];

  if (!context.selectedSchool) {
    notes.push('Choose a school before loading weekly meals.');
    return { loadedAt, issues, notes };
  }

  const client = createClient();
  let week: WeeklyMeals | undefined;
  await safeLoad('weekly-meals', async () => {
    week = await client.getMealsWeek({
      school: context.selectedSchool!,
    });
  }, issues);

  return { loadedAt, week, issues, notes };
}

export async function loadHumanTeacherData(
  context: HumanSessionContext,
): Promise<HumanTeacherData> {
  const loadedAt = new Date().toISOString();
  const issues: HumanIssue[] = [];
  const notes: string[] = [];

  if (!context.selectedSchool) {
    notes.push('Choose a school before opening the teacher view.');
    return { loadedAt, issues, notes };
  }
  if (!context.teacherName) {
    notes.push('Add a teacher name before loading teacher info and the teacher timetable.');
    return { loadedAt, issues, notes };
  }

  const client = createClient();
  let info: TeacherInfo | undefined;
  let timetable: TeacherTimetable | undefined;

  await Promise.all([
    safeLoad('teacher-info', async () => {
      info = await client.getTeacherInfo({
        school: context.selectedSchool!,
        teacherName: context.teacherName!,
      });
    }, issues),
    safeLoad('teacher-timetable', async () => {
      timetable = await client.getTeacherTimetable({
        school: context.selectedSchool!,
        teacherName: context.teacherName!,
      });
    }, issues),
  ]);

  return { loadedAt, info, timetable, issues, notes };
}

export async function loadHumanDiagnostics(
  context?: HumanSessionContext,
): Promise<HumanDiagnosticsData> {
  const session = context ?? (await loadHumanSessionContext());
  const warnings: string[] = [...session.notes];

  if (session.configStatus.neisApiKeyStored && !session.configStatus.neisApiKeyReadable) {
    warnings.push('A stored NEIS key exists, but it is not readable in this environment.');
  }
  if (!session.configStatus.neisApiKeyConfigured) {
    warnings.push('NEIS official queries are running in limited mode because no API key is configured.');
  }

  return {
    loadedAt: new Date().toISOString(),
    configStatus: session.configStatus,
    expectedModes: [
      {
        provider: 'comcigan',
        accessMode: 'unofficial',
        note: 'Student timetable, teacher timetable, and class times currently come from Comcigan.',
      },
      {
        provider: 'neis',
        accessMode: session.configStatus.neisApiKeyConfigured ? 'official-full' : 'official-limited',
        note: session.configStatus.neisApiKeyConfigured
          ? 'School info, meals, and official NEIS datasets are available in full mode.'
          : 'School info and meals are available, but official NEIS queries stay in limited mode.',
      },
    ],
    warnings,
  };
}

function storedSchoolToSearchResult(stored: KampusStoredSchool): SchoolSearchResult {
  return {
    name: stored.name,
    region: stored.region,
    schoolType: stored.schoolType,
    providerRefs: stored.providerRefs,
    sourceProviders: providerIdsFromRefs(stored.providerRefs),
  };
}

function buildSessionNotes(input: {
  selectedSchool?: SchoolSearchResult;
  grade?: number;
  classNo?: number;
  teacherName?: string;
  neisConfigured: boolean;
}): string[] {
  const notes: string[] = [];

  if (!input.selectedSchool) {
    notes.push('No default school is saved yet. Start on the school page and choose one.');
  }
  if (!input.grade || !input.classNo) {
    notes.push('No grade/class is saved yet, so timetable cards may stay empty.');
  }
  if (!input.teacherName) {
    notes.push('Add a teacher name if you want teacher info and teacher timetable shortcuts ready.');
  }
  if (!input.neisConfigured) {
    notes.push('Without a NEIS key, official queries continue in limited mode.');
  }

  return notes;
}

async function safeLoad(
  section: string,
  task: () => Promise<void>,
  issues: HumanIssue[],
): Promise<void> {
  try {
    await task();
  } catch (error) {
    issues.push({
      section,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
