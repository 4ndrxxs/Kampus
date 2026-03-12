import type { Command } from 'commander';
import chalk from 'chalk';
import {
  describeSecretStorage,
  getPreferredSecretStorage,
  getKampusConfigStatus,
  InvalidInputError,
  loadKampusConfig,
  maskSecret,
  resolveCachePolicy,
  resolveKampusCachePath,
  resolveNeisApiKey,
  saveKampusConfig,
  setNeisApiKeyStatus,
} from '@kampus/core';
import { NeisProvider } from '@kampus/provider-neis';
import { getFormat, printStructured } from '../output.js';

const SMOKE_KEYWORD = '\uACBD\uAE30\uBD81\uACFC\uD559\uACE0';

export function authCommands(program: Command): void {
  const auth = program.command('auth').description('Manage NEIS authentication and validation');

  auth
    .command('status')
    .description('Show the current NEIS authentication status')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .action((opts) => {
      const format = getFormat(opts);
      const status = getKampusConfigStatus();
      const payload = {
        configPath: status.configPath,
        configured: status.neisApiKeyConfigured,
        stored: status.neisApiKeyStored,
        readable: status.neisApiKeyReadable,
        source: status.neisApiKeySource,
        storageMode: status.neisApiKeyStorage,
        preview: status.neisApiKeyPreview,
        error: status.neisApiKeyError,
        validation: status.neisApiKeyStatus,
        storage: describeSecretStorage(status.neisApiKeyStorage, status.neisApiKeySource),
        warnings: buildAuthWarnings({
          source: status.neisApiKeySource,
          storageMode: status.neisApiKeyStorage,
          readable: status.neisApiKeyReadable,
          error: status.neisApiKeyError,
        }),
      };

      if (format !== 'human') {
        printStructured(payload, format === 'markdown' ? 'json' : format);
        return;
      }

      console.log();
      console.log(`  ${chalk.bold('Auth Status')}`);
      console.log(`  ${chalk.dim('─'.repeat(48))}`);
      console.log();
      console.log(`  ${chalk.dim('configured')}  ${payload.configured ? chalk.green('yes') : chalk.yellow('no')}`);
      console.log(`  ${chalk.dim('stored')}      ${payload.stored ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('readable')}    ${payload.readable ? chalk.green('yes') : chalk.red('no')}`);
      console.log(`  ${chalk.dim('source')}      ${payload.source}`);
      if (payload.storageMode) {
        console.log(`  ${chalk.dim('storage')}     ${payload.storageMode}`);
      }
      if (payload.preview) {
        console.log(`  ${chalk.dim('preview')}     ${chalk.cyan(payload.preview)}`);
      }
      if (payload.error) {
        console.log(`  ${chalk.dim('error')}       ${chalk.red(payload.error)}`);
      }
      if (payload.validation?.checkedAt) {
        console.log(`  ${chalk.dim('validated')}   ${payload.validation.checkedAt}`);
      }
      if (payload.validation?.accessMode) {
        const modeColor = payload.validation.accessMode === 'official-full' ? chalk.green : chalk.yellow;
        console.log(`  ${chalk.dim('access mode')} ${modeColor(payload.validation.accessMode)}`);
      }
      if (payload.validation?.message) {
        console.log(`  ${chalk.dim('message')}     ${payload.validation.message}`);
      }
      console.log(`  ${chalk.dim('storage')}     ${payload.storage}`);
      for (const warning of payload.warnings) {
        console.log(chalk.yellow(`  ⚠ ${warning}`));
      }
      console.log();
    });

  auth
    .command('login')
    .description('Save a NEIS API key to local config and optionally validate it')
    .requiredOption('--api-key <key>', 'NEIS API key')
    .option('--storage <type>', 'Storage mode (auto|windows-dpapi|plain-text)', 'auto')
    .option('--skip-validate', 'Skip the live validation check')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .action(async (opts) => {
      const format = getFormat(opts);
      const preferredStorage = parseStorageMode(opts.storage);
      let nextConfig = saveKampusConfig({
        ...loadKampusConfig(),
        neisApiKey: opts.apiKey,
        neisApiKeyStoredValue: undefined,
        neisApiKeyStorage: preferredStorage === 'auto' ? getPreferredSecretStorage() : preferredStorage,
        neisApiKeyReadable: true,
        neisApiKeyError: undefined,
      });

      let validation = undefined;
      if (!opts.skipValidate) {
        validation = await validateKey(opts.apiKey, 'config');
        nextConfig = saveKampusConfig(setNeisApiKeyStatus(nextConfig, validation));
      }

      const payload = {
        ok: true,
        configured: true,
        preview: maskSecret(opts.apiKey),
        storageMode: nextConfig.neisApiKeyStorage,
        storage: describeSecretStorage(nextConfig.neisApiKeyStorage, 'config'),
        validation,
        warnings: buildAuthWarnings({
          source: 'config',
          storageMode: nextConfig.neisApiKeyStorage,
          readable: true,
        }),
      };

      if (format !== 'human') {
        printStructured(payload, format === 'markdown' ? 'json' : format);
        return;
      }

      console.log(`  ${chalk.green('✓')} Saved NEIS API key to local config.`);
      console.log(`  ${chalk.dim('preview')}  ${chalk.cyan(payload.preview)}`);
      console.log(`  ${chalk.dim('storage')}  ${payload.storage}`);
      if (validation?.message) {
        console.log(`  ${chalk.dim('validation')}  ${validation.message}`);
      }
      for (const warning of payload.warnings) {
        console.log(chalk.yellow(`  ⚠ ${warning}`));
      }
    });

  auth
    .command('migrate')
    .description('Re-save the current config key using the preferred protected storage when available')
    .option('--storage <type>', 'Storage mode (auto|windows-dpapi|plain-text)', 'auto')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .action((opts) => {
      const format = getFormat(opts);
      const current = loadKampusConfig();
      if (!current.neisApiKey) {
        if (current.neisApiKeyStoredValue && current.neisApiKeyError) {
          throw new InvalidInputError(current.neisApiKeyError);
        }
        throw new InvalidInputError('No saved config NEIS API key is available to migrate.');
      }

      const preferredStorage = parseStorageMode(opts.storage);
      const next = saveKampusConfig({
        ...current,
        neisApiKey: current.neisApiKey,
        neisApiKeyStoredValue: undefined,
        neisApiKeyStorage: preferredStorage === 'auto' ? getPreferredSecretStorage() : preferredStorage,
        neisApiKeyReadable: true,
        neisApiKeyError: undefined,
      });

      const payload = {
        ok: true,
        configured: true,
        preview: maskSecret(current.neisApiKey),
        storageMode: next.neisApiKeyStorage,
        storage: describeSecretStorage(next.neisApiKeyStorage, 'config'),
        warnings: buildAuthWarnings({
          source: 'config',
          storageMode: next.neisApiKeyStorage,
          readable: true,
        }),
      };

      if (format !== 'human') {
        printStructured(payload, format === 'markdown' ? 'json' : format);
        return;
      }

      console.log(`  ${chalk.green('✓')} Re-saved the NEIS API key using the requested storage mode.`);
      console.log(`  ${chalk.dim('storage')}  ${payload.storage}`);
      console.log(`  ${chalk.dim('preview')}  ${chalk.cyan(payload.preview)}`);
      for (const warning of payload.warnings) {
        console.log(chalk.yellow(`  ⚠ ${warning}`));
      }
    });

  auth
    .command('validate')
    .description('Run a live NEIS validation check against the configured key')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .action(async (opts) => {
      const format = getFormat(opts);
      const status = getKampusConfigStatus();
      const apiKey = resolveNeisApiKey();
      if (!apiKey) {
        if (status.neisApiKeyStored && !status.neisApiKeyReadable && status.neisApiKeyError) {
          throw new InvalidInputError(status.neisApiKeyError);
        }
        throw new InvalidInputError('No NEIS API key is configured. Use "kps auth login --api-key <key>" first.');
      }

      const source = process.env.NEIS_API_KEY?.trim() ? 'env' : 'config';
      const validation = await validateKey(apiKey, source);

      if (source === 'config') {
        saveKampusConfig(setNeisApiKeyStatus(loadKampusConfig(), validation));
      }

      if (format !== 'human') {
        printStructured(validation, format === 'markdown' ? 'json' : format);
        return;
      }

      const icon = validation.ok ? chalk.green('✓') : chalk.red('✖');
      console.log(`  ${icon} ${validation.ok ? 'Validation passed' : 'Validation failed'}`);
      console.log(`  ${chalk.dim('validated')}  ${validation.checkedAt}`);
      if (validation.accessMode) {
        const modeColor = validation.accessMode === 'official-full' ? chalk.green : chalk.yellow;
        console.log(`  ${chalk.dim('access mode')}  ${modeColor(validation.accessMode)}`);
      }
      if (validation.message) {
        console.log(`  ${chalk.dim('message')}  ${validation.message}`);
      }
    });

  auth
    .command('logout')
    .description('Remove the saved NEIS API key from local config')
    .action(() => {
      saveKampusConfig({
        ...loadKampusConfig(),
        neisApiKey: undefined,
        neisApiKeyStoredValue: undefined,
        neisApiKeyStorage: undefined,
        neisApiKeyReadable: false,
        neisApiKeyError: undefined,
        neisApiKeyStatus: undefined,
      });
      console.log(`  ${chalk.green('✓')} Removed the saved NEIS API key from local config.`);
    });

  auth
    .command('export')
    .description('Print a shell command that exports the current NEIS API key')
    .option('--shell <type>', 'Shell type (powershell|bash)', 'powershell')
    .action((opts) => {
      const apiKey = resolveNeisApiKey();
      if (!apiKey) {
        throw new InvalidInputError('No NEIS API key is configured.');
      }

      if (opts.shell === 'bash') {
        console.log(`export NEIS_API_KEY="${apiKey}"`);
        return;
      }

      console.log(`$env:NEIS_API_KEY="${apiKey}"`);
    });
}

async function validateKey(apiKey: string, source: 'env' | 'config') {
  const cachePolicy = resolveCachePolicy();
  const provider = new NeisProvider({
    apiKey,
    cachePath: resolveKampusCachePath(),
    cacheTtlMs: cachePolicy.datasetTtlMinutes * 60 * 1000,
    staleIfErrorMs: cachePolicy.staleIfErrorHours * 60 * 60 * 1000,
    cacheMaxEntries: cachePolicy.maxEntries,
  });
  const checkedAt = new Date().toISOString();

  try {
    const result = await provider.getDatasetResult('schoolInfo', {
      SCHUL_NM: SMOKE_KEYWORD,
      pSize: 1,
    });

    return {
      checkedAt,
      ok: true,
      accessMode: result.dataStatus.accessMode,
      message: `Validated against schoolInfo smoke query for "${SMOKE_KEYWORD}".`,
      source,
    } as const;
  } catch (error) {
    return {
      checkedAt,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      source,
    } as const;
  }
}

function parseStorageMode(value: string): 'auto' | 'windows-dpapi' | 'plain-text' {
  if (value === 'auto' || value === 'windows-dpapi' || value === 'plain-text') {
    return value;
  }

  throw new InvalidInputError('Storage mode must be one of: auto, windows-dpapi, plain-text.');
}

function buildAuthWarnings(input: {
  source: 'env' | 'config' | 'none';
  storageMode?: 'windows-dpapi' | 'plain-text';
  readable: boolean;
  error?: string;
}): string[] {
  const warnings: string[] = [];

  if (input.error) {
    warnings.push(input.error);
  }

  if (input.source === 'config' && input.storageMode === 'plain-text') {
    warnings.push(
      process.platform === 'win32'
        ? 'This key is still stored as plain text. Run "kps auth migrate" to upgrade it to Windows DPAPI protection.'
        : 'This key is stored in plain-text config on this platform. Prefer NEIS_API_KEY environment variables or an external secret manager for production use.',
    );
  }

  if (input.source === 'config' && !input.readable) {
    warnings.push('The saved config key exists but is not readable in this environment. Re-enter it or override it with NEIS_API_KEY.');
  }

  return warnings;
}
