#!/usr/bin/env node

import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { runGuardedCommand, safePackPackage } from './safe-package-pack.mjs'

// 仓根就是 @velaros-ai/ui 包：临时打一个 tarball，核对包清单与 README 在里面。
const packageDirectory = path.resolve(import.meta.dirname, '../..')

if (process.argv.length !== 2) {
  throw new Error('Usage: bun run check:package-pack')
}

const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'))
const destination = await mkdtemp(path.join(tmpdir(), 'velaros-package-pack-check-'))

try {
  await safePackPackage({ destination, packageDirectory })
  const tarballs = (await readdir(destination)).filter((file) => file.endsWith('.tgz'))
  if (tarballs.length !== 1) {
    throw new Error(`${manifest.name} produced ${tarballs.length} tarballs`)
  }
  const tarballPath = path.join(destination, tarballs[0])
  const { stdout } = await runGuardedCommand({
    args: ['-tzf', tarballPath],
    command: 'tar',
    cwd: packageDirectory,
    operation: `List ${manifest.name} package tarball`,
  })
  const entries = new Set(stdout.split('\n').filter(Boolean))
  for (const requiredFile of ['package/package.json', 'package/README.md']) {
    if (!entries.has(requiredFile)) {
      throw new Error(`${manifest.name} tarball is missing ${requiredFile}`)
    }
  }

  const archive = await stat(tarballPath)
  console.info(`✓ ${manifest.name}@${manifest.version} packed safely (${archive.size} bytes)`)
} finally {
  await rm(destination, { force: true, recursive: true })
}
