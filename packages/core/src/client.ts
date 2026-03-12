import type {
  ClassTimeSlot,
  DailyMeals,
  DayTimetable,
  KampusProvider,
  PeriodItem,
  ProviderCapability,
  ProviderId,
  SchoolInfo,
  SchoolRef,
  SchoolSearchResult,
  SnapshotDiff,
  TeacherInfo,
  TeacherTimetable,
  WeekTimetable,
  WeeklyMeals,
} from './types.js';
import {
  AmbiguousSchoolError,
  InvalidInputError,
  ProviderUnavailableError,
  SchoolNotFoundError,
} from './errors.js';
import {
  diffSnapshots,
  extractDay,
  formatDate,
  getMonday,
  hasProviderRef,
  mergeSchoolRefs,
  mergeSchoolSearchResults,
  normalizeRegionName,
  normalizeSchoolName,
  schoolMatches,
  todayWeekday,
} from './normalize.js';

export interface KampusClientOptions {
  providers: KampusProvider[];
}

const PROVIDER_PREFERENCES: Partial<Record<ProviderCapability, string[]>> = {
  schoolInfo: ['neis'],
  studentTimetable: ['comcigan'],
  teacherTimetable: ['comcigan'],
  teacherInfo: ['comcigan'],
  classTimes: ['comcigan'],
  meals: ['neis'],
};

export class KampusClient {
  private readonly providers: KampusProvider[];
  private readonly initPromises = new Map<KampusProvider, Promise<void>>();

  constructor(options: KampusClientOptions) {
    if (!options.providers.length) {
      throw new InvalidInputError('At least one provider is required.');
    }

    this.providers = options.providers;
  }

  async init(): Promise<void> {
    await Promise.all(this.providers.map((provider) => this.initializeProvider(provider)));
  }

  async searchSchools(keyword: string): Promise<SchoolSearchResult[]> {
    if (!keyword.trim()) {
      throw new InvalidInputError('A school keyword is required.');
    }

    const providers = this.getProviders('schoolSearch');
    const searchResults = await Promise.all(
      providers.map(async (provider) => this.trySearchWithProvider(provider, keyword)),
    );

    const successes = searchResults.flatMap((result) => result.results);
    if (successes.length > 0) {
      return mergeSchoolSearchResults(successes);
    }

    const firstError = searchResults.find((result) => result.error)?.error;
    if (firstError) {
      throw firstError;
    }

    return [];
  }

  async resolveSchool(name: string, region?: string): Promise<SchoolSearchResult> {
    const keyword = name.trim();
    if (!keyword) {
      throw new InvalidInputError('A school name is required.');
    }

    const results = await this.searchSchools(keyword);
    return this.selectSchool(results, keyword, region);
  }

  async getSchoolByExactMatch(name: string, region?: string): Promise<SchoolSearchResult> {
    return this.resolveSchool(name, region);
  }

  async getSchoolInfo(school: SchoolRef): Promise<SchoolInfo> {
    const provider = this.getPreferredProvider('schoolInfo');
    const resolvedSchool = await this.resolveSchoolForProvider(school, provider.name);
    return provider.getSchoolInfo!(resolvedSchool);
  }

  async getWeekTimetable(params: {
    school: SchoolRef;
    grade: number;
    classNo: number;
    weekOffset?: number;
  }): Promise<WeekTimetable> {
    this.validateGradeClass(params.grade, params.classNo);
    const provider = this.getPreferredProvider('studentTimetable');
    const resolvedSchool = await this.resolveSchoolForProvider(params.school, provider.name);
    return provider.getWeekTimetable!({
      ...params,
      school: resolvedSchool,
    });
  }

  async getDayTimetable(params: {
    school: SchoolRef;
    grade: number;
    classNo: number;
    weekday: number;
    weekOffset?: number;
  }): Promise<DayTimetable> {
    this.validateGradeClass(params.grade, params.classNo);
    this.validateWeekday(params.weekday);

    const provider = this.getPreferredProvider('studentTimetable');
    const resolvedSchool = await this.resolveSchoolForProvider(params.school, provider.name);

    if (provider.getDayTimetable) {
      return provider.getDayTimetable({
        ...params,
        school: resolvedSchool,
      });
    }

    const week = await provider.getWeekTimetable!({
      school: resolvedSchool,
      grade: params.grade,
      classNo: params.classNo,
      weekOffset: params.weekOffset,
    });

    const day = extractDay(week, params.weekday);
    if (!day) {
      throw new InvalidInputError(`No timetable exists for weekday ${params.weekday}.`);
    }

    return day;
  }

  async getTodayTimetable(params: {
    school: SchoolRef;
    grade: number;
    classNo: number;
    date?: Date;
  }): Promise<DayTimetable> {
    return this.getDayTimetable({
      school: params.school,
      grade: params.grade,
      classNo: params.classNo,
      weekday: todayWeekday(params.date),
    });
  }

  async getTeacherTimetable(params: {
    school: SchoolRef;
    teacherName: string;
    weekday?: number;
    weekOffset?: number;
  }): Promise<TeacherTimetable> {
    if (!params.teacherName.trim()) {
      throw new InvalidInputError('A teacher name is required.');
    }
    if (params.weekday != null) {
      this.validateWeekday(params.weekday);
    }

    const provider = this.getPreferredProvider('teacherTimetable');
    const resolvedSchool = await this.resolveSchoolForProvider(params.school, provider.name);
    return provider.getTeacherTimetable!({
      ...params,
      school: resolvedSchool,
    });
  }

  async getTeacherInfo(params: {
    school: SchoolRef;
    teacherName: string;
  }): Promise<TeacherInfo> {
    if (!params.teacherName.trim()) {
      throw new InvalidInputError('A teacher name is required.');
    }

    const provider = this.getPreferredProvider('teacherInfo');
    const resolvedSchool = await this.resolveSchoolForProvider(params.school, provider.name);
    return provider.getTeacherInfo!({
      ...params,
      school: resolvedSchool,
    });
  }

  async getClassTimes(school: SchoolRef): Promise<ClassTimeSlot[]> {
    const provider = this.getPreferredProvider('classTimes');
    const resolvedSchool = await this.resolveSchoolForProvider(school, provider.name);
    return provider.getClassTimes!(resolvedSchool);
  }

  async getMealsToday(params: {
    school: SchoolRef;
    date?: string;
  }): Promise<DailyMeals> {
    const provider = this.getPreferredProvider('meals');
    const resolvedSchool = await this.resolveSchoolForProvider(params.school, provider.name);
    return provider.getMealsToday!({
      ...params,
      school: resolvedSchool,
    });
  }

  async getMealsWeek(params: {
    school: SchoolRef;
    weekOffset?: number;
    date?: string;
  }): Promise<WeeklyMeals> {
    const provider = this.getPreferredProvider('meals');
    const resolvedSchool = await this.resolveSchoolForProvider(params.school, provider.name);
    return provider.getMealsWeek!({
      ...params,
      school: resolvedSchool,
    });
  }

  async getMealsRange(params: {
    school: SchoolRef;
    fromDate: string;
    toDate: string;
  }): Promise<WeeklyMeals> {
    const provider = this.getPreferredProvider('meals');
    if (!provider.getMealsRange) {
      throw new ProviderUnavailableError(
        provider.name,
        undefined,
        `Provider "${provider.name}" does not support ranged meal queries.`,
      );
    }

    const resolvedSchool = await this.resolveSchoolForProvider(params.school, provider.name);
    return provider.getMealsRange({
      ...params,
      school: resolvedSchool,
    });
  }

  async getNextClass(params: {
    school: SchoolRef;
    grade: number;
    classNo: number;
    now?: Date;
  }): Promise<{ period: PeriodItem; minutesUntil?: number } | null> {
    const now = params.now ?? new Date();
    const timetable = await this.getTodayTimetable({
      school: params.school,
      grade: params.grade,
      classNo: params.classNo,
      date: now,
    });

    let classTimes: ClassTimeSlot[] | null = null;
    try {
      classTimes = await this.getClassTimes(params.school);
    } catch {
      classTimes = null;
    }

    if (!classTimes) {
      return timetable.periods.find((period) => !period.isFreePeriod)
        ? { period: timetable.periods.find((period) => !period.isFreePeriod)! }
        : null;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (const period of timetable.periods) {
      if (period.isFreePeriod) {
        continue;
      }

      const slot = classTimes.find((candidate) => candidate.period === period.period);
      if (!slot) {
        continue;
      }

      const [hour, minute] = slot.startTime.split(':').map(Number);
      const startMinutes = hour * 60 + minute;
      if (startMinutes > currentMinutes) {
        return {
          period,
          minutesUntil: startMinutes - currentMinutes,
        };
      }
    }

    return null;
  }

  diffSnapshots(a: WeekTimetable, b: WeekTimetable): SnapshotDiff {
    return diffSnapshots(a, b);
  }

  private async initializeProvider(provider: KampusProvider): Promise<void> {
    let initPromise = this.initPromises.get(provider);
    if (!initPromise) {
      initPromise = Promise.resolve(provider.init?.());
      this.initPromises.set(provider, initPromise);
    }

    try {
      await initPromise;
    } catch (error) {
      this.initPromises.delete(provider);
      throw error;
    }
  }

  private getProviders(capability: ProviderCapability): KampusProvider[] {
    const providers = this.providers.filter((provider) => provider.capabilities.has(capability));
    if (!providers.length) {
      throw new ProviderUnavailableError(
        capability,
        undefined,
        `No provider is registered for capability "${capability}".`,
      );
    }

    const preferences = PROVIDER_PREFERENCES[capability] ?? [];
    return [...providers].sort((left, right) => {
      const leftIndex = this.preferenceIndex(preferences, left.name);
      const rightIndex = this.preferenceIndex(preferences, right.name);
      return leftIndex - rightIndex;
    });
  }

  private getPreferredProvider(capability: Exclude<ProviderCapability, 'schoolSearch'>): KampusProvider {
    const provider = this.getProviders(capability)[0];
    return provider;
  }

  private preferenceIndex(preferences: string[], providerName: string): number {
    const index = preferences.indexOf(providerName);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  private async trySearchWithProvider(
    provider: KampusProvider,
    keyword: string,
  ): Promise<{ results: SchoolSearchResult[]; error?: Error }> {
    try {
      await this.initializeProvider(provider);
      return {
        results: (await provider.searchSchools?.(keyword)) ?? [],
      };
    } catch (error) {
      return {
        results: [],
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private selectSchool(
    results: SchoolSearchResult[],
    name: string,
    region?: string,
  ): SchoolSearchResult {
    const normalizedName = normalizeSchoolName(name);
    const exactNameMatches = results.filter(
      (result) => normalizeSchoolName(result.name) === normalizedName,
    );
    const partialNameMatches = results.filter((result) =>
      normalizeSchoolName(result.name).includes(normalizedName),
    );

    const normalizedRegion = normalizeRegionName(region);
    const applyRegion = (candidates: SchoolSearchResult[]) =>
      normalizedRegion
        ? candidates.filter((result) => {
          const resultRegion = normalizeRegionName(result.region);
          return !resultRegion || resultRegion === normalizedRegion;
        })
        : candidates;

    const regionMatches = applyRegion(exactNameMatches);

    if (regionMatches.length === 1) {
      return regionMatches[0];
    }

    if (!region && exactNameMatches.length === 1) {
      return exactNameMatches[0];
    }

    if (!exactNameMatches.length) {
      const partialRegionMatches = applyRegion(partialNameMatches);
      if (partialRegionMatches.length === 1) {
        return partialRegionMatches[0];
      }
      if (!region && partialNameMatches.length === 1) {
        return partialNameMatches[0];
      }
      throw new SchoolNotFoundError(name);
    }

    throw new AmbiguousSchoolError(
      name,
      (regionMatches.length > 0 ? regionMatches : exactNameMatches).map((match) => ({
        name: match.name,
        region: match.region,
        schoolType: match.schoolType,
      })),
    );
  }

  private async resolveSchoolForProvider(school: SchoolRef, providerName: string): Promise<SchoolRef> {
    if (providerName !== 'comcigan' && providerName !== 'neis') {
      return school;
    }

    if (hasProviderRef(school, providerName)) {
      return school;
    }

    const provider = this.providers.find((candidate) => candidate.name === providerName);
    if (provider?.capabilities.has('schoolSearch') && provider.searchSchools) {
      const providerResults = await this.trySearchWithProvider(provider, school.name);
      if (providerResults.error && providerResults.results.length === 0) {
        throw providerResults.error;
      }
      const selected = this.trySelectMatchingSchool(providerResults.results, school, providerName);
      if (selected) {
        return mergeSchoolRefs(school, selected);
      }
    }

    const aggregated = await this.searchSchools(school.name);
    const selected = this.trySelectMatchingSchool(aggregated, school, providerName);
    if (selected) {
      return mergeSchoolRefs(school, selected);
    }

    throw new ProviderUnavailableError(
      providerName,
      undefined,
      `Unable to resolve a ${providerName} school reference for "${school.name}".`,
    );
  }

  private trySelectMatchingSchool(
    candidates: SchoolSearchResult[],
    target: SchoolRef,
    providerName: ProviderId,
  ): SchoolSearchResult | null {
    const matches = candidates.filter((candidate) => schoolMatches(candidate, target));
    const withProviderRef = matches.filter((candidate) => hasProviderRef(candidate, providerName));

    if (withProviderRef.length === 1) {
      return withProviderRef[0];
    }

    if (withProviderRef.length > 1) {
      throw new AmbiguousSchoolError(
        target.name,
        withProviderRef.map((match) => ({
          name: match.name,
          region: match.region,
          schoolType: match.schoolType,
        })),
      );
    }

    return null;
  }

  private validateGradeClass(grade: number, classNo: number): void {
    if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
      throw new InvalidInputError('Grade must be an integer from 1 to 6.');
    }
    if (!Number.isInteger(classNo) || classNo < 1 || classNo > 30) {
      throw new InvalidInputError('Class number must be an integer from 1 to 30.');
    }
  }

  private validateWeekday(weekday: number): void {
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      throw new InvalidInputError('Weekday must be an integer from 1 to 7.');
    }
  }
}

export type KampusSnapshot = {
  school: SchoolRef;
  capturedAt: string;
  weekStart: string;
  grade: number;
  classNo: number;
  timetable: WeekTimetable;
};

export function createSnapshot(week: WeekTimetable): KampusSnapshot {
  return {
    school: week.school,
    capturedAt: new Date().toISOString(),
    weekStart: week.weekStart ?? formatDate(getMonday(new Date())),
    grade: week.grade,
    classNo: week.classNo,
    timetable: week,
  };
}
