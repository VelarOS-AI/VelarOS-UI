/**
 * 单行文字默认以省略号收尾，溢出且 `active` 时横向循环滚动。
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
const MarqueePixelsPerSecond = 48

export interface MarqueeTextProps {
  title: string
  /** 溢出时是否播放滚动动画。 */
  active?: boolean
  /** 强制静态（不测量、不滚动），如打字机重命名期间。 */
  disabled?: boolean
  children?: ReactNode
}

export function MarqueeText({
  title,
  active = false,
  disabled = false,
  children,
}: MarqueeTextProps): ReactElement {
  const viewportRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [distance, setDistance] = useState(0)

  const measureDistance = useCallback((): void => {
    if (disabled) {
      setDistance(0)
      return
    }
    const viewportNode = viewportRef.current
    const textNode = textRef.current
    if (!viewportNode || !textNode) return

    const textWidth = textNode.scrollWidth
    const scale = window.devicePixelRatio
    // 两份文字的起点相隔整数个设备像素，循环首尾使用同一栅格位置。
    setDistance(
      textWidth > viewportNode.clientWidth + 1
        ? Math.ceil((textWidth + MarqueeGapPx) * scale) / scale
        : 0
    )
  }, [disabled])

  useLayoutEffect(() => {
    measureDistance()
  }, [children, measureDistance, title])

  useEffect(() => {
    const ResizeObserverCtor = globalThis.ResizeObserver
    if (disabled || !ResizeObserverCtor) return undefined

    const viewportNode = viewportRef.current
    const textNode = textRef.current
    if (!viewportNode || !textNode) return undefined

    const observer = new ResizeObserverCtor(measureDistance)
    observer.observe(viewportNode)
    observer.observe(textNode)
    return () => {
      observer.disconnect()
    }
  }, [disabled, measureDistance])

  const marqueeActive = distance > 0 && active && !disabled
  const motionStyle = {
    '--velar-marquee-text-distance': `${distance}px`,
    '--velar-marquee-text-duration': `${Math.max(MarqueeMinDurationMs, (distance * 1000) / MarqueePixelsPerSecond)}ms`,
  } as CSSProperties
  const text = children ?? title

  return (
    <span
      ref={viewportRef}
      data-slot="text"
      className="velar-marquee-text"
      data-overflowing={distance > 0 ? 'true' : undefined}
      data-marquee-active={marqueeActive ? 'true' : undefined}
      title={title}
    >
      <span ref={textRef} className="velar-marquee-text-item">
        {text}
      </span>
      {marqueeActive && (
        <span className="velar-marquee-text-track" style={motionStyle} aria-hidden="true">
          <span>{text}</span>
          <span>{text}</span>
        </span>
      )}
    </span>
  )
}
