import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { 'cli/index': 'src/cli/index.ts' },
  format: 'esm',
  // fixedExtension: false → outputs .js (not .mjs) when package.json has "type": "module"
  fixedExtension: false,
  dts: true,
  clean: true,
  outDir: 'dist',
});
