import { Command } from 'commander';
import { classCommands } from './commands/class.js';
import { authCommands } from './commands/auth.js';
import { configCommands } from './commands/config.js';
import { diagCommands } from './commands/diag.js';
import { mealsCommands } from './commands/meals.js';
import { neisCommands } from './commands/neis.js';
import { profileCommands } from './commands/profile.js';
import { schoolCommands } from './commands/school.js';
import { teacherCommands } from './commands/teacher.js';
import { interactiveCommands } from './commands/interactive.js';
import { utilCommands } from './commands/util.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('kps')
    .description('Kampus CLI for Korean school timetable and meal lookups')
    .version('0.1.0');

  interactiveCommands(program);
  authCommands(program);
  configCommands(program);
  profileCommands(program);
  schoolCommands(program);
  neisCommands(program);
  classCommands(program);
  teacherCommands(program);
  mealsCommands(program);
  utilCommands(program);
  diagCommands(program);

  return program;
}
