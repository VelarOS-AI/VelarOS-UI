import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef } from 'react'

import { isFunction } from '../lib/runtime'

export interface PointerResizeMove {
  deltaX: number
  deltaY: number
  startX: number
  startY: number
}

export interface UsePointerResizeOptions<TTarget, TContext> {
  cursor: string | ((target: TTarget) => string)
  onResize: (target: TTarget, move: PointerResizeMove, context: TContext) => void
  onResizeStart: (target: TTarget, event: ReactPointerEvent) => TContext
}

export type PointerResizeStarter<TTarget> = (target: TTarget, event: ReactPointerEvent) => void

export function usePointerResize<TTarget, TContext>({
  cursor,
  onResize,
  onResizeStart,
}: UsePointerResizeOptions<TTarget, TContext>): PointerResizeStarter<TTarget> {
  const stopActiveResizeRef = useRef<(() => void) | null>(null)
  useEffect(() => () => stopActiveResizeRef.current?.(), [])

  return useCallback(
    (target: TTarget, event: ReactPointerEvent): void => {
      if (event.button !== 0 || !event.isPrimary) return
      event.preventDefault()
      stopActiveResizeRef.current?.()

      const pointerId = event.pointerId
      const startX = event.clientX
      const startY = event.clientY
      const context = onResizeStart(target, event)
      const previousCursor = document.body.style.cursor
      const previousUserSelect = document.body.style.userSelect

      document.body.style.cursor = isFunction(cursor) ? cursor(target) : cursor
      document.body.style.userSelect = 'none'

      const handlePointerMove = (pointerEvent: PointerEvent): void => {
        if (pointerEvent.pointerId !== pointerId) return
        onResize(
          target,
          {
            deltaX: pointerEvent.clientX - startX,
            deltaY: pointerEvent.clientY - startY,
            startX,
            startY,
          },
          context
        )
      }

      const stopResize = (): void => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerEnd)
        window.removeEventListener('pointercancel', handlePointerEnd)
        window.removeEventListener('blur', stopResize)
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousUserSelect
        if (stopActiveResizeRef.current === stopResize) stopActiveResizeRef.current = null
      }
      const handlePointerEnd = (pointerEvent: PointerEvent): void => {
        if (pointerEvent.pointerId === pointerId) stopResize()
      }

      stopActiveResizeRef.current = stopResize
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerEnd)
      window.addEventListener('pointercancel', handlePointerEnd)
      window.addEventListener('blur', stopResize)
    },
    [cursor, onResize, onResizeStart]
  )
}
