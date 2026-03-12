import { spawnSync } from 'node:child_process';

export type KampusSecretStorage = 'plain-text' | 'windows-dpapi';

export interface KampusProtectedSecret {
  storage: KampusSecretStorage;
  value: string;
  warning?: string;
}

export interface KampusResolvedSecret {
  storage: KampusSecretStorage;
  value?: string;
  readable: boolean;
  error?: string;
}

export function getPreferredSecretStorage(platform: NodeJS.Platform = process.platform): KampusSecretStorage {
  return platform === 'win32' ? 'windows-dpapi' : 'plain-text';
}

export function protectSecret(
  secret: string,
  options?: {
    storage?: KampusSecretStorage;
    platform?: NodeJS.Platform;
  },
): KampusProtectedSecret {
  const trimmed = secret.trim();
  const preferredStorage = options?.storage ?? getPreferredSecretStorage(options?.platform);
  if (!trimmed) {
    return {
      storage: preferredStorage,
      value: '',
    };
  }

  if (preferredStorage !== 'windows-dpapi') {
    return {
      storage: 'plain-text',
      value: trimmed,
    };
  }

  if ((options?.platform ?? process.platform) !== 'win32') {
    return {
      storage: 'plain-text',
      value: trimmed,
      warning: 'windows-dpapi storage is only available on Windows. Falling back to plain-text config storage.',
    };
  }

  const result = runPowerShell(
    `$secure = ConvertTo-SecureString -String ${quotePowerShellLiteral(trimmed)} -AsPlainText -Force; ConvertFrom-SecureString -SecureString $secure`,
  );
  if (!result.ok || !result.stdout) {
    return {
      storage: 'plain-text',
      value: trimmed,
      warning:
        result.error ??
        'Windows DPAPI protection failed. Falling back to plain-text config storage for this key.',
    };
  }

  return {
    storage: 'windows-dpapi',
    value: result.stdout,
  };
}

export function resolveSecret(
  value: string | undefined,
  storage: KampusSecretStorage | undefined,
  options?: {
    platform?: NodeJS.Platform;
  },
): KampusResolvedSecret {
  const normalizedStorage = storage ?? 'plain-text';
  const trimmed = value?.trim();
  if (!trimmed) {
    return {
      storage: normalizedStorage,
      readable: false,
    };
  }

  if (normalizedStorage !== 'windows-dpapi') {
    return {
      storage: 'plain-text',
      value: trimmed,
      readable: true,
    };
  }

  if ((options?.platform ?? process.platform) !== 'win32') {
    return {
      storage: 'windows-dpapi',
      readable: false,
      error:
        'This NEIS key is stored with Windows DPAPI and cannot be decrypted on the current platform. Re-enter the key in this environment or use an environment variable override.',
    };
  }

  const result = runPowerShell(
    `$secure = ConvertTo-SecureString ${quotePowerShellLiteral(trimmed)}; [System.Net.NetworkCredential]::new('', $secure).Password`,
  );
  if (!result.ok || !result.stdout) {
    return {
      storage: 'windows-dpapi',
      readable: false,
      error:
        result.error ??
        'Unable to decrypt the saved Windows DPAPI NEIS key. Re-enter the key with "kps auth login".',
    };
  }

  return {
    storage: 'windows-dpapi',
    value: result.stdout,
    readable: true,
  };
}

export function describeSecretStorage(storage: KampusSecretStorage | undefined, source: 'env' | 'config' | 'none') {
  if (source === 'env') {
    return 'env';
  }
  if (storage === 'windows-dpapi') {
    return 'windows-dpapi';
  }
  return 'local-config-plain-text';
}

function runPowerShell(script: string): { ok: boolean; stdout?: string; error?: string } {
  for (const command of ['powershell.exe', 'powershell', 'pwsh.exe', 'pwsh']) {
    const result = spawnSync(command, ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
    });

    if (result.error && isMissingCommandError(result.error)) {
      continue;
    }

    if (result.status !== 0) {
      return {
        ok: false,
        error: [result.stderr, result.stdout]
          .filter(Boolean)
          .map((value) => value.trim())
          .filter(Boolean)
          .join(' ')
          .trim(),
      };
    }

    return {
      ok: true,
      stdout: result.stdout.trim(),
    };
  }

  return {
    ok: false,
    error: 'PowerShell is not available in this environment.',
  };
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isMissingCommandError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === 'ENOENT';
}
