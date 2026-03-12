import { describe, expect, it } from 'vitest';
import { shouldLaunchInteractiveCli } from './runtime.js';

describe('shouldLaunchInteractiveCli', () => {
  it('launches human shell for no-arg tty sessions', () => {
    expect(
      shouldLaunchInteractiveCli([], {
        stdinIsTty: true,
        stdoutIsTty: true,
      }),
    ).toBe(true);
  });

  it('keeps raw mode when arguments exist', () => {
    expect(
      shouldLaunchInteractiveCli(['school', 'search'], {
        stdinIsTty: true,
        stdoutIsTty: true,
      }),
    ).toBe(false);
  });

  it('keeps raw mode when stdout is not interactive', () => {
    expect(
      shouldLaunchInteractiveCli([], {
        stdinIsTty: true,
        stdoutIsTty: false,
      }),
    ).toBe(false);
  });
});
