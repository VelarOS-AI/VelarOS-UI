import { highlightTree, tagHighlighter, tags } from '@lezer/highlight'
import { parser as javascriptParser } from '@lezer/javascript'
import { parser as jsonParser } from '@lezer/json'

import type { ExecutionStepCodeLanguage, HighlightedCode } from './executionStepHighlight'

const typescriptParser = javascriptParser.configure({ dialect: 'ts' })
const syntaxHighlighter = tagHighlighter([
  { tag: tags.keyword, class: 'keyword' },
  { tag: [tags.string, tags.regexp], class: 'string' },
  { tag: [tags.number, tags.bool, tags.null], class: 'literal' },
  { tag: tags.comment, class: 'comment' },
  { tag: tags.function(tags.variableName), class: 'function' },
  { tag: [tags.typeName, tags.className], class: 'type' },
])

/** 执行卡只需 TypeScript/JSON；使用编辑器同源 Lezer，避免冷 TextMate 正则编译阻塞点击。 */
export function tokenizeExecutionStep(text: string, language: ExecutionStepCodeLanguage): HighlightedCode {
  const tokens: HighlightedCode['tokens'] = [[]]
  let position = 0
  const append = (from: number, to: number, style?: string): void => {
    const color = `var(--syntax-execution-${style || 'foreground'})`
    let offset = from
    const lines = text.slice(from, to).split('\n')
    for (const [index, content] of lines.entries()) {
      if (index > 0) { tokens.push([]); offset += 1 }
      if (content) {
        tokens.at(-1)!.push({
          content, offset,
          color,
          htmlStyle: { '--shiki-dark': color },
        })
      }
      offset += content.length
    }
  }
  const tree = (language === 'json' ? jsonParser : typescriptParser).parse(text)
  highlightTree(tree, syntaxHighlighter, (from, to, style) => {
    append(position, from)
    append(from, to, style)
    position = to
  })
  append(position, text.length)
  return { tokens }
}
