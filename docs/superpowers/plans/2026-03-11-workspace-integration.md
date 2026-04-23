# Workspace 整合实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `run-control/web-rig` 和 `scripts/copy-dist` 纳入 pnpm workspaces，消除相对路径引用。

**Architecture:** 修改 pnpm-workspace.yaml 新增两个 workspace 模式，将 web-rig 依赖统一到 catalog，然后批量替换所有子包的相对路径引用为包名引用 `@aw/web-rig/library/...`。

**Tech Stack:** pnpm workspaces, catalog protocol

**设计文档:** `docs/superpowers/specs/2026-03-11-workspace-integration-design.md`

---

## Task 1: Workspace 配置与清理

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `run-control/web-rig/package.json`
- Modify: `package.json`（根目录）
- Delete: `run-control/web-rig/pnpm-lock.yaml`
- Delete: `scripts/copy-dist/pnpm-lock.yaml`

- [ ] **Step 1: 修改 pnpm-workspace.yaml**

在 packages 列表末尾新增两行：

```yaml
  - 'run-control/*'
  - 'scripts/*'
```

- [ ] **Step 2: 修改 web-rig 的 package.json，依赖改用 catalog**

将 devDependencies 中的固定版本替换为 `catalog:` 协议：

```json
{
  "devDependencies": {
    "@types/node": "22.13.10",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vite-plugin-dts": "4.5.3",
    "vite-bundle-analyzer": "0.18.1",
    "rollup-plugin-visualizer": "5.14.0",
    "vitest": "catalog:",
    "happy-dom": "catalog:"
  }
}
```

- [ ] **Step 3: 删除根 package.json 中的 install:ci 脚本**

删除这一行：
```json
"install:ci": "pnpm i && cd ./scripts/copy-dist && pnpm i --ignore-workspace && cd ../../run-control/web-rig && pnpm i --ignore-workspace"
```

- [ ] **Step 4: 删除独立 lock 文件**

```bash
rm run-control/web-rig/pnpm-lock.yaml
rm scripts/copy-dist/pnpm-lock.yaml
```

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "chore: 将 run-control 和 scripts 纳入 pnpm workspaces"
```

---

## Task 2: 迁移 shared/* 引用（3 个包）

**Files:**
- Modify: `shared/types/tsconfig.json`
- Modify: `shared/types/vite.config.ts`
- Modify: `shared/di/tsconfig.json`
- Modify: `shared/di/vite.config.ts`
- Modify: `shared/di/vitest.config.ts`
- Modify: `shared/util/tsconfig.json`
- Modify: `shared/util/vite.config.ts`
- Modify: `shared/util/vitest.config.ts`

**替换规则（全部包通用）：**

| 文件 | 旧值 | 新值 |
|------|------|------|
| tsconfig.json | `../../run-control/tsconfig.lib.json` | `@aw/web-rig/library/tsconfig.lib.json` |
| vite.config.ts | `../../run-control/vite.lib.config` | `@aw/web-rig/library/vite.lib.config` |
| vitest.config.ts | `../../run-control/vitest.config.base` | `@aw/web-rig/library/vitest.config.base` |

- [ ] **Step 1: 替换 shared/types 的 tsconfig.json 和 vite.config.ts**
- [ ] **Step 2: 替换 shared/di 的 tsconfig.json、vite.config.ts、vitest.config.ts**
- [ ] **Step 3: 替换 shared/util 的 tsconfig.json、vite.config.ts、vitest.config.ts**
- [ ] **Step 4: 提交**

```bash
git add shared/ && git commit -m "refactor: shared/* 引用迁移到 @aw/web-rig 包名"
```

---

## Task 3: 迁移 libraries/* 引用（12 个包）

**Files:** libraries 下所有子包的 tsconfig.json、vite.config.ts、vitest.config.ts

**替换规则同 Task 2。**

涉及子包：`core`、`model`、`brush-freehand`、`input-pointer`、`render-canvas`、`render-svg`、`render-offscreen`、`render-protocol`、`playback`、`sdk`、`compute-worker`

- [ ] **Step 1: 批量替换所有 libraries/*/tsconfig.json**

每个文件将 `"extends": "../../run-control/tsconfig.lib.json"` 替换为 `"extends": "@aw/web-rig/library/tsconfig.lib.json"`

- [ ] **Step 2: 批量替换所有 libraries/*/vite.config.ts**

每个文件将 `from '../../run-control/vite.lib.config'` 替换为 `from '@aw/web-rig/library/vite.lib.config'`

- [ ] **Step 3: 批量替换所有 libraries/*/vitest.config.ts**

每个文件将 `from '../../run-control/vitest.config.base'` 替换为 `from '@aw/web-rig/library/vitest.config.base'`

- [ ] **Step 4: 提交**

```bash
git add libraries/ && git commit -m "refactor: libraries/* 引用迁移到 @aw/web-rig 包名"
```

---

## Task 4: 迁移 third-parties/* 和 playground/* 引用

**Files:**
- Modify: `third-parties/freehand/tsconfig.json`
- Modify: `third-parties/freehand/vite.config.ts`
- Modify: `third-parties/freehand/vitest.config.ts`
- Modify: `playground/app/tsconfig.json`

- [ ] **Step 1: 替换 third-parties/freehand 的三个配置文件**

替换规则同 Task 2。

- [ ] **Step 2: 替换 playground/app/tsconfig.json**

注意此包引用的是 `tsconfig.base.json`（非 lib）：

```diff
- "extends": "../../run-control/tsconfig.base.json"
+ "extends": "@aw/web-rig/library/tsconfig.base.json"
```

- [ ] **Step 3: 提交**

```bash
git add third-parties/ playground/ && git commit -m "refactor: third-parties 和 playground 引用迁移到 @aw/web-rig 包名"
```

---

## Task 5: 安装与验证

- [ ] **Step 1: 执行 pnpm install**

```bash
pnpm install
```

预期：成功，无报错。`@aw/web-rig` 和 `@aw/copy-dist` 出现在 workspace 包列表中。

- [ ] **Step 2: 执行 pnpm build**

```bash
pnpm build
```

预期：所有子包构建成功。

- [ ] **Step 3: 提交 lockfile 变更**

```bash
git add pnpm-lock.yaml && git commit -m "chore: 更新 lockfile"
```

---

## 并行策略

- Task 1 必须先完成（workspace 配置是前置条件）
- Task 2、3、4 互相独立，可并行执行
- Task 5 必须在 2-4 全部完成后执行
