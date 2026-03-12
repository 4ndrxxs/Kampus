import type { Command } from 'commander';
import chalk from 'chalk';
import {
  InvalidInputError,
  KampusClient,
  resolveCachePolicy,
  resolveKampusCachePath,
  resolveNeisApiKey,
} from '@kampus/core';
import {
  NeisProvider,
  type NeisAcademicScheduleRecord,
  type NeisAcademyInfoRecord,
  type NeisClassInfoRecord,
  type NeisClassroomInfoRecord,
  type NeisDatasetResult,
  type NeisMajorInfoRecord,
  type NeisOfficialTimetableRecord,
  type NeisTrackInfoRecord,
} from '@kampus/provider-neis';
import { getFormat, printStructured, type OutputFormat } from '../output.js';
import { resolveSchool } from './resolve.js';

export function neisCommands(program: Command): void {
  const neis = program.command('neis').description('Official NEIS Open API commands');

  neis
    .command('classes')
    .description('Fetch official NEIS class info')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--year <YYYY>', 'Academic year')
    .option('--grade <number>', 'Grade filter')
    .option('--school-course <name>', 'School course name')
    .option('--day-night <name>', 'Day/night course name')
    .option('--track <name>', 'Track name')
    .option('--department <name>', 'Department name')
    .option('--page-limit <n>', 'Maximum number of auto-fetched pages', parseInt)
    .option('--dry-run', 'Print the NEIS request plan without executing it')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .action(async (opts) => {
      const provider = createNeisProvider(opts.pageLimit);
      const school = await resolveNeisSchool(provider, opts.school, opts.region);
      const request = {
        dataset: 'classInfo',
        school: {
          name: school.name,
          region: school.region,
          providerRefs: school.providerRefs,
        },
        query: {
          year: opts.year,
          grade: optionalNumber(opts.grade, '--grade'),
          schoolCourseName: opts.schoolCourse,
          dayNightCourseName: opts.dayNight,
          trackName: opts.track,
          departmentName: opts.department,
        },
        pageLimit: opts.pageLimit,
      };
      if (opts.dryRun) {
        printDryRunPlan('neis classes', request, getFormat(opts));
        return;
      }
      const result = await provider.getClassInfoResult({
        school,
        ...request.query,
      });
      printDatasetResult('NEIS class info', result, getFormat(opts), renderClassInfoRecord);
    });

  neis
    .command('majors')
    .description('Fetch official NEIS school major info')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--day-night <name>', 'Day/night course name')
    .option('--track <name>', 'Track name')
    .option('--page-limit <n>', 'Maximum number of auto-fetched pages', parseInt)
    .option('--dry-run', 'Print the NEIS request plan without executing it')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .action(async (opts) => {
      const provider = createNeisProvider(opts.pageLimit);
      const school = await resolveNeisSchool(provider, opts.school, opts.region);
      const request = {
        dataset: 'schoolMajorinfo',
        school: {
          name: school.name,
          region: school.region,
          providerRefs: school.providerRefs,
        },
        query: {
          dayNightCourseName: opts.dayNight,
          trackName: opts.track,
        },
        pageLimit: opts.pageLimit,
      };
      if (opts.dryRun) {
        printDryRunPlan('neis majors', request, getFormat(opts));
        return;
      }
      const result = await provider.getMajorInfoResult({
        school,
        ...request.query,
      });
      printDatasetResult('NEIS major info', result, getFormat(opts), renderMajorInfoRecord);
    });

  neis
    .command('tracks')
    .description('Fetch official NEIS school track info')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--day-night <name>', 'Day/night course name')
    .option('--page-limit <n>', 'Maximum number of auto-fetched pages', parseInt)
    .option('--dry-run', 'Print the NEIS request plan without executing it')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .action(async (opts) => {
      const provider = createNeisProvider(opts.pageLimit);
      const school = await resolveNeisSchool(provider, opts.school, opts.region);
      const request = {
        dataset: 'schulAflcoinfo',
        school: {
          name: school.name,
          region: school.region,
          providerRefs: school.providerRefs,
        },
        query: {
          dayNightCourseName: opts.dayNight,
        },
        pageLimit: opts.pageLimit,
      };
      if (opts.dryRun) {
        printDryRunPlan('neis tracks', request, getFormat(opts));
        return;
      }
      const result = await provider.getTrackInfoResult({
        school,
        ...request.query,
      });
      printDatasetResult('NEIS track info', result, getFormat(opts), renderTrackInfoRecord);
    });

  neis
    .command('schedule')
    .description('Fetch official NEIS academic schedule')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--school-course <name>', 'School course name')
    .option('--day-night <name>', 'Day/night course name')
    .option('--date <YYYY-MM-DD>', 'Single date')
    .option('--from <YYYY-MM-DD>', 'Start date')
    .option('--to <YYYY-MM-DD>', 'End date')
    .option('--page-limit <n>', 'Maximum number of auto-fetched pages', parseInt)
    .option('--dry-run', 'Print the NEIS request plan without executing it')
    .option('--ics', 'Print ICS instead of text/JSON/Markdown')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .action(async (opts) => {
      const provider = createNeisProvider(opts.pageLimit);
      const school = await resolveNeisSchool(provider, opts.school, opts.region);
      const request = {
        dataset: 'SchoolSchedule',
        school: {
          name: school.name,
          region: school.region,
          providerRefs: school.providerRefs,
        },
        query: {
          schoolCourseName: opts.schoolCourse,
          dayNightCourseName: opts.dayNight,
          date: opts.date,
          fromDate: opts.from,
          toDate: opts.to,
        },
        pageLimit: opts.pageLimit,
      };
      if (opts.dryRun) {
        printDryRunPlan('neis schedule', request, getFormat(opts));
        return;
      }
      const result = await provider.getAcademicScheduleResult({
        school,
        ...request.query,
      });

      if (opts.ics) {
        console.log(renderScheduleIcs(school.name, result.rows));
        return;
      }

      printDatasetResult('NEIS academic schedule', result, getFormat(opts), renderAcademicScheduleRecord);
    });

  neis
    .command('timetable')
    .description('Fetch official NEIS timetable rows')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--year <YYYY>', 'Academic year')
    .option('--semester <number>', 'Semester')
    .option('--date <YYYY-MM-DD>', 'Single date')
    .option('--from <YYYY-MM-DD>', 'Start date')
    .option('--to <YYYY-MM-DD>', 'End date')
    .option('--grade <number>', 'Grade')
    .option('--class-name <name>', 'Class name')
    .option('--period <number>', 'Period')
    .option('--school-course <name>', 'School course name')
    .option('--day-night <name>', 'Day/night course name')
    .option('--track <name>', 'Track name')
    .option('--department <name>', 'Department name')
    .option('--classroom <name>', 'Classroom name')
    .option('--page-limit <n>', 'Maximum number of auto-fetched pages', parseInt)
    .option('--dry-run', 'Print the NEIS request plan without executing it')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .action(async (opts) => {
      const provider = createNeisProvider(opts.pageLimit);
      const school = await resolveNeisSchool(provider, opts.school, opts.region);
      const request = {
        dataset: 'officialTimetable',
        school: {
          name: school.name,
          region: school.region,
          providerRefs: school.providerRefs,
        },
        query: {
          year: opts.year,
          semester: opts.semester,
          date: opts.date,
          fromDate: opts.from,
          toDate: opts.to,
          grade: optionalNumber(opts.grade, '--grade'),
          className: opts.className,
          period: optionalNumber(opts.period, '--period'),
          schoolCourseName: opts.schoolCourse,
          dayNightCourseName: opts.dayNight,
          trackName: opts.track,
          departmentName: opts.department,
          classroomName: opts.classroom,
        },
        pageLimit: opts.pageLimit,
      };
      if (opts.dryRun) {
        printDryRunPlan('neis timetable', request, getFormat(opts));
        return;
      }
      const result = await provider.getOfficialTimetableResult({
        school,
        ...request.query,
      });
      printDatasetResult('NEIS official timetable', result, getFormat(opts), renderOfficialTimetableRecord);
    });

  neis
    .command('classrooms')
    .description('Fetch official NEIS classroom info')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--year <YYYY>', 'Academic year')
    .option('--grade <number>', 'Grade')
    .option('--semester <number>', 'Semester')
    .option('--school-course <name>', 'School course name')
    .option('--day-night <name>', 'Day/night course name')
    .option('--track <name>', 'Track name')
    .option('--department <name>', 'Department name')
    .option('--page-limit <n>', 'Maximum number of auto-fetched pages', parseInt)
    .option('--dry-run', 'Print the NEIS request plan without executing it')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .action(async (opts) => {
      const provider = createNeisProvider(opts.pageLimit);
      const school = await resolveNeisSchool(provider, opts.school, opts.region);
      const request = {
        dataset: 'tiClrminfo',
        school: {
          name: school.name,
          region: school.region,
          providerRefs: school.providerRefs,
        },
        query: {
          year: opts.year,
          grade: optionalNumber(opts.grade, '--grade'),
          semester: opts.semester,
          schoolCourseName: opts.schoolCourse,
          dayNightCourseName: opts.dayNight,
          trackName: opts.track,
          departmentName: opts.department,
        },
        pageLimit: opts.pageLimit,
      };
      if (opts.dryRun) {
        printDryRunPlan('neis classrooms', request, getFormat(opts));
        return;
      }
      const result = await provider.getClassroomInfoResult({
        school,
        ...request.query,
      });
      printDatasetResult('NEIS classroom info', result, getFormat(opts), renderClassroomInfoRecord);
    });

  neis
    .command('academies')
    .description('Search official NEIS academy info')
    .option('--office-code <code>', 'Office code such as B10 or J10')
    .option('--zone <name>', 'Administrative zone name')
    .option('--number <value>', 'Academy serial number')
    .option('--name <name>', 'Academy name')
    .option('--field <name>', 'Field name')
    .option('--series <name>', 'Series name')
    .option('--course <name>', 'Course name')
    .option('--page-limit <n>', 'Maximum number of auto-fetched pages', parseInt)
    .option('--dry-run', 'Print the NEIS request plan without executing it')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .action(async (opts) => {
      const provider = createNeisProvider(opts.pageLimit);
      const request = {
        dataset: 'acaInsTiInfo',
        query: {
          officeCode: opts.officeCode,
          adminZoneName: opts.zone,
          academyNumber: opts.number,
          academyName: opts.name,
          fieldName: opts.field,
          seriesName: opts.series,
          courseName: opts.course,
        },
        pageLimit: opts.pageLimit,
      };
      if (opts.dryRun) {
        printDryRunPlan('neis academies', request, getFormat(opts));
        return;
      }
      const result = await provider.searchAcademyInfoResult(request.query);
      printDatasetResult('NEIS academy info', result, getFormat(opts), renderAcademyInfoRecord);
    });
}

function createNeisProvider(pageLimit?: number): NeisProvider {
  const cachePolicy = resolveCachePolicy();
  return new NeisProvider({
    apiKey: resolveNeisApiKey(),
    maxAutoPages: pageLimit,
    cachePath: resolveKampusCachePath(),
    cacheTtlMs: cachePolicy.datasetTtlMinutes * 60 * 1000,
    staleIfErrorMs: cachePolicy.staleIfErrorHours * 60 * 60 * 1000,
    cacheMaxEntries: cachePolicy.maxEntries,
  });
}

async function resolveNeisSchool(provider: NeisProvider, name?: string, region?: string) {
  const client = new KampusClient({
    providers: [provider],
  });
  return resolveSchool(client, name, region);
}

function optionalNumber(value: string | undefined, _label: string): number | undefined {
  if (value == null) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new InvalidInputError(`${_label} must be an integer.`);
  }
  return parsed;
}

/* ── Access badge helper ───────────────────────────────────── */

function accessBadge(mode: string): string {
  switch (mode) {
    case 'official-full': return chalk.green.bold('OFFICIAL');
    case 'official-limited': return chalk.yellow.bold('LIMITED');
    case 'unofficial': return chalk.dim('UNOFFICIAL');
    default: return chalk.dim(mode);
  }
}

/* ── Dataset result printer ────────────────────────────────── */

function printDatasetResult<T>(
  title: string,
  result: NeisDatasetResult<T>,
  format: OutputFormat,
  render: (record: T) => string,
): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured({
      totalCount: result.totalCount,
      dataStatus: result.dataStatus,
      providerMetadata: result.providerMetadata,
      rows: result.rows,
    }, format);
    return;
  }

  const statusLines = renderStatusLines(result);
  if (format === 'markdown') {
    console.log(`# ${title}`);
    console.log();
    for (const line of statusLines) {
      console.log(`> ${line}`);
    }
    if (!result.rows.length) {
      console.log();
      console.log('No records matched.');
      return;
    }
    console.log();
    for (const record of result.rows) {
      console.log(`- ${render(record)}`);
    }
    return;
  }

  console.log();
  console.log(`  ${chalk.bold(title)}`);
  console.log(`  ${chalk.dim('─'.repeat(48))}`);
  console.log();

  const rowLabel = `${result.rows.length}${result.totalCount != null ? chalk.dim(` / ${result.totalCount} total`) : ''}`;
  console.log(`  ${accessBadge(result.dataStatus.accessMode)}  ${result.dataStatus.complete ? chalk.green('complete') : chalk.yellow('incomplete')}  ${chalk.dim(`rows: ${rowLabel}`)}`);
  console.log(`  ${chalk.dim(`via ${result.dataStatus.sourceProviders.join(', ')}`)}`);

  for (const warning of result.dataStatus.warnings ?? []) {
    console.log(chalk.yellow(`  ⚠ ${chalk.bold(`[${warning.code}]`)} ${warning.message}`));
  }

  if (!result.rows.length) {
    console.log();
    console.log(chalk.dim('  No records matched.'));
    return;
  }
  console.log();
  for (const record of result.rows) {
    console.log(`  ${chalk.dim('▸')} ${render(record)}`);
  }
  console.log();
}

function renderStatusLines<T>(result: NeisDatasetResult<T>): string[] {
  const lines = [
    `mode: ${result.dataStatus.accessMode}`,
    `complete: ${result.dataStatus.complete ? 'yes' : 'no'}`,
    `rows: ${result.rows.length}${result.totalCount != null ? ` / ${result.totalCount}` : ''}`,
    `sources: ${result.dataStatus.sourceProviders.join(', ')}`,
  ];

  for (const warning of result.dataStatus.warnings ?? []) {
    lines.push(`warning: [${warning.code}] ${warning.message}`);
  }

  return lines;
}

/* ── Record renderers (unchanged data) ─────────────────────── */

function renderClassInfoRecord(row: NeisClassInfoRecord): string {
  return [
    row.year,
    row.grade ? `${row.grade} grade` : undefined,
    row.className ? `class ${row.className}` : undefined,
    row.departmentName,
    row.trackName,
    row.dayNightCourseName,
  ]
    .filter(Boolean)
    .join(' | ');
}

function renderMajorInfoRecord(row: NeisMajorInfoRecord): string {
  return [row.departmentName, row.trackName, row.dayNightCourseName].filter(Boolean).join(' | ');
}

function renderTrackInfoRecord(row: NeisTrackInfoRecord): string {
  return [row.trackName, row.dayNightCourseName].filter(Boolean).join(' | ');
}

function renderAcademicScheduleRecord(row: NeisAcademicScheduleRecord): string {
  const grades = row.gradeEventYears.length ? `grades ${row.gradeEventYears.join(',')}` : undefined;
  return [row.date, row.eventName, row.eventContent, grades].filter(Boolean).join(' | ');
}

function renderOfficialTimetableRecord(row: NeisOfficialTimetableRecord): string {
  return [
    row.date,
    row.grade ? `${row.grade} grade` : undefined,
    row.className ? `class ${row.className}` : undefined,
    row.period ? `period ${row.period}` : undefined,
    row.content,
    row.classroomName,
  ]
    .filter(Boolean)
    .join(' | ');
}

function renderClassroomInfoRecord(row: NeisClassroomInfoRecord): string {
  return [
    row.year,
    row.grade ? `${row.grade} grade` : undefined,
    row.semester ? `semester ${row.semester}` : undefined,
    row.classroomName,
    row.departmentName,
    row.trackName,
  ]
    .filter(Boolean)
    .join(' | ');
}

function renderAcademyInfoRecord(row: NeisAcademyInfoRecord): string {
  return [
    row.academyName,
    row.adminZoneName,
    row.fieldName,
    row.seriesName,
    row.courseName,
    row.academyNumber,
  ]
    .filter(Boolean)
    .join(' | ');
}

/* ── ICS renderer (unchanged) ──────────────────────────────── */

function renderScheduleIcs(schoolName: string, rows: NeisAcademicScheduleRecord[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kampus//NEIS Schedule//EN'];

  rows.forEach((row, index) => {
    if (!row.date || !row.eventName) {
      return;
    }

    const compactDate = row.date.replace(/-/g, '');
    const summary = escapeIcsText(row.eventName);
    const description = escapeIcsText(row.eventContent ?? '');
    const uidBase = summary.replace(/[^A-Za-z0-9]/g, '') || 'event';
    const uid = `${compactDate}-${uidBase}-${index + 1}@kampus`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`);
    lines.push(`DTSTART;VALUE=DATE:${compactDate}`);
    lines.push(`SUMMARY:${summary}`);
    if (description) {
      lines.push(`DESCRIPTION:${description}`);
    }
    lines.push(`LOCATION:${escapeIcsText(schoolName)}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/* ── Dry run printer ───────────────────────────────────────── */

function printDryRunPlan(command: string, payload: unknown, format: OutputFormat): void {
  const envelope = {
    ok: true,
    dryRun: true,
    command,
    payload,
    accessMode: resolveNeisApiKey() ? 'official-full' : 'official-limited',
  };

  if (format !== 'human' && format !== 'markdown') {
    printStructured(envelope, format);
    return;
  }

  if (format === 'markdown') {
    console.log(`# Dry Run: ${command}`);
    console.log();
    console.log('```json');
    console.log(JSON.stringify(envelope, null, 2));
    console.log('```');
    return;
  }

  console.log();
  console.log(`  ${chalk.bold(`Dry Run: ${command}`)}`);
  console.log(`  ${chalk.dim('─'.repeat(48))}`);
  console.log();
  console.log(JSON.stringify(envelope, null, 2));
  console.log();
}
