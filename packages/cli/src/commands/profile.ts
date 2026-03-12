import type { Command } from 'commander';
import chalk from 'chalk';
import {
  getActiveProfile,
  listProfiles,
  loadKampusConfig,
  removeProfile,
  saveKampusConfig,
  setActiveProfile,
  type KampusProfile,
  upsertProfile,
} from '@kampus/core';
import { createClient } from '../client-factory.js';
import { getFormat, printStructured } from '../output.js';
import { getDefaultSchool, resolveSchool } from './resolve.js';

export function profileCommands(program: Command): void {
  const profile = program.command('profile').description('Manage reusable Kampus profiles');

  profile
    .command('list')
    .description('List saved profiles')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .action((opts) => {
      const format = getFormat(opts);
      const config = loadKampusConfig();
      const payload = {
        activeProfile: getActiveProfile(config)?.name,
        profiles: listProfiles(config),
      };

      if (format !== 'human') {
        printStructured(payload, format === 'markdown' ? 'json' : format);
        return;
      }

      console.log();
      console.log(`  ${chalk.dim('active')}  ${payload.activeProfile ? chalk.green(payload.activeProfile) : chalk.dim('(none)')}`);
      if (!payload.profiles.length) {
        console.log(chalk.dim('  No profiles saved.'));
        console.log();
        return;
      }
      console.log();
      for (const entry of payload.profiles) {
        const isActive = payload.activeProfile === entry.name;
        const icon = isActive ? chalk.green('●') : chalk.dim('○');
        const name = isActive ? chalk.green.bold(entry.name) : entry.name;
        console.log(`  ${icon} ${name}`);
      }
      console.log();
    });

  profile
    .command('show [name]')
    .description('Show a saved profile or the active profile')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .action((name: string | undefined, opts) => {
      const format = getFormat(opts);
      const config = loadKampusConfig();
      const entry = findProfile(config, name);
      if (format !== 'human') {
        printStructured(entry ?? null, format === 'markdown' ? 'json' : format);
        return;
      }
      if (!entry) {
        console.log(chalk.dim('  No matching profile found.'));
        return;
      }
      printProfile(entry, getActiveProfile(config)?.name === entry.name);
    });

  profile
    .command('save <name>')
    .description('Save or update a reusable profile')
    .option('--school <name>', 'School name')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--grade <n>', 'Default grade', parseInt)
    .option('--class <n>', 'Default class number', parseInt)
    .option('--teacher <name>', 'Default teacher name')
    .option('--notes <text>', 'Optional notes')
    .option('--activate', 'Set the saved profile as active immediately')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .action(async (name: string, opts) => {
      const format = getFormat(opts);
      const client = createClient();
      const defaultSchool = getDefaultSchool();
      const school =
        opts.school || opts.region
          ? await resolveSchool(client, opts.school, opts.region)
          : defaultSchool;

      let nextConfig = upsertProfile(loadKampusConfig(), {
        name,
        school,
        grade: opts.grade,
        classNo: opts.class,
        teacherName: opts.teacher,
        notes: opts.notes,
      });

      if (opts.activate) {
        nextConfig = setActiveProfile(nextConfig, name);
      }

      saveKampusConfig(nextConfig);
      const entry = findProfile(nextConfig, name);

      if (format !== 'human') {
        printStructured({
          ok: true,
          active: opts.activate,
          profile: entry,
        }, format === 'markdown' ? 'json' : format);
        return;
      }

      console.log(`  ${chalk.green('✓')} Saved profile: ${chalk.bold(name)}`);
      if (opts.activate) {
        console.log(`  ${chalk.green('●')} Profile is now active.`);
      }
      if (entry) {
        printProfile(entry, opts.activate);
      }
    });

  profile
    .command('use <name>')
    .description('Set the active profile')
    .action((name: string) => {
      const nextConfig = setActiveProfile(loadKampusConfig(), name);
      saveKampusConfig(nextConfig);
      console.log(`  ${chalk.green('●')} Active profile: ${chalk.bold(findProfile(nextConfig, name)?.name ?? name)}`);
    });

  profile
    .command('clear-active')
    .description('Clear the active profile selection')
    .action(() => {
      saveKampusConfig(setActiveProfile(loadKampusConfig(), undefined));
      console.log(`  ${chalk.green('✓')} Cleared the active profile.`);
    });

  profile
    .command('remove <name>')
    .description('Remove a saved profile')
    .action((name: string) => {
      saveKampusConfig(removeProfile(loadKampusConfig(), name));
      console.log(`  ${chalk.green('✓')} Removed profile: ${chalk.bold(name)}`);
    });
}

function findProfile(config: ReturnType<typeof loadKampusConfig>, name?: string): KampusProfile | undefined {
  if (!name) {
    return getActiveProfile(config);
  }

  return listProfiles(config).find((entry) => entry.name.toLowerCase() === name.trim().toLowerCase());
}

function printProfile(profile: KampusProfile, active: boolean): void {
  console.log();
  const icon = active ? chalk.green('●') : chalk.dim('○');
  console.log(`  ${icon} ${chalk.bold(profile.name)}`);
  if (profile.school) {
    const extras = [profile.school.region, profile.school.schoolType].filter(Boolean).join(', ');
    const label = extras ? `${profile.school.name} ${chalk.dim(`(${extras})`)}` : profile.school.name;
    console.log(`    ${chalk.dim('school')}   ${label}`);
  }
  if (profile.grade) {
    console.log(`    ${chalk.dim('grade')}    ${profile.grade}`);
  }
  if (profile.classNo) {
    console.log(`    ${chalk.dim('class')}    ${profile.classNo}`);
  }
  if (profile.teacherName) {
    console.log(`    ${chalk.dim('teacher')}  ${profile.teacherName}`);
  }
  if (profile.notes) {
    console.log(`    ${chalk.dim('notes')}    ${profile.notes}`);
  }
  console.log();
}
