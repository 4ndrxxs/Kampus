import type { Command } from 'commander';
import chalk from 'chalk';
import {
  AmbiguousSchoolError,
  describeSecretStorage,
  InvalidInputError,
  SchoolNotFoundError,
  formatDate,
  getKampusConfigStatus,
  resolveCachePolicy,
  resolveKampusCachePath,
  resolveNeisApiKey,
  type DataStatus,
  type ProviderId,
  type SchoolRef,
  type SchoolSearchResult,
} from '@kampus/core';
import { ComciganProvider } from '@kampus/provider-comcigan';
import { NeisProvider, type NeisDatasetName } from '@kampus/provider-neis';
import { createClient } from '../client-factory.js';
import { getFormat, printStructured, type OutputFormat } from '../output.js';
import { getDefaultSchool } from './resolve.js';
import { toCliErrorPayload } from '../errors.js';

const KNOWN_SMOKE_KEYWORD = '\uACBD\uAE30\uBD81\uACFC\uD559\uACE0';
const NEIS_DATASETS: NeisDatasetName[] = [
  'schoolInfo',
  'mealServiceDietInfo',
  'classInfo',
  'schoolMajorinfo',
  'schulAflcoinfo',
  'SchoolSchedule',
  'elsTimetable',
  'misTimetable',
  'hisTimetable',
  'spsTimetable',
  'tiClrminfo',
  'acaInsTiInfo',
];

interface ProviderLiveCheck {
  ok: boolean;
  check: string;
  message: string;
  resultCount?: number;
  totalCount?: number;
  dataStatus?: DataStatus;
  firstResult?: unknown;
  error?: {
    code: string;
    message: string;
  };
  subchecks?: ProviderLiveSubcheck[];
}

interface ProviderLiveSubcheck {
  name: string;
  ok: boolean;
  message: string;
  dataStatus?: DataStatus;
  error?: {
    code: string;
    message: string;
  };
}

interface ProviderDebugReport {
  provider: ProviderId;
  configured: boolean;
  capabilities: string[];
  expectedAccessMode: 'official-full' | 'official-limited' | 'unofficial';
  notes: string[];
  live?: ProviderLiveCheck;
}

interface DoctorReport {
  ok: true;
  checkedAt: string;
  live: boolean;
  config: ReturnType<typeof getKampusConfigStatus>;
  providers: ProviderDebugReport[];
  recommendations: string[];
}

export function diagCommands(program: Command): void {
  program
    .command('doctor')
    .description('Inspect local Kampus configuration and provider readiness')
    .option('--live', 'Run lightweight live upstream smoke checks')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExamples:\n  kps doctor\n  kps doctor --live --json')
    .action(async (opts) => {
      const config = getKampusConfigStatus();
      const providers = await Promise.all([
        buildProviderReport('comcigan', opts.live),
        buildProviderReport('neis', opts.live),
      ]);

      const report: DoctorReport = {
        ok: true,
        checkedAt: new Date().toISOString(),
        live: Boolean(opts.live),
        config,
        providers,
        recommendations: buildRecommendations(config, providers),
      };

      printDoctorReport(report, getFormat(opts));
    });

  const debug = program.command('debug').description('Debug school resolution and provider state');

  debug
    .command('school [name]')
    .description('Inspect school search candidates and final resolution')
    .option('--region <name>', 'Region hint to disambiguate')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExamples:\n  kps debug school "<school>" --region "<region>" --json\n  kps debug school --json')
    .action(async (name: string | undefined, opts) => {
      const client = createClient();
      const defaultSchool = getDefaultSchool();
      const keyword = name?.trim() || defaultSchool?.name;
      if (!keyword) {
        throw new InvalidInputError(
          'School name is required. Pass a name or configure a default school before using debug school.',
        );
      }

      const regionHint = opts.region?.trim() || (!name ? defaultSchool?.region : undefined);
      const candidates = await client.searchSchools(keyword);

      const report = {
        ok: true as const,
        input: {
          keyword,
          regionHint,
          usedDefaultSchool: !name,
        },
        defaultSchool,
        candidateCount: candidates.length,
        candidates,
        resolution: await resolveSchoolDebug(client, keyword, regionHint),
      };

      printSchoolDebugReport(report, getFormat(opts));
    });

  debug
    .command('provider <provider>')
    .description('Inspect provider configuration and optional live smoke result')
    .option('--live', 'Run a live smoke check for the provider')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExamples:\n  kps debug provider neis --json\n  kps debug provider comcigan --live')
    .action(async (providerName: string, opts) => {
      const provider = parseProviderId(providerName);
      const report = {
        ok: true as const,
        checkedAt: new Date().toISOString(),
        report: await buildProviderReport(provider, opts.live),
      };

      printProviderDebugReport(report, getFormat(opts));
    });

  debug
    .command('neis-dataset <dataset>')
    .description('Run a raw NEIS dataset query for troubleshooting')
    .option('--query <json>', 'Dataset query as JSON object', '{}')
    .option('--format <type>', 'Output format (human|json|markdown|yaml|csv|table|ndjson)')
    .option('--json', 'Print JSON')
    .option('--markdown', 'Print Markdown')
    .addHelpText('after', '\nExample:\n  kps debug neis-dataset schoolInfo --query \'{"SCHUL_NM":"<school>"}\' --json')
    .action(async (dataset: string, opts) => {
      const serviceName = parseNeisDatasetName(dataset);
      const query = parseJsonObject(opts.query, '--query');
      const provider = new NeisProvider({
        apiKey: resolveNeisApiKey(),
        cachePath: resolveKampusCachePath(),
        cacheTtlMs: resolveCachePolicy().datasetTtlMinutes * 60 * 1000,
        staleIfErrorMs: resolveCachePolicy().staleIfErrorHours * 60 * 60 * 1000,
        cacheMaxEntries: resolveCachePolicy().maxEntries,
      });
      const result = await provider.getDatasetResult(serviceName, query);

      const report = {
        ok: true as const,
        dataset: serviceName,
        query,
        rowCount: result.rows.length,
        totalCount: result.totalCount,
        dataStatus: result.dataStatus,
        providerMetadata: result.providerMetadata,
        rows: result.rows,
      };

      printNeisDatasetDebugReport(report, getFormat(opts));
    });
}

async function resolveSchoolDebug(
  client: ReturnType<typeof createClient>,
  keyword: string,
  regionHint?: string,
) {
  try {
    const resolved = await client.resolveSchool(keyword, regionHint);
    return {
      status: 'resolved' as const,
      resolvedSchool: resolved,
    };
  } catch (error) {
    if (error instanceof AmbiguousSchoolError) {
      return {
        status: 'ambiguous' as const,
        matches: error.matches,
      };
    }

    if (error instanceof SchoolNotFoundError) {
      return {
        status: 'not_found' as const,
      };
    }

    throw error;
  }
}

async function buildProviderReport(
  provider: ProviderId,
  live: boolean,
): Promise<ProviderDebugReport> {
  if (provider === 'comcigan') {
    const instance = new ComciganProvider();
    return {
      provider,
      configured: true,
      capabilities: [...instance.capabilities],
      expectedAccessMode: 'unofficial',
      notes: [
        'Comcigan is an unofficial upstream and can break without notice.',
      ],
      live: live ? await runComciganLiveCheck(instance) : undefined,
    };
  }

  const apiKey = resolveNeisApiKey();
  const cachePolicy = resolveCachePolicy();
  const instance = new NeisProvider({
    apiKey,
    cachePath: resolveKampusCachePath(),
    cacheTtlMs: cachePolicy.datasetTtlMinutes * 60 * 1000,
    staleIfErrorMs: cachePolicy.staleIfErrorHours * 60 * 60 * 1000,
    cacheMaxEntries: cachePolicy.maxEntries,
  });
  return {
    provider,
    configured: Boolean(apiKey),
    capabilities: [...instance.capabilities, 'datasets'],
    expectedAccessMode: apiKey ? 'official-full' : 'official-limited',
    notes: apiKey
      ? ['A NEIS API key is configured. Official full-mode queries are enabled.']
      : ['No NEIS API key is configured. Official queries will use limited sample mode when available.'],
    live: live ? await runNeisLiveCheck(instance) : undefined,
  };
}

async function runComciganLiveCheck(provider: ComciganProvider): Promise<ProviderLiveCheck> {
  try {
    const schools = await provider.searchSchools(KNOWN_SMOKE_KEYWORD);
    return {
      ok: true,
      check: `searchSchools("${KNOWN_SMOKE_KEYWORD}")`,
      message: `Comcigan returned ${schools.length} school result(s).`,
      resultCount: schools.length,
      firstResult: schools[0],
    };
  } catch (error) {
    const payload = toCliErrorPayload(error);
    return {
      ok: false,
      check: `searchSchools("${KNOWN_SMOKE_KEYWORD}")`,
      message: payload.error.message,
      error: payload.error,
    };
  }
}

async function runNeisLiveCheck(provider: NeisProvider): Promise<ProviderLiveCheck> {
  try {
    const result = await provider.getDatasetResult('schoolInfo', {
      SCHUL_NM: KNOWN_SMOKE_KEYWORD,
    });
    const firstRow = result.rows[0];
    const subchecks = firstRow
      ? [await runNeisTimetableSubcheck(provider, firstRow)]
      : undefined;

    return {
      ok: true,
      check: `schoolInfo query for "${KNOWN_SMOKE_KEYWORD}"`,
      message: `NEIS returned ${result.rows.length} row(s).`,
      resultCount: result.rows.length,
      totalCount: result.totalCount,
      dataStatus: result.dataStatus,
      firstResult: firstRow,
      subchecks,
    };
  } catch (error) {
    const payload = toCliErrorPayload(error);
    return {
      ok: false,
      check: `schoolInfo query for "${KNOWN_SMOKE_KEYWORD}"`,
      message: payload.error.message,
      error: payload.error,
    };
  }
}

async function runNeisTimetableSubcheck(
  provider: NeisProvider,
  row: Record<string, string>,
): Promise<ProviderLiveSubcheck> {
  const school: SchoolRef = {
    name: row.SCHUL_NM || KNOWN_SMOKE_KEYWORD,
    region: row.LCTN_SC_NM || row.ATPT_OFCDC_SC_NM,
    schoolType: row.SCHUL_KND_SC_NM,
    providerRefs: {
      neis: {
        officeCode: row.ATPT_OFCDC_SC_CODE,
        schoolCode: row.SD_SCHUL_CODE,
      },
    },
  };

  const today = new Date();
  const targetDate = formatDate(today);
  const targetYear = String(today.getFullYear());

  try {
    const result = await provider.getOfficialTimetableResult({
      school,
      year: targetYear,
      date: targetDate,
      grade: 1,
      className: '1',
    });

    const warningCodes = (result.dataStatus.warnings ?? []).map((warning) => warning.code);
    const warningSummary = warningCodes.length ? ` warnings=${warningCodes.join(',')}` : '';
    const message =
      result.rows.length > 0
        ? `Official timetable probe returned ${result.rows.length} row(s) for academic year ${targetYear} on ${targetDate}.`
        : `Official timetable probe returned no rows for academic year ${targetYear} on ${targetDate}.${warningSummary}`;

    return {
      name: 'official-timetable-probe',
      ok: true,
      message,
      dataStatus: result.dataStatus,
    };
  } catch (error) {
    const payload = toCliErrorPayload(error);
    return {
      name: 'official-timetable-probe',
      ok: false,
      message: payload.error.message,
      error: payload.error,
    };
  }
}

function buildRecommendations(
  config: ReturnType<typeof getKampusConfigStatus>,
  providers: ProviderDebugReport[],
): string[] {
  const recommendations: string[] = [];

  if (!config.neisApiKeyConfigured) {
    recommendations.push('Configure a NEIS API key for complete official dataset coverage.');
  }
  if (!config.defaultSchool) {
    recommendations.push('Set a default school to simplify repeated CLI usage.');
  }
  if (config.neisApiKeyStored && !config.neisApiKeyReadable) {
    recommendations.push(
      'A saved NEIS key exists but is not readable in this environment. Re-enter it with "kps auth login" or override it with NEIS_API_KEY.',
    );
  }
  if (config.neisApiKeySource === 'config' && config.neisApiKeyStorage === 'plain-text') {
    recommendations.push(
      process.platform === 'win32'
        ? 'The saved NEIS key is still plain text. Run "kps auth migrate" to upgrade it to Windows DPAPI protection.'
        : 'The saved NEIS key is stored as plain text on this platform. Prefer NEIS_API_KEY environment variables or an external secret manager for production use.',
    );
  }
  for (const provider of providers) {
    if (provider.live && !provider.live.ok) {
      recommendations.push(`Investigate ${provider.provider} provider readiness before relying on live queries.`);
    }
    for (const subcheck of provider.live?.subchecks ?? []) {
      if (!subcheck.ok) {
        recommendations.push(`Investigate ${provider.provider} ${subcheck.name} before relying on official timetable data.`);
        continue;
      }

      const warningCodes = (subcheck.dataStatus?.warnings ?? []).map((warning) => warning.code);
      if (warningCodes.includes('NEIS_TIMETABLE_YEAR_LAG')) {
        recommendations.push('Official NEIS timetable data appears to lag behind the current academic year for the smoke school.');
      }
      if (warningCodes.includes('NEIS_TIMETABLE_FILTER_NO_MATCH')) {
        recommendations.push('Official NEIS timetable data exists, but exact timetable filters may need to be widened when rows are empty.');
      }
    }
  }
  if (!recommendations.length) {
    recommendations.push('No immediate configuration issues detected.');
  }

  return recommendations;
}

/* ── Human output helpers ──────────────────────────────────── */

function accessBadge(mode: string): string {
  switch (mode) {
    case 'official-full': return chalk.green.bold('OFFICIAL');
    case 'official-limited': return chalk.yellow.bold('LIMITED');
    case 'unofficial': return chalk.dim('UNOFFICIAL');
    default: return chalk.dim(mode);
  }
}

function statusIcon(ok: boolean): string {
  return ok ? chalk.green('✓') : chalk.red('✖');
}

function label(key: string, value: string): string {
  return `  ${chalk.dim(key)}  ${value}`;
}

function printDoctorReport(report: DoctorReport, format: OutputFormat): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(report, format);
    return;
  }

  if (format === 'markdown') {
    console.log('# Kampus Doctor');
    console.log();
    console.log(`- checkedAt: ${report.checkedAt}`);
    console.log(`- liveChecks: ${report.live ? 'enabled' : 'disabled'}`);
    console.log(`- configPath: ${report.config.configPath}`);
    console.log(`- neisApiKeyConfigured: ${report.config.neisApiKeyConfigured}`);
    console.log(`- neisApiKeyStorage: ${describeSecretStorage(report.config.neisApiKeyStorage, report.config.neisApiKeySource)}`);
    console.log(`- defaultSchool: ${report.config.defaultSchool?.name ?? '(not set)'}`);
    console.log();
    console.log('## Providers');
    console.log();
    for (const provider of report.providers) {
      printProviderSection(provider, 'markdown');
    }
    console.log('## Recommendations');
    console.log();
    for (const recommendation of report.recommendations) {
      console.log(`- ${recommendation}`);
    }
    return;
  }

  console.log();
  console.log(`  ${chalk.bold('Kampus Doctor')}`);
  console.log(`  ${chalk.dim('─'.repeat(48))}`);
  console.log();
  console.log(label('Checked at', chalk.dim(report.checkedAt)));
  console.log(label('Live checks', report.live ? chalk.green('enabled') : chalk.dim('disabled')));
  console.log(label('Config', chalk.dim(report.config.configPath)));
  console.log(label('NEIS API key', report.config.neisApiKeyConfigured ? chalk.green('configured') : chalk.yellow('not configured')));
  console.log(label('Key storage', describeSecretStorage(report.config.neisApiKeyStorage, report.config.neisApiKeySource)));
  console.log(label('Default school', report.config.defaultSchool?.name ?? chalk.dim('(not set)')));
  console.log();

  console.log(`  ${chalk.bold('Providers')}`);
  console.log();
  for (const provider of report.providers) {
    printProviderSection(provider, 'human');
  }

  console.log(`  ${chalk.bold('Recommendations')}`);
  console.log();
  for (const recommendation of report.recommendations) {
    console.log(`    ${chalk.dim('▸')} ${recommendation}`);
  }
  console.log();
}

function printSchoolDebugReport(
  report: {
    ok: true;
    input: { keyword: string; regionHint?: string; usedDefaultSchool: boolean };
    defaultSchool?: SchoolSearchResult;
    candidateCount: number;
    candidates: SchoolSearchResult[];
    resolution:
      | { status: 'resolved'; resolvedSchool: SchoolSearchResult }
      | { status: 'ambiguous'; matches: Array<Pick<SchoolSearchResult, 'name' | 'region' | 'schoolType'>> }
      | { status: 'not_found' };
  },
  format: OutputFormat,
): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(report, format);
    return;
  }

  if (format === 'markdown') {
    console.log('# School Debug');
    console.log();
    console.log(`- keyword: ${report.input.keyword}`);
    console.log(`- regionHint: ${report.input.regionHint ?? '(none)'}`);
    console.log(`- usedDefaultSchool: ${report.input.usedDefaultSchool}`);
    console.log(`- candidateCount: ${report.candidateCount}`);
    console.log(`- resolution: ${report.resolution.status}`);
    console.log();
    console.log('## Candidates');
    console.log();
    for (const candidate of report.candidates) {
      console.log(`- ${formatSchool(candidate)} | refs: ${formatProviderRefs(candidate)}`);
    }
    return;
  }

  console.log();
  console.log(`  ${chalk.bold('School Debug')}`);
  console.log(`  ${chalk.dim('─'.repeat(48))}`);
  console.log();
  console.log(label('Keyword', chalk.bold(report.input.keyword)));
  console.log(label('Region hint', report.input.regionHint ?? chalk.dim('(none)')));
  console.log(label('Used default', report.input.usedDefaultSchool ? 'yes' : 'no'));
  console.log(label('Candidates', String(report.candidateCount)));

  const resStatus = report.resolution.status;
  const resColor = resStatus === 'resolved' ? chalk.green : resStatus === 'ambiguous' ? chalk.yellow : chalk.red;
  console.log(label('Resolution', resColor(resStatus)));
  console.log();

  console.log(`  ${chalk.bold('Candidates')}`);
  console.log();
  for (const candidate of report.candidates) {
    console.log(`    ${chalk.bold(candidate.name)} ${chalk.dim(formatSchoolExtras(candidate))}`);
    console.log(`      ${chalk.magenta(formatProviderRefs(candidate))}`);
  }
  console.log();
}

function printProviderDebugReport(
  report: { ok: true; checkedAt: string; report: ProviderDebugReport },
  format: OutputFormat,
): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(report, format);
    return;
  }

  if (format === 'markdown') {
    console.log('# Provider Debug');
    console.log();
    console.log(`- checkedAt: ${report.checkedAt}`);
    console.log();
    printProviderSection(report.report, 'markdown');
    return;
  }

  console.log();
  console.log(`  ${chalk.bold('Provider Debug')}`);
  console.log(`  ${chalk.dim('─'.repeat(48))}`);
  console.log(label('Checked at', chalk.dim(report.checkedAt)));
  console.log();
  printProviderSection(report.report, 'human');
}

function printNeisDatasetDebugReport(
  report: {
    ok: true;
    dataset: NeisDatasetName;
    query: Record<string, string | number | undefined>;
    rowCount: number;
    totalCount?: number;
    dataStatus: DataStatus;
    providerMetadata?: unknown;
    rows: Record<string, string>[];
  },
  format: OutputFormat,
): void {
  if (format !== 'human' && format !== 'markdown') {
    printStructured(report, format);
    return;
  }

  const statusLines = renderDataStatusLines(report.dataStatus);
  if (format === 'markdown') {
    console.log(`# NEIS Dataset Debug: ${report.dataset}`);
    console.log();
    console.log(`- rowCount: ${report.rowCount}`);
    console.log(`- totalCount: ${report.totalCount ?? '(unknown)'}`);
    for (const line of statusLines) {
      console.log(`- ${line}`);
    }
    console.log();
    console.log('```json');
    console.log(JSON.stringify(report.rows, null, 2));
    console.log('```');
    return;
  }

  console.log();
  console.log(`  ${chalk.bold(`NEIS Dataset: ${report.dataset}`)}`);
  console.log(`  ${chalk.dim('─'.repeat(48))}`);
  console.log();
  console.log(label('Rows', `${report.rowCount}${report.totalCount != null ? chalk.dim(` / ${report.totalCount} total`) : ''}`));
  console.log(label('Mode', accessBadge(report.dataStatus.accessMode)));
  console.log(label('Complete', report.dataStatus.complete ? chalk.green('yes') : chalk.yellow('no')));
  console.log(label('Sources', report.dataStatus.sourceProviders.join(', ')));
  for (const warning of report.dataStatus.warnings ?? []) {
    console.log(chalk.yellow(`  ⚠ ${chalk.bold(`[${warning.code}]`)} ${warning.message}`));
  }
  console.log();
  console.log(JSON.stringify(report.rows, null, 2));
}

function printProviderSection(provider: ProviderDebugReport, format: Exclude<OutputFormat, 'json'>): void {
  if (format === 'markdown') {
    const prefix = '- ';
    console.log(`${prefix}${provider.provider}`);
    console.log(`  - configured: ${provider.configured}`);
    console.log(`  - expectedAccessMode: ${provider.expectedAccessMode}`);
    console.log(`  - capabilities: ${provider.capabilities.join(', ')}`);
    for (const note of provider.notes) {
      console.log(`  - note: ${note}`);
    }
    if (provider.live) {
      console.log(`  - live: ${provider.live.ok ? 'ok' : 'failed'}`);
      console.log(`    - check: ${provider.live.check}`);
      console.log(`    - message: ${provider.live.message}`);
      if (provider.live.dataStatus) {
        for (const line of renderDataStatusLines(provider.live.dataStatus)) {
          console.log(`    - ${line}`);
        }
      }
      if (provider.live.error) {
        console.log(
          `    - error: ${provider.live.error.code} ${provider.live.error.message}`,
        );
      }
      for (const subcheck of provider.live.subchecks ?? []) {
        console.log(
          `    - subcheck ${subcheck.name}: ${subcheck.ok ? 'ok' : 'failed'}`,
        );
        console.log(`      - message: ${subcheck.message}`);
        if (subcheck.dataStatus) {
          for (const line of renderDataStatusLines(subcheck.dataStatus)) {
            console.log(`      - ${line}`);
          }
        }
        if (subcheck.error) {
          console.log(
            `      - error: ${subcheck.error.code} ${subcheck.error.message}`,
          );
        }
      }
    }
    console.log('');
    return;
  }

  // human
  console.log(`    ${chalk.bold(provider.provider)}  ${accessBadge(provider.expectedAccessMode)}`);
  console.log(`      ${chalk.dim('configured')}  ${provider.configured ? chalk.green('yes') : chalk.yellow('no')}`);
  console.log(`      ${chalk.dim('capabilities')}  ${provider.capabilities.join(', ')}`);
  for (const note of provider.notes) {
    console.log(`      ${chalk.dim(note)}`);
  }
  if (provider.live) {
    console.log();
    console.log(`      ${chalk.dim('live')}  ${statusIcon(provider.live.ok)} ${provider.live.ok ? chalk.green('ok') : chalk.red('failed')}`);
    console.log(`      ${chalk.dim('check')}  ${provider.live.check}`);
    console.log(`      ${chalk.dim('result')}  ${provider.live.message}`);
    if (provider.live.dataStatus) {
      for (const warning of provider.live.dataStatus.warnings ?? []) {
        console.log(chalk.yellow(`      ⚠ ${chalk.bold(`[${warning.code}]`)} ${warning.message}`));
      }
    }
    if (provider.live.error) {
      console.log(`      ${chalk.red(`error: ${provider.live.error.code} ${provider.live.error.message}`)}`);
    }
    for (const subcheck of provider.live.subchecks ?? []) {
      console.log();
      console.log(`      ${chalk.dim(subcheck.name)}  ${statusIcon(subcheck.ok)} ${subcheck.ok ? chalk.green('ok') : chalk.red('failed')}`);
      console.log(`        ${chalk.dim(subcheck.message)}`);
      if (subcheck.dataStatus) {
        for (const warning of subcheck.dataStatus.warnings ?? []) {
          console.log(chalk.yellow(`        ⚠ ${chalk.bold(`[${warning.code}]`)} ${warning.message}`));
        }
      }
      if (subcheck.error) {
        console.log(`        ${chalk.red(`error: ${subcheck.error.code} ${subcheck.error.message}`)}`);
      }
    }
  }
  console.log();
}

function renderDataStatusLines(dataStatus?: DataStatus): string[] {
  if (!dataStatus) {
    return [];
  }

  const lines = [
    `mode: ${dataStatus.accessMode}`,
    `complete: ${dataStatus.complete ? 'yes' : 'no'}`,
    `sources: ${dataStatus.sourceProviders.join(', ')}`,
  ];

  for (const warning of dataStatus.warnings ?? []) {
    lines.push(`warning: ${warning.code} - ${warning.message}`);
  }

  return lines;
}

function formatSchool(school: Pick<SchoolSearchResult, 'name' | 'region' | 'schoolType'>): string {
  const extras = [school.region, school.schoolType].filter(Boolean).join(', ');
  return extras ? `${school.name} (${extras})` : school.name;
}

function formatSchoolExtras(school: Pick<SchoolSearchResult, 'region' | 'schoolType'>): string {
  const extras = [school.region, school.schoolType].filter(Boolean).join(', ');
  return extras ? `(${extras})` : '';
}

function formatProviderRefs(school: Pick<SchoolSearchResult, 'providerRefs'>): string {
  const refs: string[] = [];
  if (school.providerRefs.comcigan) {
    refs.push(`comcigan:${school.providerRefs.comcigan.schoolCode}`);
  }
  if (school.providerRefs.neis) {
    refs.push(`neis:${school.providerRefs.neis.officeCode}/${school.providerRefs.neis.schoolCode}`);
  }
  return refs.join(', ') || '(unresolved)';
}

function parseProviderId(value: string): ProviderId {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'comcigan' || normalized === 'neis') {
    return normalized;
  }
  throw new InvalidInputError(`Unknown provider "${value}". Use "comcigan" or "neis".`);
}

function parseNeisDatasetName(value: string): NeisDatasetName {
  const match = NEIS_DATASETS.find((dataset) => dataset.toLowerCase() === value.trim().toLowerCase());
  if (!match) {
    throw new InvalidInputError(`Unknown NEIS dataset "${value}".`);
  }
  return match;
}

function parseJsonObject(value: string, _label: string): Record<string, string | number | undefined> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new InvalidInputError(
      `${_label} must be a valid JSON object: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidInputError(`${_label} must be a JSON object.`);
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, entryValue]) => {
      if (
        entryValue == null ||
        typeof entryValue === 'string' ||
        typeof entryValue === 'number'
      ) {
        return [key, entryValue as string | number | undefined];
      }

      return [key, JSON.stringify(entryValue)];
    }),
  );
}
