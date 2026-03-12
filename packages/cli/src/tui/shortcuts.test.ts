import { describe, expect, it } from 'vitest';
import { clamp, isTypingInput, pageIndexFor, resolvePageShortcut, resolveRecentSchoolShortcut } from './shortcuts.js';

describe('tui shortcuts', () => {
  it('maps quick shortcuts to pages', () => {
    expect(resolvePageShortcut('h')).toBe('home');
    expect(resolvePageShortcut('s')).toBe('schools');
    expect(resolvePageShortcut('t')).toBe('timetable');
    expect(resolvePageShortcut('m')).toBe('meals');
    expect(resolvePageShortcut('y')).toBe('teacher');
    expect(resolvePageShortcut('g')).toBe('diagnostics');
    expect(resolvePageShortcut('p')).toBe('settings');
    expect(resolvePageShortcut('?')).toBe('help');
    expect(resolvePageShortcut('x')).toBeUndefined();
  });

  it('returns stable indexes for known pages', () => {
    expect(pageIndexFor('home')).toBe(0);
    expect(pageIndexFor('schools')).toBe(1);
    expect(pageIndexFor('help')).toBeGreaterThanOrEqual(0);
  });

  it('detects normal typing and clamps ranges', () => {
    expect(isTypingInput('a', {})).toBe(true);
    expect(isTypingInput('', {})).toBe(false);
    expect(isTypingInput('r', { ctrl: true })).toBe(false);
    expect(isTypingInput('x', { leftArrow: true })).toBe(false);
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-1, 1, 3)).toBe(1);
    expect(clamp(2, 1, 3)).toBe(2);
  });

  it('maps numeric shortcuts for recent schools', () => {
    expect(resolveRecentSchoolShortcut('1')).toBe(0);
    expect(resolveRecentSchoolShortcut('5')).toBe(4);
    expect(resolveRecentSchoolShortcut('0')).toBeUndefined();
    expect(resolveRecentSchoolShortcut('x')).toBeUndefined();
  });
});
