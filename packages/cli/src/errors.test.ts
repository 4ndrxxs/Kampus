import { describe, expect, it } from 'vitest';
import {
  AmbiguousSchoolError,
  InvalidInputError,
  ProviderUnavailableError,
  SchoolNotFoundError,
} from '@kampus/core';
import {
  detectCliErrorFormat,
  exitCodeForError,
  renderCliError,
  toCliErrorPayload,
} from './errors.js';

describe('CLI error helpers', () => {
  it('detects json and markdown formats from argv', () => {
    expect(detectCliErrorFormat(['node', 'kps', '--json'])).toBe('json');
    expect(detectCliErrorFormat(['node', 'kps', '--markdown'])).toBe('markdown');
    expect(detectCliErrorFormat(['node', 'kps'])).toBe('human');
  });

  it('serializes ambiguous school errors with matches', () => {
    const payload = toCliErrorPayload(
      new AmbiguousSchoolError('Sample High', [
        { name: 'Sample High School', region: 'Seoul', schoolType: 'High School' },
        { name: 'Sample High School', region: 'Busan', schoolType: 'High School' },
      ]),
    );

    expect(payload).toEqual({
      ok: false,
      error: {
        code: 'AMBIGUOUS_SCHOOL',
        message: expect.stringContaining('Multiple schools matched'),
        details: {
          keyword: 'Sample High',
          matches: [
            { name: 'Sample High School', region: 'Seoul', schoolType: 'High School' },
            { name: 'Sample High School', region: 'Busan', schoolType: 'High School' },
          ],
        },
      },
    });
  });

  it('maps known error classes to stable exit codes', () => {
    expect(exitCodeForError(new InvalidInputError('bad input'))).toBe(2);
    expect(exitCodeForError(new SchoolNotFoundError('missing'))).toBe(3);
    expect(exitCodeForError(new ProviderUnavailableError('neis'))).toBe(7);
    expect(exitCodeForError(new Error('boom'))).toBe(10);
  });

  it('renders json errors as structured payloads', () => {
    const rendered = renderCliError(new InvalidInputError('bad input'), 'json');
    expect(JSON.parse(rendered)).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'bad input',
      },
    });
  });

  it('renders human ambiguous errors with candidate lines', () => {
    const rendered = renderCliError(
      new AmbiguousSchoolError('Sample High', [
        { name: 'Sample High School', region: 'Seoul', schoolType: 'High School' },
      ]),
      'human',
    );

    expect(rendered).toContain('Error [AMBIGUOUS_SCHOOL]');
    expect(rendered).toContain('Sample High School (Seoul, High School)');
  });
});
