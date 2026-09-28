import { CaretDoubleDownIcon, CaretDoubleUpIcon } from '@phosphor-icons/react'
import type { MouseEvent, ReactElement } from 'react'

import { AutoScrollSuspendEventName } from '../react-hooks/scrollBehavior'

import styles from './ExpandableContentControls.module.css'

/** 代码、表格与执行详情共用的底部展开入口和收起图标。容器负责内容裁切与溢出判定。 */
export function ExpandableContentControls({
  expanded,
  expandLabel,
  collapseLabel,
  onExpandedChange,
}: {
  expanded: boolean
  expandLabel: string
  collapseLabel: string
  onExpandedChange: (expanded: boolean) => void
}): ReactElement {
  const toggle = (event: MouseEvent<HTMLButtonElement>): void => {
    event.currentTarget.dispatchEvent(new Event(AutoScrollSuspendEventName, { bubbles: true }))
    onExpandedChange(!expanded)
  }

  if (!expanded)
    return (
      <button
        type="button"
        className={styles.expandableCodeBlockOverlay}
        aria-expanded="false"
        aria-label={expandLabel}
        title={expandLabel}
        onClick={toggle}
      >
        <span className={styles.expandableCodeBlockButton} aria-hidden="true">
          <CaretDoubleDownIcon size={18} weight="bold" />
        </span>
      </button>
    )

  return (
    <div className={styles.expandableCodeBlockCollapseSlot}>
      <button
        type="button"
        className={styles.expandableCodeBlockCollapseButton}
        aria-expanded="true"
        aria-label={collapseLabel}
        title={collapseLabel}
        onClick={toggle}
      >
        <CaretDoubleUpIcon size={18} weight="bold" aria-hidden="true" />
      </button>
    </div>
  )
}
