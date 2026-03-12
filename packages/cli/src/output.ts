import chalk from 'chalk';
import type {
  ClassTimeSlot,
  DataStatus,
  DailyMeals,
  DayTimetable,
  PeriodItem,
  ProviderMetadata,
  SchoolInfo,
  SchoolRef,
  SchoolSearchResult,
  SnapshotDiff,
  TeacherInfo,
  TeacherTimetable,
  WeekTimetable,
  WeeklyMeals,
} from '@kampus/core';

export type OutputFormat = 'human' | 'json' | 'markdown' | 'yaml' | 'csv' | 'table' | 'ndjson';

export function getFormat(opts: { format?: string; json?: boolean; markdown?: boolean }): OutputFormat {
  const explicitFormat = opts.format?.trim().toLowerCase();
  if (explicitFormat) {
    if (isOutputFormat(explicitFormat)) {
      return explicitFormat;
    }
    throw new Error(`Unsupported output format "${opts.format}".`);
  }
  if (opts.json) {
    return 'json';
  }
  if (opts.markdown) {
    return 'markdown';
  }
  return 'human';
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printStructured(data: unknown, format: Exclude<OutputFormat, 'human' | 'markdown'>): void {
  switch (format) {
    case 'json':
      printJson(data);
      return;
    case 'yaml':
      console.log(renderYaml(data));
      return;
    case 'ndjson':
      printNdjson(data);
      return;
    case 'csv':
      console.log(renderCsv(data));
      return;
    case 'table':
      console.log(renderTable(data));
      return;
  }
}

/* ── Chalk helpers ─────────────────────────────────────────── */

function accessBadge(mode: string): string {
  switch (mode) {
    case 'official-full':
      return chalk.green.bold('OFFICIAL');
    case 'official-limited':
      return chalk.yellow.bold('LIMITED');
    case 'unofficial':
      return chalk.dim('UNOFFICIAL');
    default:
      return chalk.dim(mode);
  }
}

function completeBadge(complete: boolean): string {
  return complete ? chalk.green('complete') : chalk.yellow('incomplete');
}

function kv(key: string, value: string): string {
  return `${chalk.cyan(key)}  ${value}`;
}

function heading(text: string): string {
  return chalk.bold(text);
}

function separator(width = 48): string {
  return chalk.dim('─'.repeat(width));
}

function warningLine(code: string, message: string): string {
  return chalk.yellow(`  ⚠ ${chalk.bold(`[${code}]`)} ${message}`);
}

function renderStatusBanner(value: {
  dataStatus?: DataStatus;
  providerMetadata?: ProviderMetadata;
}): string[] {
  const lines: string[] = [];
  if (value.dataStatus) {
    const parts = [
      accessBadge(value.dataStatus.accessMode),
      completeBadge(value.dataStatus.complete),
      chalk.dim(`via ${value.dataStatus.sourceProviders.join(', ')}`),
    ];
    if (value.providerMetadata?.cached) {
      parts.push(chalk.blue('cached'));
    }
    lines.push(`  ${parts.join(chalk.dim('  ·  '))}`);
    for (const warning of value.dataStatus.warnings ?? []) {
      lines.push(warningLine(warning.code, warning.message));
    }
  } else if (value.providerMetadata?.cached) {
    lines.push(`  ${chalk.blue('cached')}`);
  }
  return lines;
}

function printBanner(value: {
  dataStatus?: DataStatus;
  providerMetadata?: ProviderMetadata;
}): void {
  for (const line of renderStatusBanner(value)) {
    console.log(line);
  }
}

/* ── Human label helpers (unchanged contract) ──────────────── */

function renderProviderRefs(school: SchoolRef): string {
  const refs: string[] = [];

  if (school.providerRefs.neis) {
    refs.push(`neis:${school.providerRefs.neis.officeCode}/${school.providerRefs.neis.schoolCode}`);
  }
  if (school.providerRefs.comcigan) {
    refs.push(`comcigan:${school.providerRefs.comcigan.schoolCode}`);
  }

  return refs.join(', ') || '(unresolved)';
}

function renderProviderRefsColored(school: SchoolRef): string {
  const refs: string[] = [];
  if (school.providerRefs.neis) {
    refs.push(chalk.magenta(`neis:${school.providerRefs.neis.officeCode}/${school.providerRefs.neis.schoolCode}`));
  }
  if (school.providerRefs.comcigan) {
    refs.push(chalk.magenta(`comcigan:${school.providerRefs.comcigan.schoolCode}`));
  }
  return refs.join(chalk.dim(' · ')) || chalk.dim('(unresolved)');
}

function renderSchoolLabel(school: Pick<SchoolRef, 'name' | 'region' | 'schoolType'>): string {
  const extras = [school.region, school.schoolType].filter(Boolean).join(', ');
  return extras ? `${school.name} (${extras})` : school.name;
}

function renderSchoolLabelColored(school: Pick<SchoolRef, 'name' | 'region' | 'schoolType'>): string {
  const extras = [school.region, school.schoolType].filter(Boolean).join(', ');
  return extras
    ? `${chalk.bold(school.name)} ${chalk.dim(`(${extras})`)}`
    : chalk.bold(school.name);
}

function renderPeriod(period: PeriodItem): string {
  if (period.isFreePeriod) {
    return '(free)';
  }

  const teacher = period.teacher ? ` [${period.teacher}]` : '';
  return `${period.subject}${teacher}`;
}

function renderPeriodColored(period: PeriodItem): string {
  if (period.isFreePeriod) {
    return chalk.dim('(free)');
  }
  if (period.status === 'unknown-subject') {
    const teacher = period.teacher ? chalk.dim(` [${period.teacher}]`) : '';
    return `${chalk.yellow('???')}${teacher}`;
  }
  const teacher = period.teacher ? chalk.dim(` [${period.teacher}]`) : '';
  return `${chalk.white(period.subject)}${teacher}`;
}

function renderStatusLines(value: {
  dataStatus?: DataStatus;
  providerMetadata?: ProviderMetadata;
}): string[] {
  const lines: string[] = [];

  if (value.dataStatus) {
    lines.push(`mode: ${value.dataStatus.accessMode}`);
    lines.push(`complete: ${value.dataStatus.complete ? 'yes' : 'no'}`);
    lines.push(`sources: ${value.dataStatus.sourceProviders.join(', ')}`);
    for (const warning of value.dataStatus.warnings ?? []) {
      lines.push(`warning: [${warning.code}] ${warning.message}`);
    }
  }

  if (value.providerMetadata?.cached) {
    lines.push('cached: yes');
  }

  return lines;
}

function printStatusLines(
  value: {
    dataStatus?: DataStatus;
    providerMetadata?: ProviderMetadata;
  },
  format: Exclude<OutputFormat, 'json'>,
): void {
  const lines = renderStatusLines(value);
  if (!lines.length) {
    return;
  }

  if (format === 'markdown') {
    for (const line of lines) {
      console.log(`> ${line}`);
    }
    console.log();
    return;
  }

  for (const line of lines) {
    console.log(line);
  }
}

/* ── Print functions ───────────────────────────────────────── */

export function printSchoolSearch(results: SchoolSearchResult[], format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(results, format);
    return;
  }

  if (!results.length) {
    if (format === 'markdown') {
      console.log('No schools matched.');
    } else {
      console.log(chalk.dim('No schools matched.'));
    }
    return;
  }

  if (format === 'markdown') {
    console.log('| School | Type | Provider refs | Sources |');
    console.log('| --- | --- | --- | --- |');
    for (const school of results) {
      console.log(
        `| ${renderSchoolLabel(school)} | ${school.schoolType ?? '-'} | ${renderProviderRefs(
          school,
        )} | ${school.sourceProviders.join(', ')} |`,
      );
    }
    return;
  }

  console.log(heading(`Matched ${results.length} school(s)`));
  console.log();
  for (const school of results) {
    console.log(`  ${renderSchoolLabelColored(school)}`);
    console.log(`    ${renderProviderRefsColored(school)}`);
    console.log(`    ${chalk.dim(`sources: ${school.sourceProviders.join(', ')}`)}`);
    console.log();
  }
}

export function printSchoolInfo(info: SchoolInfo, format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(info, format);
    return;
  }

  const lines = [
    `School: ${info.name}`,
    info.region ? `Region: ${info.region}` : undefined,
    info.schoolType ? `Type: ${info.schoolType}` : undefined,
    info.address ? `Address: ${info.address}` : undefined,
    info.phone ? `Phone: ${info.phone}` : undefined,
    info.website ? `Website: ${info.website}` : undefined,
    `Provider refs: ${renderProviderRefs(info)}`,
    info.gradeCount ? `Grades: ${info.gradeCount}` : undefined,
    info.teacherNames?.length ? `Teachers: ${info.teacherNames.length}` : undefined,
  ].filter(Boolean);

  if (format === 'markdown') {
    console.log(`# ${info.name}`);
    console.log();
    printStatusLines(info, 'markdown');
    for (const line of lines.slice(1)) {
      console.log(`- ${line}`);
    }
    if (info.classCounts) {
      console.log('- Class counts:');
      for (const [grade, count] of Object.entries(info.classCounts)) {
        console.log(`  ${grade}: ${count}`);
      }
    }
    return;
  }

  console.log();
  console.log(`  ${heading(info.name)}`);
  console.log(`  ${separator()}`);
  printBanner(info);
  console.log();
  if (info.region) console.log(`  ${kv('Region', info.region)}`);
  if (info.schoolType) console.log(`  ${kv('Type', info.schoolType)}`);
  if (info.address) console.log(`  ${kv('Address', info.address)}`);
  if (info.phone) console.log(`  ${kv('Phone', info.phone)}`);
  if (info.website) console.log(`  ${kv('Website', chalk.underline(info.website))}`);
  console.log(`  ${kv('Refs', renderProviderRefsColored(info))}`);
  if (info.gradeCount) console.log(`  ${kv('Grades', String(info.gradeCount))}`);
  if (info.teacherNames?.length) console.log(`  ${kv('Teachers', String(info.teacherNames.length))}`);
  if (info.classCounts) {
    console.log();
    console.log(`  ${chalk.dim('Class counts')}`);
    for (const [grade, count] of Object.entries(info.classCounts)) {
      console.log(`    ${chalk.cyan(`grade ${grade}`)}  ${count}`);
    }
  }
  console.log();
}

export function printDayTimetable(day: DayTimetable, format: OutputFormat, header?: string): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(day, format);
    return;
  }

  const title = header ?? `${day.weekdayName}${day.date ? ` (${day.date})` : ''}`;
  if (format === 'markdown') {
    console.log(`## ${title}`);
    console.log();
    printStatusLines(day, 'markdown');
    console.log('| Period | Class | Status |');
    console.log('| --- | --- | --- |');
    for (const period of day.periods) {
      console.log(`| ${period.period} | ${renderPeriod(period)} | ${period.status} |`);
    }
    return;
  }

  console.log(`  ${heading(title)}`);
  printBanner(day);
  console.log();
  const padWidth = String(day.periods.length).length + 1;
  for (const period of day.periods) {
    const num = chalk.cyan(`P${String(period.period).padStart(padWidth)}`);
    const content = renderPeriodColored(period);
    const status = period.isFreePeriod
      ? chalk.dim(period.status)
      : period.status === 'unknown-subject'
        ? chalk.yellow(period.status)
        : chalk.dim(period.status);
    console.log(`  ${num}  ${content.padEnd(36)}${status}`);
  }
}

export function printWeekTimetable(week: WeekTimetable, format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(week, format);
    return;
  }

  const header = `${week.school.name} ${week.grade}-${week.classNo}`;
  if (format === 'markdown') {
    console.log(`# ${header}`);
    console.log();
    printStatusLines(week, 'markdown');
  } else {
    console.log();
    console.log(`  ${heading(header)}`);
    console.log(`  ${separator()}`);
    if (week.weekStart) {
      console.log(`  ${chalk.dim(`Week of ${week.weekStart}`)}`);
    }
    printBanner(week);
    console.log();
  }

  for (const day of week.days) {
    printDayTimetable(day, format);
    console.log();
  }
}

export function printTeacherTimetable(timetable: TeacherTimetable, format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(timetable, format);
    return;
  }

  const header = `${timetable.school.name} — ${timetable.teacherName}`;
  if (format === 'markdown') {
    console.log(`# ${header}`);
    console.log();
    printStatusLines(timetable, 'markdown');
  } else {
    console.log();
    console.log(`  ${heading(header)}`);
    console.log(`  ${separator()}`);
    printBanner(timetable);
    console.log();
  }

  for (const day of timetable.days) {
    if (format === 'markdown') {
      console.log(`## ${day.weekdayName}${day.date ? ` (${day.date})` : ''}`);
      console.log();
      console.log('| Period | Subject | Class | Status |');
      console.log('| --- | --- | --- | --- |');
      for (const period of day.periods) {
        console.log(
          `| ${period.period} | ${period.isFreePeriod ? '(free)' : period.subject} | ${
            period.classLabel ?? '-'
          } | ${period.status} |`,
        );
      }
    } else {
      console.log(`  ${heading(day.weekdayName)}${day.date ? chalk.dim(` (${day.date})`) : ''}`);
      const padWidth = String(day.periods.length).length + 1;
      for (const period of day.periods) {
        const num = chalk.cyan(`P${String(period.period).padStart(padWidth)}`);
        const subject = period.isFreePeriod
          ? chalk.dim('(free)')
          : period.status === 'unknown-subject'
            ? chalk.yellow('???')
            : chalk.white(period.subject);
        const classLabel = period.classLabel ? chalk.dim(` [${period.classLabel}]`) : '';
        const status = period.isFreePeriod
          ? chalk.dim(period.status)
          : period.status === 'unknown-subject'
            ? chalk.yellow(period.status)
            : chalk.dim(period.status);
        console.log(`  ${num}  ${(subject + classLabel).padEnd(36)}${status}`);
      }
    }
    console.log();
  }
}

export function printTeacherInfo(info: TeacherInfo, format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(info, format);
    return;
  }

  const lines = [
    `Teacher: ${info.name}`,
    `School: ${info.school.name}`,
    info.subjects?.length ? `Subjects: ${info.subjects.join(', ')}` : undefined,
    info.classes?.length ? `Classes: ${info.classes.join(', ')}` : undefined,
  ].filter(Boolean);

  if (format === 'markdown') {
    console.log(`# ${info.name}`);
    console.log();
    printStatusLines(info, 'markdown');
    for (const line of lines.slice(1)) {
      console.log(`- ${line}`);
    }
    return;
  }

  console.log();
  console.log(`  ${heading(info.name)}`);
  console.log(`  ${separator()}`);
  printBanner(info);
  console.log();
  console.log(`  ${kv('School', info.school.name)}`);
  if (info.subjects?.length) console.log(`  ${kv('Subjects', info.subjects.join(', '))}`);
  if (info.classes?.length) console.log(`  ${kv('Classes', info.classes.join(', '))}`);
  console.log();
}

export function printDailyMeals(daily: DailyMeals, format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(daily, format);
    return;
  }

  const title = `${daily.date}${daily.weekdayName ? ` (${daily.weekdayName})` : ''}`;
  if (format === 'markdown') {
    console.log(`## ${title}`);
    console.log();
    printStatusLines(daily, 'markdown');
    for (const meal of daily.meals) {
      console.log(`### ${meal.type}`);
      console.log();
      for (const item of meal.items) {
        const allergies = item.allergyCodes?.length ? ` (${item.allergyCodes.join('.')})` : '';
        console.log(`- ${item.name}${allergies}`);
      }
      if (meal.calories) {
        console.log();
        console.log(`> ${meal.calories}`);
      }
      if (meal.nutritionInfo) {
        console.log();
        console.log(`> nutrition: ${meal.nutritionInfo}`);
      }
      if (meal.originInfo) {
        console.log();
        console.log(`> origin: ${meal.originInfo}`);
      }
      console.log();
    }
    return;
  }

  console.log(`  ${heading(title)}`);
  printBanner(daily);
  for (const meal of daily.meals) {
    console.log();
    console.log(`  ${chalk.cyan.bold(`[${meal.type}]`)}`);
    for (const item of meal.items) {
      const allergies = item.allergyCodes?.length
        ? chalk.dim(` (${item.allergyCodes.join('.')})`)
        : '';
      console.log(`    ${item.name}${allergies}`);
    }
    if (meal.calories) console.log(`    ${chalk.dim(meal.calories)}`);
    if (meal.nutritionInfo) console.log(`    ${chalk.dim(`nutrition: ${meal.nutritionInfo}`)}`);
    if (meal.originInfo) console.log(`    ${chalk.dim(`origin: ${meal.originInfo}`)}`);
  }
}

export function printWeeklyMeals(weekly: WeeklyMeals, format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(weekly, format);
    return;
  }

  if (format === 'markdown') {
    console.log(`# ${weekly.school.name} meals`);
    console.log();
    printStatusLines(weekly, 'markdown');
  } else {
    console.log();
    console.log(`  ${heading(`${weekly.school.name} meals`)}`);
    console.log(`  ${separator()}`);
    if (weekly.weekStart) {
      console.log(`  ${chalk.dim(`Week of ${weekly.weekStart}`)}`);
    }
    if (weekly.fromDate && weekly.toDate && weekly.fromDate !== weekly.toDate) {
      console.log(`  ${chalk.dim(`${weekly.fromDate} — ${weekly.toDate}`)}`);
    }
    printBanner(weekly);
    console.log();
  }

  for (const day of weekly.days) {
    printDailyMeals(day, format);
    console.log();
  }
}

export function printClassTimes(slots: ClassTimeSlot[], format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(slots, format);
    return;
  }

  if (format === 'markdown') {
    console.log('| Period | Start | End |');
    console.log('| --- | --- | --- |');
    for (const slot of slots) {
      console.log(`| ${slot.period} | ${slot.startTime} | ${slot.endTime} |`);
    }
    return;
  }

  console.log();
  console.log(`  ${heading('Class Times')}`);
  console.log(`  ${separator()}`);
  console.log();
  for (const slot of slots) {
    console.log(`  ${chalk.cyan(`P${slot.period}`)}  ${slot.startTime} ${chalk.dim('—')} ${slot.endTime}`);
  }
  console.log();
}

export function printSnapshotDiff(diff: SnapshotDiff, format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(diff, format);
    return;
  }

  if (!diff.changes.length) {
    if (format === 'markdown') {
      console.log('No timetable changes detected.');
    } else {
      console.log(chalk.dim('  No timetable changes detected.'));
    }
    return;
  }

  if (format === 'markdown') {
    console.log('| Day | Period | Before | After |');
    console.log('| --- | --- | --- | --- |');
    for (const change of diff.changes) {
      const before = `${change.before.subject}${change.before.teacher ? ` [${change.before.teacher}]` : ''}`;
      const after = `${change.after.subject}${change.after.teacher ? ` [${change.after.teacher}]` : ''}`;
      console.log(`| ${change.weekdayName} | ${change.period} | ${before} | ${after} |`);
    }
    return;
  }

  console.log();
  console.log(`  ${heading('Timetable Changes')}`);
  console.log(`  ${separator()}`);
  console.log();
  for (const change of diff.changes) {
    const before = `${change.before.subject}${change.before.teacher ? chalk.dim(` [${change.before.teacher}]`) : ''}`;
    const after = `${change.after.subject}${change.after.teacher ? chalk.dim(` [${change.after.teacher}]`) : ''}`;
    console.log(`  ${chalk.cyan(change.weekdayName)} P${change.period}  ${chalk.red(before)} ${chalk.dim('→')} ${chalk.green(after)}`);
  }
  console.log();
}

export function printNextClass(
  result: { period: PeriodItem; minutesUntil?: number } | null,
  format: OutputFormat,
): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(result, format);
    return;
  }

  if (!result) {
    if (format === 'markdown') {
      console.log('No upcoming class found.');
    } else {
      console.log(chalk.dim('  No upcoming class found.'));
    }
    return;
  }

  if (format === 'markdown') {
    const eta = result.minutesUntil != null ? ` in ${result.minutesUntil} min` : '';
    console.log(`Next class: P${result.period.period} ${renderPeriod(result.period)}${eta}`);
    return;
  }

  const eta = result.minutesUntil != null
    ? chalk.blue(` in ${result.minutesUntil} min`)
    : '';
  console.log();
  console.log(`  ${chalk.bold('Next')}  ${chalk.cyan(`P${result.period.period}`)} ${renderPeriodColored(result.period)}${eta}`);
  console.log();
}

/* ── Format detection ──────────────────────────────────────── */

function isOutputFormat(value: string): value is OutputFormat {
  return ['human', 'json', 'markdown', 'yaml', 'csv', 'table', 'ndjson'].includes(value);
}

/* ── YAML renderer (unchanged) ─────────────────────────────── */

function renderYaml(data: unknown, depth = 0): string {
  const indent = '  '.repeat(depth);

  if (data == null) {
    return 'null';
  }
  if (typeof data === 'string') {
    return JSON.stringify(data);
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }
  if (Array.isArray(data)) {
    if (!data.length) {
      return '[]';
    }
    return data
      .map((item) => {
        const rendered = renderYaml(item, depth + 1);
        if (typeof item === 'object' && item != null) {
          return `${indent}- ${rendered.startsWith('\n') ? rendered.slice(1) : rendered}`;
        }
        return `${indent}- ${rendered}`;
      })
      .join('\n');
  }

  const entries = Object.entries(data as Record<string, unknown>);
  if (!entries.length) {
    return '{}';
  }

  return entries
    .map(([key, value]) => {
      if (value && typeof value === 'object') {
        const child = renderYaml(value, depth + 1);
        return `${indent}${key}:\n${child}`;
      }
      return `${indent}${key}: ${renderYaml(value, depth + 1)}`;
    })
    .join('\n');
}

/* ── NDJSON renderer (unchanged) ───────────────────────────── */

function printNdjson(data: unknown): void {
  if (Array.isArray(data)) {
    for (const item of data) {
      console.log(JSON.stringify(item));
    }
    return;
  }

  console.log(JSON.stringify(data));
}

/* ── CSV renderer (unchanged) ──────────────────────────────── */

function renderCsv(data: unknown): string {
  const rows = toTabularRows(data);
  const columns = collectColumns(rows);
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(','));
  return [header, ...body].join('\n');
}

/* ── Table renderer (unchanged) ────────────────────────────── */

function renderTable(data: unknown): string {
  const rows = toTabularRows(data);
  const columns = collectColumns(rows);
  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.max(column.length, ...rows.map((row) => String(row[column] ?? '').length)),
    ]),
  ) as Record<string, number>;

  const header = columns.map((column) => padCell(column, widths[column])).join(' | ');
  const divider = columns.map((column) => '-'.repeat(widths[column])).join('-|-');
  const body = rows.map((row) =>
    columns.map((column) => padCell(String(row[column] ?? ''), widths[column])).join(' | '),
  );

  return [header, divider, ...body].join('\n');
}

/* ── Shared tabular helpers (unchanged) ────────────────────── */

function toTabularRows(data: unknown): Array<Record<string, string>> {
  if (Array.isArray(data)) {
    return data.map((entry) => flattenRecord(entry));
  }
  return [flattenRecord(data)];
}

function flattenRecord(value: unknown, prefix = ''): Record<string, string> {
  if (value == null) {
    return prefix ? { [prefix]: '' } : { value: '' };
  }

  if (typeof value !== 'object' || value instanceof Date) {
    return prefix ? { [prefix]: String(value) } : { value: String(value) };
  }

  if (Array.isArray(value)) {
    return prefix ? { [prefix]: JSON.stringify(value) } : { value: JSON.stringify(value) };
  }

  const flattened = Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return Object.entries(flattenRecord(entry, nextPrefix));
  });

  if (!flattened.length) {
    return prefix ? { [prefix]: '{}' } : { value: '{}' };
  }

  return Object.fromEntries(flattened);
}

function collectColumns(rows: Array<Record<string, string>>): string[] {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key);
    }
  }
  return [...columns];
}

function escapeCsv(value: string | undefined): string {
  const text = value ?? '';
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function padCell(value: string, width: number): string {
  return `${value}${' '.repeat(Math.max(0, width - value.length))}`;
}
