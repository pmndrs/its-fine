import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRsbuild } from '@rsbuild/core'

// Test the published ESM entry, including exports that consumers may guard at runtime.
const directory = await mkdtemp(join(tmpdir(), 'its-fine-bundle-'))
try {
  const entry = join(directory, 'entry.js')
  await writeFile(
    entry,
    `import * as fine from ${JSON.stringify(resolve('dist/index.js'))}; globalThis.itsFine = fine;`,
  )
  const rsbuild = await createRsbuild({
    rsbuildConfig: {
      source: { entry: { index: entry } },
      output: { distPath: { root: join(directory, 'dist') }, cleanDistPath: true },
      performance: { printFileSize: false },
      tools: { rspack: { module: { parser: { javascript: { exportsPresence: 'error' } } } } },
    },
  })
  await rsbuild.build()
} finally {
  await rm(directory, { recursive: true, force: true })
}
