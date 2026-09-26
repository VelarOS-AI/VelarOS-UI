/**
 * 产品面：本包交给外面的能力只有沙箱文档一件。它的 API 定义在类的上方（`impl/HtmlArtifactDocuments.ts`，接口紧挨着类），
 * 这里登记并转发；这里的每个接口都必须从根入口导出。
 */

// ── 类实现的产品面接口：定义在类上方，这里登记 ────────────────
export type { HtmlArtifactDocumentsApi } from '../impl/HtmlArtifactDocuments.js'
