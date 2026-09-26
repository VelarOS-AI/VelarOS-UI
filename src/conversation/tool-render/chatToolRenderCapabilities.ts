import type { Result } from '#internal/result'

export interface LocalAttachmentReadRequest {
  sessionId: string
  path: string
  name: string
  mediaType: string
  expectedSize?: number
}

export interface LocalAttachmentReadResult {
  data: Uint8Array
  mediaType: string
}

/** 工具卡异步回调的全局提示（toast）语气；desktop 绑定 GlobalMessage.open。 */
export type ChatToolRenderNoticeTone = 'success' | 'info' | 'warning' | 'error'

export interface ChatToolRenderNotice {
  title: string
  description?: string
  tone?: ChatToolRenderNoticeTone
  /** 自动消失时长（ms）；缺省走宿主 toast 默认。 */
  duration?: number
  /** 是否展示关闭按钮；缺省宿主默认 true。 */
  showClose?: boolean
}

/** 消息块组件所需的可注入能力；由宿主绑定 IPC，组件库留空。 */
export interface ChatToolRenderCapabilities {
  /** 读本机附件（浏览器截图等）；缺注入时相应的预览不显示。 */
  readLocalAttachmentFile?: (
    request: LocalAttachmentReadRequest
  ) => Promise<Result<LocalAttachmentReadResult>>
  /** 异步操作完成/失败的全局提示；缺注入时静默（渲染增强，非必需）。 */
  showNotice?: (notice: ChatToolRenderNotice) => void
}

export const emptyChatToolRenderCapabilities: ChatToolRenderCapabilities = {}
