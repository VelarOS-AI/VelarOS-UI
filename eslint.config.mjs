// VelarOS-UI 根 eslint 配置。
//
// 形态:不重写规则集。两套规则各住在 eslint/<域>.config.mjs:ui(React 组件、测试与组件图鉴)
// 与 html-artifacts(零依赖的浏览器库单元,不叠 React 那套)。本文件只做两件机械事:
//   ① 域作用域收敛——把每条 config entry 的 files 与该域的 glob 求交(flat config 的
//      `files: [[a, b]]` 语义是 AND),再挂上该域要让出去的目录,使两套规则各管各的文件;
//   ② 根锚定——parserOptions.tsconfigRootDir 从 eslint/ 目录改回仓根,project 指向根
//      tsconfig.eslint.json(全仓 program)。
// 纯全局 ignores 条目(只有 ignores 一个键)原样保留为全局。

import path from 'node:path'

import htmlArtifactsConfig from './eslint/html-artifacts.config.mjs'
import uiConfig from './eslint/ui.config.mjs'

const RepoRoot = import.meta.dirname

/** 各域的作用域 glob,以及让给别的域的目录。 */
const Domains = [
  {
    name: 'ui',
    config: uiConfig,
    globs: ['src/**', 'test/**', 'component-library/**'],
    // html-artifacts 单元用它自己那套规则（下一条），不叠 React 的这套
    excludes: ['src/html-artifacts/**'],
  },
  {
    name: 'html-artifacts',
    config: htmlArtifactsConfig,
    globs: ['src/html-artifacts/**'],
    excludes: [],
  },
]

const toArray = (value) => (Array.isArray(value) ? value : [value])

function isGlobalIgnores(entry) {
  const keys = Object.keys(entry)
  return keys.length === 1 && keys[0] === 'ignores'
}

function anchorLanguageOptions(languageOptions) {
  const parserOptions = languageOptions?.parserOptions
  if (!parserOptions?.tsconfigRootDir && !parserOptions?.project) return languageOptions
  return {
    ...languageOptions,
    parserOptions: {
      ...parserOptions,
      ...(parserOptions.project ? { project: './tsconfig.eslint.json' } : {}),
      ...(parserOptions.tsconfigRootDir ? { tsconfigRootDir: RepoRoot } : {}),
    },
  }
}

function scopeDomain({ config, globs, excludes }) {
  return config.map((entry) => {
    if (isGlobalIgnores(entry)) return entry
    const scoped = { ...entry }
    scoped.files = entry.files
      ? entry.files.flatMap((pattern) => globs.map((glob) => [...toArray(pattern), glob]))
      : globs
    const ignores = [...(entry.ignores ?? []), ...excludes]
    if (ignores.length > 0) scoped.ignores = ignores
    if (entry.languageOptions) {
      scoped.languageOptions = anchorLanguageOptions(entry.languageOptions)
    }
    return scoped
  })
}

export default [
  {
    ignores: [
      '**/.git/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/demo-dist/**',
      // 产品打包产物：已在 .gitignore 里，但 lint 此前照扫不误。里面躺着 pdf.js 的 worker，
      // 它自带引用第三方插件规则的 eslint 指令注释，于是本机只要构建过一次 document-renderer，
      // `bun run check` 就会以 73 条「规则未找到」失败——连带把发布也挡下。
      'dist-document-renderer/**',
      'scripts/**',
      'eslint/**',
      'docs/**',
      'baselines/**',
      // src 里的 .d.ts 是手写的环境声明（全局类型别名、CSS 模块、?raw 资源），不按源码规则查。
      'src/**/*.js',
      'src/**/*.d.ts',
      path.basename(import.meta.filename),
    ],
  },
  ...Domains.flatMap((domain) => scopeDomain(domain)),
]
