import { readdirSync, rmSync } from 'node:fs';

try {
  rmSync('dist', { recursive: true, force: true });
} catch {
  // Ignore missing dist directories.
}

for (const entry of readdirSync('.')) {
  if (entry.endsWith('.tsbuildinfo')) {
    rmSync(entry, { force: true });
  }
}
