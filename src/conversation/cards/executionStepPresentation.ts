/**
 * 执行步骤卡的纯呈现层：脚本执行卡与旧工具调用卡共用的外观判定、标题兜底和参数排版。
 * 这里不碰 React 与文案目录，文案 key 由卡片自己按这里给出的判定去取。
 */
import { DEFAULT_TOOL_JSON_PREVIEW_MAX_CHARS } from '../tool-render/toolDisplay'

import type { ScriptExecutionBlock, ScriptExecutionCall, ToolCallBlock } from '#contracts'
import {
  isArray,
  isEmpty,
  isNonBlankString,
  isPresent,
  isRecord,
  isString,
  stringifyPretty,
  toNullable,
  trimmedStringOrEmpty,
} from '#internal/runtime'
import { asRecord, readString } from '#internal/unknownJsonRecord'

/** 步骤卡的四种外观：进行中、成功、失败、已取消。 */
export type ExecutionStepTone = 'running' | 'success' | 'error' | 'cancelled'

/** 外框的底色：步骤卡的四种，加上交互卡等用户回答时的一种。 */
export type ExecutionFrameTone = ExecutionStepTone | 'waiting'

/** 参数、返回值超过这么多行或这么多字符就先折起来，点「展开全部」再看。 */
const FoldedPayloadMaxLines = 8
const FoldedPayloadMaxChars = 600

/** 旧工具调用的参数、结果最多展示这么多字符，与原来的通用工具卡一致。 */
const ToolCallPayloadMaxChars = DEFAULT_TOOL_JSON_PREVIEW_MAX_CHARS

const ScriptExecutionToneByStatus = {
  writing: 'running',
  running: 'running',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'cancelled',
} as const satisfies Record<ScriptExecutionBlock['status'], ExecutionStepTone>

/** 脚本执行的外观：编写中与运行中都算进行中。 */
export function resolveScriptExecutionTone(status: ScriptExecutionBlock['status']): ExecutionStepTone {
  return ScriptExecutionToneByStatus[status]
}

/** 模块在标签上的名字：去掉 `velaros:` 这类前缀，只留冒号后的部分；没有前缀时原样返回。 */
export function formatScriptModuleLabel(moduleId: string): string {
  const separatorIndex = moduleId.indexOf(':')
  const label = separatorIndex < 0 ? moduleId : moduleId.slice(separatorIndex + 1)
  return label || moduleId
}

/** 一次调用的「模块 · 操作」，模块用标签上的名字。 */
export function formatScriptCallLabel(call: Pick<ScriptExecutionCall, 'module' | 'operation'>): string {
  return `${formatScriptModuleLabel(call.module)} · ${call.operation}`
}

/**
 * 卡片标题：宿主取好的那句话；为空时用第一处调用的「模块 · 操作」。
 * 连调用都还没有时返回 null，由卡片给「执行脚本」。
 */
export function resolveScriptExecutionTitle(
  block: Pick<ScriptExecutionBlock, 'title' | 'calls'>
): Nullable<string> {
  const title = trimmedStringOrEmpty(block.title)
  if (title) return title

  const [firstCall] = block.calls
  return firstCall ? formatScriptCallLabel(firstCall) : null
}

/** 多行文字的第一处非空行；整段为空时返回 null。 */
function readFirstLine(text: string): Nullable<string> {
  const line = text
    .split('\n')
    .map((part) => part.trim())
    .find((part) => !!part)
  return toNullable(line)
}

/** 标题下那行失败原因：只有脚本失败且带着原因时才有，取第一行，全文在详情里。 */
export function resolveScriptExecutionFailureReason(
  block: Pick<ScriptExecutionBlock, 'status' | 'error'>
): Nullable<string> {
  if (block.status !== 'failed') return null

  return readFirstLine(trimmedStringOrEmpty(block.error))
}

/**
 * 解析后的 JSON 值排成缩进两格的 JSON；字符串里的换行照原样断行（其余字符仍按 JSON 转义），
 * 命令输出、文件内容这类多行文本不会挤成一长串 `\n`。
 */
function printPayloadValue(value: unknown, indent: string): string {
  const inner = `${indent}  `

  if (isString(value))
    return `"${value
      .split('\n')
      .map((line) => JSON.stringify(line).slice(1, -1))
      .join('\n')}"`

  if (isArray(value)) {
    if (isEmpty(value)) return '[]'

    const items = value.map((item) => `${inner}${printPayloadValue(item, inner)}`)
    return `[\n${items.join(',\n')}\n${indent}]`
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
    if (isEmpty(entries)) return '{}'

    const fields = entries.map(
      ([key, item]) => `${inner}${JSON.stringify(key)}: ${printPayloadValue(item, inner)}`
    )
    return `{\n${fields.join(',\n')}\n${indent}}`
  }

  return JSON.stringify(value)
}

/**
 * 调用的参数与返回值是 JSON 原文：能解析就排成缩进的 JSON，字符串值直接给出原文（换行照常）；
 * 解析不了（宿主按上限截断过）就照原样显示。
 */
export function formatScriptPayload(text: string): string {
  if (!isNonBlankString(text)) return ''

  try {
    const value: unknown = JSON.parse(text)
    return isString(value) ? value : printPayloadValue(value, '')
  } catch {
    // arch-guard:silent-catch-ok 被截断的 JSON 本来就解析不了，照原文显示就是想要的结果。
    return text
  }
}

/** 一次调用的结果按哪种语言着色：排成了 JSON 对象或数组的按 JSON，别的（原文、字符串值）按纯文本。 */
export function resolveScriptPayloadLanguage(text: string): LooseOptional<'json'> {
  return /^\s*[[{]/u.test(text) ? 'json' : undefined
}

/** 参数、返回值是否长到要先折起来。 */
export function isLongExecutionPayload(text: string): boolean {
  return text.length > FoldedPayloadMaxChars || text.split('\n').length > FoldedPayloadMaxLines
}

/**
 * 旧工具调用的参数、进度或结果排成可读文本：字符串原样，其余排成缩进的 JSON，超过上限截断并标出来。
 * 这是坏数据的最后一站（参数可能是 null、标量甚至循环引用），只降级、不抛错；没有内容时返回 null。
 */
export function formatToolCallPayload(
  value: unknown
): Nullable<{ text: string; truncated: boolean }> {
  if (!isPresent(value)) return null
  if (isRecord(value) && isEmpty(Object.keys(value))) return null

  let text: string
  try {
    text = isString(value) ? value : stringifyPretty(value)
  } catch {
    // arch-guard:silent-catch-ok 排不成 JSON（循环引用）就退回 String，展示层不该因坏数据整卡消失。
    text = String(value)
  }
  if (!isNonBlankString(text)) return null

  return text.length > ToolCallPayloadMaxChars
    ? { text: text.slice(0, ToolCallPayloadMaxChars), truncated: true }
    : { text, truncated: false }
}

/** 旧工具调用的错误原文：契约上是字符串，磁盘归档与流式归约里也见过 `{ message }` 的形状。 */
export function readToolCallErrorText(block: Pick<ToolCallBlock, 'error'>): Nullable<string> {
  const error: unknown = block.error
  const text = isString(error) ? error.trim() : readString(asRecord(error), 'message')
  return isNonBlankString(text) ? text : null
}

/** 旧工具调用的外观：运行中、出错，其余算完成。 */
export function resolveToolCallStepTone(
  block: Pick<ToolCallBlock, 'isRunning' | 'error'>
): ExecutionStepTone {
  if (block.isRunning) return 'running'

  return readToolCallErrorText(block) ? 'error' : 'success'
}

/** 旧工具调用标题下那行失败原因：运行结束且有错误时取错误的第一行。 */
export function resolveToolCallFailureReason(
  block: Pick<ToolCallBlock, 'isRunning' | 'error'>
): Nullable<string> {
  if (block.isRunning) return null

  const errorText = readToolCallErrorText(block)
  return errorText ? readFirstLine(errorText) : null
}
