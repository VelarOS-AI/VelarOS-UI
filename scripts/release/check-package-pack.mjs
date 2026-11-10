#!/usr/bin/env node

import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { packReleasePackage } from './pack-release-package.mjs'
import { runGuardedCommand } from './safe-package-pack.mjs'

// 仓根就是 @velaros-ai/ui 包：临时打一个 tarball，核对包清单与 README 在里面。
const packageDirectory = path.resolve(import.meta.dirname, '../..')

if (process.argv.length !== 2) {
  throw new Error('Usage: bun run check:package-pack')
}

const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'))
const destination = await mkdtemp(path.join(tmpdir(), 'velaros-package-pack-check-'))

try {
  await packReleasePackage({ destination, packageDirectory })
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
  const entries = new Set(stdout.split(/\r?\n/u).map((entry) => entry.replaceAll('\\', '/')).filter(Boolean))
  for (const requiredFile of ['package/package.json', 'package/README.md']) {
    if (!entries.has(requiredFile)) {
      throw new Error(`${manifest.name} tarball is missing ${requiredFile}`)
    }
  }

  const packedManifestResult = await runGuardedCommand({
    args: ['-xOf', tarballPath, 'package/package.json'],
    command: 'tar',
    cwd: packageDirectory,
    operation: 'Read the production package manifest',
  })
  const packedManifest = JSON.parse(packedManifestResult.stdout)
  for (const field of ['overrides', 'resolutions', 'devDependencies', 'scripts', 'packageManager']) {
    if (Object.hasOwn(packedManifest, field)) throw new Error(`Production package contains ${field}`)
  }
  for (const field of ['name', 'version', 'dependencies', 'peerDependencies', 'exports', 'imports']) {
    if (JSON.stringify(packedManifest[field]) !== JSON.stringify(manifest[field])) {
      throw new Error(`Production package changed ${field}`)
    }
  }
  const sourceAfterPack = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'))
  if (JSON.stringify(sourceAfterPack) !== JSON.stringify(manifest)) {
    throw new Error('Packing changed the development manifest')
  }

  const archive = await stat(tarballPath)
  console.info(`✓ ${manifest.name}@${manifest.version} packed safely (${archive.size} bytes)`)
} finally {
  await rm(destination, { force: true, recursive: true })
}
