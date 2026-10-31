import assert from 'node:assert/strict'

import { renderToStaticMarkup } from 'react-dom/server'
import { test } from 'bun:test'
import type { ReactElement, ReactNode } from 'react'

import { ChatTaskUsagePopover, type ChatTaskUsageTotals } from '../src/conversation/status/ChatTaskUsagePopover'

const labels = { title: '本次任务用量', input: '输入', output: '输出', cache: '缓存命中', cacheKnown: '缓存·已知', coverage: '数据覆盖', requests: '请求数' }
const total: ChatTaskUsageTotals = {
  requests: 106, inputTokens: 5_585_770, outputTokens: 40_286,
  cacheReadTokens: 4_932_480, incompleteRequests: 8, cacheMissingRequests: 8,
  cacheKnownRequests: 98, cacheKnownInputTokens: 5_585_770, cacheKnownReadTokens: 4_932_480,
}

function panel(value: ChatTaskUsageTotals): string {
  const card = ChatTaskUsagePopover({ total: value, locale: 'zh-CN', labels }) as ReactElement<{ content: ReactNode }>
  return renderToStaticMarkup(card.props.content)
}

void test('部分覆盖显示已知标记、覆盖计数与真实缓存比例', () => {
  const markup = panel(total)
  assert.match(markup, /缓存·已知/u)
  assert.match(markup, /88\.3%/u)
  assert.match(markup, /数据覆盖 98\/106/u)
  assert.match(markup, /title="4,932,480 \/ 5,585,770"/u)
  assert.match(markup, /data-unknown="false"/u)
})

void test('完整覆盖恢复普通标题；全部未知仍显示未知而不是0%', () => {
  const full = panel({ ...total, requests: 98, incompleteRequests: 0, cacheMissingRequests: 0 })
  assert.match(full, /缓存命中/u)
  assert.doesNotMatch(full, /数据覆盖|缓存·已知/u)
  const unknown = panel({ ...total, cacheKnownRequests: 0, cacheKnownInputTokens: 0, cacheKnownReadTokens: 0 })
  assert.match(unknown, /—/u)
  assert.match(unknown, /数据覆盖 0\/106/u)
  assert.match(unknown, /data-unknown="true"/u)
})
