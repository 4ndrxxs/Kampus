import type {
  DailyMealService,
  DailyMeals,
  DataStatus,
  KampusProvider,
  MealItem,
  ProviderCapability,
  ProviderMetadata,
  ProviderWarning,
  SchoolInfo,
  SchoolRef,
  SchoolSearchResult,
  WeeklyMeals,
} from '@kampus/core';
import {
  MealsUnavailableError,
  NetworkError,
  ProviderUnavailableError,
  SchoolNotFoundError,
  formatDate,
  getMonday,
  readKampusCacheEntry,
  touchKampusCacheEntry,
  weekdayName,
  writeKampusCacheEntry,
} from '@kampus/core';

const NEIS_BASE = 'https://open.neis.go.kr/hub';

type NeisRow = Record<string, string>;
type NeisQueryValue = string | number | undefined;

export type NeisDatasetName =
  | 'schoolInfo'
  | 'mealServiceDietInfo'
  | 'classInfo'
  | 'schoolMajorinfo'
  | 'schulAflcoinfo'
  | 'SchoolSchedule'
  | 'elsTimetable'
  | 'misTimetable'
  | 'hisTimetable'
  | 'spsTimetable'
  | 'tiClrminfo'
  | 'acaInsTiInfo';

export interface NeisDatasetResult<T> {
  rows: T[];
  totalCount?: number;
  providerMetadata?: ProviderMetadata;
  dataStatus: DataStatus;
}

export interface NeisClassInfoRecord {
  year?: string;
  grade?: number;
  className?: string;
  schoolCourseName?: string;
  dayNightCourseName?: string;
  trackName?: string;
  departmentName?: string;
  raw: NeisRow;
}

export interface NeisMajorInfoRecord {
  dayNightCourseName?: string;
  trackName?: string;
  departmentName?: string;
  raw: NeisRow;
}

export interface NeisTrackInfoRecord {
  dayNightCourseName?: string;
  trackName?: string;
  raw: NeisRow;
}

export interface NeisAcademicScheduleRecord {
  date?: string;
  eventName?: string;
  eventContent?: string;
  schoolYear?: string;
  schoolCourseName?: string;
  dayNightCourseName?: string;
  gradeEventYears: number[];
  raw: NeisRow;
}

export interface NeisOfficialTimetableRecord {
  date?: string;
  year?: string;
  semester?: string;
  grade?: number;
  className?: string;
  period?: number;
  content?: string;
  schoolCourseName?: string;
  dayNightCourseName?: string;
  trackName?: string;
  departmentName?: string;
  classroomName?: string;
  raw: NeisRow;
}

export interface NeisClassroomInfoRecord {
  year?: string;
  grade?: number;
  semester?: string;
  schoolCourseName?: string;
  dayNightCourseName?: string;
  trackName?: string;
  departmentName?: string;
  classroomName?: string;
  raw: NeisRow;
}

export interface NeisAcademyInfoRecord {
  academyName?: string;
  academyNumber?: string;
  adminZoneName?: string;
  fieldName?: string;
  seriesName?: string;
  courseName?: string;
  raw: NeisRow;
}

export interface NeisProviderOptions {
  apiKey?: string;
  maxAutoPages?: number;
  cachePath?: string;
  cacheTtlMs?: number;
  staleIfErrorMs?: number;
  cacheMaxEntries?: number;
}

type NeisTimetableServiceName = 'elsTimetable' | 'misTimetable' | 'hisTimetable' | 'spsTimetable';

interface OfficialTimetableQueryParams {
  school: SchoolRef;
  year?: string;
  semester?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  dayNightCourseName?: string;
  schoolCourseName?: string;
  grade?: number;
  className?: string;
  period?: number;
  trackName?: string;
  departmentName?: string;
  classroomName?: string;
}

interface OfficialTimetableProbe {
  year?: number;
  date?: string;
}

interface NeisDatasetEnvelope {
  rows: NeisRow[];
  totalCount?: number;
  providerMetadata?: ProviderMetadata;
  dataStatus: DataStatus;
}

export class NeisProvider implements KampusProvider {
  readonly name = 'neis';
  readonly capabilities: ReadonlySet<ProviderCapability> = new Set([
    'schoolSearch',
    'schoolInfo',
    'meals',
  ]);

  private readonly apiKey: string;
  private readonly maxAutoPages: number;
  private readonly cachePath?: string;
  private readonly cacheTtlMs: number;
  private readonly staleIfErrorMs: number;
  private readonly cacheMaxEntries: number;

  constructor(options?: NeisProviderOptions) {
    this.apiKey = options?.apiKey?.trim() ?? process.env.NEIS_API_KEY?.trim() ?? '';
    this.maxAutoPages = Math.max(1, options?.maxAutoPages ?? 25);
    this.cachePath = options?.cachePath;
    this.cacheTtlMs = Math.max(0, options?.cacheTtlMs ?? 15 * 60 * 1000);
    this.staleIfErrorMs = Math.max(0, options?.staleIfErrorMs ?? 24 * 60 * 60 * 1000);
    this.cacheMaxEntries = Math.max(1, options?.cacheMaxEntries ?? 250);
  }

  async searchSchools(keyword: string): Promise<SchoolSearchResult[]> {
    const result = await this.requestDataset(
      'schoolInfo',
      this.createQuery({
        SCHUL_NM: keyword,
        pSize: 30,
      }),
    );

    return result.rows.map((row) => ({
      name: row.SCHUL_NM,
      region: row.LCTN_SC_NM || row.ATPT_OFCDC_SC_NM,
      schoolType: row.SCHUL_KND_SC_NM,
      providerRefs: {
        neis: {
          officeCode: row.ATPT_OFCDC_SC_CODE,
          schoolCode: row.SD_SCHUL_CODE,
        },
      },
      sourceProviders: ['neis'],
    }));
  }

  async getSchoolInfo(school: SchoolRef): Promise<SchoolInfo> {
    const ref = this.getNeisRef(school);
    const result = await this.requestDataset(
      'schoolInfo',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
      }),
    );
    const row = result.rows[0];
    if (!row) {
      throw new SchoolNotFoundError(school.name);
    }

    return {
      name: row.SCHUL_NM,
      region: row.LCTN_SC_NM || row.ATPT_OFCDC_SC_NM,
      schoolType: row.SCHUL_KND_SC_NM,
      providerRefs: {
        neis: ref,
      },
      address: row.ORG_RDNMA,
      phone: row.ORG_TELNO,
      website: row.HMPG_ADRES,
      providerMetadata: result.providerMetadata,
      dataStatus: result.dataStatus,
      warnings: result.dataStatus.warnings,
    };
  }

  async getMealsToday(params: {
    school: SchoolRef;
    date?: string;
  }): Promise<DailyMeals> {
    const ref = this.getNeisRef(params.school);
    const date = params.date ?? formatDate(new Date());
    const result = await this.requestDataset(
      'mealServiceDietInfo',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        MLSV_YMD: date.replace(/-/g, ''),
      }),
    );

    if (!result.rows.length) {
      throw new MealsUnavailableError(`No meals were published for ${date}.`);
    }

    return this.parseDailyMeals(result.rows, date, result.providerMetadata, result.dataStatus);
  }

  async getMealsWeek(params: {
    school: SchoolRef;
    weekOffset?: number;
    date?: string;
  }): Promise<WeeklyMeals> {
    const baseDate = params.date ? new Date(params.date) : new Date();
    if (params.weekOffset) {
      baseDate.setDate(baseDate.getDate() + params.weekOffset * 7);
    }

    const monday = getMonday(baseDate);
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);

    return this.getMealsRangeInternal({
      school: params.school,
      fromDate: formatDate(monday),
      toDate: formatDate(friday),
      weekStart: formatDate(monday),
    });
  }

  async getMealsRange(params: {
    school: SchoolRef;
    fromDate: string;
    toDate: string;
  }): Promise<WeeklyMeals> {
    return this.getMealsRangeInternal(params);
  }

  async getDatasetRows(
    serviceName: NeisDatasetName,
    query: Record<string, NeisQueryValue>,
  ): Promise<NeisRow[]> {
    return (await this.getDatasetResult(serviceName, query)).rows;
  }

  async getDatasetResult(
    serviceName: NeisDatasetName,
    query: Record<string, NeisQueryValue>,
  ): Promise<NeisDatasetResult<NeisRow>> {
    const result = await this.requestDataset(serviceName, this.createQuery(query));
    return {
      rows: result.rows,
      totalCount: result.totalCount,
      providerMetadata: result.providerMetadata,
      dataStatus: result.dataStatus,
    };
  }

  async getClassInfoRows(params: {
    school: SchoolRef;
    year?: string;
    grade?: number;
    dayNightCourseName?: string;
    schoolCourseName?: string;
    trackName?: string;
    departmentName?: string;
  }): Promise<NeisClassInfoRecord[]> {
    return (await this.getClassInfoResult(params)).rows;
  }

  async getClassInfoResult(params: {
    school: SchoolRef;
    year?: string;
    grade?: number;
    dayNightCourseName?: string;
    schoolCourseName?: string;
    trackName?: string;
    departmentName?: string;
  }): Promise<NeisDatasetResult<NeisClassInfoRecord>> {
    const ref = this.getNeisRef(params.school);
    const result = await this.requestDataset(
      'classInfo',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        AY: params.year,
        GRADE: stringifyNumber(params.grade),
        DGHT_CRSE_SC_NM: params.dayNightCourseName,
        SCHUL_CRSE_SC_NM: params.schoolCourseName,
        ORD_SC_NM: params.trackName,
        DDDEP_NM: params.departmentName,
      }),
    );

    return this.mapDatasetResult(result, (row) => ({
      year: row.AY,
      grade: parseInteger(row.GRADE),
      className: row.CLASS_NM,
      schoolCourseName: row.SCHUL_CRSE_SC_NM,
      dayNightCourseName: row.DGHT_CRSE_SC_NM,
      trackName: row.ORD_SC_NM,
      departmentName: row.DDDEP_NM,
      raw: row,
    }));
  }

  async getMajorInfoRows(params: {
    school: SchoolRef;
    dayNightCourseName?: string;
    trackName?: string;
  }): Promise<NeisMajorInfoRecord[]> {
    return (await this.getMajorInfoResult(params)).rows;
  }

  async getMajorInfoResult(params: {
    school: SchoolRef;
    dayNightCourseName?: string;
    trackName?: string;
  }): Promise<NeisDatasetResult<NeisMajorInfoRecord>> {
    const ref = this.getNeisRef(params.school);
    const result = await this.requestDataset(
      'schoolMajorinfo',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        DGHT_CRSE_SC_NM: params.dayNightCourseName,
        ORD_SC_NM: params.trackName,
      }),
    );

    return this.mapDatasetResult(result, (row) => ({
      dayNightCourseName: row.DGHT_CRSE_SC_NM,
      trackName: row.ORD_SC_NM,
      departmentName: row.DDDEP_NM,
      raw: row,
    }));
  }

  async getTrackInfoRows(params: {
    school: SchoolRef;
    dayNightCourseName?: string;
  }): Promise<NeisTrackInfoRecord[]> {
    return (await this.getTrackInfoResult(params)).rows;
  }

  async getTrackInfoResult(params: {
    school: SchoolRef;
    dayNightCourseName?: string;
  }): Promise<NeisDatasetResult<NeisTrackInfoRecord>> {
    const ref = this.getNeisRef(params.school);
    const result = await this.requestDataset(
      'schulAflcoinfo',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        DGHT_CRSE_SC_NM: params.dayNightCourseName,
      }),
    );

    return this.mapDatasetResult(result, (row) => ({
      dayNightCourseName: row.DGHT_CRSE_SC_NM,
      trackName: row.ORD_SC_NM,
      raw: row,
    }));
  }

  async getAcademicScheduleRows(params: {
    school: SchoolRef;
    schoolCourseName?: string;
    dayNightCourseName?: string;
    date?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<NeisAcademicScheduleRecord[]> {
    return (await this.getAcademicScheduleResult(params)).rows;
  }

  async getAcademicScheduleResult(params: {
    school: SchoolRef;
    schoolCourseName?: string;
    dayNightCourseName?: string;
    date?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<NeisDatasetResult<NeisAcademicScheduleRecord>> {
    const ref = this.getNeisRef(params.school);
    const result = await this.requestDataset(
      'SchoolSchedule',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        SCHUL_CRSE_SC_NM: params.schoolCourseName,
        DGHT_CRSE_SC_NM: params.dayNightCourseName,
        AA_YMD: compactDate(params.date),
        AA_FROM_YMD: compactDate(params.fromDate),
        AA_TO_YMD: compactDate(params.toDate),
      }),
    );

    return this.mapDatasetResult(result, (row) => ({
      date: expandDate(row.AA_YMD),
      eventName: row.EVENT_NM,
      eventContent: row.EVENT_CNTNT,
      schoolYear: row.AY,
      schoolCourseName: row.SCHUL_CRSE_SC_NM,
      dayNightCourseName: row.DGHT_CRSE_SC_NM,
      gradeEventYears: extractGradeEventYears(row),
      raw: row,
    }));
  }

  async getOfficialTimetableRows(params: OfficialTimetableQueryParams): Promise<NeisOfficialTimetableRecord[]> {
    return (await this.getOfficialTimetableResult(params)).rows;
  }

  async getOfficialTimetableResult(
    params: OfficialTimetableQueryParams,
  ): Promise<NeisDatasetResult<NeisOfficialTimetableRecord>> {
    const ref = this.getNeisRef(params.school);
    const serviceName = await this.resolveTimetableServiceName(params.school);
    const result = await this.requestDataset(
      serviceName,
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        AY: params.year,
        SEM: params.semester,
        ALL_TI_YMD: compactDate(params.date),
        TI_FROM_YMD: compactDate(params.fromDate),
        TI_TO_YMD: compactDate(params.toDate),
        DGHT_CRSE_SC_NM: params.dayNightCourseName,
        SCHUL_CRSE_SC_NM: params.schoolCourseName,
        GRADE: stringifyNumber(params.grade),
        CLASS_NM: params.className,
        PERIO: stringifyNumber(params.period),
        ORD_SC_NM: params.trackName,
        DDDEP_NM: params.departmentName,
        CLRM_NM: params.classroomName,
      }),
    );

    const diagnosedResult = await this.diagnoseOfficialTimetableResult(result, params, serviceName);

    return this.mapDatasetResult(diagnosedResult, (row) => ({
      date: expandDate(row.ALL_TI_YMD),
      year: row.AY,
      semester: row.SEM,
      grade: parseInteger(row.GRADE),
      className: row.CLASS_NM,
      period: parseInteger(row.PERIO),
      content: row.ITRT_CNTNT,
      schoolCourseName: row.SCHUL_CRSE_SC_NM,
      dayNightCourseName: row.DGHT_CRSE_SC_NM,
      trackName: row.ORD_SC_NM,
      departmentName: row.DDDEP_NM,
      classroomName: row.CLRM_NM,
      raw: row,
    }));
  }

  async getClassroomInfoRows(params: {
    school: SchoolRef;
    year?: string;
    grade?: number;
    semester?: string;
    schoolCourseName?: string;
    dayNightCourseName?: string;
    trackName?: string;
    departmentName?: string;
  }): Promise<NeisClassroomInfoRecord[]> {
    return (await this.getClassroomInfoResult(params)).rows;
  }

  async getClassroomInfoResult(params: {
    school: SchoolRef;
    year?: string;
    grade?: number;
    semester?: string;
    schoolCourseName?: string;
    dayNightCourseName?: string;
    trackName?: string;
    departmentName?: string;
  }): Promise<NeisDatasetResult<NeisClassroomInfoRecord>> {
    const ref = this.getNeisRef(params.school);
    const result = await this.requestDataset(
      'tiClrminfo',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        AY: params.year,
        GRADE: stringifyNumber(params.grade),
        SEM: params.semester,
        SCHUL_CRSE_SC_NM: params.schoolCourseName,
        DGHT_CRSE_SC_NM: params.dayNightCourseName,
        ORD_SC_NM: params.trackName,
        DDDEP_NM: params.departmentName,
      }),
    );

    return this.mapDatasetResult(result, (row) => ({
      year: row.AY,
      grade: parseInteger(row.GRADE),
      semester: row.SEM,
      schoolCourseName: row.SCHUL_CRSE_SC_NM,
      dayNightCourseName: row.DGHT_CRSE_SC_NM,
      trackName: row.ORD_SC_NM,
      departmentName: row.DDDEP_NM,
      classroomName: row.CLRM_NM,
      raw: row,
    }));
  }

  async searchAcademyInfoRows(params: {
    officeCode?: string;
    adminZoneName?: string;
    academyNumber?: string;
    academyName?: string;
    fieldName?: string;
    seriesName?: string;
    courseName?: string;
  }): Promise<NeisAcademyInfoRecord[]> {
    return (await this.searchAcademyInfoResult(params)).rows;
  }

  async searchAcademyInfoResult(params: {
    officeCode?: string;
    adminZoneName?: string;
    academyNumber?: string;
    academyName?: string;
    fieldName?: string;
    seriesName?: string;
    courseName?: string;
  }): Promise<NeisDatasetResult<NeisAcademyInfoRecord>> {
    const result = await this.requestDataset(
      'acaInsTiInfo',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: params.officeCode,
        ADMST_ZONE_NM: params.adminZoneName,
        ACA_ASNUM: params.academyNumber,
        ACA_NM: params.academyName,
        REALM_SC_NM: params.fieldName,
        LE_ORD_NM: params.seriesName,
        LE_CRSE_NM: params.courseName,
      }),
    );

    return this.mapDatasetResult(result, (row) => ({
      academyName: row.ACA_NM,
      academyNumber: row.ACA_ASNUM,
      adminZoneName: row.ADMST_ZONE_NM,
      fieldName: row.REALM_SC_NM,
      seriesName: row.LE_ORD_NM,
      courseName: row.LE_CRSE_NM,
      raw: row,
    }));
  }

  private getNeisRef(school: SchoolRef) {
    const ref = school.providerRefs.neis;
    if (!ref) {
      throw new MealsUnavailableError(
        `NEIS school reference is missing for "${school.name}". Resolve the school through search first.`,
      );
    }
    return ref;
  }

  private async getMealsRangeInternal(params: {
    school: SchoolRef;
    fromDate: string;
    toDate: string;
    weekStart?: string;
  }): Promise<WeeklyMeals> {
    const ref = this.getNeisRef(params.school);
    const result = await this.requestDataset(
      'mealServiceDietInfo',
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        MLSV_FROM_YMD: compactDate(params.fromDate),
        MLSV_TO_YMD: compactDate(params.toDate),
      }),
    );

    const grouped = new Map<string, NeisRow[]>();
    for (const row of result.rows) {
      const rawDate = row.MLSV_YMD;
      if (!rawDate || rawDate.length !== 8) {
        continue;
      }

      const isoDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const bucket = grouped.get(isoDate);
      if (bucket) {
        bucket.push(row);
      } else {
        grouped.set(isoDate, [row]);
      }
    }

    const days = [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, rows]) => this.parseDailyMeals(rows, date));

    if (!days.length) {
      throw new MealsUnavailableError(
        `No meals were published between ${params.fromDate} and ${params.toDate}.`,
      );
    }

    return {
      school: {
        ...params.school,
        providerRefs: {
          ...params.school.providerRefs,
          neis: ref,
        },
      },
      weekStart: params.weekStart,
      fromDate: params.fromDate,
      toDate: params.toDate,
      days,
      providerMetadata: result.providerMetadata,
      dataStatus: result.dataStatus,
      warnings: result.dataStatus.warnings,
    };
  }

  private parseDailyMeals(
    rows: NeisRow[],
    date: string,
    providerMetadata?: ProviderMetadata,
    dataStatus?: DataStatus,
  ): DailyMeals {
    return {
      date,
      weekdayName: weekdayName(new Date(date).getDay() || 7),
      meals: rows.map((row) => this.parseMealService(row)),
      providerMetadata,
      dataStatus,
      warnings: dataStatus?.warnings,
    };
  }

  private parseMealService(row: NeisRow): DailyMealService {
    return {
      type: row.MMEAL_SC_NM,
      mealCode: row.MMEAL_SC_CODE,
      items: this.parseDishNames(row.DDISH_NM ?? ''),
      calories: row.CAL_INFO || undefined,
      nutritionInfo: row.NTR_INFO || undefined,
      originInfo: row.ORPLC_INFO || undefined,
      rawMenuText: row.DDISH_NM || undefined,
      rawRow: row,
    };
  }

  private parseDishNames(raw: string): MealItem[] {
    if (!raw.trim()) {
      return [];
    }

    return raw
      .split(/<br\/?>/i)
      .map((line) => line.replace(/\*/g, '').trim())
      .filter(Boolean)
      .map((line) => {
        const allergyMatch = line.match(/\(([0-9.]+)\)\s*$/);
        return {
          name: line.replace(/\s*\([0-9.]+\)\s*$/, '').trim(),
          allergyCodes: allergyMatch
            ? allergyMatch[1]
                .split('.')
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value))
            : undefined,
        };
      })
      .filter((item) => item.name.length > 0);
  }

  private createQuery(query: Record<string, NeisQueryValue>): URLSearchParams {
    const params = new URLSearchParams({
      Type: 'json',
      pSize: '1000',
    });

    if (this.apiKey) {
      params.set('KEY', this.apiKey);
    }

    for (const [key, value] of Object.entries(query)) {
      if (value == null) {
        continue;
      }
      const stringValue = `${value}`.trim();
      if (!stringValue) {
        continue;
      }
      params.set(key, stringValue);
    }

    return params;
  }

  private async resolveTimetableServiceName(
    school: SchoolRef,
  ): Promise<NeisTimetableServiceName> {
    const schoolType = (
      school.schoolType ??
      (await this.getSchoolInfo(school)).schoolType ??
      ''
    ).replace(/\s+/g, '');

    if (schoolType.includes('\uCD08\uB4F1\uD559\uAD50')) {
      return 'elsTimetable';
    }
    if (schoolType.includes('\uC911\uD559\uAD50')) {
      return 'misTimetable';
    }
    if (schoolType.includes('\uD2B9\uC218\uD559\uAD50')) {
      return 'spsTimetable';
    }
    return 'hisTimetable';
  }

  private async diagnoseOfficialTimetableResult(
    result: NeisDatasetEnvelope,
    params: OfficialTimetableQueryParams,
    serviceName: NeisTimetableServiceName,
  ): Promise<NeisDatasetEnvelope> {
    if (result.rows.length > 0) {
      return result;
    }

    const warnings: ProviderWarning[] = [
      {
        provider: 'neis',
        code: 'NEIS_TIMETABLE_NO_DATA',
        message: 'NEIS returned no official timetable rows for this query.',
      },
    ];

    const requestedYear = detectRequestedAcademicYear(params);
    if (requestedYear != null && requestedYear > 1) {
      try {
        const sameYearSample = await this.probeOfficialTimetableYear(params, serviceName, requestedYear);
        if (sameYearSample) {
          warnings.push({
            provider: 'neis',
            code: 'NEIS_TIMETABLE_FILTER_NO_MATCH',
            message:
              `No official timetable rows matched this exact query, but NEIS does expose timetable data for academic year ${sameYearSample.year ?? requestedYear}. ` +
              `The requested date, class, or period filters may be too narrow.${sameYearSample.date ? ` Sample row date: ${sameYearSample.date}.` : ''}`,
          });
        } else {
          const previousYearSample = await this.probeOfficialTimetableYear(
            params,
            serviceName,
            requestedYear - 1,
          );
          if (previousYearSample) {
            warnings.push({
              provider: 'neis',
              code: 'NEIS_TIMETABLE_YEAR_LAG',
              message:
                `No official timetable rows matched academic year ${requestedYear}. ` +
                `This school currently appears to expose ${previousYearSample.year ?? requestedYear - 1} timetable data in NEIS.` +
                `${previousYearSample.date ? ` Sample row date: ${previousYearSample.date}.` : ''}`,
            });
          }
        }
      } catch {
        // Diagnostic probes are best-effort and should not turn an empty result into a hard failure.
      }
    }

    return this.withMergedWarnings(result, warnings);
  }

  private async requestDataset(serviceName: NeisDatasetName, params: URLSearchParams): Promise<NeisDatasetEnvelope> {
    const cacheKey = this.buildCacheKey(serviceName, params);
    const cachedRead = this.cachePath
      ? readKampusCacheEntry<NeisDatasetEnvelope>(cacheKey, { cachePath: this.cachePath })
      : { state: 'missing' as const };
    const cacheState = this.resolveCacheState(cachedRead.entry);

    if (cacheState === 'fresh' && cachedRead.entry?.value) {
      touchKampusCacheEntry(cacheKey, { cachePath: this.cachePath });
      return this.withCacheState(cachedRead.entry.value, 'fresh');
    }

    try {
      const firstPage = await this.fetchDatasetPage(serviceName, params);
      const aggregated = await this.fetchRemainingPages(serviceName, params, firstPage);
      const dataStatus = this.buildDataStatus(aggregated.totalCount, aggregated.rows.length, {
        pageLimitReached: aggregated.pageLimitReached,
      });

      const envelope: NeisDatasetEnvelope = {
        rows: aggregated.rows,
        totalCount: aggregated.totalCount,
        dataStatus,
        providerMetadata: this.meta(dataStatus),
      };

      this.storeEnvelope(cacheKey, envelope, serviceName, params);
      return envelope;
    } catch (error) {
      if (cacheState === 'stale' && cachedRead.entry?.value) {
        touchKampusCacheEntry(cacheKey, { cachePath: this.cachePath });
        return this.withCacheState(cachedRead.entry.value, 'stale');
      }
      throw error;
    }
  }

  private async probeOfficialTimetableYear(
    params: OfficialTimetableQueryParams,
    serviceName: NeisTimetableServiceName,
    year: number,
  ): Promise<OfficialTimetableProbe | null> {
    if (!Number.isInteger(year) || year < 1) {
      return null;
    }

    const ref = this.getNeisRef(params.school);
    const result = await this.fetchDatasetPage(
      serviceName,
      this.createQuery({
        ATPT_OFCDC_SC_CODE: ref.officeCode,
        SD_SCHUL_CODE: ref.schoolCode,
        AY: String(year),
        SCHUL_CRSE_SC_NM: params.schoolCourseName,
        DGHT_CRSE_SC_NM: params.dayNightCourseName,
        ORD_SC_NM: params.trackName,
        DDDEP_NM: params.departmentName,
        pSize: 1,
      }),
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      year: parseInteger(row.AY) ?? year,
      date: expandDate(row.ALL_TI_YMD),
    };
  }

  private withMergedWarnings(
    result: NeisDatasetEnvelope,
    extraWarnings: ProviderWarning[],
  ): NeisDatasetEnvelope {
    const mergedWarnings = dedupeWarnings([...(result.dataStatus.warnings ?? []), ...extraWarnings]);
    const dataStatus: DataStatus = {
      ...result.dataStatus,
      warnings: mergedWarnings.length ? mergedWarnings : undefined,
    };

    return {
      ...result,
      dataStatus,
      providerMetadata: result.providerMetadata
        ? {
            ...result.providerMetadata,
            warnings: dataStatus.warnings?.map((warning) => warning.message),
          }
        : this.meta(dataStatus),
    };
  }

  private buildDataStatus(
    totalCount: number | undefined,
    rowCount: number,
    options?: { pageLimitReached?: boolean; cacheState?: 'fresh' | 'stale' },
  ): DataStatus {
    const warnings: ProviderWarning[] = [];
    const complete = totalCount == null || totalCount <= rowCount;

    if (!this.apiKey) {
      warnings.push({
        provider: 'neis',
        code: 'NEIS_KEYLESS_LIMITED',
        message:
          'NEIS is running without an API key. The official sample mode may return at most a small subset of rows.',
      });
    }

    if (totalCount != null && totalCount > rowCount) {
      warnings.push({
        provider: 'neis',
        code: 'NEIS_TRUNCATED',
        message: `NEIS returned ${rowCount} row(s) out of ${totalCount}. Add a NEIS API key or narrow the query for a complete result.`,
      });
    }

    if (options?.pageLimitReached) {
      warnings.push({
        provider: 'neis',
        code: 'NEIS_PAGE_LIMIT',
        message: `NEIS auto-pagination stopped after ${this.maxAutoPages} page(s). Narrow the query or increase the page limit in the provider configuration.`,
      });
    }

    if (options?.cacheState === 'stale') {
      warnings.push({
        provider: 'neis',
        code: 'NEIS_STALE_CACHE',
        message:
          'Kampus returned a stale cached NEIS response because the live request failed. Re-run later to refresh the official data.',
      });
    }

    return {
      accessMode: this.apiKey ? 'official-full' : 'official-limited',
      complete,
      sourceProviders: ['neis'],
      warnings: warnings.length ? warnings : undefined,
    };
  }

  private async fetchRemainingPages(
    serviceName: NeisDatasetName,
    params: URLSearchParams,
    firstPage: { rows: NeisRow[]; totalCount?: number },
  ): Promise<{ rows: NeisRow[]; totalCount?: number; pageLimitReached: boolean }> {
    const totalCount = firstPage.totalCount;
    if (!this.apiKey || totalCount == null || totalCount <= firstPage.rows.length) {
      return {
        rows: firstPage.rows,
        totalCount,
        pageLimitReached: false,
      };
    }

    const pageSize = Math.max(parseInteger(params.get('pSize') ?? undefined) ?? 1000, 1);
    const startPage = Math.max(parseInteger(params.get('pIndex') ?? undefined) ?? 1, 1);
    const totalPages = Math.max(Math.ceil(totalCount / pageSize), startPage);
    const lastPage = Math.min(totalPages, startPage + this.maxAutoPages - 1);
    const rows = [...firstPage.rows];

    for (let page = startPage + 1; page <= lastPage && rows.length < totalCount; page += 1) {
      const pageParams = new URLSearchParams(params);
      pageParams.set('pIndex', String(page));
      const nextPage = await this.fetchDatasetPage(serviceName, pageParams);
      if (!nextPage.rows.length) {
        break;
      }
      rows.push(...nextPage.rows);
    }

    return {
      rows: rows.slice(0, totalCount),
      totalCount,
      pageLimitReached: lastPage < totalPages && rows.length < totalCount,
    };
  }

  private async fetchDatasetPage(
    serviceName: NeisDatasetName,
    params: URLSearchParams,
  ): Promise<{ rows: NeisRow[]; totalCount?: number }> {
    const payload = await this.fetchJson(`${NEIS_BASE}/${serviceName}?${params}`);
    const apiError = this.extractApiError(payload, serviceName);
    if (apiError) {
      if (apiError.code === 'INFO-200') {
        return {
          rows: [],
          totalCount: 0,
        };
      }

      if (apiError.code === 'ERROR-290') {
        if (!this.apiKey) {
          throw new ProviderUnavailableError(
            'neis',
            undefined,
            'NEIS sample mode is currently unavailable. Configure a NEIS API key and retry.',
          );
        }

        throw new ProviderUnavailableError(
          'neis',
          undefined,
          'NEIS_API_KEY is missing or invalid. Set a valid NEIS API key to use NEIS-backed features.',
        );
      }

      throw new ProviderUnavailableError(
        'neis',
        undefined,
        `NEIS API error ${apiError.code}: ${apiError.message}`,
      );
    }

    return {
      rows: this.extractRows(payload, serviceName),
      totalCount: this.extractTotalCount(payload, serviceName),
    };
  }

  private async fetchJson(url: string): Promise<unknown> {
    try {
      const response = await globalThis.fetch(url);
      if (!response.ok) {
        throw new NetworkError(`NEIS request failed with HTTP ${response.status}.`);
      }
      return response.json();
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      throw new NetworkError('NEIS request failed.', error);
    }
  }

  private extractRows(payload: unknown, serviceName: string): NeisRow[] {
    const service = (payload as Record<string, unknown>)[serviceName];
    if (!Array.isArray(service)) {
      return [];
    }

    const rowBlock = service.find(
      (entry): entry is { row?: NeisRow[] } =>
        typeof entry === 'object' && entry !== null && 'row' in entry,
    );

    return rowBlock?.row ?? [];
  }

  private extractTotalCount(payload: unknown, serviceName: string): number | undefined {
    const service = (payload as Record<string, unknown>)[serviceName];
    if (!Array.isArray(service)) {
      return undefined;
    }

    for (const entry of service) {
      if (!entry || typeof entry !== 'object' || !('head' in entry)) {
        continue;
      }

      const head = (entry as { head?: unknown }).head;
      if (!Array.isArray(head)) {
        continue;
      }

      for (const headEntry of head) {
        if (!headEntry || typeof headEntry !== 'object') {
          continue;
        }

        const count = (headEntry as { list_total_count?: unknown }).list_total_count;
        const parsed = Number(count);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  private extractApiError(payload: unknown, serviceName: string): { code: string; message: string } | null {
    const topLevel = (payload as Record<string, unknown>).RESULT;
    const parsedTopLevel = this.parseApiErrorBlock(topLevel);
    if (parsedTopLevel) {
      return parsedTopLevel;
    }

    const service = (payload as Record<string, unknown>)[serviceName];
    if (!Array.isArray(service)) {
      return null;
    }

    for (const entry of service) {
      if (!entry || typeof entry !== 'object' || !('head' in entry)) {
        continue;
      }

      const head = (entry as { head?: unknown }).head;
      if (!Array.isArray(head)) {
        continue;
      }

      for (const headEntry of head) {
        if (!headEntry || typeof headEntry !== 'object' || !('RESULT' in headEntry)) {
          continue;
        }

        const result = this.parseApiErrorBlock((headEntry as { RESULT?: unknown }).RESULT);
        if (result && result.code !== 'INFO-000') {
          return result;
        }
      }
    }

    return null;
  }

  private parseApiErrorBlock(value: unknown): { code: string; message: string } | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const code = (value as Record<string, unknown>).CODE;
    const message = (value as Record<string, unknown>).MESSAGE;
    if (typeof code === 'string' && typeof message === 'string') {
      return { code, message };
    }

    return null;
  }

  private mapDatasetResult<T>(
    result: NeisDatasetEnvelope,
    mapper: (row: NeisRow) => T,
  ): NeisDatasetResult<T> {
    return {
      rows: result.rows.map(mapper),
      totalCount: result.totalCount,
      providerMetadata: result.providerMetadata,
      dataStatus: result.dataStatus,
    };
  }

  private meta(dataStatus: DataStatus): ProviderMetadata {
    return {
      provider: 'neis',
      fetchedAt: new Date().toISOString(),
      warnings: dataStatus.warnings?.map((warning: ProviderWarning) => warning.message),
    };
  }

  private withCacheState(
    envelope: NeisDatasetEnvelope,
    cacheState: 'fresh' | 'stale',
  ): NeisDatasetEnvelope {
    const warnings =
      cacheState === 'stale'
        ? dedupeWarnings([
            ...(envelope.dataStatus.warnings ?? []),
            {
              provider: 'neis',
              code: 'NEIS_STALE_CACHE',
              message:
                'Kampus returned a stale cached NEIS response because the live request failed. Re-run later to refresh the official data.',
            },
          ])
        : envelope.dataStatus.warnings;

    return {
      ...envelope,
      dataStatus: {
        ...envelope.dataStatus,
        warnings,
      },
      providerMetadata: {
        ...(envelope.providerMetadata ?? this.meta(envelope.dataStatus)),
        cached: true,
        warnings: warnings?.map((warning) => warning.message),
      },
    };
  }

  private storeEnvelope(
    cacheKey: string,
    envelope: NeisDatasetEnvelope,
    serviceName: NeisDatasetName,
    params: URLSearchParams,
  ): void {
    if (!this.cachePath || (this.cacheTtlMs <= 0 && this.staleIfErrorMs <= 0)) {
      return;
    }

    const now = new Date();
    const expiresAt =
      this.cacheTtlMs > 0 ? new Date(now.getTime() + this.cacheTtlMs).toISOString() : undefined;
    const staleUntil =
      this.staleIfErrorMs > 0
        ? new Date(now.getTime() + Math.max(this.cacheTtlMs, 0) + this.staleIfErrorMs).toISOString()
        : undefined;

    writeKampusCacheEntry<NeisDatasetEnvelope>(
      {
        key: cacheKey,
        value: envelope,
        storedAt: now.toISOString(),
        expiresAt,
        staleUntil,
        meta: {
          provider: 'neis',
          serviceName,
          params: params.toString(),
        },
      },
      {
        cachePath: this.cachePath,
        maxEntries: this.cacheMaxEntries,
      },
    );
  }

  private resolveCacheState(
    entry?: { storedAt?: string } | undefined,
  ): 'missing' | 'fresh' | 'stale' | 'expired' {
    if (!entry?.storedAt) {
      return 'missing';
    }

    const storedAt = Date.parse(entry.storedAt);
    if (!Number.isFinite(storedAt)) {
      return 'expired';
    }

    const ageMs = Date.now() - storedAt;
    if (this.cacheTtlMs > 0 && ageMs <= this.cacheTtlMs) {
      return 'fresh';
    }

    if (this.staleIfErrorMs > 0 && ageMs <= Math.max(this.cacheTtlMs, 0) + this.staleIfErrorMs) {
      return 'stale';
    }

    return 'expired';
  }

  private buildCacheKey(serviceName: NeisDatasetName, params: URLSearchParams): string {
    const filtered = new URLSearchParams(params);
    if (filtered.get('KEY')) {
      filtered.set('KEY', this.apiKey ? '__configured__' : '__none__');
    }

    const ordered = [...filtered.entries()].sort(([left], [right]) => left.localeCompare(right));
    return `neis:${serviceName}:${new URLSearchParams(ordered).toString()}`;
  }
}

function compactDate(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/-/g, '');
}

function expandDate(value?: string): string | undefined {
  if (!value || value.length !== 8) {
    return value || undefined;
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function stringifyNumber(value?: number): string | undefined {
  return value == null ? undefined : String(value);
}

function parseInteger(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function detectRequestedAcademicYear(params: OfficialTimetableQueryParams): number | undefined {
  return (
    parseInteger(params.year) ??
    extractYearFromDate(params.date) ??
    extractYearFromDate(params.fromDate) ??
    extractYearFromDate(params.toDate)
  );
}

function extractYearFromDate(value?: string): number | undefined {
  const match = value?.trim().match(/^(\d{4})/);
  return match ? parseInteger(match[1]) : undefined;
}

function extractGradeEventYears(row: NeisRow): number[] {
  const flags: Array<[number, string | undefined]> = [
    [1, row.ONE_GRADE_EVENT_YN],
    [2, row.TW_GRADE_EVENT_YN],
    [3, row.THREE_GRADE_EVENT_YN],
    [4, row.FR_GRADE_EVENT_YN],
    [5, row.FIV_GRADE_EVENT_YN],
    [6, row.SIX_GRADE_EVENT_YN],
  ];

  return flags.filter(([, value]) => value === 'Y').map(([grade]) => grade);
}

function dedupeWarnings(warnings: ProviderWarning[]): ProviderWarning[] {
  return warnings.filter((warning, index, values) => {
    return values.findIndex((candidate) => {
      return (
        candidate.provider === warning.provider &&
        candidate.code === warning.code &&
        candidate.message === warning.message
      );
    }) === index;
  });
}
