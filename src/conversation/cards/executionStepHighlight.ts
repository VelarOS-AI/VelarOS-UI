/**
 * 执行步骤卡里代码与返回值的语法着色：按需加载编辑器同源 Lezer，保留 GitHub 明暗主题色。
 * 先展示纯文本，避免 TextMate 冷语法初始化阻塞工具卡的展开与收起。
 */
import { type CSSProperties, useEffect, useState } from 'react'
import type { HighlightResult } from '@streamdown/code'

import { useTimerScope } from '../react-hooks/useTimerScope'

import { Log } from '#internal/runtime'

const HighlightMaxChars = 20_000

/** 执行步骤卡用到的语言：脚本源码是 TypeScript，调用的返回值是 JSON。 */
export type ExecutionStepCodeLanguage = 'typescript' | 'json'

/** 一段代码的分词结果。 */
export type HighlightedCode = Pick<HighlightResult, 'tokens'>

type HighlightedToken = HighlightResult['tokens'][number][number]

const highlights = new Map<string, HighlightedCode>()
const pendingHighlights = new Map<string, Promise<HighlightedCode>>()

/**
 * 缓存命中同步交回；冷请求合并计算，取消后不向已卸载组件交付。缓存按完整正文区分，最多保留32段。
 */
export function requestHighlight(
  text: string,
  language: ExecutionStepCodeLanguage,
  onReady: (code: HighlightedCode) => void
): () => void {
  let live = true
  const key = `${language}:${text}`
  const cached = highlights.get(key)
  if (cached) {
    onReady(cached)
    return () => { live = false }
  }
  let pending = pendingHighlights.get(key)
  if (!pending) {
    pending = import('./executionStepTokenize').then(({ tokenizeExecutionStep }) => {
      const code = tokenizeExecutionStep(text, language)
      highlights.set(key, code)
      if (highlights.size > 32) highlights.delete(highlights.keys().next().value!)
      return code
    })
    pendingHighlights.set(key, pending)
    void pending.finally(() => pendingHighlights.delete(key)).catch((error: unknown) => {
      Log.tag('execution-highlight').debug('分词器不可用，保留纯文本', { reason: error instanceof Error ? error.message : String(error) })
    })
  }
  void pending.then((code) => { if (live) onReady(code) }).catch((error: unknown) => {
    Log.tag('execution-highlight').debug('高亮结果未交付，保留纯文本', { reason: error instanceof Error ? error.message : String(error) })
  })
  return () => {
    live = false
  }
}

/** 这段文字按语言着色后的分词；不给语言、或高亮器还在加载这种语言时返回 null。 */
export function useHighlightedCode(
  text: string,
  language: LooseOptional<ExecutionStepCodeLanguage>
): Nullable<HighlightedCode> {
  const timers = useTimerScope('execution-step-highlight')
  const [loaded, setLoaded] = useState<
    Nullable<{ text: string; language: ExecutionStepCodeLanguage; code: HighlightedCode }>
  >(null)

  useEffect(() => {
    // 先显示正文，不在 React 渲染期间同步分词。超长正文保留可读纯文本。
    if (!language || text.length > HighlightMaxChars) return
    let cancel: (() => void) | undefined
    const timer = timers.after(0, () => {
      cancel = requestHighlight(text, language, (code) => setLoaded({ text, language, code }))
    })
    return () => { timer.cancel(); cancel?.() }
  }, [text, language, timers])

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
