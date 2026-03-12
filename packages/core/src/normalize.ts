import type {
  DayTimetable,
  PeriodChange,
  PeriodItem,
  PeriodSource,
  ProviderId,
  ProviderRefs,
  SchoolRef,
  SchoolSearchResult,
  SnapshotDiff,
  TeacherPeriodItem,
  WeekTimetable,
} from './types.js';
import { UNKNOWN_SUBJECT, WEEKDAY_NAMES } from './types.js';

const REGION_SUFFIX_PATTERN =
  /(특별자치시|특별자치도|광역시|특별시|자치시|자치도|도)$/u;

export function normalizePeriod(raw: {
  period: number;
  subject?: string | null;
  teacher?: string | null;
  source?: Partial<PeriodSource>;
  rawSubject?: string | null;
  rawTeacher?: string | null;
  rawCodes?: Record<string, number | string>;
}): PeriodItem {
  const teacher = raw.teacher?.trim() || undefined;
  const subjectText = raw.subject?.trim() || '';

  let subject = subjectText;
  let status: PeriodItem['status'] = 'class';
  let isFreePeriod = false;

  if (!subjectText && teacher) {
    subject = UNKNOWN_SUBJECT;
    status = 'unknown-subject';
  } else if (!subjectText) {
    subject = '';
    status = 'free';
    isFreePeriod = true;
  }

  return {
    period: raw.period,
    subject,
    teacher,
    status,
    isFreePeriod,
    source: {
      provider: raw.source?.provider ?? 'unknown',
      rawSubject: raw.rawSubject ?? raw.source?.rawSubject ?? raw.subject ?? undefined,
      rawTeacher: raw.rawTeacher ?? raw.source?.rawTeacher ?? raw.teacher ?? undefined,
      rawCodes: raw.rawCodes ?? raw.source?.rawCodes,
    },
  };
}

export function normalizeTeacherPeriod(raw: {
  period: number;
  subject?: string | null;
  grade?: number;
  classNo?: number;
  source?: Partial<PeriodSource>;
  rawSubject?: string | null;
  rawCodes?: Record<string, number | string>;
}): TeacherPeriodItem {
  const subjectText = raw.subject?.trim() || '';
  const hasClass = Number.isInteger(raw.grade) && Number.isInteger(raw.classNo);

  let subject = subjectText;
  let status: TeacherPeriodItem['status'] = 'class';
  let isFreePeriod = false;

  if (!subjectText && hasClass) {
    subject = UNKNOWN_SUBJECT;
    status = 'unknown-subject';
  } else if (!subjectText) {
    subject = '';
    status = 'free';
    isFreePeriod = true;
  }

  return {
    period: raw.period,
    subject,
    grade: raw.grade,
    classNo: raw.classNo,
    classLabel: hasClass ? `${raw.grade}-${raw.classNo}` : undefined,
    status,
    isFreePeriod,
    source: {
      provider: raw.source?.provider ?? 'unknown',
      rawSubject: raw.rawSubject ?? raw.source?.rawSubject ?? raw.subject ?? undefined,
      rawCodes: raw.rawCodes ?? raw.source?.rawCodes,
    },
  };
}

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? `${weekday}`;
}

export function normalizeSchoolName(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export function normalizeRegionName(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/\s+/g, '').replace(REGION_SUFFIX_PATTERN, '');
}

export function schoolMatches(
  left: Pick<SchoolRef, 'name' | 'region' | 'schoolType'>,
  right: Pick<SchoolRef, 'name' | 'region' | 'schoolType'>,
): boolean {
  if (normalizeSchoolName(left.name) !== normalizeSchoolName(right.name)) {
    return false;
  }

  const leftRegion = normalizeRegionName(left.region);
  const rightRegion = normalizeRegionName(right.region);
  if (leftRegion && rightRegion && leftRegion !== rightRegion) {
    return false;
  }

  if (left.schoolType && right.schoolType && left.schoolType !== right.schoolType) {
    return false;
  }

  return true;
}

export function hasProviderRef(school: SchoolRef, providerId: ProviderId): boolean {
  return school.providerRefs[providerId] != null;
}

export function mergeProviderRefs(base: ProviderRefs, incoming: ProviderRefs): ProviderRefs {
  return {
    comcigan: incoming.comcigan ?? base.comcigan,
    neis: incoming.neis ?? base.neis,
  };
}

export function providerIdsFromRefs(providerRefs: ProviderRefs): ProviderId[] {
  const ids: ProviderId[] = [];

  if (providerRefs.comcigan) {
    ids.push('comcigan');
  }
  if (providerRefs.neis) {
    ids.push('neis');
  }

  return ids;
}

export function mergeSchoolRefs(
  base: SchoolRef,
  incoming: SchoolRef | SchoolSearchResult,
): SchoolSearchResult {
  const sourceProviders = new Set<ProviderId>([
    ...providerIdsFromRefs(base.providerRefs),
    ...providerIdsFromRefs(incoming.providerRefs),
    ...('sourceProviders' in incoming ? incoming.sourceProviders : []),
  ]);

  return {
    name: base.name || incoming.name,
    region: base.region ?? incoming.region,
    schoolType: base.schoolType ?? incoming.schoolType,
    providerRefs: mergeProviderRefs(base.providerRefs, incoming.providerRefs),
    sourceProviders: [...sourceProviders],
  };
}

export function mergeSchoolSearchResults(results: SchoolSearchResult[]): SchoolSearchResult[] {
  const merged: SchoolSearchResult[] = [];

  for (const result of results) {
    const existing = merged.find((candidate) => schoolMatches(candidate, result));
    if (!existing) {
      merged.push({
        ...result,
        providerRefs: mergeProviderRefs({}, result.providerRefs),
        sourceProviders: [...new Set(result.sourceProviders)],
      });
      continue;
    }

    const combined = mergeSchoolRefs(existing, result);
    Object.assign(existing, combined);
  }

  return merged.sort((left, right) => {
    const regionA = normalizeRegionName(left.region) ?? '';
    const regionB = normalizeRegionName(right.region) ?? '';
    return regionA.localeCompare(regionB, 'ko') || left.name.localeCompare(right.name, 'ko');
  });
}

export function diffSnapshots(a: WeekTimetable, b: WeekTimetable): SnapshotDiff {
  const changes: PeriodChange[] = [];

  for (const dayA of a.days) {
    const dayB = b.days.find((candidate) => candidate.weekday === dayA.weekday);
    if (!dayB) {
      continue;
    }

    for (const periodA of dayA.periods) {
      const periodB = dayB.periods.find((candidate) => candidate.period === periodA.period);
      if (!periodB) {
        continue;
      }

      if (
        periodA.subject !== periodB.subject ||
        periodA.teacher !== periodB.teacher ||
        periodA.status !== periodB.status
      ) {
        changes.push({
          weekday: dayA.weekday,
          weekdayName: dayA.weekdayName,
          period: periodA.period,
          before: {
            subject: periodA.subject,
            teacher: periodA.teacher,
            status: periodA.status,
          },
          after: {
            subject: periodB.subject,
            teacher: periodB.teacher,
            status: periodB.status,
          },
        });
      }
    }
  }

  return {
    school: a.school,
    grade: a.grade,
    classNo: a.classNo,
    changes,
  };
}

export function extractDay(week: WeekTimetable, weekday: number): DayTimetable | undefined {
  return week.days.find((day) => day.weekday === weekday);
}

export function todayWeekday(now?: Date): number {
  const date = now ?? new Date();
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonday(date: Date): Date {
  const monday = new Date(date);
  const weekday = monday.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  monday.setDate(monday.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
