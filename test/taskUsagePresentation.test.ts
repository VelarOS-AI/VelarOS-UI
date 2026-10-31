import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { ChatTaskUsageTotals } from '../src/conversation/status/ChatTaskUsagePopover'
import { resolveTaskUsageCache } from '../src/conversation/status/taskUsagePresentation'

const complete: ChatTaskUsageTotals = {
  requests: 98,
  inputTokens: 5_585_770,
  outputTokens: 40_286,
  cacheReadTokens: 4_932_480,
  incompleteRequests: 0,
  cacheMissingRequests: 0,
  cacheKnownRequests: 98,
  cacheKnownInputTokens: 5_585_770,
  cacheKnownReadTokens: 4_932_480,
}

void test('完整数据正常显示整体加权命中率', () => {
  const cache = resolveTaskUsageCache(complete)
  assert.equal(cache.percent?.toFixed(1), '88.3')
  assert.equal(cache.partial, false)
})

void test('未知和进行中请求不抹掉已知部分，也不把只有输入量的请求加入缓存分母', () => {
  const cache = resolveTaskUsageCache({
    ...complete,
    requests: 106,
    inputTokens: complete.inputTokens + 1_000_000,
    cacheReadTokens: complete.cacheReadTokens + 50_000,
    incompleteRequests: 8,
    cacheMissingRequests: 8,
  })
  assert.equal(cache.percent?.toFixed(1), '88.3')
  assert.equal(cache.partial, true)
})

void test('只有输出量缺失时，不隐藏已知输入和缓存事实', () => {
  const cache = resolveTaskUsageCache({ ...complete, incompleteRequests: 1 })
  assert.equal(cache.percent?.toFixed(1), '88.3')
  assert.equal(cache.partial, false)
})

void test('真实零命中显示0%，全未知与零输入量显示未知', () => {
  assert.equal(resolveTaskUsageCache({ ...complete, cacheKnownReadTokens: 0 }).percent, 0)
  assert.equal(resolveTaskUsageCache({ ...complete, cacheKnownRequests: 0 }).percent, null)
  assert.equal(resolveTaskUsageCache({ ...complete, cacheKnownInputTokens: 0 }).percent, null)
})
