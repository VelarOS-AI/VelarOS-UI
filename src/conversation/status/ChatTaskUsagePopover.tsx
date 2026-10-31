import { type CSSProperties, type ReactElement } from 'react'
import { ChartBarIcon } from '@phosphor-icons/react'

import { isNull } from '../../lib/runtime'
import { HoverCard } from '../../primitives/overlays/HoverCard'

import { resolveTaskUsageCache } from './taskUsagePresentation'

import styles from './ChatTaskUsagePopover.module.css'

/** 宿主提供去重后的计量；缺失计数单独报告，不能画成零命中。 */
export interface ChatTaskUsageTotals {
  requests: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  incompleteRequests: number
  cacheMissingRequests: number
  /** 同时具有可信输入量与缓存读取量的请求数；包含真实零命中，排除未知及进行中请求。 */
  cacheKnownRequests: number
  /** 仅累加 cacheKnownRequests 对应请求的输入量，不得混入缓存字段缺失的请求。 */
  cacheKnownInputTokens: number
  /** 与 cacheKnownInputTokens 相同请求集合的缓存读取量。 */
  cacheKnownReadTokens: number
}

export interface ChatTaskUsagePopoverProps {
  total: ChatTaskUsageTotals
  locale: string
  labels: {
    title: string
    requests: string
    input: string
    output: string
    cache: string
    cacheKnown: string
    coverage: string
  }
}

/** 紧凑的任务用量浮层；只负责展示，不持有会话、计价或请求归属策略。 */
export function ChatTaskUsagePopover({
  total,
  locale,
  labels,
}: ChatTaskUsagePopoverProps): ReactElement {
  const exact = new Intl.NumberFormat(locale)
  const compact = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const percentLabel = (value: Nullable<number>): string =>
    isNull(value) ? '—' : `${value.toFixed(1)}%`
  const cache = resolveTaskUsageCache(total)
  const totalPercent = cache.percent
  return (
    <HoverCard
      align="end"
      side="top"
      sideOffset={6}
      content={
        <section className={styles.panel} aria-label={labels.title}>
          <div className={styles.metrics}>
            <div title={exact.format(total.inputTokens)}>
              <span>{labels.input}</span>
              <strong>{compact.format(total.inputTokens)}</strong>
            </div>
            <div title={exact.format(total.outputTokens)}>
              <span>{labels.output}</span>
              <strong>{compact.format(total.outputTokens)}</strong>
            </div>
            <div
              title={`${exact.format(total.cacheKnownReadTokens)} / ${exact.format(total.cacheKnownInputTokens)}`}
            >
              <span>{cache.partial ? labels.cacheKnown : labels.cache}</span>
              <strong>{percentLabel(totalPercent)}</strong>
            </div>
          </div>
          <div className={styles.cacheTrack} data-unknown={isNull(totalPercent)} aria-hidden="true">
            <span style={{ '--task-cache-fill': `${totalPercent ?? 0}%` } as CSSProperties} />
          </div>
          <div className={styles.meta}>
            {labels.requests} {exact.format(total.requests)}
            {cache.partial && <> · {labels.coverage} {exact.format(total.cacheKnownRequests)}/{exact.format(total.requests)}</>}
          </div>
        </section>
      }
    >
      <button type="button" className={styles.trigger} aria-label={labels.title}>
        <ChartBarIcon size={16} />
      </button>
    </HoverCard>
  )
}
