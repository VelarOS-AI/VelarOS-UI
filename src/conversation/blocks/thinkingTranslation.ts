import type { AppLocale, ThinkingBlock } from '#contracts'
import { isBlank, isNonBlankString, isNull, isTrue } from '#internal/runtime'

export type ThinkingTextLanguage = 'english' | 'chinese' | 'mixed' | 'neutral'

export type ThinkingTranslationButtonKind =
  | 'hidden'
  | 'translate'
  | 'show-original'
  | 'show-translation'

export type ThinkingTranslationClickResolution =
  | { kind: 'noop' }
  | { kind: 'show-original' }
  | { kind: 'show-cached' }
  | { kind: 'request-model'; sourceText: string }

const StreamingThinkingTailChars = 12_000
const StreamingThinkingTailLines = 240
const CjkPattern = /[\u3400-\u9fff\uf900-\ufaff]/g
const LatinPattern = /[A-Za-z]/g
const MarkdownFencePattern = /```[\s\S]*?```/g
const InlineCodePattern = /`[^`]*`/g
const UrlPattern = /https?:\/\/\S+/gi

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

function stripNonLinguisticText(text: string): string {
  return text
    .replace(MarkdownFencePattern, ' ')
    .replace(InlineCodePattern, ' ')
    .replace(UrlPattern, ' ')
}

export function detectThinkingTextLanguage(text: string): ThinkingTextLanguage {
  const normalized = stripNonLinguisticText(text)
  const cjkCount = countMatches(normalized, CjkPattern)
  const latinCount = countMatches(normalized, LatinPattern)

  if (cjkCount === 0 && latinCount === 0) return 'neutral'

  if (cjkCount === 0) return 'english'

  if (latinCount === 0) return 'chinese'

  if (cjkCount >= latinCount * 0.35) return 'chinese'

  if (latinCount >= cjkCount * 3) return 'english'

  return 'mixed'
}

export function shouldOfferThinkingTranslation(text: string, locale: AppLocale): boolean {
  if (isBlank(text)) return false

  const language = detectThinkingTextLanguage(text)
  if (language === 'neutral') return false

  if (locale === 'zh-CN') return language !== 'chinese'

  return language !== 'english'
}

export function hasThinkingTranslationForLocale(
  block: ThinkingBlock,
  locale: AppLocale
): boolean {
  return (
    block.translatedLocale === locale &&
    isNonBlankString(block.translatedText)
  )
}

export function isThinkingTranslationVisible(
  block: ThinkingBlock,
  locale: AppLocale
): boolean {
  return isTrue(block.translationVisible) && hasThinkingTranslationForLocale(block, locale)
}

export function getThinkingBlockDisplayText(block: ThinkingBlock, locale: AppLocale): string {
  return isThinkingTranslationVisible(block, locale) ? block.translatedText ?? block.text : block.text
}

/** 思考文字去掉标题记号后的样子：`text` 是要显示的文字，`headings` 是其中标题行的区间。 */
export interface ThinkingDisplayText {
  text: string
  /** 标题行在 `text` 里的 `[start, end)`，按先后排。 */
  headings: ReadonlyArray<{ readonly start: number; readonly end: number }>
}

/**
 * 整行的 `**标题**`（OpenAI 的推理摘要每一段都这样起头）只留标题文字、另记区间，由渲染层加粗；别的
 * Markdown 原样显示。流式时最后一行的标题可能还没写完，先按标题算，显示的字不会一会儿多出两颗星号。
 */
export function readThinkingHeadings(text: string): ThinkingDisplayText {
  const lines = text.split('\n')
  const headings: Array<{ start: number; end: number }> = []
  let display = ''
  lines.forEach((line, index) => {
    if (index > 0) display += '\n'
    const heading = readThinkingHeadingLine(line, index === lines.length - 1)
    if (isNull(heading)) {
      display += line
      return
    }
    if (heading) headings.push({ start: display.length, end: display.length + heading.length })
    display += heading
  })
  return { text: display, headings }
}

/** 这一行是 `**标题**` 就给出标题文字；`last` 时收尾的星号可以还没到齐。 */
function readThinkingHeadingLine(line: string, last: boolean): Nullable<string> {
  if (!line.startsWith('**')) return null
  const body =
    line.length >= 4 && line.endsWith('**')
      ? line.slice(2, -2)
      : last
        ? line.slice(2).replace(/\*+$/, '')
        : null
  return isNull(body) || body.startsWith('*') || body.includes('**') ? null : body
}

export interface StreamingThinkingDisplayWindow {
  /** 窗口里的思考原文（整段原文的一个后缀）。 */
  text: string
  /** 窗口在整段原文里的起点。 */
  start: number
  /** 前面还有被截掉的部分。 */
  truncated: boolean
}

/** 流式思考只显示末尾一段：最多 `maxChars` 个字、`maxLines` 行，窗口永远是原文的后缀。 */
export function getStreamingThinkingDisplayWindow(
  text: string,
  options: {
    streaming: boolean
    maxChars?: number
    maxLines?: number
  }
): StreamingThinkingDisplayWindow {
  if (!options.streaming) return { text, start: 0, truncated: false }

  const maxChars = options.maxChars ?? StreamingThinkingTailChars
  const maxLines = options.maxLines ?? StreamingThinkingTailLines
  let start = maxChars > 0 && text.length > maxChars ? text.length - maxChars : 0

  if (maxLines > 0) {
    let newlines = 0
    for (let index = text.length - 1; index >= start; index -= 1) {
      if (text[index] !== '\n') continue
      newlines += 1
      if (newlines === maxLines) {
        start = index + 1
        break
      }
    }
  }

  return { text: text.slice(start), start, truncated: start > 0 }
}

export function getStreamingThinkingDisplayText(
  text: string,
  options: {
    streaming: boolean
    maxChars?: number
    maxLines?: number
  }
): string {
  const window = getStreamingThinkingDisplayWindow(text, options)
  return window.truncated ? `...\n${window.text}` : window.text
}

export function getThinkingTranslationButtonKind(
  block: ThinkingBlock,
  locale: AppLocale
): ThinkingTranslationButtonKind {
  if (isThinkingTranslationVisible(block, locale)) return 'show-original'

  if (hasThinkingTranslationForLocale(block, locale)) return 'show-translation'

  return shouldOfferThinkingTranslation(block.text, locale) ? 'translate' : 'hidden'
}

export function resolveThinkingTranslationClick(
  block: ThinkingBlock,
  locale: AppLocale
): ThinkingTranslationClickResolution {
  if (isThinkingTranslationVisible(block, locale)) return { kind: 'show-original' }

  if (hasThinkingTranslationForLocale(block, locale)) return { kind: 'show-cached' }

  const sourceText = block.text.trim()
  if (!shouldOfferThinkingTranslation(sourceText, locale)) return { kind: 'noop' }

  return {
    kind: 'request-model',
    sourceText,
  }
}

export function shouldAutoTranslateThinkingBlock(
  block: ThinkingBlock,
  locale: AppLocale,
  enabled: boolean
): boolean {
  if (!enabled) return false
  if (hasThinkingTranslationForLocale(block, locale)) return false

  return resolveThinkingTranslationClick(block, locale).kind === 'request-model'
}
