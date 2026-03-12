import { HUMAN_PAGES, type HumanPageId, type KeyLike } from './types.js';

export function resolvePageShortcut(input: string): HumanPageId | undefined {
  switch (input) {
    case 'h':
      return 'home';
    case 's':
      return 'schools';
    case 't':
      return 'timetable';
    case 'm':
      return 'meals';
    case 'y':
      return 'teacher';
    case 'g':
      return 'diagnostics';
    case 'p':
      return 'settings';
    case '?':
      return 'help';
    default:
      return undefined;
  }
}

export function pageIndexFor(page: HumanPageId): number {
  return HUMAN_PAGES.findIndex((entry) => entry.id === page);
}

export function isTypingInput(input: string, key: KeyLike): boolean {
  return Boolean(
    input &&
      !key.ctrl &&
      !key.meta &&
      !key.return &&
      !key.escape &&
      !key.backspace &&
      !key.delete &&
      !key.leftArrow &&
      !key.rightArrow &&
      !key.upArrow &&
      !key.downArrow &&
      !key.tab,
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveRecentSchoolShortcut(input: string): number | undefined {
  if (!/^[1-9]$/.test(input)) {
    return undefined;
  }
  return Number.parseInt(input, 10) - 1;
}
