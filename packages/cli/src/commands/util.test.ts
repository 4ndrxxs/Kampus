import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { parseWeekSnapshotFile } from './util.js';

describe('parseWeekSnapshotFile', () => {
  it('accepts UTF-8 BOM-prefixed JSON snapshots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kampus-util-test-'));
    const file = join(dir, 'week.json');
    const snapshot = {
      school: {
        name: '테스트학교',
        providerRefs: {},
      },
      grade: 3,
      classNo: 5,
      weekStart: '2026-03-09',
      days: [],
    };

    writeFileSync(file, `\uFEFF${JSON.stringify(snapshot)}`, 'utf8');

    expect(parseWeekSnapshotFile(file)).toMatchObject({
      school: { name: '테스트학교' },
      grade: 3,
      classNo: 5,
      weekStart: '2026-03-09',
    });
  });
});
