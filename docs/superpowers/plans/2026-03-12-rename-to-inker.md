# AnimalWriting → Inker 重命名实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目从 AnimalWriting 重命名为 Inker，包括包 scope `@aw/` → `@inker/`、类名、文件名、文档。

**Architecture:** 纯机械性文本替换 + 文件重命名。无逻辑变更。按目录分组并行执行，避免文件冲突。

**Tech Stack:** bash (sed/mv), pnpm

---

## 不改什么

- `docs/superpowers/` 下所有 spec 和 plan 文件（历史记录）
- `CHANGELOG.md`（历史记录）
- `pnpm-lock.yaml`（最后重新生成）

---

## Task 1: shared/ + third-parties/ + run-control/ + scripts/

**负责范围：** `shared/`、`third-parties/`、`run-control/`、`scripts/` 下的所有文件

**Files:**
- Modify: `shared/types/package.json` — name `@aw/types` → `@inker/types`
- Modify: `shared/di/package.json` — name `@aw/di` → `@inker/di`
- Modify: `shared/util/package.json` — name `@aw/util` → `@inker/util`
- Modify: `third-parties/freehand/package.json` — name `@aw/freehand` → `@inker/freehand`
- Modify: `run-control/web-rig/package.json` — name `@aw/web-rig` → `@inker/web-rig`
- Modify: `scripts/copy-dist/package.json` — dependencies 中 @aw/ → @inker/
- Modify: 所有 `tsconfig.json`、`vite.config.ts`、`vitest.config.ts` — `@aw/` → `@inker/`
- Modify: 所有 `src/**/*.ts` — import 路径 `@aw/` → `@inker/`
- Modify: 所有 `README.md` — `@aw/` → `@inker/`，AnimalWriting → Inker

- [ ] **Step 1: 替换所有 package.json 中的包名和依赖**

在 `shared/types/package.json`、`shared/di/package.json`、`shared/util/package.json`、`third-parties/freehand/package.json`、`run-control/web-rig/package.json`、`scripts/copy-dist/package.json` 中：
- `"name": "@aw/xxx"` → `"name": "@inker/xxx"`
- 所有 `"@aw/` 依赖引用 → `"@inker/`

- [ ] **Step 2: 替换所有 .ts 源码文件中的 `@aw/` import**

在 `shared/`、`third-parties/`、`run-control/` 目录下所有 `.ts` 文件中：
- `from '@aw/` → `from '@inker/`
- `import('@aw/` → `import('@inker/`

- [ ] **Step 3: 替换 tsconfig.json 和 vite.config.ts 中的 `@aw/` 路径映射**

- `"@aw/` → `"@inker/`

- [ ] **Step 4: 更新 README.md 文档**

在 `shared/README.md`、`shared/types/README.md`、`shared/util/README.md`、`shared/di/README.md`、`third-parties/README.md`、`third-parties/freehand/README.md`、`run-control/web-rig/README.md` 中：
- `@aw/` → `@inker/`
- `AnimalWriting` → `Inker`

- [ ] **Step 5: 自检**

在 `shared/`、`third-parties/`、`run-control/`、`scripts/` 范围内搜索确认无残留 `@aw/` 或 `AnimalWriting`。

---

## Task 2: libraries/（除 sdk 外）

**负责范围：** `libraries/core`、`libraries/model`、`libraries/input-pointer`、`libraries/brush-freehand`、`libraries/render-canvas`、`libraries/render-offscreen`、`libraries/render-protocol`、`libraries/render-svg`、`libraries/playback`、`libraries/compute-worker`、`libraries/README.md`

**Files:**
- Modify: 每个子包的 `package.json` — name 和 dependencies 中 `@aw/` → `@inker/`
- Modify: 每个子包的 `tsconfig.json`、`vite.config.ts`、`vitest.config.ts` — `@aw/` → `@inker/`
- Modify: 每个子包的 `src/**/*.ts` — import `@aw/` → `@inker/`
- Modify: 每个子包的 `README.md` — `@aw/` → `@inker/`，AnimalWriting → Inker
- Modify: `libraries/README.md` — `@aw/` → `@inker/`，AnimalWriting → Inker

- [ ] **Step 1: 替换所有 package.json 中的包名和依赖**

对以下包的 package.json 做替换（共 10 个文件）：
core, model, input-pointer, brush-freehand, render-canvas, render-offscreen, render-protocol, render-svg, playback, compute-worker

- `"name": "@aw/xxx"` → `"name": "@inker/xxx"`
- 所有 `"@aw/` 依赖引用 → `"@inker/`

- [ ] **Step 2: 替换所有 .ts 源码和测试文件中的 `@aw/` import**

在 `libraries/`（排除 `libraries/sdk/`）所有 `.ts` 文件中：
- `from '@aw/` → `from '@inker/`
- `import('@aw/` → `import('@inker/`

- [ ] **Step 3: 替换 tsconfig.json 和 vite.config.ts 中的路径映射**

- `@aw/` → `@inker/`

- [ ] **Step 4: 更新 README.md 文档**

- `@aw/` → `@inker/`
- `AnimalWriting` → `Inker`

- [ ] **Step 5: 自检**

在 `libraries/`（排除 `libraries/sdk/`）范围内搜索确认无残留。

---

## Task 3: libraries/sdk/（含 facade 重命名）

**负责范围：** `libraries/sdk/` 下所有文件

**Files:**
- Modify: `libraries/sdk/package.json` — name `@aw/sdk` → `@inker/sdk`，dependencies
- Modify: `libraries/sdk/tsconfig.json`、`vite.config.ts`、`vitest.config.ts` — `@aw/` → `@inker/`
- Rename: `libraries/sdk/src/animal-writing.facade.ts` → `libraries/sdk/src/inker.facade.ts`
- Rename: `libraries/sdk/src/__tests__/animal-writing.facade.spec.ts` → `libraries/sdk/src/__tests__/inker.facade.spec.ts`
- Modify: 所有 .ts — 类名 `AnimalWriting` → `Inker`，import 路径 `./animal-writing.facade` → `./inker.facade`
- Modify: `libraries/sdk/README.md` — `@aw/` → `@inker/`，AnimalWriting → Inker
- Modify: `libraries/sdk/CHANGELOG.md` — **不改**（历史记录）

- [ ] **Step 1: 重命名 facade 文件**

```bash
mv libraries/sdk/src/animal-writing.facade.ts libraries/sdk/src/inker.facade.ts
mv libraries/sdk/src/__tests__/animal-writing.facade.spec.ts libraries/sdk/src/__tests__/inker.facade.spec.ts
```

- [ ] **Step 2: 替换 package.json 中的包名和依赖**

- `"name": "@aw/sdk"` → `"name": "@inker/sdk"`
- 所有 `"@aw/` → `"@inker/`

- [ ] **Step 3: 替换所有 .ts 文件中的 import 路径和类名**

在 `libraries/sdk/src/` 所有 `.ts` 文件中：
- `from '@aw/` → `from '@inker/`
- `from './animal-writing.facade'` → `from './inker.facade'`
- `from '../animal-writing.facade'` → `from '../inker.facade'`
- 类名 `AnimalWriting` → `Inker`（包括注释中的）

受影响文件：
- `inker.facade.ts`（重命名后）
- `index.ts`
- `editor.builder.ts`
- `__tests__/inker.facade.spec.ts`（重命名后）
- `__tests__/editor.builder.spec.ts`
- `__tests__/setup.ts`

- [ ] **Step 4: 替换 tsconfig.json 和 vite.config.ts 中的路径映射**

- `@aw/` → `@inker/`

- [ ] **Step 5: 更新 README.md**

- `@aw/` → `@inker/`，AnimalWriting → Inker

- [ ] **Step 6: 自检**

在 `libraries/sdk/` 范围内搜索确认无残留 `@aw/` 或 `AnimalWriting`（CHANGELOG.md 除外）。

---

## Task 4: 根目录 + playground/ + 配置文件

**负责范围：** 根目录文件、`playground/`、`CLAUDE.md`、`.claude/rules/`

**Files:**
- Modify: `package.json` — `"name": "animal-writing"` → `"name": "inker"`
- Modify: `README.md` — 全文更新（标题、@aw/ → @inker/、AnimalWriting → Inker、目录结构中的 animal-writing/ → inker/）
- Modify: `CLAUDE.md` — 全文更新（项目名、@aw/ → @inker/、AnimalWriting → Inker）
- Modify: `.claude/rules/project-specifics.md` — `@aw/` → `@inker/`
- Modify: `playground/app/package.json` — dependencies `@aw/` → `@inker/`
- Modify: `playground/app/tsconfig.json` — `@aw/` → `@inker/`
- Modify: `playground/app/index.html` — title AnimalWriting → Inker
- Modify: `playground/app/src/App.vue` — AnimalWriting → Inker
- Modify: `playground/app/src/composables/useEditor.ts` — `@aw/sdk` → `@inker/sdk`，`AnimalWriting` → `Inker`
- Modify: `playground/app/src/components/FreehandPanel.vue` — `@aw/` → `@inker/`
- Modify: `playground/app/README.md` — AnimalWriting → Inker

- [ ] **Step 1: 根 package.json**

`"name": "animal-writing"` → `"name": "inker"`

- [ ] **Step 2: 根 README.md**

- 标题 `# AnimalWriting` → `# Inker`
- 所有 `@aw/` → `@inker/`
- 所有 `AnimalWriting` → `Inker`
- 目录结构中 `animal-writing/` → `inker/`

- [ ] **Step 3: CLAUDE.md**

- 项目名 `AnimalWriting` → `Inker`
- 所有 `@aw/` → `@inker/`
- `AnimalWriting.es.js` / `AnimalWriting.umd.js` → 更新为实际产物名（由 vite 自动派生）
- `EditorFacade.js` 相关描述更新

- [ ] **Step 4: .claude/rules/project-specifics.md**

- `@aw/` → `@inker/`

- [ ] **Step 5: playground/ 所有文件**

- `playground/app/package.json` — `@aw/` → `@inker/`
- `playground/app/tsconfig.json` — `@aw/` → `@inker/`
- `playground/app/index.html` — `<title>AnimalWriting Playground</title>` → `<title>Inker Playground</title>`
- `playground/app/src/App.vue` — `AnimalWriting Playground` → `Inker Playground`
- `playground/app/src/composables/useEditor.ts` — `@aw/sdk` → `@inker/sdk`，`AnimalWriting` → `Inker`
- `playground/app/src/components/FreehandPanel.vue` — `@aw/` → `@inker/`
- `playground/app/README.md` — `AnimalWriting` → `Inker`，`@aw/` → `@inker/`

- [ ] **Step 6: 自检**

在根目录文件和 `playground/` 范围内搜索确认无残留（docs/superpowers/ 和 CHANGELOG.md 除外）。

---

## Task 5: 验证

**前置：** Task 1-4 全部完成

- [ ] **Step 1: 删除 pnpm-lock.yaml 并重新安装**

```bash
rm pnpm-lock.yaml
pnpm install
```

- [ ] **Step 2: 全量构建**

```bash
pnpm build
```

预期：构建成功，产物名称为 `InkerSdk.umd.js` 等。

- [ ] **Step 3: 全量测试**

```bash
pnpm test
```

预期：所有测试通过。

- [ ] **Step 4: 类型检查**

```bash
pnpm typecheck
```

预期：无类型错误。

- [ ] **Step 5: 全局残留检查**

在全仓库搜索 `@aw/` 和 `AnimalWriting`，确认仅出现在：
- `docs/superpowers/` 下的历史文档
- `CHANGELOG.md`
- `pnpm-lock.yaml`（内部引用）

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "refactor: 项目重命名 AnimalWriting → Inker，包 scope @aw/ → @inker/"
```
