import * as path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true,
    target: 'es2018',
    lib: {
      formats: ['cjs', 'es'],
      entry: 'src/index.tsx',
      fileName: '[name]',
    },
    rollupOptions: {
      external: (id: string) => !id.startsWith('.') && !path.isAbsolute(id),
    },
  },
})
