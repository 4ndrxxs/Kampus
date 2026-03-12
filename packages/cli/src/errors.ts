import chalk from 'chalk';
import {
  AmbiguousSchoolError,
  InvalidInputError,
  KampusError,
  MealsUnavailableError,
  NetworkError,
  ProviderUnavailableError,
  SchoolNotFoundError,
  TeacherNotFoundError,
  TimetableUnavailableError,
  UpstreamChangedError,
} from '@kampus/core';

export type CliErrorFormat = 'human' | 'json' | 'markdown';

export interface CliErrorPayload {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface CommanderLikeError {
  code?: unknown;
  message?: unknown;
}

export function detectCliErrorFormat(argv: string[] = process.argv): CliErrorFormat {
  if (argv.includes('--json')) {
    return 'json';
  }
  if (argv.includes('--markdown')) {
    return 'markdown';
  }
  return 'human';
}

export function exitCodeForError(error: unknown): number {
  if (error instanceof InvalidInputError || isCommanderError(error)) {
    return 2;
  }
  if (error instanceof SchoolNotFoundError) {
    return 3;
  }
  if (error instanceof AmbiguousSchoolError) {
    return 4;
  }
  if (error instanceof TeacherNotFoundError) {
    return 5;
  }
  if (error instanceof MealsUnavailableError || error instanceof TimetableUnavailableError) {
    return 6;
  }
  if (error instanceof ProviderUnavailableError) {
    return 7;
  }
  if (error instanceof NetworkError) {
    return 8;
  }
  if (error instanceof UpstreamChangedError) {
    return 9;
  }
  return 10;
}

export function toCliErrorPayload(error: unknown): CliErrorPayload {
  if (error instanceof AmbiguousSchoolError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: {
          keyword: error.keyword,
          matches: error.matches,
        },
      },
    };
  }

  if (error instanceof KampusError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (isCommanderError(error)) {
    return {
      ok: false,
      error: {
        code: 'CLI_PARSE_ERROR',
        message: typeof error.message === 'string' ? error.message : 'Invalid CLI input.',
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

export function renderCliError(error: unknown, format: CliErrorFormat): string {
  const payload = toCliErrorPayload(error);

  if (format === 'json') {
    return JSON.stringify(payload, null, 2);
  }

  if (format === 'markdown') {
    const lines = [
      '# Error',
      '',
      `- code: ${payload.error.code}`,
      `- message: ${payload.error.message}`,
    ];

    const matches = extractMatches(payload);
    if (matches.length) {
      lines.push('- matches:');
      for (const match of matches) {
        lines.push(`  - ${match}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }

  const lines = [`Error [${payload.error.code}] ${payload.error.message}`];
  const matches = extractMatches(payload);
  for (const match of matches) {
    lines.push(`- ${match}`);
  }
  return `${lines.join('\n')}\n`;
}

export function printCliError(error: unknown, format: CliErrorFormat): void {
  const rendered = renderCliError(error, format);
  if (format === 'json') {
    console.log(rendered);
    return;
  }

  if (format === 'human') {
    const payload = toCliErrorPayload(error);
    const lines = [
      `  ${chalk.red('✖')} ${chalk.red.bold(`Error [${payload.error.code}]`)} ${payload.error.message}`,
    ];
    const matches = extractMatches(payload);
    for (const match of matches) {
      lines.push(`    ${chalk.dim('▸')} ${match}`);
    }
    console.error(lines.join('\n'));
    return;
  }

  console.error(rendered.trimEnd());
}

function extractMatches(payload: CliErrorPayload): string[] {
  const rawMatches = payload.error.details?.matches;
  if (!Array.isArray(rawMatches)) {
    return [];
  }

  return rawMatches
    .filter((match): match is { name?: unknown; region?: unknown; schoolType?: unknown } => {
      return !!match && typeof match === 'object';
    })
    .map((match) => {
      const name = typeof match.name === 'string' ? match.name : 'Unknown school';
      const extras = [match.region, match.schoolType]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(', ');
      return extras ? `${name} (${extras})` : name;
    });
}

function isCommanderError(error: unknown): error is CommanderLikeError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as CommanderLikeError;
  return typeof candidate.code === 'string' && candidate.code.startsWith('commander.');
}
