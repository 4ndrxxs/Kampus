import type { Command } from 'commander';
import { InvalidInputError } from '@kampus/core';
import { createClient } from '../client-factory.js';
import {
  getFormat,
  printClassTimes,
  printDayTimetable,
  printNextClass,
  printWeekTimetable,
} from '../output.js';
import { resolveGradeClassDefaults, resolveSchool } from './resolve.js';

export function classCommands(program: Command): void {
  const cls = program.command('class').description('Student timetable commands');

  cls
    .command('today')
    .description('Fetch the current-day timetable')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--grade <n>', 'Grade (falls back to active profile)', parseInt)
    .option('--class <n>', 'Class number (falls back to active profile)', parseInt)
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps class today --school "<school>" --region "<region>" --grade 3 --class 5')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const { grade, classNo } = requireGradeClass(opts.grade, opts.class);
      const timetable = await client.getTodayTimetable({
        school,
        grade,
        classNo,
      });
      printDayTimetable(
        timetable,
        getFormat(opts),
        `${school.name} ${grade}-${classNo} today`,
      );
    });

  cls
    .command('day')
    .description('Fetch a timetable for a specific weekday')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--grade <n>', 'Grade (falls back to active profile)', parseInt)
    .option('--class <n>', 'Class number (falls back to active profile)', parseInt)
    .requiredOption('--weekday <n>', 'Weekday (1-7)', parseInt)
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps class day --school "<school>" --region "<region>" --grade 3 --class 5 --weekday 1')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const { grade, classNo } = requireGradeClass(opts.grade, opts.class);
      const timetable = await client.getDayTimetable({
        school,
        grade,
        classNo,
        weekday: opts.weekday,
      });
      printDayTimetable(timetable, getFormat(opts));
    });

  cls
    .command('week')
    .description('Fetch a weekly timetable')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--grade <n>', 'Grade (falls back to active profile)', parseInt)
    .option('--class <n>', 'Class number (falls back to active profile)', parseInt)
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps class week --school "<school>" --region "<region>" --grade 3 --class 5')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const { grade, classNo } = requireGradeClass(opts.grade, opts.class);
      const timetable = await client.getWeekTimetable({
        school,
        grade,
        classNo,
      });
      printWeekTimetable(timetable, getFormat(opts));
    });

  program
    .command('next')
    .description('Find the next class')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--grade <n>', 'Grade (falls back to active profile)', parseInt)
    .option('--class <n>', 'Class number (falls back to active profile)', parseInt)
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .addHelpText('after', '\nExample:\n  kps next --school "<school>" --region "<region>" --grade 3 --class 5')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const { grade, classNo } = requireGradeClass(opts.grade, opts.class);
      const result = await client.getNextClass({
        school,
        grade,
        classNo,
      });
      printNextClass(result, getFormat(opts));
    });

  program
    .command('class-times')
    .description('Fetch class time slots')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps class-times --school "<school>" --region "<region>"')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const times = await client.getClassTimes(school);
      printClassTimes(times, getFormat(opts));
    });
}

function requireGradeClass(grade?: number, classNo?: number): { grade: number; classNo: number } {
  const resolved = resolveGradeClassDefaults(grade, classNo);
  if (!resolved.grade || !resolved.classNo) {
    throw new InvalidInputError(
      'Grade and class are required. Pass --grade/--class or save them in the active profile.',
    );
  }
  return resolved;
}
