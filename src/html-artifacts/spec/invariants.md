# HTML 制品不变量登记

每一条都是本模块对外的承诺。改动或删除任何一条，都要在差量报告里点名并说明原来的承诺为什么不对；新增一条同样要点名。
检验方式与 `packages/agent/spec/invariants.md` 相同：测试 / 类型 / 门禁 / 运行时 / 文字，`check:module-ownership` 核对每一行的检验器是否存在。

编号只增不重排。2026-09-26 流式 HTML 渲染下线，增量协议与浏览器宿主 `mountHtmlArtifact` 随之删掉，五条退役、编号不复用：
INV-1（流可以在任意字符处切开）、INV-4（协议资源上限）、INV-7（解析状态是纯数据）随增量协议退役；
INV-2（iframe 固定 `allow-scripts`、非法外链到不了 `onLink`）、INV-3（上报高度在 iframe 内外两侧按 `maxHeight` 封顶）随浏览器宿主退役——
iframe 与消息桥改由自己托管 iframe 的宿主负责；外链白名单仍由沙箱文档承诺，改登记为 INV-8，iframe 内侧的高度上限由 INV-5 覆盖。
INV-6 的措辞跟着改：对外只剩沙箱文档一件能力。

| 编号 | 不变量 | 检验方式 | 检验器 |
| --- | --- | --- | --- |
| INV-5 | 注入 iframe 的脚本不另抄常量：缺省高度上限与宽度倍数上限就是 `HtmlArtifactDefaults` 里那两个数字，改常量表脚本跟着变 | 测试 | `spec/acceptance.test.ts` |
| INV-6 | 两个入口整条引用链不碰 Node 内置模块，浏览器扩展与渲染进程都能直接加载；类与工具函数不出包，外面只拿得到沙箱文档能力的实例与常量表 | 门禁 | `check:module-ownership` |
| INV-8 | 外链只放行 `http:` / `https:`：`htmlArtifactDocuments.normalizeExternalUrl` 对主动执行型 URL（`javascript:` 一类）、相对地址、空串一律给 null，宿主据此拒绝跳转 | 测试 | `spec/acceptance.test.ts` |
