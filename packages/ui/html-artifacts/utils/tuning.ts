/**
 * 包内可调参数：只放数字，每项一句说明。
 * 对外承诺的上限（尺寸缺省）不在这里，在 `contract/constants.ts`。
 */

/** 文档生成里的循环预算：改它不影响对外契约，只影响单次处理的深度。 */
export const HtmlArtifactTuning = Object.freeze({
  /** 源码归一化：最多剥几层外层包装（CDATA、Markdown 代码围栏），够用又不至于对着恶意输入空转。 */
  sourceUnwrapPasses: 3,
} as const)
