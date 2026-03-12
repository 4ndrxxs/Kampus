import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const artifactsDir = join(repoRoot, 'artifacts');

run('node', [join(repoRoot, 'scripts', 'pack-cli.mjs')], repoRoot);

const cliTarball = resolveTarball();
const tempDir = mkdtempSync(join(tmpdir(), 'kampus-cli-pack-smoke-'));

try {
  writeFileSync(
    join(tempDir, 'package.json'),
    `${JSON.stringify({ name: 'kampus-cli-pack-smoke', private: true, version: '0.0.0' }, null, 2)}\n`,
    'utf8',
  );

  run('npm', ['install', '--ignore-scripts', '--no-package-lock', '--no-save', cliTarball], tempDir);

  const installedPackageJson = JSON.parse(
    readFileSync(join(tempDir, 'node_modules', '@kampus', 'cli', 'package.json'), 'utf8'),
  );

  const invalidInternalDependencies = Object.keys(installedPackageJson.dependencies ?? {}).filter((dependency) =>
    dependency.startsWith('@kampus/'),
  );
  if (invalidInternalDependencies.length > 0) {
    throw new Error(
      `Packed CLI still declares internal workspace dependencies: ${invalidInternalDependencies.join(', ')}`,
    );
  }

  const binRelativePath =
    typeof installedPackageJson.bin === 'string' ? installedPackageJson.bin : installedPackageJson.bin?.kps;

  if (!binRelativePath) {
    throw new Error('Packed CLI does not declare a kps bin entry.');
  }

  const binPath = join(tempDir, 'node_modules', '@kampus', 'cli', binRelativePath);
  run('node', [binPath, '--version'], tempDir);
  run('node', [binPath, 'doctor', '--json'], tempDir);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function resolveTarball() {
  const tarballPath = readdirSync(artifactsDir)
    .filter((fileName) => fileName.startsWith('kampus-cli-') && fileName.endsWith('.tgz'))
    .map((fileName) => ({
      filePath: join(artifactsDir, fileName),
      mtimeMs: statSync(join(artifactsDir, fileName)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.filePath;

  if (!tarballPath) {
    throw new Error('CLI tarball was not generated.');
  }

  return tarballPath;
}

function run(command, args, cwd) {
  try {
    if (process.platform === 'win32' && (command === 'npm' || command === 'pnpm')) {
      const result = spawnSync(resolveCmdExecutable(), ['/d', '/s', '/c', buildCmdInvocation(command, args)], {
        cwd,
        stdio: 'inherit',
      });
      if (result.status !== 0) {
        const failure = new Error(`${command} ${args.join(' ')} failed.`);
        Object.assign(failure, { status: result.status ?? 1 });
        throw failure;
      }
      return;
    }

    const executable = resolveExecutable(command);

    execFileSync(executable, args, {
      cwd,
      stdio: 'inherit',
    });
  } catch (error) {
    if (error instanceof Error && error.message) {
      process.stderr.write(`${error.message}\n`);
    }
    if (typeof error === 'object' && error && 'status' in error && typeof error.status === 'number') {
      process.exit(error.status);
    }
    process.exit(1);
  }
}

function resolveExecutable(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (command === 'node') {
    return process.execPath;
  }

  if (command === 'npm' || command === 'pnpm') {
    return `${command}.cmd`;
  }

  return command;
}

function resolveCmdExecutable() {
  return process.env.ComSpec || 'cmd.exe';
}

function buildCmdInvocation(command, args) {
  return [command, ...args].map(quoteCmdArg).join(' ');
}

function quoteCmdArg(value) {
  if (!value || /[\s"]/u.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}
