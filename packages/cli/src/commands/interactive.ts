import type { Command } from 'commander';
import { runInteractiveCli } from '../tui/index.js';

export function interactiveCommands(program: Command): void {
  program
    .command('human')
    .description('Launch the interactive human shell')
    .option('--no-splash', 'Skip the splash/logo animation')
    .action(async (opts) => {
      await runInteractiveCli({
        mode: 'human',
        splash: opts.splash,
      });
    });

  program
    .command('easy')
    .description('Launch the guided easy mode')
    .option('--no-splash', 'Skip the splash/logo animation')
    .action(async (opts) => {
      await runInteractiveCli({
        mode: 'easy',
        splash: opts.splash,
      });
    });
}
