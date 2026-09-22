# VelarOS UI

共享 React UI 的独立仓库，维护 `@velaros-ai/ui`：基础组件、设计令牌、会话 UI、HTML 工件，以及 `component-library` 展示站。

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run build:component-library
```

`packages/ui` 是发布包，`component-library` 是示例与文档；`tests/ui`、`scripts/ui`、`baselines/ui` 维护行为、发布契约和质量门。包名与公开入口保持一致，消费者按发布版本更新。

临时打包使用 `bun run check:package-pack -- ui`，所有 tarball 流程复用 `scripts/release/safe-package-pack.mjs`。
