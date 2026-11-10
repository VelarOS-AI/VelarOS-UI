// 从已构建的发布文件建立临时包，只在发布清单中移除开发配置，不改写源码清单。
import { cp, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { safePackPackage } from './safe-package-pack.mjs'

export async function packReleasePackage({ packageDirectory, ...options }) {
  const sourceRoot = await realpath(packageDirectory)
  const sourceManifest = JSON.parse(await readFile(path.join(sourceRoot, 'package.json'), 'utf8'))
  if (!Array.isArray(sourceManifest.files) || sourceManifest.files.length === 0) {
    throw new Error('Release packages must explicitly list their published files')
  }
  const outputDirectory = await realpath(options.destination ?? path.dirname(options.filename))
  for (const [parent, candidate] of [[sourceRoot, outputDirectory], [outputDirectory, sourceRoot]]) {
    const relative = path.relative(parent, candidate)
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error('Release output must not overlap the source package')
    }
  }

  const temporaryRoot = await realpath(tmpdir())
  const stagingRoot = await mkdtemp(path.join(temporaryRoot, 'velaros-release-package-'))
  try {
    for (const entry of new Set([...sourceManifest.files, 'LICENSE'])) {
      const source = path.resolve(sourceRoot, entry)
      const relative = path.relative(sourceRoot, source)
      if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`Published file must stay inside the source package: ${entry}`)
      }
      await cp(source, path.join(stagingRoot, relative), { recursive: true })
    }
    const manifest = { ...sourceManifest }
    for (const field of ['overrides', 'resolutions', 'devDependencies', 'scripts', 'packageManager']) {
      delete manifest[field]
    }
    await writeFile(path.join(stagingRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    return await safePackPackage({ ...options, packageDirectory: stagingRoot })
  } finally {
    const resolvedStaging = await realpath(stagingRoot)
    if (path.dirname(resolvedStaging) !== temporaryRoot) {
      throw new Error('Release staging cleanup must stay inside the dedicated temporary root')
    }
    await rm(resolvedStaging, { recursive: true, force: true })
  }
}
