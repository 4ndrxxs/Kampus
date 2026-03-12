import type { Command } from 'commander';
import chalk from 'chalk';
import { createClient } from '../client-factory.js';
import { getFormat, printSchoolInfo, printSchoolSearch, printStructured } from '../output.js';
import { resolveSchool } from './resolve.js';

function formatResolvedRefs(school: Awaited<ReturnType<typeof resolveSchool>>): string {
  const refs: string[] = [];
  if (school.providerRefs.neis) {
    refs.push(`neis:${school.providerRefs.neis.officeCode}/${school.providerRefs.neis.schoolCode}`);
  }
  if (school.providerRefs.comcigan) {
    refs.push(`comcigan:${school.providerRefs.comcigan.schoolCode}`);
  }
  return refs.join(', ') || '(unresolved)';
}

export function schoolCommands(program: Command): void {
  const school = program.command('school').description('Search and resolve school identities');

  school
    .command('search <keyword>')
    .description('Search schools by keyword')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExamples:\n  kps school search "<keyword>"\n  kps school search "<keyword>" --json')
    .action(async (keyword: string, opts) => {
      const client = createClient();
      const results = await client.searchSchools(keyword);
      printSchoolSearch(results, getFormat(opts));
    });

  school
    .command('info')
    .description('Fetch normalized school info')
    .option('--school <name>', 'School name (defaults to saved default school)')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps school info --school "<school>" --region "<region>"')
    .action(async (opts) => {
      const client = createClient();
      const resolved = await resolveSchool(client, opts.school, opts.region);
      const info = await client.getSchoolInfo(resolved);
      printSchoolInfo(info, getFormat(opts));
    });

  school
    .command('resolve <name>')
    .description('Resolve a school into provider refs')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .addHelpText('after', '\nExample:\n  kps school resolve "<school>" --region "<region>" --json')
    .action(async (name: string, opts) => {
      const client = createClient();
      const resolved = await resolveSchool(client, name, opts.region);
      const format = getFormat(opts);
      if (format !== 'human') {
        printStructured(resolved, format === 'markdown' ? 'json' : format);
        return;
      }

      console.log();
      console.log(`  ${chalk.bold(resolved.name)}`);
      if (resolved.region) {
        console.log(`  ${chalk.dim('region')}  ${resolved.region}`);
      }
      if (resolved.schoolType) {
        console.log(`  ${chalk.dim('type')}    ${resolved.schoolType}`);
      }
      console.log(`  ${chalk.dim('refs')}    ${chalk.magenta(formatResolvedRefs(resolved))}`);
      console.log();
    });
}
