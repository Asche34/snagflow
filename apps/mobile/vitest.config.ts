import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  esbuild: { tsconfigRaw: '{"compilerOptions":{}}' },
  test: { include: ['apps/mobile/tests/**/*.test.ts'], environment: 'node' },
});
