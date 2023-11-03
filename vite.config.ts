/// <reference types="vitest" />
import * as path from 'path'
import * as vite from 'vite'

export default vite.defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    target: 'es2018',
    lib: {
      formats: ['cjs', 'es'],
      entry: 'src/index.tsx',
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
  plugins: [
    {
      name: 'vite-tsc',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'index.d.ts', source: `export * from '../src'` })
      },
    },
    {
      name: 'vite-minify',
      transform(code, url) {
        if (!url.includes('node_modules')) {
          return vite.transformWithEsbuild(code, url, { target: 'es2018' })
        }
      },
      renderChunk: {
        order: 'post',
        handler(code, { fileName }) {
          return vite.transformWithEsbuild(code, fileName, { minify: true, target: 'es2018' })
        },
      },
    },
  ],
})
