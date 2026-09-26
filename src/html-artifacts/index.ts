/**
 * 根入口（`@velaros-ai/ui/html-artifacts`）：沙箱文档这一件能力，外加它用到的数据。
 * 整条引用链不碰 Node 模块，渲染进程与浏览器扩展都能加载。
 * 另一个入口 `./contracts` 是它的子集，只有可移植数据。
 */

// ── 子集入口 ────────────────────────────────────────────────────
export * from './contracts.js'

// ── 产品面：沙箱文档 ────────────────────────────────────────────
export type { HtmlArtifactDocumentsApi } from './impl/HtmlArtifactDocuments.js'
export { htmlArtifactDocuments } from './impl/HtmlArtifactDocuments.js'
