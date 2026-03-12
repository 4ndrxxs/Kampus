import { format } from 'node:util';
import { createProgram } from './program.js';

export interface InProcessCliResult {
  status: number;
  stdout: string;
  stderr: string;
}

export async function runCliInProcess(
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<InProcessCliResult> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalEnvValues = new Map<string, string | undefined>();
  const envEntries = Object.entries(env ?? {});

  let stdout = '';
  let stderr = '';
  let status = 0;

  for (const [key, value] of envEntries) {
    originalEnvValues.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  console.log = (...values: unknown[]) => {
    stdout += `${format(...values)}\n`;
  };
  console.error = (...values: unknown[]) => {
    stderr += `${format(...values)}\n`;
  };
  console.warn = (...values: unknown[]) => {
    stderr += `${format(...values)}\n`;
  };

  try {
    const program = createProgram();
    program.exitOverride();
    program.configureOutput({
      writeOut: (value) => {
        stdout += value;
      },
      writeErr: (value) => {
        stderr += value;
      },
      outputError: (value, write) => {
        write(value);
      },
    });

    try {
      await program.parseAsync(args, { from: 'user' });
    } catch (error) {
      const commanderError = error as { code?: string; exitCode?: number };
      if (commanderError.code === 'commander.helpDisplayed' || commanderError.code === 'commander.version') {
        status = 0;
      } else if (typeof commanderError.exitCode === 'number') {
        status = commanderError.exitCode;
      } else {
        throw error;
      }
    }
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    for (const [key, value] of originalEnvValues.entries()) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  return {
    status,
    stdout,
    stderr,
  };
}

