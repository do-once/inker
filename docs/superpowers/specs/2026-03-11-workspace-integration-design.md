# 将 run-control/web-rig 和 scripts/copy-dist 纳入 pnpm workspaces

日期：2026-03-11

## 背景

项目从扁平结构调整为嵌套结构（参考 rushstack rig 模式），导致所有子包通过相对路径（`../../run-control/...`）引用共享配置的地方全部失效。根本原因是相对路径引用脆弱，目录调整即断裂。

## 决策

将 `run-control/*` 和 `scripts/*` 纳入 pnpm workspaces，消费方通过包名（`@aw/web-rig`、`@aw/copy-dist`）引用，消除相对路径依赖。

## 设计

### 1. Workspace 配置

pnpm-workspace.yaml 新增两个模式：

```yaml
packages:
  - 'run-control/*'
  - 'scripts/*'
```

### 2. web-rig 依赖统一

`@aw/web-rig` 的 `vite`、`vitest`、`typescript`、`happy-dom` 改用 `catalog:` 协议，与 monorepo 统一版本管理。其余依赖（`vite-plugin-dts`、`rollup-plugin-visualizer`、`vite-bundle-analyzer`、`@types/node`）保持固定版本。

### 3. 引用路径迁移

所有子包的引用从相对路径改为包名：

| 文件类型 | 变更前 | 变更后 |
|----------|--------|--------|
| tsconfig.json | `../../run-control/web-rig/library/tsconfig.lib.json` | `@aw/web-rig/library/tsconfig.lib.json` |
| vite.config.ts | `../../run-control/web-rig/library/vite.lib.config` | `@aw/web-rig/library/vite.lib.config` |
| vitest.config.ts | `../../run-control/web-rig/library/vitest.config.base` | `@aw/web-rig/library/vitest.config.base` |

保留 rushstack rig 的 `library/` profile 惯例。

### 4. 清理

- 删除 `run-control/web-rig/pnpm-lock.yaml`
- 删除 `scripts/copy-dist/pnpm-lock.yaml`
- 删除各自的独立 `node_modules/`
- 删除根 `package.json` 中的 `install:ci` 脚本

### 5. 不变项

- `postbuild` 调用方式保持 `node scripts/copy-dist`
- `web-rig` 内部目录结构不变
- 各子包自身配置内容不变

## 影响范围

约 15 个子包的 `tsconfig.json` + `vite.config.ts`，部分子包的 `vitest.config.ts`。
