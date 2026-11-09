import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import ts from 'typescript'

import { MessageMarkdownBlock } from '../src/conversation/blocks/MessageMarkdownBlocks'
import { ConversationLocalizationProvider } from '../src/conversation/i18n'
import {
  BasicConversationMarkdownProfile,
  ConversationMarkdownProfileProvider,
  useConversationMarkdownProfile,
} from '../src/conversation/markdown/conversationMarkdownProfile'
import { FullConversationMarkdownProvider } from '../src/conversation/markdown/fullConversationComponents'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = join(repository, 'src')
const publicExports = (JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8')) as {
  exports: Record<string, string | { import?: string }>
}).exports
const advancedPackages = ['@streamdown/code', '@streamdown/math', '@streamdown/mermaid']
const basicExcludedPackages = [...advancedPackages, 'shiki', 'mermaid', 'katex', 'cytoscape']

/** 只解析源文件语法，不创建 TypeScript Program；同时跟随静态与懒加载边，避免把延迟加载误当资源隔离。 */
function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const imports: string[] = []
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      const names = clause?.namedBindings
      const onlyTypes = clause?.isTypeOnly || (!clause?.name && names && ts.isNamedImports(names) &&
        names.elements.length > 0 && names.elements.every((item) => item.isTypeOnly))
      if (!onlyTypes && ts.isStringLiteralLike(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text)
      return
    }
    if (ts.isExportDeclaration(node)) {
      const names = node.exportClause
      const onlyTypes = node.isTypeOnly || (names && ts.isNamedExports(names) &&
        names.elements.length > 0 && names.elements.every((item) => item.isTypeOnly))
      if (!onlyTypes && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier))
        imports.push(node.moduleSpecifier.text)
      return
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]))
      imports.push(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return imports
}

function localSource(specifier: string, from: string): string | null {
  let target: string
  if (specifier.startsWith('.')) target = resolve(dirname(from), specifier)
  else if (specifier === '#contracts') target = join(sourceRoot, 'conversation/contracts/index')
  else if (specifier.startsWith('#internal/')) target = join(sourceRoot, 'conversation/internal', specifier.slice('#internal/'.length))
  else if (specifier === '@velaros-ai/ui' || specifier.startsWith('@velaros-ai/ui/')) {
    const entry = publicExports[specifier === '@velaros-ai/ui' ? '.' : `.${specifier.slice('@velaros-ai/ui'.length)}`]
    const published = typeof entry === 'string' ? entry : entry?.import
    assert(published, `Missing public entry ${specifier}`)
    target = resolve(sourceRoot, published.replace(/^\.\/dist\//u, ''))
  } else return null
  if (target.endsWith('.css')) return null
  const base = target.replace(/\.js$/u, '')
  const candidates = [
    ...(base.endsWith('.ts') || base.endsWith('.tsx') ? [base] : []),
    `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx'),
  ]
  const found = candidates.find((candidate) => existsSync(candidate))
  assert(found, `Unresolved runtime source ${specifier} from ${from}`)
  return found
}

function externalClosure(entry: string): Set<string> {
  const seen = new Set<string>()
  const external = new Set<string>()
  function walk(file: string): void {
    if (seen.has(file)) return
    seen.add(file)
    for (const specifier of runtimeImports(file)) {
      const source = localSource(specifier, file)
      if (source) walk(source)
      else external.add(specifier)
    }
  }
  walk(entry)
  return external
}

void test('basic public entry has no full renderer dependency even through lazy imports', () => {
  const basic = externalClosure(join(sourceRoot, 'conversation/basic.ts'))
  const full = externalClosure(join(sourceRoot, 'conversation/index.ts'))
  for (const dependency of basic)
    assert.equal(basicExcludedPackages.some((name) => dependency === name || dependency.startsWith(`${name}/`)),
      false, `Basic entry reaches ${dependency}`)
  for (const advanced of advancedPackages) {
    assert.equal(full.has(advanced), true, `Full entry lost ${advanced}`)
  }
})

function ProfileProbe(): ReactElement {
  const profile = useConversationMarkdownProfile()
  return <output data-profile={profile.kind}>{profile.kind}</output>
}

void test('profiles stay within their instance and basic uses the shared code and safe-link renderer', () => {
  const profiles = renderToStaticMarkup(
    <div>
      <FullConversationMarkdownProvider><ProfileProbe /></FullConversationMarkdownProvider>
      <ConversationMarkdownProfileProvider profile={BasicConversationMarkdownProfile}>
        <FullConversationMarkdownProvider><ProfileProbe /></FullConversationMarkdownProvider>
      </ConversationMarkdownProfileProvider>
    </div>
  )
  assert.match(profiles, /data-profile="full">full/u)
  assert.match(profiles, /data-profile="basic">basic/u)
  const markup = renderToStaticMarkup(
    <ConversationLocalizationProvider value={{ locale: 'zh-CN', setLocale: async () => {}, t: (key) => key }}>
      <ConversationMarkdownProfileProvider profile={BasicConversationMarkdownProfile}>
        <MessageMarkdownBlock block={{
          type: 'text',
          text: '**结果**\n\n```javascript\nconst answer = 42\n```\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n[安全链接](https://example.com) [无效链接](javascript:alert(1))',
        }} />
      </ConversationMarkdownProfileProvider>
    </ConversationLocalizationProvider>
  )
  assert.match(markup, /const answer = 42/u)
  assert.match(markup, /data-expandable-viewport="code"/u)
  assert.match(markup, /data-streamdown="code-block-copy-button"/u)
  assert.match(markup, /flowchart LR/u)
  assert.doesNotMatch(markup, /data-view="preview"/u)
  assert.match(markup, /href="https:\/\/example\.com/u)
  assert.doesNotMatch(markup, /href="javascript:/u)
})
