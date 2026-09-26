/**
 * 小部件卡：模型用 `velaros:widget` 交来的一段 HTML 片段或 SVG，在沙箱 iframe 里显示。工具栏能看源码、
 * 复制、下载成完整的 HTML 文件、重新加载、全屏预览；页面里调 `sendPrompt(text)` 会把这句话交给宿主的
 * 输入框。查看源码、复制与下载用的是同一份可独立运行的文档。
 */
import { memo, type ReactElement, useCallback, useMemo, useState } from 'react'

import { htmlArtifactDocuments } from '@velaros-ai/ui/html-artifacts'

import { HtmlArtifactSourceCode } from '../artifacts/HtmlArtifactSourceCode'
import { downloadTextFile } from '../html-preview/download'
import { buildPortableHtmlDocument } from '../html-preview/htmlPreviewDocument'
import { HtmlPreviewFrame } from '../html-preview/HtmlPreviewFrame'
import { HtmlPreviewFullscreenLayer } from '../html-preview/HtmlPreviewFullscreenLayer'
import { HtmlPreviewToolbar } from '../html-preview/HtmlPreviewToolbar'
import { useConversationI18n } from '../i18n'

import styles from '../html-preview/HtmlPreview.module.css'

import type { WidgetBlock } from '#contracts'

/** 下载的文件名取标题，去掉文件名里不能有的字符。 */
function widgetDownloadFilename(title: string): string {
  const baseName = title
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `${baseName || 'widget'}.html`
}

export interface WidgetCardProps {
  block: WidgetBlock
}

function WidgetCardInner({ block }: WidgetCardProps): ReactElement {
  const { t } = useConversationI18n()
  const [showCode, setShowCode] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const title = block.title.trim() || t('chat.widgetDefaultTitle')
  const code = useMemo(() => htmlArtifactDocuments.normalizeSource(block.code), [block.code])
  const htmlDocument = useMemo(() => buildPortableHtmlDocument(code), [code])
  const handleDownload = useCallback((): void => {
    downloadTextFile(widgetDownloadFilename(title), htmlDocument, {
      mimeType: 'text/html;charset=utf-8',
    })
  }, [htmlDocument, title])

  return (
    <>
      <div className={styles.shell} data-slot="widget">
        <header className={styles.header}>
          <div className={styles.title} title={title}>
            {title}
          </div>
          <div className={styles.actions}>
            <HtmlPreviewToolbar
              copyLabel={t('chat.widgetCopyCode')}
              copiedLabel={t('chat.codeBlockCopied')}
              copyValue={htmlDocument}
              downloadLabel={t('chat.widgetDownloadHtml')}
              previewLabel={t('chat.widgetOpenPreview')}
              reloadLabel={t('chat.widgetReload')}
              showCode={showCode}
              showCodeLabel={t('chat.widgetShowCode')}
              hideCodeLabel={t('chat.widgetHideCode')}
              actionButtonClassName={styles.actionButton}
              onDownload={handleDownload}
              onOpenPreview={() => setPreviewOpen(true)}
              onReload={() => {
                setShowCode(false)
                setReloadKey((value) => value + 1)
              }}
              onToggleCode={() => setShowCode((value) => !value)}
            />
          </div>
        </header>
        <div className={styles.body}>
          {showCode ? (
            <HtmlArtifactSourceCode source={htmlDocument} />
          ) : (
            <div className={styles.frameShell}>
              <HtmlPreviewFrame
                fitViewportWidth
                html={code}
                initialHeight={block.height}
                reloadKey={reloadKey}
                title={title}
              />
            </div>
          )}
        </div>
      </div>
      <HtmlPreviewFullscreenLayer open={previewOpen} onOpenChange={setPreviewOpen} title={title}>
        <HtmlPreviewFrame
          fillHost
          fitViewportWidth
          html={code}
          initialHeight={block.height}
          reloadKey={reloadKey}
          title={title}
        />
      </HtmlPreviewFullscreenLayer>
    </>
  )
}

export const WidgetCard = memo(WidgetCardInner)

WidgetCard.displayName = 'WidgetCard'
