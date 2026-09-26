// ESLint configuration for HTML Artifacts. Source and build scripts use the shared
// Platform baseline; the unit's acceptance and tests are excluded (it lives in src/html-artifacts).
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDomainConfig } from './_shared.config.mjs'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default createDomainConfig({
  rootDir,
  ignores: [
    'src/html-artifacts/spec/**',
    'src/html-artifacts/test/**',
  ],
})
