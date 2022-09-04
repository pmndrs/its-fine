/// <reference types="vitest" />
import * as path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    dir: 'tests',
    setupFiles: 'tests/setupTests.ts',
  },
  build: {
    minify: false,
    sourcemap: true,
    target: 'es2018',
    lib: {
      formats: ['cjs', 'es'],
      entry: 'src/index.ts',
      fileName: '[name]',
    },
    rollupOptions: {
      external: (id: string) => !id.startsWith('.') && !path.isAbsolute(id),
      treeshake: false,
      output: {
        preserveModules: true,
        sourcemapExcludeSources: true,
      },
    },
  },
})
