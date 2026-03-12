import type { HumanPageId } from './types.js';

export type AccentTone = 'cyan' | 'green' | 'yellow' | 'magenta' | 'blue' | 'red';

export const PAGE_SHORTCUTS: Record<HumanPageId, string> = {
  home: 'H',
  schools: 'S',
  timetable: 'T',
  meals: 'M',
  teacher: 'Y',
  diagnostics: 'G',
  settings: 'P',
  help: '?',
};

export function accentColor(accent: AccentTone): string {
  switch (accent) {
    case 'blue':
      return 'blue';
    case 'green':
      return 'green';
    case 'yellow':
      return 'yellow';
    case 'magenta':
      return 'magenta';
    case 'red':
      return 'red';
    default:
      return 'cyan';
  }
}

export function accentGlyph(accent: AccentTone): string {
  switch (accent) {
    case 'blue':
      return '::';
    case 'green':
      return '++';
    case 'yellow':
      return '!!';
    case 'magenta':
      return '##';
    case 'red':
      return 'xx';
    default:
      return '>>';
  }
}

export function pageTone(page: HumanPageId): AccentTone {
  switch (page) {
    case 'home':
      return 'blue';
    case 'schools':
      return 'magenta';
    case 'timetable':
      return 'cyan';
    case 'meals':
      return 'green';
    case 'teacher':
      return 'magenta';
    case 'diagnostics':
      return 'yellow';
    case 'settings':
      return 'blue';
    case 'help':
      return 'cyan';
  }
}

export function accessTone(accessMode: string): AccentTone {
  if (accessMode === 'official-full') {
    return 'green';
  }
  if (accessMode === 'official-limited') {
    return 'yellow';
  }
  return 'magenta';
}
