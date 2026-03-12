import type { Command } from 'commander';
import { InvalidInputError } from '@kampus/core';
import { createClient } from '../client-factory.js';
import { getFormat, printTeacherInfo, printTeacherTimetable } from '../output.js';
import { resolveSchool, resolveTeacherDefault } from './resolve.js';

export function teacherCommands(program: Command): void {
  const teacher = program.command('teacher').description('Teacher timetable and info commands');

  teacher
    .command('timetable')
    .description('Fetch a teacher timetable')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--teacher <name>', 'Teacher name (falls back to active profile)')
    .option('--weekday <n>', 'Weekday (1-7)', parseInt)
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps teacher timetable --school "<school>" --region "<region>" --teacher "<teacher>"')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const teacherName = requireTeacherName(opts.teacher);
      const timetable = await client.getTeacherTimetable({
        school,
        teacherName,
        weekday: opts.weekday,
      });
      printTeacherTimetable(timetable, getFormat(opts));
    });

  teacher
    .command('info')
    .description('Fetch normalized teacher info')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--teacher <name>', 'Teacher name (falls back to active profile)')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps teacher info --school "<school>" --region "<region>" --teacher "<teacher>"')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const teacherName = requireTeacherName(opts.teacher);
      const info = await client.getTeacherInfo({
        school,
        teacherName,
      });
      printTeacherInfo(info, getFormat(opts));
    });
}

function requireTeacherName(value?: string): string {
  const resolved = resolveTeacherDefault(value);
  if (!resolved) {
    throw new InvalidInputError(
      'Teacher name is required. Pass --teacher or save it in the active profile.',
    );
  }
  return resolved;
}
