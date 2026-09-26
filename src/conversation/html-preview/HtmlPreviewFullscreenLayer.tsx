import React from 'react'
import { XIcon } from '@phosphor-icons/react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { IconButton } from '@velaros-ai/ui/primitives/buttons/IconButton'
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@velaros-ai/ui/primitives/overlays/Dialog'

import { useConversationI18n } from '../i18n'

import styles from './HtmlPreview.module.css'

/**
 * Widget 的全屏预览层:不透明应用背景全屏融入、零面板框,顶栏=标题+关闭——
 * 共享 `velar-image-preview-*` 类是给暗底图片预览设计的白字,这里逐项覆写成应用前景配色。
 */
export function HtmlPreviewFullscreenLayer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
}): React.ReactElement {
  const { t } = useConversationI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          className={`velar-image-preview-dialog-overlay ${styles.generationOverlay}`}
        />
        <DialogPrimitive.Content
          className={`velar-image-preview-dialog-content ${styles.generationContent}`}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className={`velar-image-preview-dialog-top-bar ${styles.generationTopBar}`}>
            <div className={`velar-image-preview-dialog-meta ${styles.generationMeta}`}>
              <DialogTitle className={`velar-image-preview-dialog-title ${styles.generationTitle}`}>
                {title}
              </DialogTitle>
            </div>
            <DialogClose asChild>
              <IconButton
                label={t('common.close')}
                size="icon-sm"
                className={`velar-image-preview-dialog-close-button ${styles.generationCloseButton}`}
              >
                <XIcon size={18} weight="bold" />
              </IconButton>
            </DialogClose>
          </div>
          <div className={styles.generationViewport}>
            <div className={styles.generationFrame}>{children}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
