import React, { useEffect, useRef, useState } from 'react'
import { useEventListener, useLatest, useMemoizedFn } from 'ahooks'

import { StyleUtils } from '@velaros-ai/ui'
import {
  HtmlArtifactBridgeMessageTypes,
  htmlArtifactDocuments,
  type HtmlArtifactFrameFit,
} from '@velaros-ai/ui/html-artifacts'

import { useIntersectionObserver } from '../react-hooks/useIntersectionObserver'
import { useTimerScope } from '../react-hooks/useTimerScope'

import {
  HTML_PREVIEW_IFRAME_SANDBOX,
  HTML_PREVIEW_MSG_OPEN_LINK,
  HTML_PREVIEW_MSG_RENDER,
  HTML_PREVIEW_MSG_RESIZE,
  HTML_PREVIEW_MSG_SEND_PROMPT,
  HTML_PREVIEW_PROMPT_EVENT,
} from './htmlPreviewConstants'
import { buildHtmlPreviewFrameShell } from './htmlPreviewDocument'

import styles from './HtmlPreview.module.css'

import { isNull, isNumber, isObject, isPresent, isTrue, numberOrNull, toNullable } from '#internal/runtime'
import type { TimerLease } from '#internal/timerScope'
import { readStringScalar as readString } from '#internal/unknownJsonRecord'

const cx = StyleUtils.bindCx(styles)

/** 定型之后内容变矮要稳住这么久（毫秒）才缩回去：途中再有汇报就重新计时，免得和内容自己的重排来回拉扯。 */
const FitShrinkSettleMs = 600
/** 矮了不到这么多像素不算变矮：滚动条、字体回退这类抖动不值得动一次。 */
const FitShrinkTolerancePx = 8

function applyFrameFitToIframe(
  iframe: HTMLIFrameElement,
  fit: HtmlArtifactFrameFit,
  fillHost = false
): void {
  iframe.style.transformOrigin = 'top left'

  if (fillHost) {
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.transform = 'none'
    return
  }

  if (!fit.locked) {
    iframe.style.width = '100%'
    iframe.style.height = `${fit.viewportHeight}px`
    iframe.style.transform = 'none'
    return
  }

  iframe.style.width = `${fit.contentWidth}px`
  iframe.style.height = `${fit.contentHeight}px`
  iframe.style.transform = fit.scale === 1 ? 'none' : `scale(${fit.scale})`
}

function readFrameMeasure(value: any): Nullable<number> {
  return numberOrNull(value)
}

function readHostWidth(host: Nullable<HTMLDivElement>): Nullable<number> {
  if (!host) return null

  return readFrameMeasure(host.getBoundingClientRect().width)
}

export interface HtmlPreviewFrameProps {
  html: string
  fillHost?: boolean
  fitViewportWidth?: boolean
  initialHeight: number
  reloadKey: number
  title: string
}

export function HtmlPreviewFrame({
  html,
  fillHost = false,
  fitViewportWidth = false,
  initialHeight,
  reloadKey,
  title,
}: HtmlPreviewFrameProps): React.ReactElement {
  const { ref: hostRef, isIntersecting: isInViewport } = useIntersectionObserver<HTMLDivElement>({
    threshold: 0.01,
  })
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const blobUrlRef = useRef<string>(null)
  const maxFrameWidthRef = useRef<Nullable<number>>(null)
  const frameFitRef = useRef<HtmlArtifactFrameFit>(
    htmlArtifactDocuments.resolveFrameFit({ fallbackHeight: initialHeight })
  )
  const frameFitFinalizedRef = useRef(false)
  const frameFitFinalizeTimerRef = useRef<Nullable<TimerLease>>(null)
  const frameFitShrinkTimerRef = useRef<Nullable<TimerLease>>(null)
  const [frameFit, setFrameFit] = useState<HtmlArtifactFrameFit>(() => frameFitRef.current)
  const timers = useTimerScope('HtmlPreviewFrame')
  const titleLatest = useLatest(title)
  const htmlLatest = useLatest(html)
  const shellKind = html.trimStart().startsWith('<svg') ? 'svg' : 'html'

  const clearFrameFitFinalization = useMemoizedFn((): void => {
    if (isNull(frameFitFinalizeTimerRef.current)) return

    frameFitFinalizeTimerRef.current.cancel()
    frameFitFinalizeTimerRef.current = null
  })

  const clearFrameFitShrink = useMemoizedFn((): void => {
    if (isNull(frameFitShrinkTimerRef.current)) return

    frameFitShrinkTimerRef.current.cancel()
    frameFitShrinkTimerRef.current = null
  })

  const scheduleFrameFitFinalization = useMemoizedFn((): void => {
    clearFrameFitFinalization()

    if (!frameFitRef.current.locked) return

    frameFitFinalizeTimerRef.current = timers.after(
      420,
      () => {
        frameFitFinalizeTimerRef.current = null
        if (frameFitRef.current.locked) {
          frameFitFinalizedRef.current = true
        }
      },
      { label: 'htmlArtifact.fit.finalize' }
    )
  })

  const postRenderMessage = useMemoizedFn((): void => {
    const iframeWindow = iframeRef.current?.contentWindow
    if (!iframeWindow) return

    iframeWindow.postMessage(
      {
        type: HTML_PREVIEW_MSG_RENDER,
        html: htmlLatest.current,
      },
      '*'
    )
  })

  const readFrameMaxWidth = useMemoizedFn(
    (fallbackWidth: LooseOptional<number>): Nullable<number> => {
      if (maxFrameWidthRef.current) return maxFrameWidthRef.current

      const measuredWidth = readHostWidth(hostRef.current)
      if (measuredWidth) {
        maxFrameWidthRef.current = measuredWidth
        return measuredWidth
      }

      return readFrameMeasure(fallbackWidth)
    }
  )

  const setResolvedFrameFit = useMemoizedFn((nextFit: HtmlArtifactFrameFit): void => {
    frameFitRef.current = nextFit
    setFrameFit(nextFit)

    if (iframeRef.current) {
      applyFrameFitToIframe(iframeRef.current, nextFit, fillHost)
    }
  })

  /**
   * 定型之后内容明显变矮：多半是定型前某次测量被顶高了（撞到高度上限、脚本还没排好版），框却一直留着那个高度，
   * 底下空出一大片。等内容稳住再按它的尺寸缩回去；稳住之前又有汇报就重新计时，变高的汇报直接取消。
   */
  const scheduleFrameFitShrink = useMemoizedFn(
    (naturalHeight: number, naturalWidth: Nullable<number>): void => {
      clearFrameFitShrink()
      frameFitShrinkTimerRef.current = timers.after(
        FitShrinkSettleMs,
        () => {
          frameFitShrinkTimerRef.current = null
          const maxViewportWidth = readFrameMaxWidth(naturalWidth)
          setResolvedFrameFit(
            htmlArtifactDocuments.resolveFrameFit({
              fallbackHeight: initialHeight,
              preferViewportWidth: fitViewportWidth,
              maxViewportWidth,
              naturalHeight,
              naturalWidth: naturalWidth ?? maxViewportWidth,
            })
          )
        },
        { label: 'htmlArtifact.fit.shrink' }
      )
    }
  )

  useEffect(() => {
    maxFrameWidthRef.current = null
    frameFitFinalizedRef.current = false
    clearFrameFitFinalization()
    clearFrameFitShrink()
    setResolvedFrameFit(htmlArtifactDocuments.resolveFrameFit({ fallbackHeight: initialHeight }))
  }, [clearFrameFitFinalization, clearFrameFitShrink, initialHeight, reloadKey, setResolvedFrameFit])

  useEffect(
    () => () => {
      clearFrameFitFinalization()
      clearFrameFitShrink()
    },
    [clearFrameFitFinalization, clearFrameFitShrink]
  )

  useEffect(() => {
    const host = hostRef.current

    if (!host) return undefined

    host.replaceChildren()

    if (!isInViewport) return undefined

    const revokeCurrentBlob = (): void => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }

    const createBlobUrl = (): string => {
      const shellHtml = buildHtmlPreviewFrameShell(htmlLatest.current)
      return URL.createObjectURL(new Blob([shellHtml], { type: 'text/html' }))
    }
    const iframe = document.createElement('iframe')
    iframe.className = styles.frame
    iframe.title = title
    iframe.referrerPolicy = 'no-referrer'
    iframe.setAttribute('sandbox', HTML_PREVIEW_IFRAME_SANDBOX)
    applyFrameFitToIframe(iframe, frameFitRef.current, fillHost)
    iframe.style.opacity = '0'

    const handleLoad = (): void => {
      iframe.style.opacity = '1'
      postRenderMessage()
    }

    iframe.addEventListener('load', handleLoad)

    const firstUrl = createBlobUrl()
    blobUrlRef.current = firstUrl
    iframe.src = firstUrl
    host.appendChild(iframe)
    iframeRef.current = iframe

    return () => {
      iframe.removeEventListener('load', handleLoad)
      iframe.remove()
      iframeRef.current = null
      revokeCurrentBlob()
    }
  }, [fillHost, htmlLatest, isInViewport, postRenderMessage, reloadKey, shellKind, title])

  useEffect(() => {
    postRenderMessage()
  }, [html, postRenderMessage])

  const handleIframeMessage = useMemoizedFn((event: MessageEvent): void => {
    const iframeWindow = iframeRef.current?.contentWindow
    if (!iframeWindow || event.source !== iframeWindow) return

    const data = event.data as {
      type?: any
      height?: any
      width?: any
      naturalHeight?: any
      naturalWidth?: any
      rendered?: any
      prompt?: any
      url?: any
    }
    if (!data || !isObject(data)) return

    if (data.type === HTML_PREVIEW_MSG_RESIZE) {
      if (!isTrue(data.rendered)) return

      const naturalHeight = readFrameMeasure(data.naturalHeight) ?? readFrameMeasure(data.height)
      const reportedNaturalWidth =
        readFrameMeasure(data.naturalWidth) ?? readFrameMeasure(data.width)
      const currentFit = frameFitRef.current
      const finalizedReportHasGrowth =
        frameFitFinalizedRef.current &&
        ((isPresent(naturalHeight) && naturalHeight > currentFit.contentHeight + 1) ||
          (isPresent(reportedNaturalWidth) && reportedNaturalWidth > currentFit.contentWidth + 1))

      if (frameFitFinalizedRef.current && !finalizedReportHasGrowth) {
        if (isPresent(naturalHeight) && naturalHeight < currentFit.contentHeight - FitShrinkTolerancePx)
          scheduleFrameFitShrink(naturalHeight, reportedNaturalWidth)
        return
      }
      clearFrameFitShrink()
      if (finalizedReportHasGrowth) {
        frameFitFinalizedRef.current = false
        clearFrameFitFinalization()
      }

      const maxViewportWidth = readFrameMaxWidth(reportedNaturalWidth)
      const naturalWidth = reportedNaturalWidth ?? maxViewportWidth

      const nextFit = htmlArtifactDocuments.resolveFrameFit({
        fallbackHeight: initialHeight,
        preferViewportWidth: fitViewportWidth,
        maxViewportWidth,
        naturalHeight,
        naturalWidth,
      })
      setResolvedFrameFit(nextFit)

      if (nextFit.locked) {
        scheduleFrameFitFinalization()
      }
      return
    }

    if (data.type === HtmlArtifactBridgeMessageTypes.wheel) {
      const wheelData = data as { deltaY?: unknown; deltaX?: unknown }
      scrollHostContainer(
        isNumber(wheelData.deltaY) ? wheelData.deltaY : 0,
        isNumber(wheelData.deltaX) ? wheelData.deltaX : 0
      )
      return
    }

    if (data.type === HTML_PREVIEW_MSG_SEND_PROMPT) {
      const prompt = readString(data.prompt)
      if (prompt) {
        window.dispatchEvent(
          new CustomEvent(HTML_PREVIEW_PROMPT_EVENT, {
            detail: { prompt, title: titleLatest.current },
          })
        )
      }
      return
    }

    if (data.type === HTML_PREVIEW_MSG_OPEN_LINK) {
      const url = readString(data.url)
      const externalUrl = htmlArtifactDocuments.normalizeExternalUrl(url)
      if (externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer')
      }
    }
  })

  useEventListener('message', handleIframeMessage)

  // 平铺后 iframe 内部无可滚,滚轮必须交还页面:iframe 文档转发的 wheel 消息在这里代滚宿主。
  const scrollHostContainer = useMemoizedFn((deltaY: number, deltaX: number): void => {
    let current: Nullable<HTMLElement> = toNullable(hostRef.current?.parentElement)
    while (current) {
      const style = window.getComputedStyle(current)
      if (
        /(auto|scroll|overlay)/u.test(style.overflowY) &&
        current.scrollHeight > current.clientHeight
      ) {
        current.scrollBy({ top: deltaY, left: deltaX })
        return
      }
      current = current.parentElement
    }
    window.scrollBy({ top: deltaY, left: deltaX })
  })

  const frameHostStyle: React.CSSProperties = fillHost
    ? { height: '100%', width: '100%' }
    : frameFit.locked
      ? { height: frameFit.viewportHeight, width: frameFit.viewportWidth }
      : { minHeight: frameFit.viewportHeight }

  return (
    <div
      ref={hostRef}
      className={cx('frameHost', fillHost ? 'frameHostFill' : false)}
      style={frameHostStyle}
    />
  )
}
