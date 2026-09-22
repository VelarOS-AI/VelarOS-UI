# UI 仓库

每轮结束运行 `bun run check:module-ownership`。保留组件行为测试、HTML 工件验收测试和 UI 质量门。临时 tarball 核验使用 `bun run check:package-pack -- ui`，打包流程复用 `scripts/release/safe-package-pack.mjs`。
