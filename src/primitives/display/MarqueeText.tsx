/**
 * 溢出自动横向滚动的单行文本（跑马灯）。文本不溢出时静态省略号，溢出且 `active` 时循环滚动。
 *
 * variants（封闭枚举，全仓共用一套）：无外观 variant——固定形态，字色 / 字号从父级继承（无 className 逃生口）。
 * 样式：`.velar-marquee-text` · 见 styles/components/。
 * 状态：`active`（是否播放滚动）/ `disabled`（强制静态，如重命名打字期间）经 props 投影。
 */
import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

const MarqueeGapPx = 24
const MarqueeMinDurationMs = 4200
const MarqueeMaxDurationMs = 12000
const MarqueePixelsPerSecond = 48

interface MarqueeState {
  overflowing: boolean
  durationMs: number
}

const EmptyMarqueeState: MarqueeState = {
  overflowing: false,
  durationMs: MarqueeMinDurationMs,
}

export interface MarqueeTextProps {
  title: string
  /** 溢出时是否播放滚动动画。 */
  active?: boolean
  /** 强制静态（不测量、不滚动），如打字机重命名期间。 */
  disabled?: boolean
  children?: ReactNode
}

function makeMarqueeState(
  viewportWidth: number,
  textWidth: number,
  disabled: boolean
): MarqueeState {
  const overflowing = !disabled && textWidth > viewportWidth + 1
  if (!overflowing) return EmptyMarqueeState

  const durationMs = Math.min(
    MarqueeMaxDurationMs,
    Math.max(
      MarqueeMinDurationMs,
      Math.round(((textWidth + MarqueeGapPx) / MarqueePixelsPerSecond) * 1000)
    )
  )

  return {
    overflowing: true,
    durationMs,
  }
}

function areMarqueeStatesEqual(left: MarqueeState, right: MarqueeState): boolean {
  return left.overflowing === right.overflowing && left.durationMs === right.durationMs
}

export function MarqueeText({
  title,
  active = false,
  disabled = false,
  children,
}: MarqueeTextProps): ReactElement {
  const viewportRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [marquee, setMarquee] = useState<MarqueeState>(EmptyMarqueeState)

  const syncMarqueeState = useCallback((): void => {
    const viewportNode = viewportRef.current
    const textNode = textRef.current
    if (!viewportNode || !textNode) return

    const next = makeMarqueeState(viewportNode.clientWidth, textNode.scrollWidth, disabled)
    setMarquee((current) => (areMarqueeStatesEqual(current, next) ? current : next))
  }, [disabled])

  useLayoutEffect(() => {
    syncMarqueeState()
  }, [children, syncMarqueeState, title])

  useEffect(() => {
    const ResizeObserverCtor = globalThis.ResizeObserver
    if (!ResizeObserverCtor) return undefined

    const viewportNode = viewportRef.current
    const textNode = textRef.current
    if (!viewportNode || !textNode) return undefined

    const observer = new ResizeObserverCtor(syncMarqueeState)
    observer.observe(viewportNode)
    observer.observe(textNode)
    syncMarqueeState()

    return () => {
      observer.disconnect()
    }
  }, [syncMarqueeState])

  const marqueeStyle = marquee.overflowing
    ? ({
        '--velar-marquee-text-gap': `${MarqueeGapPx}px`,
        '--velar-marquee-text-duration': `${marquee.durationMs}ms`,
      } as CSSProperties)
    : undefined
  const marqueeActive = marquee.overflowing && active && !disabled

  return (
    <span
      ref={viewportRef}
      data-slot="text"
      className="velar-marquee-text"
      data-overflowing={marquee.overflowing ? 'true' : undefined}
      data-marquee-active={marqueeActive ? 'true' : undefined}
      title={title}
    >
      <span className="velar-marquee-text-track" style={marqueeStyle}>
        <span ref={textRef} className="velar-marquee-text-item">
          {children ?? title}
        </span>
        {marqueeActive && (
          <span className="velar-marquee-text-item" aria-hidden="true">
            {children ?? title}
          </span>
        )}
      </span>
    </span>
  )
}
