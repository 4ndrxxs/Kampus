#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  KampusClient,
  KampusError,
  resolveCachePolicy,
  resolveKampusCachePath,
  resolveNeisApiKey,
  type DataStatus,
  type ClassTimeSlot,
  type DailyMeals,
  type DayTimetable,
  type PeriodItem,
  type ProviderMetadata,
  type ProviderWarning,
  type SchoolInfo,
  type SchoolRef,
  type SchoolSearchResult,
  type SnapshotDiff,
  type TeacherInfo,
  type TeacherPeriodItem,
  type TeacherTimetable,
  type WeekTimetable,
  type WeeklyMeals,
} from '@kampus/core';
import { ComciganProvider } from '@kampus/provider-comcigan';
import { NeisProvider } from '@kampus/provider-neis';
import { z } from 'zod';

const providerRefsSchema = z.object({
  comcigan: z
    .object({
      schoolCode: z.number(),
    })
    .optional(),
  neis: z
    .object({
      officeCode: z.string(),
      schoolCode: z.string(),
    })
    .optional(),
});

const schoolSchema = z.object({
  name: z.string(),
  region: z.string().optional(),
  schoolType: z.string().optional(),
  providerRefs: providerRefsSchema,
});

const schoolSearchResultSchema = schoolSchema.extend({
  sourceProviders: z.array(z.enum(['comcigan', 'neis'])),
});

const providerWarningSchema = z.object({
  provider: z.string(),
  code: z.string(),
  message: z.string(),
});

const providerMetadataSchema = z.object({
  provider: z.string(),
  fetchedAt: z.string(),
  cached: z.boolean().optional(),
  warnings: z.array(z.string()).optional(),
});

const dataStatusSchema = z.object({
  accessMode: z.enum(['official-full', 'official-limited', 'unofficial']),
  complete: z.boolean(),
  sourceProviders: z.array(z.enum(['comcigan', 'neis'])),
  warnings: z.array(providerWarningSchema).optional(),
});

const schoolInfoSchema = schoolSchema.extend({
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  gradeCount: z.number().optional(),
  classCounts: z.record(z.string(), z.number()).optional(),
  teacherNames: z.array(z.string()).optional(),
  providerMetadata: providerMetadataSchema.optional(),
  dataStatus: dataStatusSchema.optional(),
  warnings: z.array(providerWarningSchema).optional(),
});

const periodSourceSchema = z.object({
  provider: z.string(),
  rawSubject: z.string().optional(),
  rawTeacher: z.string().optional(),
  rawCodes: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const periodSchema = z.object({
  period: z.number(),
  subject: z.string(),
  teacher: z.string().optional(),
  status: z.enum(['class', 'unknown-subject', 'free']),
  isFreePeriod: z.boolean(),
  source: periodSourceSchema,
});

const dayTimetableSchema = z.object({
  weekday: z.number(),
  weekdayName: z.string(),
  date: z.string().optional(),
  periods: z.array(periodSchema),
  providerMetadata: providerMetadataSchema.optional(),
  dataStatus: dataStatusSchema.optional(),
  warnings: z.array(providerWarningSchema).optional(),
});

const weekTimetableSchema = z.object({
  school: schoolSchema,
  grade: z.number(),
  classNo: z.number(),
  weekStart: z.string().optional(),
  days: z.array(dayTimetableSchema),
  providerMetadata: providerMetadataSchema.optional(),
  dataStatus: dataStatusSchema.optional(),
  warnings: z.array(providerWarningSchema).optional(),
});

const teacherPeriodSchema = z.object({
  period: z.number(),
  subject: z.string(),
  grade: z.number().optional(),
  classNo: z.number().optional(),
  classLabel: z.string().optional(),
  status: z.enum(['class', 'unknown-subject', 'free']),
  isFreePeriod: z.boolean(),
  source: periodSourceSchema,
});

const teacherDaySchema = z.object({
  weekday: z.number(),
  weekdayName: z.string(),
  date: z.string().optional(),
  periods: z.array(teacherPeriodSchema),
});

const teacherTimetableSchema = z.object({
  school: schoolSchema,
  teacherName: z.string(),
  days: z.array(teacherDaySchema),
  providerMetadata: providerMetadataSchema.optional(),
  dataStatus: dataStatusSchema.optional(),
  warnings: z.array(providerWarningSchema).optional(),
});

const teacherInfoSchema = z.object({
  school: schoolSchema,
  name: z.string(),
  subjects: z.array(z.string()).optional(),
  classes: z.array(z.string()).optional(),
  providerMetadata: providerMetadataSchema.optional(),
  dataStatus: dataStatusSchema.optional(),
  warnings: z.array(providerWarningSchema).optional(),
});

const mealItemSchema = z.object({
  name: z.string(),
  allergyCodes: z.array(z.number()).optional(),
});

const dailyMealServiceSchema = z.object({
  type: z.string(),
  mealCode: z.string().optional(),
  items: z.array(mealItemSchema),
  calories: z.string().optional(),
  nutritionInfo: z.string().optional(),
  originInfo: z.string().optional(),
  rawMenuText: z.string().optional(),
  rawRow: z.record(z.string(), z.string()).optional(),
});

const dailyMealsSchema = z.object({
  date: z.string(),
  weekdayName: z.string().optional(),
  meals: z.array(dailyMealServiceSchema),
  providerMetadata: providerMetadataSchema.optional(),
  dataStatus: dataStatusSchema.optional(),
  warnings: z.array(providerWarningSchema).optional(),
});

const weeklyMealsSchema = z.object({
  school: schoolSchema,
  weekStart: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  days: z.array(dailyMealsSchema),
  providerMetadata: providerMetadataSchema.optional(),
  dataStatus: dataStatusSchema.optional(),
  warnings: z.array(providerWarningSchema).optional(),
});

const classTimesSchema = z.array(
  z.object({
    period: z.number(),
    startTime: z.string(),
    endTime: z.string(),
  }),
);

const diffSchema = z.object({
  school: schoolSchema,
  grade: z.number(),
  classNo: z.number(),
  changes: z.array(
    z.object({
      weekday: z.number(),
      weekdayName: z.string(),
      period: z.number(),
      before: z.object({
        subject: z.string(),
        teacher: z.string().optional(),
        status: z.enum(['class', 'unknown-subject', 'free']).optional(),
      }),
      after: z.object({
        subject: z.string(),
        teacher: z.string().optional(),
        status: z.enum(['class', 'unknown-subject', 'free']).optional(),
      }),
    }),
  ),
});

const nextClassSchema = z
  .object({
    period: periodSchema,
    minutesUntil: z.number().optional(),
  })
  .nullable();

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const neisDatasetSchema = z.enum([
  'classInfo',
  'schoolMajorinfo',
  'schulAflcoinfo',
  'SchoolSchedule',
  'officialTimetable',
  'elsTimetable',
  'misTimetable',
  'hisTimetable',
  'spsTimetable',
  'tiClrminfo',
  'acaInsTiInfo',
]);

const neisRawRowSchema = z.record(z.string(), z.string());

const schoolSelectorInput = {
  schoolName: z.string().describe('School name to resolve'),
  region: z.string().optional().describe('Region hint to disambiguate'),
};

export function createKampusClient(): KampusClient {
  const cachePolicy = resolveCachePolicy();
  return new KampusClient({
    providers: [
      new ComciganProvider(),
      new NeisProvider({
        apiKey: resolveNeisApiKey(),
        cachePath: resolveKampusCachePath(),
        cacheTtlMs: cachePolicy.datasetTtlMinutes * 60 * 1000,
        staleIfErrorMs: cachePolicy.staleIfErrorHours * 60 * 60 * 1000,
        cacheMaxEntries: cachePolicy.maxEntries,
      }),
    ],
  });
}

function serializeSchool(school: SchoolRef) {
  return {
    name: school.name,
    region: school.region,
    schoolType: school.schoolType,
    providerRefs: {
      comcigan: school.providerRefs.comcigan,
      neis: school.providerRefs.neis,
    },
  };
}

function serializeWarnings(warnings?: ProviderWarning[]) {
  return warnings?.map((warning) => ({
    provider: warning.provider,
    code: warning.code,
    message: warning.message,
  }));
}

function serializeProviderMetadata(metadata?: ProviderMetadata) {
  if (!metadata) {
    return undefined;
  }

  return {
    provider: metadata.provider,
    fetchedAt: metadata.fetchedAt,
    cached: metadata.cached,
    warnings: metadata.warnings,
  };
}

function serializeDataStatus(dataStatus?: DataStatus) {
  if (!dataStatus) {
    return undefined;
  }

  return {
    accessMode: dataStatus.accessMode,
    complete: dataStatus.complete,
    sourceProviders: dataStatus.sourceProviders,
    warnings: serializeWarnings(dataStatus.warnings),
  };
}

function serializeSchoolSearchResult(school: SchoolSearchResult) {
  return {
    ...serializeSchool(school),
    sourceProviders: school.sourceProviders,
  };
}

function serializeSchoolInfo(info: SchoolInfo) {
  return {
    ...serializeSchool(info),
    address: info.address,
    phone: info.phone,
    website: info.website,
    gradeCount: info.gradeCount,
    classCounts: info.classCounts
      ? Object.fromEntries(Object.entries(info.classCounts).map(([key, value]) => [String(key), value]))
      : undefined,
    teacherNames: info.teacherNames,
    providerMetadata: serializeProviderMetadata(info.providerMetadata),
    dataStatus: serializeDataStatus(info.dataStatus),
    warnings: serializeWarnings(info.warnings),
  };
}

function serializePeriod(period: PeriodItem) {
  return {
    period: period.period,
    subject: period.subject,
    teacher: period.teacher,
    status: period.status,
    isFreePeriod: period.isFreePeriod,
    source: {
      provider: period.source.provider,
      rawSubject: period.source.rawSubject,
      rawTeacher: period.source.rawTeacher,
      rawCodes: period.source.rawCodes,
    },
  };
}

function serializeTeacherPeriod(period: TeacherPeriodItem) {
  return {
    period: period.period,
    subject: period.subject,
    grade: period.grade,
    classNo: period.classNo,
    classLabel: period.classLabel,
    status: period.status,
    isFreePeriod: period.isFreePeriod,
    source: {
      provider: period.source.provider,
      rawSubject: period.source.rawSubject,
      rawTeacher: period.source.rawTeacher,
      rawCodes: period.source.rawCodes,
    },
  };
}

function serializeDayTimetable(day: DayTimetable) {
  return {
    weekday: day.weekday,
    weekdayName: day.weekdayName,
    date: day.date,
    periods: day.periods.map(serializePeriod),
    providerMetadata: serializeProviderMetadata(day.providerMetadata),
    dataStatus: serializeDataStatus(day.dataStatus),
    warnings: serializeWarnings(day.warnings),
  };
}

function serializeWeekTimetable(week: WeekTimetable) {
  return {
    school: serializeSchool(week.school),
    grade: week.grade,
    classNo: week.classNo,
    weekStart: week.weekStart,
    days: week.days.map(serializeDayTimetable),
    providerMetadata: serializeProviderMetadata(week.providerMetadata),
    dataStatus: serializeDataStatus(week.dataStatus),
    warnings: serializeWarnings(week.warnings),
  };
}

function serializeTeacherTimetable(timetable: TeacherTimetable) {
  return {
    school: serializeSchool(timetable.school),
    teacherName: timetable.teacherName,
    days: timetable.days.map((day) => ({
      weekday: day.weekday,
      weekdayName: day.weekdayName,
      date: day.date,
      periods: day.periods.map(serializeTeacherPeriod),
    })),
    providerMetadata: serializeProviderMetadata(timetable.providerMetadata),
    dataStatus: serializeDataStatus(timetable.dataStatus),
    warnings: serializeWarnings(timetable.warnings),
  };
}

function serializeTeacherInfo(info: TeacherInfo) {
  return {
    school: serializeSchool(info.school),
    name: info.name,
    subjects: info.subjects,
    classes: info.classes,
    providerMetadata: serializeProviderMetadata(info.providerMetadata),
    dataStatus: serializeDataStatus(info.dataStatus),
    warnings: serializeWarnings(info.warnings),
  };
}

function serializeDailyMeals(meals: DailyMeals) {
  return {
    date: meals.date,
    weekdayName: meals.weekdayName,
    meals: meals.meals.map((meal) => ({
      type: meal.type,
      mealCode: meal.mealCode,
      items: meal.items.map((item) => ({
        name: item.name,
        allergyCodes: item.allergyCodes,
      })),
      calories: meal.calories,
      nutritionInfo: meal.nutritionInfo,
      originInfo: meal.originInfo,
      rawMenuText: meal.rawMenuText,
      rawRow: meal.rawRow,
    })),
    providerMetadata: serializeProviderMetadata(meals.providerMetadata),
    dataStatus: serializeDataStatus(meals.dataStatus),
    warnings: serializeWarnings(meals.warnings),
  };
}

function serializeWeeklyMeals(meals: WeeklyMeals) {
  return {
    school: serializeSchool(meals.school),
    weekStart: meals.weekStart,
    fromDate: meals.fromDate,
    toDate: meals.toDate,
    days: meals.days.map(serializeDailyMeals),
    providerMetadata: serializeProviderMetadata(meals.providerMetadata),
    dataStatus: serializeDataStatus(meals.dataStatus),
    warnings: serializeWarnings(meals.warnings),
  };
}

function serializeClassTimes(times: ClassTimeSlot[]) {
  return times.map((slot) => ({
    period: slot.period,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));
}

function serializeDiff(diff: SnapshotDiff) {
  return {
    school: serializeSchool(diff.school),
    grade: diff.grade,
    classNo: diff.classNo,
    changes: diff.changes.map((change) => ({
      weekday: change.weekday,
      weekdayName: change.weekdayName,
      period: change.period,
      before: change.before,
      after: change.after,
    })),
  };
}

function serializeNextClass(result: { period: PeriodItem; minutesUntil?: number } | null) {
  if (!result) {
    return null;
  }

  return {
    period: serializePeriod(result.period),
    minutesUntil: result.minutesUntil,
  };
}

function success<T extends Record<string, unknown>>(payload: T) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function failure(payload: { ok: false; error: { code: string; message: string } }) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function toErrorPayload(error: unknown) {
  if (error instanceof KampusError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function resolveInputSchool(
  client: KampusClient,
  input: { schoolName: string; region?: string },
) {
  return client.resolveSchool(input.schoolName, input.region);
}

function createNeisProvider(): NeisProvider {
  const cachePolicy = resolveCachePolicy();
  return new NeisProvider({
    apiKey: resolveNeisApiKey(),
    cachePath: resolveKampusCachePath(),
    cacheTtlMs: cachePolicy.datasetTtlMinutes * 60 * 1000,
    staleIfErrorMs: cachePolicy.staleIfErrorHours * 60 * 60 * 1000,
    cacheMaxEntries: cachePolicy.maxEntries,
  });
}

export function createServer(client: KampusClient = createKampusClient()): McpServer {
  const server = new McpServer({
    name: 'kampus',
    version: '0.1.0',
  });

  server.registerTool(
    'search_schools',
    {
      description: 'Search schools and return merged provider references.',
      inputSchema: {
        keyword: z.string().describe('School search keyword'),
      },
      outputSchema: {
        ok: z.boolean(),
        schools: z.array(schoolSearchResultSchema).optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ keyword }) => {
      try {
        const schools = await client.searchSchools(keyword);
        return success({
          ok: true,
          schools: schools.map(serializeSchoolSearchResult),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_school_info',
    {
      description: 'Resolve a school and fetch normalized school info.',
      inputSchema: schoolSelectorInput,
      outputSchema: {
        ok: z.boolean(),
        info: schoolInfoSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async (input) => {
      try {
        const school = await resolveInputSchool(client, input);
        const info = await client.getSchoolInfo(school);
        return success({
          ok: true,
          info: serializeSchoolInfo(info),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_student_timetable_today',
    {
      description: 'Fetch the current-day student timetable.',
      inputSchema: {
        ...schoolSelectorInput,
        grade: z.number().int().min(1).max(6),
        classNo: z.number().int().min(1).max(30),
        date: z.string().optional().describe('Optional YYYY-MM-DD override'),
      },
      outputSchema: {
        ok: z.boolean(),
        timetable: dayTimetableSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region, grade, classNo, date }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const timetable = await client.getTodayTimetable({
          school,
          grade,
          classNo,
          date: date ? new Date(date) : undefined,
        });
        return success({
          ok: true,
          timetable: serializeDayTimetable(timetable),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_student_timetable_day',
    {
      description: 'Fetch a specific weekday student timetable.',
      inputSchema: {
        ...schoolSelectorInput,
        grade: z.number().int().min(1).max(6),
        classNo: z.number().int().min(1).max(30),
        weekday: z.number().int().min(1).max(7),
        weekOffset: z.number().int().optional(),
      },
      outputSchema: {
        ok: z.boolean(),
        timetable: dayTimetableSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region, grade, classNo, weekday, weekOffset }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const timetable = await client.getDayTimetable({
          school,
          grade,
          classNo,
          weekday,
          weekOffset,
        });
        return success({
          ok: true,
          timetable: serializeDayTimetable(timetable),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_student_timetable_week',
    {
      description: 'Fetch a weekly student timetable.',
      inputSchema: {
        ...schoolSelectorInput,
        grade: z.number().int().min(1).max(6),
        classNo: z.number().int().min(1).max(30),
        weekOffset: z.number().int().optional(),
      },
      outputSchema: {
        ok: z.boolean(),
        timetable: weekTimetableSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region, grade, classNo, weekOffset }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const timetable = await client.getWeekTimetable({
          school,
          grade,
          classNo,
          weekOffset,
        });
        return success({
          ok: true,
          timetable: serializeWeekTimetable(timetable),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_teacher_timetable',
    {
      description: 'Fetch a teacher timetable.',
      inputSchema: {
        ...schoolSelectorInput,
        teacherName: z.string(),
        weekday: z.number().int().min(1).max(7).optional(),
        weekOffset: z.number().int().optional(),
      },
      outputSchema: {
        ok: z.boolean(),
        timetable: teacherTimetableSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region, teacherName, weekday, weekOffset }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const timetable = await client.getTeacherTimetable({
          school,
          teacherName,
          weekday,
          weekOffset,
        });
        return success({
          ok: true,
          timetable: serializeTeacherTimetable(timetable),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_teacher_info',
    {
      description: 'Fetch normalized teacher info.',
      inputSchema: {
        ...schoolSelectorInput,
        teacherName: z.string(),
      },
      outputSchema: {
        ok: z.boolean(),
        info: teacherInfoSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region, teacherName }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const info = await client.getTeacherInfo({
          school,
          teacherName,
        });
        return success({
          ok: true,
          info: serializeTeacherInfo(info),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_next_class',
    {
      description: 'Find the next class for a student timetable.',
      inputSchema: {
        ...schoolSelectorInput,
        grade: z.number().int().min(1).max(6),
        classNo: z.number().int().min(1).max(30),
        now: z.string().optional().describe('Optional ISO timestamp override'),
      },
      outputSchema: {
        ok: z.boolean(),
        nextClass: nextClassSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region, grade, classNo, now }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const nextClass = await client.getNextClass({
          school,
          grade,
          classNo,
          now: now ? new Date(now) : undefined,
        });
        return success({
          ok: true,
          nextClass: serializeNextClass(nextClass),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_class_times',
    {
      description: 'Fetch class time slots for a school.',
      inputSchema: schoolSelectorInput,
      outputSchema: {
        ok: z.boolean(),
        classTimes: classTimesSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const classTimes = await client.getClassTimes(school);
        return success({
          ok: true,
          classTimes: serializeClassTimes(classTimes),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_meals_today',
    {
      description: 'Fetch meals for a single date.',
      inputSchema: {
        ...schoolSelectorInput,
        date: z.string().optional(),
      },
      outputSchema: {
        ok: z.boolean(),
        meals: dailyMealsSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region, date }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const meals = await client.getMealsToday({ school, date });
        return success({
          ok: true,
          meals: serializeDailyMeals(meals),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_meals_week',
    {
      description: 'Fetch meals for a school week.',
      inputSchema: {
        ...schoolSelectorInput,
        weekOffset: z.number().int().optional(),
        date: z.string().optional(),
      },
      outputSchema: {
        ok: z.boolean(),
        meals: weeklyMealsSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ schoolName, region, weekOffset, date }) => {
      try {
        const school = await resolveInputSchool(client, { schoolName, region });
        const meals = await client.getMealsWeek({ school, weekOffset, date });
        return success({
          ok: true,
          meals: serializeWeeklyMeals(meals),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  server.registerTool(
    'get_neis_dataset',
    {
      description:
        'Fetch raw rows from official NEIS datasets that are not covered by the built-in school info and meals tools.',
      inputSchema: {
        dataset: neisDatasetSchema,
        schoolName: z.string().optional().describe('Required for school-bound datasets'),
        region: z.string().optional().describe('Region hint to disambiguate'),
        filters: z.record(z.string(), z.string()).optional(),
      },
      outputSchema: {
        ok: z.boolean(),
        dataset: neisDatasetSchema.optional(),
        rows: z.array(neisRawRowSchema).optional(),
        totalCount: z.number().optional(),
        providerMetadata: providerMetadataSchema.optional(),
        dataStatus: dataStatusSchema.optional(),
        error: errorSchema.optional(),
      },
    },
      async ({ dataset, schoolName, region, filters }) => {
        try {
          const provider = createNeisProvider();
          const neisClient = new KampusClient({
            providers: [provider],
          });
          const extraFilters = { ...(filters ?? {}) };
          let rows: Array<Record<string, string>>;
          let totalCount: number | undefined;
          let providerMetadata: ReturnType<typeof serializeProviderMetadata>;
          let dataStatus: ReturnType<typeof serializeDataStatus>;

          if (dataset === 'acaInsTiInfo') {
            const result = await provider.getDatasetResult('acaInsTiInfo', extraFilters);
            rows = result.rows;
            totalCount = result.totalCount;
            providerMetadata = serializeProviderMetadata(result.providerMetadata);
            dataStatus = serializeDataStatus(result.dataStatus);
          } else if (dataset === 'officialTimetable') {
            if (!schoolName) {
              throw new KampusError('schoolName is required for officialTimetable.', 'INVALID_INPUT');
            }
            const school = await resolveInputSchool(neisClient, { schoolName, region });
            const timetableResult = await provider.getOfficialTimetableResult({
              school,
              year: extraFilters.AY,
              semester: extraFilters.SEM,
              date: extraFilters.ALL_TI_YMD,
              fromDate: extraFilters.TI_FROM_YMD,
              toDate: extraFilters.TI_TO_YMD,
              dayNightCourseName: extraFilters.DGHT_CRSE_SC_NM,
              schoolCourseName: extraFilters.SCHUL_CRSE_SC_NM,
              grade: extraFilters.GRADE ? Number.parseInt(extraFilters.GRADE, 10) : undefined,
              className: extraFilters.CLASS_NM,
              period: extraFilters.PERIO ? Number.parseInt(extraFilters.PERIO, 10) : undefined,
              trackName: extraFilters.ORD_SC_NM,
              departmentName: extraFilters.DDDEP_NM,
              classroomName: extraFilters.CLRM_NM,
            });
            rows = timetableResult.rows.map((row) => row.raw);
            totalCount = timetableResult.totalCount;
            providerMetadata = serializeProviderMetadata(timetableResult.providerMetadata);
            dataStatus = serializeDataStatus(timetableResult.dataStatus);
          } else {
            if (!schoolName) {
              throw new KampusError(`schoolName is required for ${dataset}.`, 'INVALID_INPUT');
            }
            const school = await resolveInputSchool(neisClient, { schoolName, region });
            const ref = school.providerRefs.neis;
            if (!ref) {
              throw new KampusError(
              `NEIS school reference is missing for "${school.name}".`,
              'PROVIDER_UNAVAILABLE',
            );
          }
            const result = await provider.getDatasetResult(dataset, {
              ...extraFilters,
              ATPT_OFCDC_SC_CODE: ref.officeCode,
              SD_SCHUL_CODE: ref.schoolCode,
            });
            rows = result.rows;
            totalCount = result.totalCount;
            providerMetadata = serializeProviderMetadata(result.providerMetadata);
            dataStatus = serializeDataStatus(result.dataStatus);
          }

          return success({
            ok: true,
            dataset,
            rows,
            totalCount,
            providerMetadata,
            dataStatus,
          });
        } catch (error) {
          return failure({ ok: false, error: toErrorPayload(error) });
        }
      },
  );

  server.registerTool(
    'diff_timetable_snapshots',
    {
      description: 'Diff two serialized week timetable snapshots.',
      inputSchema: {
        snapshotA: z.string().describe('JSON string for snapshot A'),
        snapshotB: z.string().describe('JSON string for snapshot B'),
      },
      outputSchema: {
        ok: z.boolean(),
        diff: diffSchema.optional(),
        error: errorSchema.optional(),
      },
    },
    async ({ snapshotA, snapshotB }) => {
      try {
        const diff = client.diffSnapshots(
          JSON.parse(snapshotA) as WeekTimetable,
          JSON.parse(snapshotB) as WeekTimetable,
        );
        return success({
          ok: true,
          diff: serializeDiff(diff),
        });
      } catch (error) {
        return failure({ ok: false, error: toErrorPayload(error) });
      }
    },
  );

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Kampus MCP server failed to start:', error);
  process.exit(1);
});
