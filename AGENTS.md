# UI 仓库

仓根就是 `@velaros-ai/ui` 包：源码在 `src/`（HTML 工件单元在 `src/html-artifacts/`，验收与测试跟着单元走），行为测试在 `test/`，组件图鉴在 `component-library/`。消费方只经 `package.json#exports` 读 `dist/`。

每轮结束运行 `bun run check:module-ownership`。保留组件行为测试、HTML 工件验收测试和 UI 质量门。临时 tarball 核验使用 `bun run check:package-pack`，打包流程复用 `scripts/release/safe-package-pack.mjs`。
