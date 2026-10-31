import { isFiniteNumber } from '../../lib/runtime'

import type { ChatTaskUsageTotals } from './ChatTaskUsagePopover'

/** 只用同时有输入量和缓存量的请求计算命中率；未知请求既不补零，也不进入分母。 */
export function resolveTaskUsageCache(total: ChatTaskUsageTotals): {
  percent: Nullable<number>
  partial: boolean
} {
  const hasKnownInput =
    total.cacheKnownRequests > 0 &&
    isFiniteNumber(total.cacheKnownInputTokens) &&
    total.cacheKnownInputTokens > 0 &&
    isFiniteNumber(total.cacheKnownReadTokens) &&
    total.cacheKnownReadTokens >= 0
  return {
    percent: hasKnownInput
      ? Math.min(100, Math.max(0, (total.cacheKnownReadTokens / total.cacheKnownInputTokens) * 100))
      : null,
    partial: total.cacheKnownRequests < total.requests,
  }
}
