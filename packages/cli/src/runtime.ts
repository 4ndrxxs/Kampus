import { createProgram } from './program.js';
import { detectCliErrorFormat, exitCodeForError, printCliError } from './errors.js';
import { canRunInteractiveCli, runInteractiveCli } from './tui/index.js';

export interface CliIoState {
  stdinIsTty: boolean;
  stdoutIsTty: boolean;
}

export function shouldLaunchInteractiveCli(
  args: string[],
  io: CliIoState = {
    stdinIsTty: Boolean(process.stdin.isTTY),
    stdoutIsTty: Boolean(process.stdout.isTTY),
  },
): boolean {
  return args.length === 0 && canRunInteractiveCli(io.stdinIsTty, io.stdoutIsTty);
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const args = argv.slice(2);
  if (shouldLaunchInteractiveCli(args)) {
    await runInteractiveCli({ mode: 'human' });
    return;
  }

  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    printCliError(error, detectCliErrorFormat(argv));
    process.exit(exitCodeForError(error));
  }
}
