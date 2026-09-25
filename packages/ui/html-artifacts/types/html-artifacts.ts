/**
 * HTML 制品的可移植数据：沙箱文档、尺寸拟合、外链归一化这些能力的入参与出参。
 * 不引任何实现，也不带行为。
 */

/** 制品源码是普通 HTML 还是一整张 SVG；两者的 body 样式与适配方式不同。 */
export type HtmlArtifactContentKind = 'html' | 'svg'

/** 一套桥接消息名：同页多个制品各用一套，互不串台。 */
export interface HtmlArtifactBridgeMessages {
  /** 宿主 → iframe：整份 HTML 渲染。 */
  render: string
  /** iframe → 宿主：上报测量出来的内容尺寸。 */
  resize: string
  /** iframe → 宿主：制品里调用 `sendPrompt()`。 */
  sendPrompt: string
  /** iframe → 宿主：制品里调用 `openLink()`。 */
  openLink: string
  /** iframe → 宿主：制品经 `artifactBridge.send()` 发来的自定义载荷。 */
  generic: string
  /** iframe → 宿主：沙箱里的脚本出错。 */
  error: string
}

/** 造一份静态制品文档（内容已经齐了）时可以给的东西。 */
export interface HtmlArtifactDocumentOptions {
  /** 内容按 HTML 还是 SVG 处理；不写就自动判。 */
  contentKind?: HtmlArtifactContentKind
  /** 产品中立的设计 CSS，插在制品自己的样式之前。 */
  designCss?: string
  /** SVG 内容的适配 CSS，只在 SVG 档生效。 */
  svgFitCss?: string
  /** 覆盖 body 的内联样式；不写按内容类型给一份缺省。 */
  bodyStyle?: string
  /** 覆盖桥接消息名；不写的那几个用常量表里的缺省值。 */
  bridgeMessages?: Partial<HtmlArtifactBridgeMessages>
  /** iframe 运行时向宿主申请的最大高度（像素）；再高的内容留在沙箱里滚。 */
  maxReportedHeight?: number
  /** iframe 运行时能申请的最大内容宽度，按宿主宽度的倍数。 */
  maxWidthRatio?: number
}

/** 造一份外壳文档（内容随后经消息桥送进去）时可以给的东西。 */
export interface HtmlArtifactShellDocumentOptions extends HtmlArtifactDocumentOptions {
  /** 承载制品的根元素 id；不写用常量表里的缺省值。 */
  rootId?: string
}

/** 宿主侧算出来的一次 frame 适配结果。 */
export interface HtmlArtifactFrameFit {
  /** 内容自己的高度（像素）。 */
  contentHeight: number
  /** 内容自己的宽度（像素）。 */
  contentWidth: number
  /** 是不是已经按真实测量锁定；没测出来时按兜底尺寸走。 */
  locked: boolean
  /** 宿主要施加的缩放比例，1 表示不缩放。 */
  scale: number
  /** 缩放之后 frame 占的高度（像素）。 */
  viewportHeight: number
  /** 缩放之后 frame 占的宽度（像素）。 */
  viewportWidth: number
}

/** 算一次 frame 适配要给的测量值。 */
export interface HtmlArtifactFrameFitInput {
  /** 还没测出来时用的高度（像素）。 */
  fallbackHeight: number
  /** 宿主留给 frame 的最大宽度（像素）。 */
  maxViewportWidth?: LooseOptional<number>
  /** iframe 上报的内容自然高度（像素）。 */
  naturalHeight?: LooseOptional<number>
  /** iframe 上报的内容自然宽度（像素）。 */
  naturalWidth?: LooseOptional<number>
  /** 内容没它宽时，要不要把 frame 铺满宿主宽度。 */
  preferViewportWidth?: boolean
}

/** 归一化一个外链时可以给的东西。 */
export interface NormalizeHtmlArtifactExternalUrlOptions {
  /** 放行哪些协议；不写用常量表里的 `http:` 与 `https:`。 */
  allowedProtocols?: readonly string[]
}
