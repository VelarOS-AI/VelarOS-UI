import { type CSSProperties, type ReactElement } from 'react'
import { ChartBarIcon } from '@phosphor-icons/react'

import { isNull } from '../../lib/runtime'
import { HoverCard } from '../../primitives/overlays/HoverCard'

import styles from './ChatTaskUsagePopover.module.css'

/** 宿主提供去重后的计量；缺失计数单独报告，不能画成零命中。 */
export interface ChatTaskUsageTotals {
  requests: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  incompleteRequests: number
  cacheMissingRequests: number
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
  const cachePercent = (value: ChatTaskUsageTotals): Nullable<number> =>
    value.inputTokens > 0 && value.cacheMissingRequests === 0 && value.incompleteRequests === 0
      ? Math.min(100, Math.max(0, (value.cacheReadTokens / value.inputTokens) * 100))
      : null
  const percentLabel = (value: Nullable<number>): string =>
    isNull(value) ? '—' : `${value.toFixed(1)}%`
  const totalPercent = cachePercent(total)
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
              title={`${exact.format(total.cacheReadTokens)} / ${exact.format(total.inputTokens)}`}
            >
              <span>{labels.cache}</span>
              <strong>{percentLabel(totalPercent)}</strong>
            </div>
          </div>
          <div className={styles.cacheTrack} data-unknown={isNull(totalPercent)} aria-hidden="true">
            <span style={{ '--task-cache-fill': `${totalPercent ?? 0}%` } as CSSProperties} />
          </div>
          <div className={styles.meta}>
            {labels.requests} {exact.format(total.requests)}
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
