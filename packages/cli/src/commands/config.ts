import type { Command } from 'commander';
import chalk from 'chalk';
import {
  describeSecretStorage,
  getKampusConfigStatus,
  InvalidInputError,
  KAMPUS_DEVELOPER_INFO,
  KAMPUS_PROJECT_INFO,
  loadKampusConfig,
  resolveCachePolicy,
  resolveKampusCachePath,
  resolveKampusConfigPath,
  saveKampusConfig,
  setDefaultSchool,
  type SchoolRef,
} from '@kampus/core';
import { createClient } from '../client-factory.js';
import { getFormat, printStructured } from '../output.js';
import { resolveSchool } from './resolve.js';

const AVAILABLE_WITHOUT_KEY = [
  'Merged school search and school resolve across Comcigan and NEIS limited mode',
  'Comcigan student timetable, teacher timetable, teacher info, next class, class times, export, diff',
  'Official NEIS school search, school info, meals, and dataset queries in limited sample mode',
];

const FULL_NEIS_FEATURES = [
  'Complete official NEIS searches and larger result sets',
  'Official NEIS meal month/range queries without sample truncation',
  'Official NEIS datasets beyond the sample-mode cap',
];

export function configCommands(program: Command): void {
  const config = program.command('config').description('Manage local Kampus configuration');
  const set = config.command('set').description('Set a config value');
  const clear = config.command('clear').description('Clear a config value');

  config
    .command('show')
    .description('Show the current config status')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .action((opts) => {
      const format = getFormat(opts);
      const status = getKampusConfigStatus();
      const data = {
        configPath: status.configPath,
        cachePath: resolveKampusCachePath(),
        metadataReadOnly: true,
        neisApiKeyConfigured: status.neisApiKeyConfigured,
        neisApiKeyStored: status.neisApiKeyStored,
        neisApiKeyReadable: status.neisApiKeyReadable,
        neisApiKeySource: status.neisApiKeySource,
        neisApiKeyStorage: status.neisApiKeyStorage,
        neisApiKeyPreview: status.neisApiKeyPreview,
        neisApiKeyError: status.neisApiKeyError,
        neisApiKeyStatus: status.neisApiKeyStatus,
        projectInfo: KAMPUS_PROJECT_INFO,
        developerInfo: KAMPUS_DEVELOPER_INFO,
        defaultSchool: status.defaultSchool,
        recentSchools: status.recentSchools,
        activeProfile: status.activeProfile,
        profiles: status.profiles,
        cachePolicy: status.cachePolicy,
        features: {
          availableWithoutKey: AVAILABLE_WITHOUT_KEY,
          unlockedByNeisApiKey: FULL_NEIS_FEATURES,
          notes: [
            'Without a NEIS key, official endpoints currently run in a limited sample mode and may truncate to a small number of rows.',
            'Default school is used when --school is omitted in school-bound commands.',
            'Recent schools are filled only from schools that you actually resolved in Kampus.',
            'Project and developer identity shown here is embedded application metadata and cannot be changed by users.',
          ],
        },
      };

      if (format !== 'human') {
        printStructured(data, format === 'markdown' ? 'json' : format);
        return;
      }

      console.log();
      console.log(`  ${chalk.bold('Kampus Config')}`);
      console.log(`  ${chalk.dim('-'.repeat(48))}`);
      console.log();
      console.log(`  ${chalk.dim('config')}     ${chalk.dim(data.configPath)}`);
      console.log(`  ${chalk.dim('cache')}      ${chalk.dim(data.cachePath)}`);
      console.log();

      console.log(`  ${chalk.bold('NEIS API Key')}`);
      console.log(`  ${chalk.dim('configured')} ${status.neisApiKeyConfigured ? chalk.green('yes') : chalk.yellow('no')}`);
      console.log(`  ${chalk.dim('stored')}     ${status.neisApiKeyStored ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('readable')}   ${status.neisApiKeyReadable ? chalk.green('yes') : chalk.red('no')}`);
      if (status.neisApiKeyConfigured) {
        console.log(`  ${chalk.dim('source')}     ${status.neisApiKeySource}`);
        console.log(`  ${chalk.dim('storage')}    ${describeSecretStorage(status.neisApiKeyStorage, status.neisApiKeySource)}`);
        if (status.neisApiKeyPreview) {
          console.log(`  ${chalk.dim('preview')}    ${chalk.cyan(status.neisApiKeyPreview)}`);
        }
      } else if (status.neisApiKeyStored && status.neisApiKeyStorage) {
        console.log(`  ${chalk.dim('storage')}    ${describeSecretStorage(status.neisApiKeyStorage, status.neisApiKeySource)}`);
      }
      if (status.neisApiKeyError) {
        console.log(`  ${chalk.dim('error')}      ${chalk.red(status.neisApiKeyError)}`);
      }
      if (status.neisApiKeyStatus?.checkedAt) {
        console.log(`  ${chalk.dim('validated')}  ${status.neisApiKeyStatus.checkedAt}`);
      }
      console.log();

      console.log(`  ${chalk.bold('Project Info')} ${chalk.dim('(read-only)')}`);
      console.log(`  ${chalk.dim('name')}       ${KAMPUS_PROJECT_INFO.name}`);
      console.log(`  ${chalk.dim('desc')}       ${KAMPUS_PROJECT_INFO.description}`);
      console.log(`  ${chalk.dim('repo')}       ${KAMPUS_PROJECT_INFO.repositoryUrl}`);
      console.log(`  ${chalk.dim('homepage')}   ${KAMPUS_PROJECT_INFO.homepageUrl}`);
      console.log();

      console.log(`  ${chalk.bold('Developer Info')} ${chalk.dim('(read-only)')}`);
      console.log(`  ${chalk.dim('name')}       ${KAMPUS_DEVELOPER_INFO.name}`);
      console.log(`  ${chalk.dim('email')}      ${KAMPUS_DEVELOPER_INFO.email ?? chalk.dim('(not set)')}`);
      console.log(`  ${chalk.dim('url')}        ${KAMPUS_DEVELOPER_INFO.url ?? chalk.dim('(not set)')}`);
      console.log();

      console.log(`  ${chalk.bold('Defaults')}`);
      console.log(`  ${chalk.dim('school')}     ${status.defaultSchool ? formatSchool(status.defaultSchool) : chalk.dim('(not set)')}`);
      console.log(`  ${chalk.dim('profile')}    ${status.activeProfile?.name ?? chalk.dim('(not set)')}`);
      console.log(`  ${chalk.dim('profiles')}   ${status.profiles.length}`);
      console.log(`  ${chalk.dim('recent')}     ${status.recentSchools.length}`);
      if (status.recentSchools.length) {
        for (const school of status.recentSchools) {
          console.log(`    ${chalk.dim('-')} ${formatSchool(school)}`);
        }
      }
      console.log();

      console.log(`  ${chalk.bold('Cache Policy')}`);
      console.log(`  ${chalk.dim('dataset ttl')}       ${status.cachePolicy.datasetTtlMinutes}m`);
      console.log(`  ${chalk.dim('stale-if-error')}    ${status.cachePolicy.staleIfErrorHours}h`);
      console.log(`  ${chalk.dim('max entries')}       ${status.cachePolicy.maxEntries}`);
      console.log();

      console.log(`  ${chalk.bold('Available without key')}`);
      for (const feature of AVAILABLE_WITHOUT_KEY) {
        console.log(`    ${chalk.dim('-')} ${feature}`);
      }
      console.log();
      console.log(`  ${chalk.bold('Unlocked by NEIS API key')}`);
      for (const feature of FULL_NEIS_FEATURES) {
        console.log(`    ${chalk.dim('-')} ${chalk.green(feature)}`);
      }
      console.log();
      for (const note of data.features.notes) {
        console.log(chalk.dim(`  ${note}`));
      }
      console.log();
    });

  config
    .command('path')
    .description('Print the local config path')
    .action(() => {
      console.log(resolveKampusConfigPath());
    });

  config
    .command('cache-path')
    .description('Print the local cache path')
    .action(() => {
      console.log(resolveKampusCachePath());
    });

  set
    .command('neis-api-key <key>')
    .description('Save the NEIS API key to the local config')
    .action((key: string) => {
      const current = loadKampusConfig();
      const next = saveKampusConfig({
        ...current,
        neisApiKey: key,
        neisApiKeyStoredValue: undefined,
      });

      console.log(`  ${chalk.green('[saved]')} Saved NEIS API key to ${chalk.dim(resolveKampusConfigPath())}`);
      if (next.neisApiKey) {
        console.log(`  ${chalk.dim('storage')}  ${describeSecretStorage(next.neisApiKeyStorage, 'config')}`);
      }
    });

  set
    .command('default-school <school>')
    .description('Resolve and save the default school')
    .option('--region <name>', 'Region hint to disambiguate')
    .action(async (schoolName: string, opts) => {
      const client = createClient();
      const school = await resolveSchool(client, schoolName, opts.region);
      const next = saveKampusConfig(setDefaultSchool(loadKampusConfig(), school));
      console.log(`  ${chalk.green('[saved]')} Saved default school to ${chalk.dim(resolveKampusConfigPath())}`);
      if (next.defaultSchool) {
        console.log(`  ${chalk.dim('school')}  ${formatSchool(next.defaultSchool)}`);
      }
    });

  set
    .command('cache-dataset-ttl <minutes>')
    .description('Set the NEIS dataset cache TTL in minutes')
    .action((minutes: string) => {
      const parsed = parsePositiveInteger(minutes, 'Cache dataset TTL');
      const current = loadKampusConfig();
      const next = saveKampusConfig({
        ...current,
        cachePolicy: {
          ...resolveCachePolicy(current),
          datasetTtlMinutes: parsed,
        },
      });
      console.log(`  ${chalk.green('[saved]')} Saved cache dataset TTL ${chalk.cyan(`${next.cachePolicy?.datasetTtlMinutes}m`)}`);
    });

  set
    .command('cache-stale-if-error <hours>')
    .description('Set the stale-if-error fallback window in hours')
    .action((hours: string) => {
      const parsed = parsePositiveInteger(hours, 'Cache stale-if-error window');
      const current = loadKampusConfig();
      const next = saveKampusConfig({
        ...current,
        cachePolicy: {
          ...resolveCachePolicy(current),
          staleIfErrorHours: parsed,
        },
      });
      console.log(`  ${chalk.green('[saved]')} Saved stale-if-error window ${chalk.cyan(`${next.cachePolicy?.staleIfErrorHours}h`)}`);
    });

  set
    .command('cache-max-entries <count>')
    .description('Set the maximum number of cached dataset entries')
    .action((count: string) => {
      const parsed = parsePositiveInteger(count, 'Cache max entries');
      const current = loadKampusConfig();
      const next = saveKampusConfig({
        ...current,
        cachePolicy: {
          ...resolveCachePolicy(current),
          maxEntries: parsed,
        },
      });
      console.log(`  ${chalk.green('[saved]')} Saved cache max entries ${chalk.cyan(String(next.cachePolicy?.maxEntries))}`);
    });

  clear
    .command('neis-api-key')
    .description('Remove the saved NEIS API key from the local config')
    .action(() => {
      const current = loadKampusConfig();
      saveKampusConfig({
        ...current,
        neisApiKey: undefined,
        neisApiKeyStoredValue: undefined,
        neisApiKeyStorage: undefined,
        neisApiKeyReadable: false,
        neisApiKeyError: undefined,
      });
      console.log(`  ${chalk.green('[cleared]')} Removed saved NEIS API key.`);
    });

  clear
    .command('default-school')
    .description('Remove the saved default school from the local config')
    .action(() => {
      const current = loadKampusConfig();
      saveKampusConfig({
        ...current,
        defaultSchool: undefined,
      });
      console.log(`  ${chalk.green('[cleared]')} Removed saved default school.`);
    });

  clear
    .command('cache-policy')
    .description('Reset the saved cache policy back to defaults')
    .action(() => {
      const current = loadKampusConfig();
      saveKampusConfig({
        ...current,
        cachePolicy: undefined,
      });
      console.log(`  ${chalk.green('[cleared]')} Reset cache policy to defaults.`);
    });
}

function formatSchool(school: Pick<SchoolRef, 'name' | 'region' | 'schoolType'>): string {
  const extras = [school.region, school.schoolType].filter(Boolean).join(', ');
  return extras ? `${school.name} (${extras})` : school.name;
}

function parsePositiveInteger(raw: string, label: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidInputError(`${label} must be a non-negative integer.`);
  }

  return parsed;
}
