import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/artifacts/**',
      '**/node_modules/**',
      '**/.pnpm-store/**',
      '.codex-research/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['packages/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    languageOptions: {
      ...config.languageOptions,
      globals: {
        ...globals.node,
      },
    },
  })),
  {
    files: ['packages/**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
];
