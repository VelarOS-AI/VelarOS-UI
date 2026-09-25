/**
 * 常量表：沙箱外壳的约定值。
 * 不 import 任何东西，浏览器、渲染进程、扩展都能用（从 `@velaros-ai/ui/html-artifacts/contracts` 取）。
 * 同一个数字只在这里写一次：注入 iframe 的脚本与宿主侧的钳制都引这里，改一处两处跟着变。
 */

/** 尺寸与根元素的缺省值：iframe 内的注入脚本和宿主侧的 frame 适配共用同一组数字。 */
export const HtmlArtifactDefaults = Object.freeze({
  /** iframe 允许向宿主申请的最大高度（像素）；再高的内容留在沙箱里滚。 */
  maxReportedHeight: 1200,
  /** iframe 允许申请的最大内容宽度，按宿主宽度的倍数；更宽的由宿主缩放。 */
  maxWidthRatio: 3,
  /** 宿主侧缩放的硬边界，按宿主宽度的倍数；超过它就停止缩放，免得正文被压成细条。 */
  hostMaxScaleDownWidthRatio: 4,
  /** 外壳文档里承载制品的根元素 id。 */
  rootId: 'velaros-html-artifact-root',
} as const)

/** 宿主与 iframe 之间的消息名：滚轮转发是固定的，其余六个是缺省值，宿主可以改。 */
export const HtmlArtifactBridgeMessageTypes = Object.freeze({
  /** iframe 自己滚不动时，请宿主代滚这一次滚轮手势。这个名字不随实例变，宿主要能认出任何一个制品发来的它。 */
  wheel: 'velaros:html-artifact-wheel',
  /** 六个桥接消息的缺省名；宿主造文档时可以经 `bridgeMessages` 换成自己的一套。 */
  defaults: Object.freeze({
    /** 宿主 → iframe：整份 HTML 渲染。 */
    render: 'velaros-html-artifact-render',
    /** iframe → 宿主：上报测量出来的内容尺寸。 */
    resize: 'velaros-html-artifact-resize',
    /** iframe → 宿主：制品里调用 `sendPrompt()` 继续提问。 */
    sendPrompt: 'velaros-html-artifact-send-prompt',
    /** iframe → 宿主：制品里调用 `openLink()` 打开外链。 */
    openLink: 'velaros-html-artifact-open-link',
    /** iframe → 宿主：制品经 `artifactBridge.send()` 发来的自定义载荷。 */
    generic: 'velaros-html-artifact-message',
    /** iframe → 宿主：沙箱里的脚本出错。 */
    error: 'velaros-html-artifact-error',
  } as const),
} as const)

/** 外链缺省只放行这两种协议；`javascript:` 一类主动执行型 URL 永远到不了宿主。 */
export const HtmlArtifactExternalUrlProtocols = Object.freeze(['http:', 'https:'] as const)
