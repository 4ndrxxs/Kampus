import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI_BIN = resolve('packages/cli/dist/bin.js');
const KNOWN_SCHOOL = {
  name: '\uACBD\uAE30\uBD81\uACFC\uD559\uACE0',
  region: '\uACBD\uAE30',
};

if (!existsSync(CLI_BIN)) {
  fail('Built CLI binary not found. Run "pnpm build" before "pnpm smoke:keyed".');
}

const authStatus = runCliJson(['auth', 'status', '--json']);
if (!authStatus?.configured || !authStatus?.readable) {
  fail('A readable NEIS API key is required for keyed smoke tests. Use NEIS_API_KEY or "kps auth login".');
}

const checks = [
  {
    name: 'provider-live',
    args: ['debug', 'provider', 'neis', '--live', '--json'],
    validate(payload) {
      assert(payload?.ok === true, 'provider debug did not return ok=true');
      assert(payload?.report?.configured === true, 'NEIS provider is not configured');
      assert(payload?.report?.live?.ok === true, 'NEIS live check failed');
      assert(
        payload?.report?.live?.dataStatus?.accessMode === 'official-full',
        'NEIS live check did not run in official-full mode',
      );
      return `mode=${payload.report.live.dataStatus.accessMode}`;
    },
  },
  {
    name: 'school-info',
    args: ['school', 'info', '--school', KNOWN_SCHOOL.name, '--region', KNOWN_SCHOOL.region, '--json'],
    validate(payload) {
      assert(payload?.providerRefs?.neis?.schoolCode, 'school info is missing NEIS school ref');
      assert(payload?.dataStatus?.accessMode === 'official-full', 'school info did not use official-full mode');
      return `${payload.name} (${payload.providerRefs.neis.officeCode}/${payload.providerRefs.neis.schoolCode})`;
    },
  },
  {
    name: 'meals-month',
    args: ['meals', 'month', '--school', KNOWN_SCHOOL.name, '--region', KNOWN_SCHOOL.region, '--month', '2026-03', '--json'],
    validate(payload) {
      assert(payload?.dataStatus?.accessMode === 'official-full', 'meals month did not use official-full mode');
      assert(Array.isArray(payload?.days) && payload.days.length > 0, 'meals month returned no meal days');
      return `days=${payload.days.length}`;
    },
  },
  {
    name: 'schedule',
    args: [
      'neis',
      'schedule',
      '--school',
      KNOWN_SCHOOL.name,
      '--region',
      KNOWN_SCHOOL.region,
      '--from',
      '2026-03-01',
      '--to',
      '2026-03-31',
      '--json',
    ],
    validate(payload) {
      assert(payload?.dataStatus?.accessMode === 'official-full', 'schedule did not use official-full mode');
      assert(Array.isArray(payload?.rows) && payload.rows.length > 0, 'schedule returned no rows');
      return `rows=${payload.rows.length}`;
    },
  },
  {
    name: 'classes',
    args: [
      'neis',
      'classes',
      '--school',
      KNOWN_SCHOOL.name,
      '--region',
      KNOWN_SCHOOL.region,
      '--year',
      '2026',
      '--grade',
      '3',
      '--json',
    ],
    validate(payload) {
      assert(payload?.dataStatus?.accessMode === 'official-full', 'classes did not use official-full mode');
      assert(Array.isArray(payload?.rows) && payload.rows.length > 0, 'classes returned no rows');
      return `rows=${payload.rows.length}`;
    },
  },
  {
    name: 'classrooms',
    args: [
      'neis',
      'classrooms',
      '--school',
      KNOWN_SCHOOL.name,
      '--region',
      KNOWN_SCHOOL.region,
      '--year',
      '2025',
      '--grade',
      '1',
      '--semester',
      '1',
      '--school-course',
      '\uACE0\uB4F1\uD559\uAD50',
      '--day-night',
      '\uC8FC\uAC04',
      '--track',
      '\uACFC\uD559\uACC4',
      '--department',
      '\uACFC\uD559\uACFC',
      '--json',
    ],
    validate(payload) {
      assert(payload?.dataStatus?.accessMode === 'official-full', 'classrooms did not use official-full mode');
      assert(Array.isArray(payload?.rows) && payload.rows.length > 0, 'classrooms returned no rows');
      return `rows=${payload.rows.length}`;
    },
  },
];

for (const check of checks) {
  process.stdout.write(`[run] ${check.name}\n`);
  const payload = runCliJson(check.args);
  const summary = check.validate(payload);
  process.stdout.write(`[ok] ${check.name}: ${summary}\n`);
}

process.stdout.write(`[done] keyed smoke passed (${checks.length} checks)\n`);

function runCliJson(args) {
  const result = spawnSync(process.execPath, [CLI_BIN, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    fail(`CLI command failed: ${args.join(' ')}\n${output}`);
  }

  const stdout = result.stdout.trim();
  try {
    return JSON.parse(stdout);
  } catch (error) {
    fail(`CLI command did not return valid JSON: ${args.join(' ')}\n${stdout}\n${String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
