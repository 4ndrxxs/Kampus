import { describe, expect, it } from 'vitest';
import { createProgram } from './program.js';

describe('createProgram', () => {
  it('registers doctor, debug, and interactive commands', () => {
    const program = createProgram();
    const topLevelNames = program.commands.map((command) => command.name());

    expect(topLevelNames).toEqual(
      expect.arrayContaining(['doctor', 'debug', 'human', 'easy', 'school', 'class', 'teacher', 'meals', 'neis']),
    );
  });

  it('registers auth and profile commands', () => {
    const program = createProgram();
    const topLevelNames = program.commands.map((command) => command.name());

    expect(topLevelNames).toEqual(expect.arrayContaining(['auth', 'profile']));
  });

  it('registers expected debug subcommands', () => {
    const program = createProgram();
    const debug = program.commands.find((command) => command.name() === 'debug');

    expect(debug?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['school', 'provider', 'neis-dataset']),
    );
  });

  it('keeps placeholder option labels in help output', () => {
    const program = createProgram();
    const teacher = program.commands.find((command) => command.name() === 'teacher');
    const teacherInfo = teacher?.commands.find((command) => command.name() === 'info');
    const help = teacherInfo?.helpInformation() ?? '';

    expect(help).toContain('--school <name>');
    expect(help).toContain('--region <name>');
    expect(help).toContain('--teacher <name>');
  });
});

