import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { InvalidInputError, type WeekTimetable } from '@kampus/core';
import { createClient } from '../client-factory.js';
import { getFormat, printSnapshotDiff, printWeekTimetable } from '../output.js';
import { resolveGradeClassDefaults } from './resolve.js';

export function utilCommands(program: Command): void {
  program
    .command('diff')
    .description('Diff two serialized week timetable snapshots')
    .requiredOption('--snapshot-a <file>', 'First snapshot JSON file')
    .requiredOption('--snapshot-b <file>', 'Second snapshot JSON file')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps diff --snapshot-a week1.json --snapshot-b week2.json')
    .action(async (opts) => {
      const client = createClient();
      const snapshotA = parseWeekSnapshotFile(opts.snapshotA);
      const snapshotB = parseWeekSnapshotFile(opts.snapshotB);
      const diff = client.diffSnapshots(snapshotA, snapshotB);
      printSnapshotDiff(diff, getFormat(opts));
    });

  program
    .command('export')
    .description('Export a weekly timetable in JSON or Markdown')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--grade <n>', 'Grade (falls back to active profile)', parseInt)
    .option('--class <n>', 'Class number (falls back to active profile)', parseInt)
    .option('--format <type>', 'Output format (json|markdown)', 'json')
    .addHelpText('after', '\nExample:\n  kps export --school "<school>" --region "<region>" --grade 3 --class 5 --format markdown')
    .action(async (opts) => {
      const { resolveSchool } = await import('./resolve.js');
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const { grade, classNo } = requireGradeClass(opts.grade, opts.class);
      const week = await client.getWeekTimetable({
        school,
        grade,
        classNo,
      });
      printWeekTimetable(week, opts.format === 'markdown' ? 'markdown' : 'json');
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

export function parseWeekSnapshotFile(path: string): WeekTimetable {
  const raw = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as WeekTimetable;
}
