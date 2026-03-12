import chalk from 'chalk';

const LOGO_LINES = [
  ' _  __                              ',
  '| |/ /__ _ _ __ ___  _ __  _   _ ___',
  "| ' // _` | '_ ` _ \\| '_ \\| | | / __|",
  '| . \\ (_| | | | | | | |_) | |_| \\__ \\',
  '|_|\\_\\__,_|_| |_| |_| .__/ \\__,_|___/',
  '                    |_|              ',
];

const LINE_GRADIENTS: Array<[string, string]> = [
  ['#2563eb', '#0ea5e9'],
  ['#2563eb', '#06b6d4'],
  ['#0ea5e9', '#22c55e'],
  ['#06b6d4', '#eab308'],
  ['#22c55e', '#f97316'],
  ['#94a3b8', '#64748b'],
];

export function getGradientLogoLines(): string[] {
  return LOGO_LINES.map((line, index) => {
    const [startHex, endHex] = LINE_GRADIENTS[index] ?? ['#94a3b8', '#64748b'];
    return applyGradient(line, startHex, endHex);
  });
}

export function getCompactWordmarkLines(): string[] {
  return [
    applyGradient('KAMPUS // HUMAN OPS SHELL', '#38bdf8', '#22c55e'),
    chalk.hex('#94a3b8')('Korean school data, schedules, meals, and diagnostics'),
  ];
}

export const KAMPUS_TAGLINE = 'Human-first shell for Korean school data';

function applyGradient(line: string, startHex: string, endHex: string): string {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const visibleChars = [...line].filter((char) => char !== ' ').length || 1;
  let visibleIndex = 0;

  return [...line]
    .map((char) => {
      if (char === ' ') {
        return char;
      }

      const ratio = visibleChars === 1 ? 0 : visibleIndex / (visibleChars - 1);
      visibleIndex += 1;
      const red = Math.round(start.red + (end.red - start.red) * ratio);
      const green = Math.round(start.green + (end.green - start.green) * ratio);
      const blue = Math.round(start.blue + (end.blue - start.blue) * ratio);
      return chalk.rgb(red, green, blue)(char);
    })
    .join('');
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const normalized = hex.replace('#', '');
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}
