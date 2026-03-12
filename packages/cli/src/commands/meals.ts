import type { Command } from 'commander';
import { InvalidInputError } from '@kampus/core';
import { createClient } from '../client-factory.js';
import { getFormat, printDailyMeals, printWeeklyMeals } from '../output.js';
import { resolveSchool } from './resolve.js';

export function mealsCommands(program: Command): void {
  const meals = program.command('meals').description('Meal lookup commands');

  meals
    .command('today')
    .description('Fetch meals for a single date')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--date <YYYY-MM-DD>', 'Date override')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps meals today --school "<school>" --region "<region>" --date 2026-03-12')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const daily = await client.getMealsToday({
        school,
        date: opts.date,
      });
      printDailyMeals(daily, getFormat(opts));
    });

  meals
    .command('week')
    .description('Fetch meals for a school week')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--date <YYYY-MM-DD>', 'Any date inside the target week')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps meals week --school "<school>" --region "<region>"')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const weekly = await client.getMealsWeek({
        school,
        date: opts.date,
      });
      printWeeklyMeals(weekly, getFormat(opts));
    });

  meals
    .command('range')
    .description('Fetch meals for a custom date range')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .requiredOption('--from <YYYY-MM-DD>', 'Start date')
    .requiredOption('--to <YYYY-MM-DD>', 'End date')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps meals range --school "<school>" --region "<region>" --from 2026-03-09 --to 2026-03-13')
    .action(async (opts) => {
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const weekly = await client.getMealsRange({
        school,
        fromDate: opts.from,
        toDate: opts.to,
      });
      printWeeklyMeals(weekly, getFormat(opts));
    });

  meals
    .command('month')
    .description('Fetch meals for a month')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .requiredOption('--month <YYYY-MM>', 'Target month')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps meals month --school "<school>" --region "<region>" --month 2026-03')
    .action(async (opts) => {
      const month = parseMonth(opts.month);
      const client = createClient();
      const school = await resolveSchool(client, opts.school, opts.region);
      const weekly = await client.getMealsRange({
        school,
        fromDate: `${month}-01`,
        toDate: lastDateOfMonth(month),
      });
      printWeeklyMeals(weekly, getFormat(opts));
    });
}

function parseMonth(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new InvalidInputError('--month must be in YYYY-MM format.');
  }
  return trimmed;
}

function lastDateOfMonth(month: string): string {
  const [yearText, monthText] = month.split('-');
  const year = Number.parseInt(yearText, 10);
  const monthIndex = Number.parseInt(monthText, 10);
  const date = new Date(year, monthIndex, 0);
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}
