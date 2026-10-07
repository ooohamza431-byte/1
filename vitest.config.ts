import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Unit test configuration.
 *
 * The environment is `node` by default (most of what is worth testing is server
 * logic: the parser, the classifier, crypto, RBAC and the router). Tests that
 * need a DOM opt in with a `@vitest-environment jsdom` docblock.
 *
 * `next/*` is aliased to the tiny stubs in `tests/stubs/` so importing a module
 * in the auth or route-helper chain does not drag the whole framework runtime
 * (or `node:crypto`-adjacent Edge code) into a pure-logic unit test.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    reporters: ['default'],
    // Inline the auth stack so the aliases below also apply to *its* imports.
    // Otherwise Node resolves `next/server` from inside next-auth (which pnpm
    // does not hoist there) and the suite dies before a single assertion runs.
    server: {
      deps: {
        inline: [/next-auth/, /@auth\/core/, /better-auth/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/db/schema.ts', 'lib/db/migrations/**'],
    },
  },
  resolve: {
    alias: {
      '@/': `${path.resolve(__dirname, './')}/`,
      'next/server': path.resolve(__dirname, './tests/stubs/next-server.ts'),
      'next/headers': path.resolve(__dirname, './tests/stubs/next-headers.ts'),
    },
  },
});
