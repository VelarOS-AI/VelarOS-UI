/**
 * 执行步骤卡里代码与返回值的语法着色：与聊天正文的代码块共用同一个 Shiki 高亮器（`@streamdown/code`）
 * 和主题。高亮器第一次用到某种语言要异步加载语法，加载好之前返回 null，调用方先按纯文本显示。
 */
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { code as codeHighlighter, type HighlightResult } from '@streamdown/code'

/** 执行步骤卡用到的语言：脚本源码是 TypeScript，调用的返回值是 JSON。 */
export type ExecutionStepCodeLanguage = 'typescript' | 'json'

/** 一段代码的分词结果。 */
export type HighlightedCode = HighlightResult

type HighlightedToken = HighlightResult['tokens'][number][number]

function highlight(
  text: string,
  language: ExecutionStepCodeLanguage,
  callback?: (result: HighlightedCode) => void
): Nullable<HighlightedCode> {
  return codeHighlighter.highlight(
    { code: text, language, themes: codeHighlighter.getThemes() },
    callback
  )
}

/**
 * 要一段文字的着色结果：高亮器已经算好的当场交给 onReady，还没算好的等它算好再交；交回取消函数，取消之后不再交。
 * 高亮器命中缓存时直接返回结果、不登记回调，只靠回调就会把这种情况漏掉——高亮器热起来以后，
 * 渲染时发起的那次计算在副作用登记回调之前就算完了，卡片会一直停在纯文本。
 */
export function requestHighlight(
  text: string,
  language: ExecutionStepCodeLanguage,
  onReady: (code: HighlightedCode) => void
): () => void {
  let live = true
  const cached = highlight(text, language, (code) => {
    if (live) onReady(code)
  })
  if (cached) onReady(cached)
  return () => {
    live = false
  }
}

/** 这段文字按语言着色后的分词；不给语言、或高亮器还在加载这种语言时返回 null。 */
export function useHighlightedCode(
  text: string,
  language: LooseOptional<ExecutionStepCodeLanguage>
): Nullable<HighlightedCode> {
  const ready = useMemo(() => (language ? highlight(text, language) : null), [text, language])
  const [loaded, setLoaded] = useState<
    Nullable<{ text: string; language: ExecutionStepCodeLanguage; code: HighlightedCode }>
  >(null)

  useEffect(() => {
    if (ready || !language) return
    return requestHighlight(text, language, (code) => setLoaded({ text, language, code }))
  }, [ready, text, language])

  if (ready) return ready
  return loaded && loaded.text === text && loaded.language === language ? loaded.code : null
}

/** 一个分词的内联样式：浅色主题的颜色放进 `--sdm-c`，暗色主题的 `--shiki-dark` 原样带上，底色不要。 */
export function highlightedTokenStyle(token: HighlightedToken): CSSProperties {
  const style: Record<string, string> = {}
  if (token.color) style['--sdm-c'] = token.color
  for (const [key, value] of Object.entries(token.htmlStyle ?? {})) {
    if (key === 'color') style['--sdm-c'] = value
    else if (!key.includes('background')) style[key] = value
  }
  return style as CSSProperties
}
