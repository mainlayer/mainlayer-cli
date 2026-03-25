import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  outDir: 'dist',
});
