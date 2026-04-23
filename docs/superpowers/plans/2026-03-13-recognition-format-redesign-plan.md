# 识别格式重设计实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 BBox 命名、简化 Format API、优化 playground 参数控制

**Architecture:** 自底向上修改——先改类型定义和工具函数，再改 recognition 包，最后改 playground 消费端

**Tech Stack:** TypeScript, Vue 3, Vitest

---

## Task 1: 全项目 BBox 命名统一

**Files:**
- Modify: `shared/types/src/geometry.types.ts` — `BoundingBox` → `BBox`
- Modify: `shared/types/src/index.ts` — 导出名更新
- Modify: `shared/util/src/geometry.util.ts` — `computeBoundingBox` → `computeBBox`
- Modify: `shared/util/src/index.ts` — 导出名更新
- Modify: `shared/util/src/__tests__/geometry.util.spec.ts` — 测试用例更新
- Modify: `solutions/recognition/src/formats/simple-json.format.ts` — 引用更新
- Modify: `solutions/recognition/src/group-by-time.ts` — 引用更新
- Modify: `solutions/recognition/src/translate.ts` — 引用更新
- Modify: `solutions/recognition/src/types.ts` — 引用更新

**注意：** 此任务仅做重命名，不改逻辑。为了向后兼容，在旧名称位置添加 deprecated 导出别名（`export type BoundingBox = BBox` 和 `export const computeBoundingBox = computeBBox`）。

- [ ] **Step 1:** 修改 `shared/types/src/geometry.types.ts`，将 `BoundingBox` 接口重命名为 `BBox`
- [ ] **Step 2:** 修改 `shared/types/src/index.ts`，导出 `BBox`，同时保留 `BoundingBox` 作为别名导出
- [ ] **Step 3:** 修改 `shared/util/src/geometry.util.ts`，将 `computeBoundingBox` 函数重命名为 `computeBBox`，导入类型改为 `BBox`
- [ ] **Step 4:** 修改 `shared/util/src/index.ts`，导出 `computeBBox`，同时保留 `computeBoundingBox` 作为别名导出
- [ ] **Step 5:** 修改 `shared/util/src/__tests__/geometry.util.spec.ts`，更新测试中的函数名和 describe 名称
- [ ] **Step 6:** 运行测试验证

```bash
cd shared/util && pnpm test
```

- [ ] **Step 7:** 更新 recognition 包中的引用：`simple-json.format.ts`、`group-by-time.ts`、`translate.ts`、`types.ts` 中的 `BoundingBox` → `BBox`，`computeBoundingBox` → `computeBBox`
- [ ] **Step 8:** 运行 recognition 测试验证

```bash
cd solutions/recognition && pnpm test
```

- [ ] **Step 9:** 提交

```bash
git add -A && git commit -m "refactor: 全项目统一 BoundingBox 为 BBox 简写命名"
```

---

## Task 2: StrokeGroup 移除 boundingBox + translateToOrigin 重命名

**Files:**
- Modify: `solutions/recognition/src/types.ts` — 移除 `boundingBox` 字段，`boundingBox` 选项改为 `toBBoxOrigin`
- Modify: `solutions/recognition/src/group-by-time.ts` — 移除 `buildGroup` 中的 bbox 计算和 `computeBBox` 导入
- Modify: `solutions/recognition/src/translate.ts` — 函数重命名
- Modify: `solutions/recognition/src/index.ts` — 导出名更新
- Modify: `solutions/recognition/src/formats/simple-json.format.ts` — 选项名更新
- Modify: `solutions/recognition/src/__tests__/group-by-time.spec.ts` — 移除 bbox 相关测试断言
- Modify: `solutions/recognition/src/__tests__/translate.spec.ts` — 更新函数名
- Modify: `solutions/recognition/src/__tests__/simple-json.format.spec.ts` — 更新选项名

- [ ] **Step 1:** 修改 `types.ts`：
  - `StrokeGroup` 移除 `readonly boundingBox: BBox` 字段，移除 `BBox` 导入（如果不再需要）
  - `ExportFormatOptions` 的 `readonly boundingBox?: boolean` 改为 `readonly toBBoxOrigin?: boolean`

- [ ] **Step 2:** 修改 `group-by-time.ts`：
  - 移除 `import { computeBBox } from '@inker/util'`
  - `buildGroup` 函数中移除 `boundingBox: computeBBox(strokes)` 行

- [ ] **Step 3:** 修改 `translate.ts`：
  - 函数名 `translateToOrigin` → `translateToBBoxOrigin`
  - 注释同步更新

- [ ] **Step 4:** 修改 `index.ts`：
  - `export { translateToOrigin }` → `export { translateToBBoxOrigin }`

- [ ] **Step 5:** 修改 `formats/simple-json.format.ts`：
  - `options?.boundingBox` → `options?.toBBoxOrigin`
  - 变量名 `useBoundingBox` → `useToBBoxOrigin`（或简化为 `toBBoxOrigin`）

- [ ] **Step 6:** 更新测试文件：
  - `group-by-time.spec.ts`：移除 `boundingBox` 相关断言
  - `translate.spec.ts`：所有 `translateToOrigin` → `translateToBBoxOrigin`
  - `simple-json.format.spec.ts`：所有 `{ boundingBox: true }` → `{ toBBoxOrigin: true }`，所有 `result.boundingBox` → `result.boundingBox`（SimpleJsonResult 的字段名保持 `boundingBox` 因为它是输出数据中的字段名，不是选项名）

**注意：** `SimpleJsonResult` 接口中的 `boundingBox` 字段是输出数据结构的一部分（JSON 输出中叫 boundingBox），这个保持不变。只有 `ExportFormatOptions` 的选项名从 `boundingBox` 改为 `toBBoxOrigin`。

- [ ] **Step 7:** 运行所有 recognition 测试

```bash
cd solutions/recognition && pnpm test
```

- [ ] **Step 8:** 提交

```bash
git add -A && git commit -m "refactor(recognition): 移除 StrokeGroup.boundingBox，重命名 translateToOrigin 和格式选项"
```

---

## Task 3: Playground 参数控制简化

**Files:**
- Modify: `playground/app/src/scenes/recognition/useRecognitionEditor.ts` — 简化转换逻辑
- Modify: `playground/app/src/scenes/recognition/RecognitionScene.vue` — UI 调整
- Modify: `playground/app/src/scenes/recognition/RecognitionDataPanel.vue` — 适配 StrokeGroup 变化

- [ ] **Step 1:** 修改 `useRecognitionEditor.ts`：
  - 移除 `translateEnabled` ref
  - 移除 `includeBoundingBox` ref
  - 新增 `toBBoxOrigin = ref(true)` ref
  - 新增 `selectedFormat = ref('simple-json')` ref（当前唯一值）
  - 移除 `import { translateToOrigin }` — 不再手动调用
  - 移除 `mergeGroupBoundingBoxes` 函数
  - 简化 `updateJsonResult()`：直接调用 `format.convert(allStrokes, { toBBoxOrigin: toBBoxOrigin.value })`，将结果 JSON.stringify 为 jsonResult
  - 更新 imports：从 `@inker/recognition` 导入中移除 `translateToOrigin`
  - 更新暴露的接口：移除 `translateEnabled`、`includeBoundingBox`，新增 `toBBoxOrigin`、`selectedFormat`

- [ ] **Step 2:** 修改 `RecognitionScene.vue`：
  - 识别参数面板中：
    - 新增 format 下拉选择器（`<select v-model="selectedFormat"><option value="simple-json">Simple JSON</option></select>`）
    - 移除 "平移到原点" 开关
    - 将 "包含包围盒" 开关改为 "平移到包围盒原点"，`v-model="toBBoxOrigin"`
    - 更新 title tooltip 文案
  - 从 composable 解构中移除 `translateEnabled`、`includeBoundingBox`，新增 `toBBoxOrigin`、`selectedFormat`

- [ ] **Step 3:** 修改 `RecognitionDataPanel.vue`：
  - 分组卡片中移除 `group.boundingBox.width × group.boundingBox.height` 显示（因为 StrokeGroup 不再有 boundingBox 字段）
  - 改为使用 `computeBBox(group.strokes)` 按需计算，或直接移除 bbox 尺寸显示

- [ ] **Step 4:** 修改 `RecognitionScene.vue` 中高亮逻辑：
  - `highlightStyle` 计算中 `group.boundingBox` → 改为 `computeBBox(group.strokes)` 按需计算
  - 添加 `import { computeBBox } from '@inker/util'`

- [ ] **Step 5:** 启动 dev server 验证页面正常工作

```bash
pnpm dev
```

- [ ] **Step 6:** 提交

```bash
git add -A && git commit -m "refactor(playground): 简化识别参数控制，使用 format 内置 toBBoxOrigin 选项"
```

---

## Task 4: 文档更新

**Files:**
- Modify: `solutions/recognition/README.md`（如存在）
- Modify: `CLAUDE.md`（如有 recognition 相关描述需更新）

- [ ] **Step 1:** 检查并更新 recognition 包的 README（如存在），反映新的 API 命名
- [ ] **Step 2:** 检查 CLAUDE.md 是否需要更新
- [ ] **Step 3:** 提交

```bash
git add -A && git commit -m "docs: 更新文档反映 BBox 命名统一和格式选项重命名"
```
