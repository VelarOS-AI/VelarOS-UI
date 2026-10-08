import type {
  HtmlArtifactContentKind,
  HtmlArtifactDocumentOptions,
} from '@velaros-ai/ui/html-artifacts'
import { htmlArtifactDocuments } from '@velaros-ai/ui/html-artifacts'

import {
  HTML_PREVIEW_MAX_REPORTED_HEIGHT,
  HTML_PREVIEW_MSG_ERROR,
  HTML_PREVIEW_MSG_GENERIC,
  HTML_PREVIEW_MSG_OPEN_LINK,
  HTML_PREVIEW_MSG_RENDER,
  HTML_PREVIEW_MSG_RESIZE,
  HTML_PREVIEW_MSG_SEND_PROMPT,
} from './htmlPreviewConstants'
import { HTML_PREVIEW_SVG_FIT_CSS } from './htmlPreviewDesignCss'

const HTML_PREVIEW_ROOT_ID = 'velaros-html-preview-root'
const HTML_PREVIEW_BRIDGE_MESSAGES = {
  render: HTML_PREVIEW_MSG_RENDER,
  resize: HTML_PREVIEW_MSG_RESIZE,
  sendPrompt: HTML_PREVIEW_MSG_SEND_PROMPT,
  openLink: HTML_PREVIEW_MSG_OPEN_LINK,
  generic: HTML_PREVIEW_MSG_GENERIC,
  error: HTML_PREVIEW_MSG_ERROR,
} as const

function resolveHtmlPreviewBodyStyle(kind: HtmlArtifactContentKind): string {
  return kind === 'svg'
    ? 'margin:0;width:100%;min-height:100%;overscroll-behavior:contain;background:transparent;'
    : 'margin:0;padding:16px;overscroll-behavior:contain;background:transparent;'
}

function buildHtmlPreviewDocumentOptions(source: string): HtmlArtifactDocumentOptions {
  const contentKind = htmlArtifactDocuments.inferContentKind(source)

  return {
    contentKind,
    svgFitCss: HTML_PREVIEW_SVG_FIT_CSS,
    bodyStyle: resolveHtmlPreviewBodyStyle(contentKind),
    bridgeMessages: HTML_PREVIEW_BRIDGE_MESSAGES,
    maxReportedHeight: HTML_PREVIEW_MAX_REPORTED_HEIGHT,
  }
}

export function buildHtmlPreviewDocument(source: string): string {
  return htmlArtifactDocuments.buildDocument(source, buildHtmlPreviewDocumentOptions(source))
}

export function buildHtmlPreviewFrameShell(source: string): string {
  return htmlArtifactDocuments.buildShellDocument({
    ...buildHtmlPreviewDocumentOptions(source),
    rootId: HTML_PREVIEW_ROOT_ID,
  })
}

// —— 纯净导出文档(查看源码/复制/下载共用) ——
// meta、尺寸适配 CSS 与小部件自己的内容构成独立文档；查看源码、复制和下载共用它。
// iframe 外壳另带消息桥与测量运行时，样式和 CSS 变量由小部件自行定义。

export function buildPortableHtmlDocument(sourceHtml: string): string {
  const source = htmlArtifactDocuments.normalizeSource(sourceHtml)
  const contentKind = htmlArtifactDocuments.inferContentKind(source)
  const svgCss = contentKind === 'svg' ? HTML_PREVIEW_SVG_FIT_CSS : ''

  const doc = document.implementation.createHTMLDocument('')
  const charset = doc.createElement('meta')
  charset.setAttribute('charset', 'utf-8')
  const viewport = doc.createElement('meta')
  viewport.setAttribute('name', 'viewport')
  viewport.setAttribute('content', 'width=device-width,initial-scale=1')
  const baseStyle = doc.createElement('style')
  baseStyle.textContent = `${svgCss}body{${resolveHtmlPreviewBodyStyle(contentKind)}}`
  doc.head.append(charset, viewport, baseStyle)

  doc.body.innerHTML = source

  return `<!doctype html>${doc.documentElement.outerHTML}`
}
