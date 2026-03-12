export type ProviderId = 'comcigan' | 'neis';
export type AccessMode = 'official-full' | 'official-limited' | 'unofficial';

export interface ComciganSchoolRef {
  schoolCode: number;
}

export interface NeisSchoolRef {
  officeCode: string;
  schoolCode: string;
}

export interface ProviderRefs {
  comcigan?: ComciganSchoolRef;
  neis?: NeisSchoolRef;
}

// ---------------------------------------------------------------------------
// School
// ---------------------------------------------------------------------------

export interface SchoolRef {
  name: string;
  region?: string;
  schoolType?: string;
  providerRefs: ProviderRefs;
}

export interface SchoolSearchResult extends SchoolRef {
  sourceProviders: ProviderId[];
}

export interface ProviderWarning {
  provider: string;
  code: string;
  message: string;
}

export interface DataStatus {
  accessMode: AccessMode;
  complete: boolean;
  sourceProviders: ProviderId[];
  warnings?: ProviderWarning[];
}

export interface SchoolInfo extends SchoolRef {
  address?: string;
  phone?: string;
  website?: string;
  gradeCount?: number;
  classCounts?: Record<number, number>;
  teacherNames?: string[];
  providerMetadata?: ProviderMetadata;
  dataStatus?: DataStatus;
  warnings?: ProviderWarning[];
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export type PeriodStatus = 'class' | 'unknown-subject' | 'free';

export interface PeriodSource {
  provider: string;
  rawSubject?: string;
  rawTeacher?: string;
  rawCodes?: Record<string, number | string>;
}

export interface PeriodItem {
  period: number;
  subject: string;
  teacher?: string;
  status: PeriodStatus;
  isFreePeriod: boolean;
  source: PeriodSource;
  warnings?: ProviderWarning[];
}

export interface DayTimetable {
  weekday: number;
  weekdayName: string;
  date?: string;
  periods: PeriodItem[];
  providerMetadata?: ProviderMetadata;
  dataStatus?: DataStatus;
  warnings?: ProviderWarning[];
}

export interface WeekTimetable {
  school: SchoolRef;
  grade: number;
  classNo: number;
  weekStart?: string;
  days: DayTimetable[];
  providerMetadata?: ProviderMetadata;
  dataStatus?: DataStatus;
  warnings?: ProviderWarning[];
}

export interface TeacherTimetable {
  school: SchoolRef;
  teacherName: string;
  days: TeacherDayTimetable[];
  providerMetadata?: ProviderMetadata;
  dataStatus?: DataStatus;
  warnings?: ProviderWarning[];
}

export interface TeacherDayTimetable {
  weekday: number;
  weekdayName: string;
  date?: string;
  periods: TeacherPeriodItem[];
}

export interface TeacherPeriodItem {
  period: number;
  subject: string;
  grade?: number;
  classNo?: number;
  classLabel?: string;
  status: PeriodStatus;
  isFreePeriod: boolean;
  source: PeriodSource;
  warnings?: ProviderWarning[];
}

// ---------------------------------------------------------------------------
// Class times
// ---------------------------------------------------------------------------

export interface ClassTimeSlot {
  period: number;
  startTime: string;
  endTime: string;
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

export interface MealItem {
  name: string;
  allergyCodes?: number[];
}

export interface DailyMealService {
  type: string;
  mealCode?: string;
  items: MealItem[];
  calories?: string;
  nutritionInfo?: string;
  originInfo?: string;
  rawMenuText?: string;
  rawRow?: Record<string, string>;
}

export interface DailyMeals {
  date: string;
  weekdayName?: string;
  meals: DailyMealService[];
  providerMetadata?: ProviderMetadata;
  dataStatus?: DataStatus;
  warnings?: ProviderWarning[];
}

export interface WeeklyMeals {
  school: SchoolRef;
  weekStart?: string;
  fromDate?: string;
  toDate?: string;
  days: DailyMeals[];
  providerMetadata?: ProviderMetadata;
  dataStatus?: DataStatus;
  warnings?: ProviderWarning[];
}

// ---------------------------------------------------------------------------
// Teacher info
// ---------------------------------------------------------------------------

export interface TeacherInfo {
  school: SchoolRef;
  name: string;
  subjects?: string[];
  classes?: string[];
  providerMetadata?: ProviderMetadata;
  dataStatus?: DataStatus;
  warnings?: ProviderWarning[];
}

// ---------------------------------------------------------------------------
// Snapshot diff
// ---------------------------------------------------------------------------

export interface SnapshotDiff {
  school: SchoolRef;
  grade: number;
  classNo: number;
  changes: PeriodChange[];
}

export interface PeriodChange {
  weekday: number;
  weekdayName: string;
  period: number;
  before: { subject: string; teacher?: string; status?: PeriodStatus };
  after: { subject: string; teacher?: string; status?: PeriodStatus };
}

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

export interface ProviderMetadata {
  provider: string;
  fetchedAt: string;
  cached?: boolean;
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export type ProviderCapability =
  | 'schoolSearch'
  | 'schoolInfo'
  | 'studentTimetable'
  | 'teacherTimetable'
  | 'teacherInfo'
  | 'classTimes'
  | 'meals';

export interface KampusProvider {
  readonly name: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;

  init?(): Promise<void>;

  searchSchools?(keyword: string): Promise<SchoolSearchResult[]>;

  getSchoolInfo?(school: SchoolRef): Promise<SchoolInfo>;

  getWeekTimetable?(params: {
    school: SchoolRef;
    grade: number;
    classNo: number;
    weekOffset?: number;
  }): Promise<WeekTimetable>;

  getDayTimetable?(params: {
    school: SchoolRef;
    grade: number;
    classNo: number;
    weekday: number;
    weekOffset?: number;
  }): Promise<DayTimetable>;

  getTeacherTimetable?(params: {
    school: SchoolRef;
    teacherName: string;
    weekday?: number;
    weekOffset?: number;
  }): Promise<TeacherTimetable>;

  getTeacherInfo?(params: {
    school: SchoolRef;
    teacherName: string;
  }): Promise<TeacherInfo>;

  getClassTimes?(school: SchoolRef): Promise<ClassTimeSlot[]>;

  getMealsToday?(params: {
    school: SchoolRef;
    date?: string;
  }): Promise<DailyMeals>;

  getMealsWeek?(params: {
    school: SchoolRef;
    weekOffset?: number;
    date?: string;
  }): Promise<WeeklyMeals>;

  getMealsRange?(params: {
    school: SchoolRef;
    fromDate: string;
    toDate: string;
  }): Promise<WeeklyMeals>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WEEKDAY_NAMES: Record<number, string> = {
  1: '\uC6D4\uC694\uC77C',
  2: '\uD654\uC694\uC77C',
  3: '\uC218\uC694\uC77C',
  4: '\uBAA9\uC694\uC77C',
  5: '\uAE08\uC694\uC77C',
  6: '\uD1A0\uC694\uC77C',
  7: '\uC77C\uC694\uC77C',
};

export const WEEKDAY_SHORT: Record<number, string> = {
  1: '\uC6D4',
  2: '\uD654',
  3: '\uC218',
  4: '\uBAA9',
  5: '\uAE08',
  6: '\uD1A0',
  7: '\uC77C',
};

export const UNKNOWN_SUBJECT = '\uBBF8\uD655\uC778';
