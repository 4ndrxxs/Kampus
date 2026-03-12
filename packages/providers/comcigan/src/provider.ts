import type {
  ClassTimeSlot,
  DataStatus,
  DayTimetable,
  KampusProvider,
  PeriodItem,
  ProviderCapability,
  ProviderMetadata,
  SchoolInfo,
  SchoolRef,
  SchoolSearchResult,
  TeacherDayTimetable,
  TeacherInfo,
  TeacherTimetable,
  TeacherPeriodItem,
  WeekTimetable,
} from '@kampus/core';
import {
  NetworkError,
  TeacherNotFoundError,
  TimetableUnavailableError,
  UpstreamChangedError,
  extractDay,
  formatDate,
  getMonday,
  normalizePeriod,
  normalizeTeacherPeriod,
  weekdayName,
} from '@kampus/core';
import iconv from 'iconv-lite';

const COMCIGAN_BASE = 'http://comci.net:4082';
const KEY_SCHOOL_SEARCH = '\uD559\uAD50\uAC80\uC0C9';
const KEY_CLASS_COUNTS = '\uD559\uAE09\uC218';
const KEY_TEACHERS = '\uC790\uB8CC446';
const KEY_SUBJECTS = '\uC790\uB8CC492';
const KEY_ORIGINAL_TIMETABLE = '\uC790\uB8CC481';
const KEY_CURRENT_TIMETABLE = '\uC790\uB8CC147';
const KEY_SPLIT = '\uBD84\uB9AC';
const KEY_TOTAL_GRADES = '\uC804\uCCB4\uD559\uB144';
const KEY_CLASS_TIMES = '\uC77C\uACFC\uC2DC\uAC04';
const ST_PATH = '/st';

type RawComciganData = Record<string, unknown>;

export interface ComciganProviderOptions {
  baseUrl?: string;
}

export class ComciganProvider implements KampusProvider {
  readonly name = 'comcigan';
  readonly capabilities: ReadonlySet<ProviderCapability> = new Set([
    'schoolSearch',
    'studentTimetable',
    'teacherTimetable',
    'teacherInfo',
    'classTimes',
  ]);

  private readonly baseUrl: string;
  private readonly schoolDataCache = new Map<number, ParsedSchoolData>();
  private routeCache?: ComciganRouteInfo;

  constructor(options?: ComciganProviderOptions) {
    this.baseUrl = options?.baseUrl ?? COMCIGAN_BASE;
  }

  async searchSchools(keyword: string): Promise<SchoolSearchResult[]> {
    const routes = await this.loadRouteInfo();
    const encodedKeyword = this.encodeSearchKeyword(keyword);
    const url = `${this.baseUrl}/${routes.mainRoute}?${routes.searchRoute}l${encodedKeyword}`;
    const response = (await this.fetchBuffer(url)).toString('utf-8');
    const cleaned = this.stripNulls(response);

    let payload: RawComciganData;
    try {
      payload = JSON.parse(cleaned);
    } catch (error) {
      throw new UpstreamChangedError('Comcigan search response is no longer valid JSON.', error);
    }

    const matches = payload[KEY_SCHOOL_SEARCH];
    if (!Array.isArray(matches)) {
      return [];
    }

    return matches
      .filter(
        (entry): entry is [number, string, string, number?] => Array.isArray(entry) && entry.length >= 3,
      )
      .map((entry) => ({
        name: String(entry[2]).trim(),
        region: entry[1] ? String(entry[1]).trim() : undefined,
        providerRefs: {
          comcigan: {
            schoolCode: Number(entry[3] ?? entry[0]),
          },
        },
        sourceProviders: ['comcigan'],
      }));
  }

  async getSchoolInfo(school: SchoolRef): Promise<SchoolInfo> {
    const data = await this.loadSchoolData(school);
    return {
      name: school.name,
      region: school.region,
      schoolType: school.schoolType,
      providerRefs: school.providerRefs,
      gradeCount: data.gradeCount,
      classCounts: data.classCounts,
      teacherNames: data.teacherNames.filter((name, index) => index > 0 && name !== '*'),
      providerMetadata: this.meta(),
      dataStatus: this.dataStatus(),
    };
  }

  async getWeekTimetable(params: {
    school: SchoolRef;
    grade: number;
    classNo: number;
    weekOffset?: number;
  }): Promise<WeekTimetable> {
    const data = await this.loadSchoolData(params.school);
    const monday = getMonday(new Date());
    if (params.weekOffset) {
      monday.setDate(monday.getDate() + params.weekOffset * 7);
    }

    const days: DayTimetable[] = [];
    for (let weekday = 1; weekday <= 5; weekday++) {
      const date = new Date(monday);
      date.setDate(date.getDate() + (weekday - 1));
      days.push({
        weekday,
        weekdayName: weekdayName(weekday),
        date: formatDate(date),
        periods: this.extractPeriods(data, params.grade, params.classNo, weekday),
        providerMetadata: this.meta(),
        dataStatus: this.dataStatus(),
      });
    }

    return {
      school: params.school,
      grade: params.grade,
      classNo: params.classNo,
      weekStart: formatDate(monday),
      days,
      providerMetadata: this.meta(),
      dataStatus: this.dataStatus(),
    };
  }

  async getDayTimetable(params: {
    school: SchoolRef;
    grade: number;
    classNo: number;
    weekday: number;
    weekOffset?: number;
  }): Promise<DayTimetable> {
    const week = await this.getWeekTimetable(params);
    const day = extractDay(week, params.weekday);
    if (!day) {
      throw new TimetableUnavailableError(`No timetable exists for weekday ${params.weekday}.`);
    }
    return day;
  }

  async getTeacherTimetable(params: {
    school: SchoolRef;
    teacherName: string;
    weekday?: number;
    weekOffset?: number;
  }): Promise<TeacherTimetable> {
    const data = await this.loadSchoolData(params.school);
    const teacherIndex = data.teacherNames.indexOf(params.teacherName);
    if (teacherIndex === -1) {
      throw new TeacherNotFoundError(params.teacherName, params.school.name);
    }

    const monday = getMonday(new Date());
    if (params.weekOffset) {
      monday.setDate(monday.getDate() + params.weekOffset * 7);
    }

    const days: TeacherDayTimetable[] = [];
    for (let weekday = 1; weekday <= 5; weekday++) {
      if (params.weekday && params.weekday !== weekday) {
        continue;
      }

      const date = new Date(monday);
      date.setDate(date.getDate() + (weekday - 1));

      days.push({
        weekday,
        weekdayName: weekdayName(weekday),
        date: formatDate(date),
        periods: this.extractTeacherPeriods(data, teacherIndex, weekday),
      });
    }

    return {
      school: params.school,
      teacherName: params.teacherName,
      days,
      providerMetadata: this.meta(),
      dataStatus: this.dataStatus(),
    };
  }

  async getTeacherInfo(params: {
    school: SchoolRef;
    teacherName: string;
  }): Promise<TeacherInfo> {
    const data = await this.loadSchoolData(params.school);
    const teacherIndex = data.teacherNames.indexOf(params.teacherName);
    if (teacherIndex === -1) {
      throw new TeacherNotFoundError(params.teacherName, params.school.name);
    }

    const subjects = new Set<string>();
    const classes = new Set<string>();

    for (let grade = 1; grade <= data.gradeCount; grade++) {
      const classCount = data.classCounts[grade] ?? 0;
      for (let classNo = 1; classNo <= classCount; classNo++) {
        for (let weekday = 1; weekday <= 5; weekday++) {
          for (const period of this.extractPeriods(data, grade, classNo, weekday)) {
            if (period.source.rawCodes?.teacherIdx === teacherIndex && !period.isFreePeriod) {
              subjects.add(period.subject);
              classes.add(`${grade}-${classNo}`);
            }
          }
        }
      }
    }

    return {
      school: params.school,
      name: params.teacherName,
      subjects: [...subjects],
      classes: [...classes].sort(),
      providerMetadata: this.meta(),
      dataStatus: this.dataStatus(),
    };
  }

  async getClassTimes(school: SchoolRef): Promise<ClassTimeSlot[]> {
    const data = await this.loadSchoolData(school);
    if (!data.classTimes?.length) {
      throw new TimetableUnavailableError('Class times are not exposed by the current Comcigan payload.');
    }
    return data.classTimes;
  }

  private async loadSchoolData(school: SchoolRef): Promise<ParsedSchoolData> {
    const schoolCode = school.providerRefs.comcigan?.schoolCode;
    if (!schoolCode) {
      throw new TimetableUnavailableError(`Comcigan school reference is missing for "${school.name}".`);
    }

    const cached = this.schoolDataCache.get(schoolCode);
    if (cached) {
      return cached;
    }

    const routes = await this.loadRouteInfo();
    const payload = Buffer.from(`${routes.dataPrefix}${schoolCode}_0_1`).toString('base64');
    const url = `${this.baseUrl}/${routes.mainRoute}_T?${payload}`;
    const cleaned = this.stripNulls((await this.fetchBuffer(url)).toString('utf-8'));

    let raw: RawComciganData;
    try {
      raw = JSON.parse(cleaned);
    } catch (error) {
      throw new UpstreamChangedError('Comcigan timetable payload is no longer valid JSON.', error);
    }

    const data = this.parseSchoolData(raw, school);
    this.schoolDataCache.set(schoolCode, data);
    return data;
  }

  private parseSchoolData(raw: RawComciganData, school: SchoolRef): ParsedSchoolData {
    const originalTimetable = raw[KEY_ORIGINAL_TIMETABLE];
    if (!Array.isArray(originalTimetable)) {
      throw new UpstreamChangedError('Comcigan timetable structure is missing.');
    }

    const currentTimetable = Array.isArray(raw[KEY_CURRENT_TIMETABLE])
      ? raw[KEY_CURRENT_TIMETABLE]
      : originalTimetable;
    const teacherNames = Array.isArray(raw[KEY_TEACHERS])
      ? raw[KEY_TEACHERS].filter((value): value is string => typeof value === 'string')
      : [];

    const rawSubjects = Array.isArray(raw[KEY_SUBJECTS])
      ? raw[KEY_SUBJECTS].filter((value): value is string => typeof value === 'string')
      : [];
    const subjects = ['', ...rawSubjects];

    const rawClassCounts = Array.isArray(raw[KEY_CLASS_COUNTS]) ? raw[KEY_CLASS_COUNTS] : [];
    const gradeCount =
      Number(raw[KEY_TOTAL_GRADES]) ||
      Number(currentTimetable[0]) ||
      Number(originalTimetable[0]) ||
      Math.max(0, rawClassCounts.length - 1);
    const classCounts: Record<number, number> = {};
    for (let grade = 1; grade <= gradeCount; grade++) {
      classCounts[grade] = Number(rawClassCounts[grade]) || 0;
    }

    return {
      school,
      teacherNames,
      subjects,
      gradeCount,
      classCounts,
      splitValue: this.resolveSplitValue(raw, teacherNames.length),
      originalTimetable,
      currentTimetable,
      classTimes: this.extractClassTimes(raw),
    };
  }

  private extractClassTimes(raw: RawComciganData): ClassTimeSlot[] | undefined {
    const candidates = [raw[KEY_CLASS_TIMES], raw['\uC218\uC5C5\uC2DC\uAC04'], raw['classTimes']];

    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }

      const slots = this.extractNumericClassTimes(candidate) ?? this.extractStringClassTimes(candidate);

      if (slots.length) {
        return slots;
      }
    }

    return undefined;
  }

  private extractPeriods(
    data: ParsedSchoolData,
    grade: number,
    classNo: number,
    weekday: number,
  ): PeriodItem[] {
    const gradeData = data.currentTimetable[grade];
    if (!Array.isArray(gradeData)) {
      return [];
    }

    const classData = gradeData[classNo];
    if (!Array.isArray(classData)) {
      return [];
    }

    const dayData = classData[weekday];
    if (!Array.isArray(dayData)) {
      return [];
    }

    const periodCount = Number(dayData[0]) || Math.max(0, dayData.length - 1);
    const periods: PeriodItem[] = [];

    for (let period = 1; period <= periodCount; period++) {
      const encoded = Number(dayData[period] ?? 0);
      if (!encoded) {
        continue;
      }

      const { subjectIdx, teacherIdx, subjectSection } = this.decodePeriodValue(encoded, data.splitValue);
      const subject = this.formatSubjectLabel(data.subjects[subjectIdx] ?? '', subjectSection);
      const teacher = data.teacherNames[teacherIdx] ?? '';
      const originalEncoded = this.lookupOriginalCode(data, grade, classNo, weekday, period);

      periods.push(
        normalizePeriod({
          period,
          subject,
          teacher,
          source: { provider: 'comcigan' },
          rawSubject: subject,
          rawTeacher: teacher,
          rawCodes: {
            encoded,
            originalEncoded: originalEncoded ?? '',
            subjectIdx,
            teacherIdx,
            splitValue: data.splitValue,
            subjectSection,
          },
        }),
      );
    }

    return periods;
  }

  private extractTeacherPeriods(
    data: ParsedSchoolData,
    teacherIndex: number,
    weekday: number,
  ): TeacherPeriodItem[] {
    const periods: TeacherPeriodItem[] = [];

    for (let grade = 1; grade <= data.gradeCount; grade++) {
      const classCount = data.classCounts[grade] ?? 0;
      for (let classNo = 1; classNo <= classCount; classNo++) {
        for (const period of this.extractPeriods(data, grade, classNo, weekday)) {
          if (period.source.rawCodes?.teacherIdx !== teacherIndex) {
            continue;
          }

          periods.push(
            normalizeTeacherPeriod({
              period: period.period,
              subject: period.subject,
              grade,
              classNo,
              source: { provider: 'comcigan' },
              rawSubject: period.source.rawSubject,
              rawCodes: period.source.rawCodes,
            }),
          );
        }
      }
    }

    periods.sort((left, right) => left.period - right.period);
    if (!periods.length) {
      return [];
    }

    const maxPeriod = Math.max(...periods.map((period) => period.period));
    const filled: TeacherPeriodItem[] = [];
    for (let period = 1; period <= maxPeriod; period++) {
      const existing = periods.find((candidate) => candidate.period === period);
      filled.push(
        existing ??
          normalizeTeacherPeriod({
            period,
            source: { provider: 'comcigan' },
          }),
      );
    }

    return filled;
  }

  private decodePeriodValue(
    value: number,
    splitValue: number,
  ): {
    subjectIdx: number;
    teacherIdx: number;
    subjectSection: number;
  } {
    if (splitValue === 100) {
      return {
        subjectIdx: value % splitValue,
        teacherIdx: Math.floor(value / splitValue),
        subjectSection: 0,
      };
    }

    const teacherIdx = value % splitValue;
    const subjectCode = Math.floor(value / splitValue);
    return {
      subjectIdx: subjectCode % splitValue,
      teacherIdx,
      subjectSection: Math.floor(subjectCode / splitValue),
    };
  }

  private formatSubjectLabel(subject: string, subjectSection: number): string {
    if (!subject) {
      return '';
    }

    if (subjectSection < 1) {
      return subject;
    }

    if (subjectSection <= 26) {
      return `${String.fromCharCode(64 + subjectSection)}_${subject}`;
    }

    return `${subjectSection}_${subject}`;
  }

  private encodeSearchKeyword(keyword: string): string {
    return [...iconv.encode(keyword, 'euc-kr')]
      .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
      .join('');
  }

  private stripNulls(value: string): string {
    return value.replace(/\u0000+/g, '').trim();
  }

  private minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    try {
      const response = await globalThis.fetch(url);
      if (!response.ok) {
        throw new NetworkError(`Comcigan request failed with HTTP ${response.status}.`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof NetworkError || error instanceof UpstreamChangedError) {
        throw error;
      }
      throw new NetworkError('Comcigan request failed.', error);
    }
  }

  private meta(): ProviderMetadata {
    return {
      provider: 'comcigan',
      fetchedAt: new Date().toISOString(),
    };
  }

  private dataStatus(): DataStatus {
    return {
      accessMode: 'unofficial',
      complete: true,
      sourceProviders: ['comcigan'],
    };
  }

  private async loadRouteInfo(): Promise<ComciganRouteInfo> {
    const today = new Date().toISOString().slice(0, 10);
    if (this.routeCache?.cacheKey === today) {
      return this.routeCache;
    }

    const source = await this.fetchRouteSource();
    const routeInfo = this.parseRouteInfo(source, today);
    this.routeCache = routeInfo;
    return routeInfo;
  }

  private async fetchRouteSource(): Promise<string> {
    let lastSource = '';

    for (let attempt = 0; attempt < 3; attempt++) {
      const buffer = await this.fetchBuffer(`${this.baseUrl}${ST_PATH}`);
      lastSource = this.stripNulls(iconv.decode(buffer, 'euc-kr'));
      if (!lastSource.includes('refresh')) {
        return lastSource;
      }
    }

    return lastSource;
  }

  private parseRouteInfo(source: string, cacheKey: string): ComciganRouteInfo {
    const mainRoute = source.match(/(?<=\.\/)\d+(?=\?\d+l)/)?.[0];
    const searchRoute = source.match(/(?<=\?)\d+(?=l)/)?.[0];
    const dataPrefix = source.match(/sc_data\('([^']+)'/)?.[1];

    if (!mainRoute || !searchRoute || !dataPrefix) {
      throw new UpstreamChangedError('Comcigan route page no longer exposes the expected search/data routes.');
    }

    return {
      mainRoute,
      searchRoute,
      dataPrefix,
      cacheKey,
    };
  }

  private resolveSplitValue(raw: RawComciganData, teacherCount: number): number {
    const splitValue = Number(raw[KEY_SPLIT]);
    if (Number.isFinite(splitValue) && splitValue > 1) {
      return splitValue;
    }

    const digits = Math.max(2, String(Math.max(teacherCount - 1, 0)).length);
    return 10 ** digits;
  }

  private extractNumericClassTimes(candidate: unknown[]): ClassTimeSlot[] | undefined {
    const slots: ClassTimeSlot[] = [];

    for (let index = 0; index < candidate.length; index++) {
      const entry = candidate[index];
      if (!Array.isArray(entry) || entry.length < 2) {
        continue;
      }

      const start = Number(entry[0]);
      const end = Number(entry[1]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }

      slots.push({
        period: index + 1,
        startTime: this.minutesToTime(start),
        endTime: this.minutesToTime(end),
      });
    }

    return slots.length ? slots : undefined;
  }

  private extractStringClassTimes(candidate: unknown[]): ClassTimeSlot[] {
    const parsed = candidate
      .map((entry, index) => this.parseClassTimeString(entry, index + 1))
      .filter((entry): entry is { period: number; startTime: string } => entry != null);

    return parsed.map((entry, index) => ({
      period: entry.period,
      startTime: entry.startTime,
      endTime: parsed[index + 1]?.startTime ?? entry.startTime,
    }));
  }

  private parseClassTimeString(
    entry: unknown,
    defaultPeriod: number,
  ): { period: number; startTime: string } | undefined {
    if (typeof entry !== 'string') {
      return undefined;
    }

    const match = entry.match(/^\s*(\d+)\((\d{1,2}:\d{2})\)\s*$/);
    if (match) {
      return {
        period: Number(match[1]) || defaultPeriod,
        startTime: match[2],
      };
    }

    const timeMatch = entry.match(/(\d{1,2}:\d{2})/);
    if (!timeMatch) {
      return undefined;
    }

    return {
      period: defaultPeriod,
      startTime: timeMatch[1],
    };
  }

  private lookupOriginalCode(
    data: ParsedSchoolData,
    grade: number,
    classNo: number,
    weekday: number,
    period: number,
  ): number | undefined {
    const gradeData = data.originalTimetable[grade];
    if (!Array.isArray(gradeData)) {
      return undefined;
    }

    const classData = gradeData[classNo];
    if (!Array.isArray(classData)) {
      return undefined;
    }

    const dayData = classData[weekday];
    if (!Array.isArray(dayData)) {
      return undefined;
    }

    const encoded = Number(dayData[period] ?? 0);
    return encoded || undefined;
  }
}

interface ParsedSchoolData {
  school: SchoolRef;
  teacherNames: string[];
  subjects: string[];
  gradeCount: number;
  classCounts: Record<number, number>;
  splitValue: number;
  originalTimetable: unknown[];
  currentTimetable: unknown[];
  classTimes?: ClassTimeSlot[];
}

interface ComciganRouteInfo {
  mainRoute: string;
  searchRoute: string;
  dataPrefix: string;
  cacheKey: string;
}
