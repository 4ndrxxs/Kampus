import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuildBuild } from 'esbuild';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const artifactsDir = join(repoRoot, 'artifacts');
const stageDir = join(artifactsDir, 'stage', 'cli');
const cliDir = join(repoRoot, 'packages', 'cli');
const coreDir = join(repoRoot, 'packages', 'core');
const comciganDir = join(repoRoot, 'packages', 'providers', 'comcigan');
const neisDir = join(repoRoot, 'packages', 'providers', 'neis');
const cliPackage = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'));
const corePackage = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8'));
const comciganPackage = JSON.parse(readFileSync(join(comciganDir, 'package.json'), 'utf8'));
const neisPackage = JSON.parse(readFileSync(join(neisDir, 'package.json'), 'utf8'));
const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const publishDependencies = collectPublishDependencies(
  cliPackage,
  corePackage,
  comciganPackage,
  neisPackage,
);

run('pnpm', ['build'], repoRoot);

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(join(stageDir, 'dist'), { recursive: true });
mkdirSync(artifactsDir, { recursive: true });

for (const fileName of readdirSync(artifactsDir)) {
  if (fileName.startsWith('kampus-cli-') && fileName.endsWith('.tgz')) {
    rmSync(join(artifactsDir, fileName), { force: true });
  }
}

await esbuildBuild({
  entryPoints: [join(cliDir, 'dist', 'bin.js')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: join(stageDir, 'dist', 'bin.mjs'),
  sourcemap: true,
  packages: 'external',
  alias: {
    '@kampus/core': join(coreDir, 'dist', 'index.js'),
    '@kampus/provider-comcigan': join(comciganDir, 'dist', 'index.js'),
    '@kampus/provider-neis': join(neisDir, 'dist', 'index.js'),
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.DEV': '"false"',
  },
});

const binPath = join(stageDir, 'dist', 'bin.mjs');
const bundledBin = readFileSync(binPath, 'utf8');
if (!bundledBin.startsWith('#!/usr/bin/env node')) {
  writeFileSync(binPath, `#!/usr/bin/env node\n${bundledBin}`, 'utf8');
}
chmodSync(binPath, 0o755);

const publishManifest = {
  name: cliPackage.name,
  version: cliPackage.version,
  description: cliPackage.description,
  license: rootPackage.license,
  type: 'module',
  bin: {
    kps: 'dist/bin.mjs',
  },
  files: ['dist', 'README.md'],
  publishConfig: {
    access: 'public',
  },
  engines: rootPackage.engines,
  dependencies: publishDependencies,
};

writeFileSync(join(stageDir, 'package.json'), `${JSON.stringify(publishManifest, null, 2)}\n`, 'utf8');

const readmePath = join(repoRoot, 'README.md');
if (existsSync(readmePath)) {
  copyFileSync(readmePath, join(stageDir, 'README.md'));
}

run('npm', ['pack', '--pack-destination', artifactsDir], stageDir);

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

function collectPublishDependencies(...packages) {
  return Object.fromEntries(
    packages.flatMap((pkg) =>
      Object.entries(pkg.dependencies ?? {}).filter(([name]) => !name.startsWith('@kampus/')),
    ),
  );
}
