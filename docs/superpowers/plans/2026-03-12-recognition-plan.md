# @inker/recognition 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 `@inker/recognition` 包，为手写识别算法提供笔画数据准备工具（分组、坐标变换、格式导出）和事件驱动 helper。

**Architecture:** 新增 `solutions/` 顶层目录，放置 `@inker/recognition` 包。前置依赖包括在 `@inker/types` 添加 `BoundingBox` 类型、在 `@inker/util` 添加 `computeBoundingBox` 函数、在 `EditorKernel` 补上 `stroke:end` 事件 emit。recognition 包提供纯工具函数 + `RecognitionHelper` 事件驱动类。

**Tech Stack:** TypeScript, Vitest, pnpm workspace

**Spec:** `docs/superpowers/specs/2026-03-12-recognition-data-design.md`

---

## 文件结构

### 修改的文件

| 文件 | 职责 |
|---|---|
| `pnpm-workspace.yaml` | 添加 `solutions/*` 到 workspace |
| `shared/types/src/geometry.types.ts` | 添加 `BoundingBox` 接口 |
| `shared/types/src/index.ts` | 导出 `BoundingBox` |
| `shared/util/src/geometry.util.ts` | 添加 `computeBoundingBox` 函数 |
| `shared/util/src/index.ts` | 导出 `computeBoundingBox` |
| `libraries/core/src/editor-kernel.service.ts` | 在 `endStroke` 中 emit `stroke:end` 事件 |

### 新建的文件

| 文件 | 职责 |
|---|---|
| `solutions/recognition/package.json` | 包配置 |
| `solutions/recognition/tsconfig.json` | TypeScript 配置 |
| `solutions/recognition/vitest.config.ts` | 测试配置 |
| `solutions/recognition/src/index.ts` | 公共导出 |
| `solutions/recognition/src/types.ts` | StrokeGroup、ExportFormat、RecognitionTarget 等类型 |
| `solutions/recognition/src/group-by-time.ts` | 时间间隔分组函数 |
| `solutions/recognition/src/translate.ts` | 坐标平移函数 |
| `solutions/recognition/src/formats/simple-json.format.ts` | SimpleJsonFormat 实现 |
| `solutions/recognition/src/recognition-helper.ts` | RecognitionHelper 事件驱动类 |
| `solutions/recognition/src/__tests__/group-by-time.spec.ts` | 分组函数测试 |
| `solutions/recognition/src/__tests__/translate.spec.ts` | 坐标平移测试 |
| `solutions/recognition/src/__tests__/simple-json.format.spec.ts` | SimpleJsonFormat 测试 |
| `solutions/recognition/src/__tests__/recognition-helper.spec.ts` | RecognitionHelper 测试 |
| `shared/util/src/__tests__/geometry.util.spec.ts` | 添加 computeBoundingBox 测试用例 |
| `libraries/core/src/__tests__/editor-kernel.service.spec.ts` | 添加 stroke:end 事件测试用例 |
| `solutions/README.md` | solutions 目录说明 |

---

## Chunk 1: 前置依赖 — BoundingBox 类型 + computeBoundingBox 函数

### Task 1: BoundingBox 类型添加到 @inker/types

**Files:**
- Modify: `shared/types/src/geometry.types.ts`
- Modify: `shared/types/src/index.ts`

- [ ] **Step 1: 在 geometry.types.ts 中添加 BoundingBox 接口**

在 `Size` 接口之后添加：

```ts
/** 最小包围盒 */
export interface BoundingBox {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
  readonly width: number
  readonly height: number
}
```

- [ ] **Step 2: 在 index.ts 中导出 BoundingBox**

将第 4 行：
```ts
export type { Point, Rect, Size } from './geometry.types'
```
改为：
```ts
export type { Point, Rect, Size, BoundingBox } from './geometry.types'
```

- [ ] **Step 3: 类型检查**

Run: `cd shared/types && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add shared/types/src/geometry.types.ts shared/types/src/index.ts
git commit -m "feat(types): 添加 BoundingBox 接口"
```

### Task 2: computeBoundingBox 函数添加到 @inker/util

**Files:**
- Modify: `shared/util/src/__tests__/geometry.util.spec.ts`
- Modify: `shared/util/src/geometry.util.ts`
- Modify: `shared/util/src/index.ts`

- [ ] **Step 1: 写失败测试**

在 `shared/util/src/__tests__/geometry.util.spec.ts` 文件末尾（`})` 之前）添加新的 describe 块：

```ts
import { computeBoundingBox } from '../geometry.util'

// ... 在文件顶部的 import 行中添加 computeBoundingBox

describe('computeBoundingBox', () => {
  it('计算单个笔画的包围盒', () => {
    const strokes = [{
      id: 's1',
      points: [
        { x: 10, y: 20, t: 0, p: 0.5 },
        { x: 30, y: 40, t: 1, p: 0.5 },
        { x: 20, y: 10, t: 2, p: 0.5 }
      ],
      style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
      createdAt: 0
    }]
    const bbox = computeBoundingBox(strokes)
    expect(bbox.minX).toBe(10)
    expect(bbox.minY).toBe(10)
    expect(bbox.maxX).toBe(30)
    expect(bbox.maxY).toBe(40)
    expect(bbox.width).toBe(20)
    expect(bbox.height).toBe(30)
  })

  it('计算多个笔画的联合包围盒', () => {
    const strokes = [
      {
        id: 's1',
        points: [{ x: 0, y: 0, t: 0, p: 0.5 }, { x: 10, y: 10, t: 1, p: 0.5 }],
        style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
        createdAt: 0
      },
      {
        id: 's2',
        points: [{ x: 50, y: 50, t: 2, p: 0.5 }, { x: 100, y: 80, t: 3, p: 0.5 }],
        style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
        createdAt: 1
      }
    ]
    const bbox = computeBoundingBox(strokes)
    expect(bbox.minX).toBe(0)
    expect(bbox.minY).toBe(0)
    expect(bbox.maxX).toBe(100)
    expect(bbox.maxY).toBe(80)
    expect(bbox.width).toBe(100)
    expect(bbox.height).toBe(80)
  })

  it('空笔画数组返回零包围盒', () => {
    const bbox = computeBoundingBox([])
    expect(bbox.minX).toBe(0)
    expect(bbox.minY).toBe(0)
    expect(bbox.maxX).toBe(0)
    expect(bbox.maxY).toBe(0)
    expect(bbox.width).toBe(0)
    expect(bbox.height).toBe(0)
  })

  it('单个点的包围盒 width/height 为 0', () => {
    const strokes = [{
      id: 's1',
      points: [{ x: 42, y: 24, t: 0, p: 0.5 }],
      style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
      createdAt: 0
    }]
    const bbox = computeBoundingBox(strokes)
    expect(bbox.minX).toBe(42)
    expect(bbox.minY).toBe(24)
    expect(bbox.width).toBe(0)
    expect(bbox.height).toBe(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd shared/util && pnpm test`
Expected: FAIL — `computeBoundingBox` is not exported

- [ ] **Step 3: 实现 computeBoundingBox**

在 `shared/util/src/geometry.util.ts` 中添加：

```ts
import type { Point, Size, BoundingBox } from '@inker/types'
// 注意：需要更新顶部 import，添加 BoundingBox

import type { Stroke } from '@inker/types'
// 注意：也需要导入 Stroke

/**
 * 计算一组笔画的最小包围盒
 * @param strokes 笔画数组
 * @returns 最小包围盒（世界坐标像素）
 */
export function computeBoundingBox(strokes: readonly Stroke[]): BoundingBox {
  if (strokes.length === 0 || strokes.every(s => s.points.length === 0)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      if (point.x < minX) minX = point.x
      if (point.y < minY) minY = point.y
      if (point.x > maxX) maxX = point.x
      if (point.y > maxY) maxY = point.y
    }
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}
```

实际修改：将文件顶部的 `import type { Point, Size } from '@inker/types'` 改为 `import type { Point, Size, BoundingBox, Stroke } from '@inker/types'`，然后在文件末尾追加上述函数。

- [ ] **Step 4: 在 index.ts 中导出**

将 `shared/util/src/index.ts` 第 7 行：
```ts
export { distance, toNormalized, fromNormalized } from './geometry.util'
```
改为：
```ts
export { distance, toNormalized, fromNormalized, computeBoundingBox } from './geometry.util'
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd shared/util && pnpm test`
Expected: ALL PASS

- [ ] **Step 6: 提交**

```bash
git add shared/util/src/geometry.util.ts shared/util/src/index.ts shared/util/src/__tests__/geometry.util.spec.ts
git commit -m "feat(util): 添加 computeBoundingBox 函数"
```

### Task 3: EditorKernel 补上 stroke:end 事件 emit

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts:217-233`
- Modify: `libraries/core/src/__tests__/editor-kernel.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `libraries/core/src/__tests__/editor-kernel.service.spec.ts` 中找到合适的位置，添加测试用例。需要先阅读现有测试了解 mock 结构，然后添加：

```ts
describe('stroke:end 事件', () => {
  it('画笔结束时 emit stroke:end 事件', () => {
    const mockStroke = {
      id: 'stroke-1',
      points: [{ x: 10, y: 20, t: 100, p: 0.5 }],
      style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
      createdAt: 100
    }
    // mock getSnapshot 返回包含该笔画的 snapshot
    deps.document.getSnapshot.mockReturnValue({
      strokes: new Map([['stroke-1', mockStroke]]),
      strokeOrder: ['stroke-1'],
      timestamp: 200
    })

    kernel.startStroke('ptr-1', { x: 10, y: 20 }, 100)
    kernel.addStrokePoint('ptr-1', { x: 15, y: 25 }, 150)
    kernel.endStroke('ptr-1', 200)

    // stroke:end 应在 document:changed 之前被 emit
    const emitCalls = deps.eventBus.emit.mock.calls
    const strokeEndIdx = emitCalls.findIndex(c => c[0] === 'stroke:end')
    const docChangedIdx = emitCalls.findIndex(c => c[0] === 'document:changed')

    expect(strokeEndIdx).toBeGreaterThanOrEqual(0)
    expect(docChangedIdx).toBeGreaterThan(strokeEndIdx)
    expect(emitCalls[strokeEndIdx][1]).toEqual({ stroke: mockStroke })
  })

  it('橡皮擦结束时不 emit stroke:end 事件', () => {
    // 设置橡皮擦模式
    kernel.penStyle = { ...kernel.penStyle, type: 'eraser' }

    kernel.startStroke('ptr-1', { x: 10, y: 20 }, 100)
    kernel.endStroke('ptr-1', 200)

    const emitCalls = deps.eventBus.emit.mock.calls
    const strokeEndCall = emitCalls.find(c => c[0] === 'stroke:end')
    expect(strokeEndCall).toBeUndefined()
  })
})
```

注意：测试中的变量名（`deps`、`kernel`）需要与现有测试文件中的 mock 结构一致，实现者需先阅读测试文件的 `beforeEach` 部分进行对齐。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd libraries/core && pnpm test`
Expected: FAIL — stroke:end 事件未被 emit

- [ ] **Step 3: 在 endStroke 中添加 stroke:end emit**

修改 `libraries/core/src/editor-kernel.service.ts` 的 `endStroke` 方法，在画笔模式分支中（第 224 行 `this.activeSessions.delete(strokeId)` 之后），添加 stroke:end 事件的 emit。

当前代码（第 217-233 行）：
```ts
    // 画笔模式：提交笔画
    this.deps.document.apply({
      type: 'stroke:end',
      strokeId: session.strokeId,
      timestamp
    })
    this.deps.renderAdapter.commitStroke(session.getPoints(), this._penStyle)
    this.activeSessions.delete(strokeId)

    if (this.activeSessions.size > 0) {
      this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
    } else {
      this.deps.renderAdapter.clearLiveLayer()
    }

    this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
```

改为：
```ts
    // 画笔模式：提交笔画
    this.deps.document.apply({
      type: 'stroke:end',
      strokeId: session.strokeId,
      timestamp
    })
    this.deps.renderAdapter.commitStroke(session.getPoints(), this._penStyle)
    this.activeSessions.delete(strokeId)

    if (this.activeSessions.size > 0) {
      this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
    } else {
      this.deps.renderAdapter.clearLiveLayer()
    }

    // 具体事件先于通用事件触发
    const snapshot = this.deps.document.getSnapshot()
    const stroke = snapshot.strokes.get(session.strokeId)
    if (stroke) {
      this.deps.eventBus.emit('stroke:end', { stroke })
    }
    this.deps.eventBus.emit('document:changed', snapshot)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd libraries/core && pnpm test`
Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add libraries/core/src/editor-kernel.service.ts libraries/core/src/__tests__/editor-kernel.service.spec.ts
git commit -m "feat(core): 在 endStroke 中 emit stroke:end 事件"
```

---

## Chunk 2: @inker/recognition 包脚手架 + 纯工具函数

### Task 4: 创建 solutions/ 目录和包脚手架

**Files:**
- Create: `solutions/README.md`
- Create: `solutions/recognition/package.json`
- Create: `solutions/recognition/tsconfig.json`
- Create: `solutions/recognition/vitest.config.ts`
- Create: `solutions/recognition/src/index.ts`
- Create: `solutions/recognition/src/types.ts`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: 创建 solutions/README.md**

```md
# solutions/

基于 Inker 核心数据构建的、面向特定业务场景的上层方案包。

## 定位

这些包依赖 Inker 的类型和数据，但 Inker 本体不依赖它们。业务方按需引入。

## 与其他目录的区别

- `shared/` — Inker 内部共享的基础设施
- `libraries/` — Inker 核心功能
- `solutions/` — Inker 之上的业务场景方案，可选引入

## 准入标准

- 面向特定业务场景（识别、协作、持久化等），不是 Inker 核心功能
- 依赖 `@inker/types` 和/或 `@inker/util`，不依赖 Inker 运行时包
- Inker 本体不反向依赖 solutions 中的包
```

- [ ] **Step 2: 创建 package.json**

`solutions/recognition/package.json`:
```json
{
  "name": "@inker/recognition",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@inker/types": "workspace:*",
    "@inker/util": "workspace:*"
  },
  "devDependencies": {
    "@inker/web-rig": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "happy-dom": "catalog:"
  }
}
```

- [ ] **Step 3: 创建 tsconfig.json**

`solutions/recognition/tsconfig.json`:
```json
{
  "extends": "@inker/web-rig/library/tsconfig.lib.json",
  "include": ["src"]
}
```

- [ ] **Step 4: 创建 vitest.config.ts**

`solutions/recognition/vitest.config.ts`:
```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '@inker/web-rig/library/vitest.config.base'

export default mergeConfig(baseConfig, defineConfig({
  test: { root: '.' }
}))
```

- [ ] **Step 5: 创建 types.ts**

`solutions/recognition/src/types.ts`:
```ts
import type { Stroke, DocumentSnapshot, BoundingBox } from '@inker/types'

/** 按时间间隔分组后的笔画组 */
export interface StrokeGroup {
  readonly strokes: Stroke[]
  readonly boundingBox: BoundingBox
  readonly startTime: number
  readonly endTime: number
}

/** 格式导出选项 */
export interface ExportFormatOptions {
  /** 是否计算包围盒并将坐标平移到包围盒原点 */
  readonly boundingBox?: boolean
}

/** 可扩展的导出格式策略接口 */
export interface ExportFormat<T> {
  readonly name: string
  convert(strokes: Stroke[], options?: ExportFormatOptions): T
}

/** RecognitionHelper 绑定目标的最小接口 */
export interface RecognitionTarget {
  on(event: string, handler: (data: unknown) => void): () => void
  getSnapshot(): DocumentSnapshot
}
```

- [ ] **Step 6: 创建空的 index.ts**

`solutions/recognition/src/index.ts`:
```ts
// @inker/recognition — 为手写识别算法准备笔画数据

// 类型
export type { StrokeGroup, ExportFormat, ExportFormatOptions, RecognitionTarget } from './types'
```

- [ ] **Step 7: 在 pnpm-workspace.yaml 中添加 solutions/**

将 `pnpm-workspace.yaml` 的 `packages:` 部分添加 `'solutions/*'`：

```yaml
packages:
  - 'shared/*'
  - 'libraries/*'
  - 'third-parties/*'
  - 'playground/*'
  - 'run-control/*'
  - 'scripts/*'
  - 'solutions/*'
```

- [ ] **Step 8: 安装依赖**

Run: `cd D:/workspace/inker && pnpm install`
Expected: 成功，无报错

- [ ] **Step 9: 类型检查**

Run: `cd solutions/recognition && pnpm typecheck`
Expected: PASS

- [ ] **Step 10: 提交**

```bash
git add solutions/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(recognition): 创建 @inker/recognition 包脚手架和 solutions/ 目录"
```

### Task 5: groupByTime 分组函数

**Files:**
- Create: `solutions/recognition/src/__tests__/group-by-time.spec.ts`
- Create: `solutions/recognition/src/group-by-time.ts`
- Modify: `solutions/recognition/src/index.ts`

- [ ] **Step 1: 写失败测试**

`solutions/recognition/src/__tests__/group-by-time.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupByTime } from '../group-by-time'
import type { Stroke } from '@inker/types'

// 辅助函数：创建测试用笔画
function makeStroke(id: string, points: Array<{ x: number; y: number; t: number }>): Stroke {
  return {
    id,
    points: points.map(p => ({ ...p, p: 0.5 })),
    style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
    createdAt: points[0]?.t ?? 0
  }
}

describe('groupByTime', () => {
  it('单个笔画形成一个组', () => {
    const strokes = [makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 150 }])]
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(1)
    expect(groups[0].strokes).toHaveLength(1)
    expect(groups[0].startTime).toBe(100)
    expect(groups[0].endTime).toBe(150)
  })

  it('时间间隔小于 gapMs 的连续笔画归为一组', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 500 }, { x: 30, y: 30, t: 600 }])
    ]
    // s1 结束时间 200，s2 开始时间 500，间隔 300ms < 500ms
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(1)
    expect(groups[0].strokes).toHaveLength(2)
  })

  it('时间间隔大于等于 gapMs 的笔画分为不同组', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 800 }, { x: 30, y: 30, t: 900 }])
    ]
    // s1 结束时间 200，s2 开始时间 800，间隔 600ms >= 500ms
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(2)
    expect(groups[0].strokes[0].id).toBe('s1')
    expect(groups[1].strokes[0].id).toBe('s2')
  })

  it('三个笔画分为两组', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 400 }, { x: 30, y: 30, t: 500 }]),
      makeStroke('s3', [{ x: 50, y: 50, t: 1500 }, { x: 60, y: 60, t: 1600 }])
    ]
    // s1→s2 间隔 200ms < 500ms（同组），s2→s3 间隔 1000ms >= 500ms（分组）
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(2)
    expect(groups[0].strokes).toHaveLength(2)
    expect(groups[1].strokes).toHaveLength(1)
  })

  it('每个组都有正确的 boundingBox', () => {
    const strokes = [makeStroke('s1', [{ x: 10, y: 20, t: 100 }, { x: 50, y: 80, t: 200 }])]
    const groups = groupByTime(strokes, 500)
    expect(groups[0].boundingBox.minX).toBe(10)
    expect(groups[0].boundingBox.minY).toBe(20)
    expect(groups[0].boundingBox.maxX).toBe(50)
    expect(groups[0].boundingBox.maxY).toBe(80)
  })

  it('空数组返回空数组', () => {
    const groups = groupByTime([], 500)
    expect(groups).toHaveLength(0)
  })

  it('笔画的 startTime 和 endTime 基于点的时间戳', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 300 }, { x: 30, y: 30, t: 400 }])
    ]
    const groups = groupByTime(strokes, 500)
    expect(groups[0].startTime).toBe(100)
    expect(groups[0].endTime).toBe(400)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd solutions/recognition && pnpm test`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 groupByTime**

`solutions/recognition/src/group-by-time.ts`:

```ts
import type { Stroke } from '@inker/types'
import { computeBoundingBox } from '@inker/util'
import type { StrokeGroup } from './types'

/**
 * 按时间间隔将连续笔画分为若干组
 * 两笔之间的时间间隔超过 gapMs 则分为不同组
 * @param strokes 按绘制顺序排列的笔画数组
 * @param gapMs 分组间隔阈值（毫秒）
 * @returns 分组后的笔画组数组
 */
export function groupByTime(strokes: readonly Stroke[], gapMs: number): StrokeGroup[] {
  if (strokes.length === 0) return []

  const groups: StrokeGroup[] = []
  let currentGroup: Stroke[] = [strokes[0]]

  for (let i = 1; i < strokes.length; i++) {
    const prevStroke = strokes[i - 1]
    const currStroke = strokes[i]
    const prevEnd = prevStroke.points[prevStroke.points.length - 1].t
    const currStart = currStroke.points[0].t

    if (currStart - prevEnd >= gapMs) {
      groups.push(buildGroup(currentGroup))
      currentGroup = [currStroke]
    } else {
      currentGroup.push(currStroke)
    }
  }

  groups.push(buildGroup(currentGroup))
  return groups
}

function buildGroup(strokes: Stroke[]): StrokeGroup {
  const firstPoint = strokes[0].points[0]
  const lastStroke = strokes[strokes.length - 1]
  const lastPoint = lastStroke.points[lastStroke.points.length - 1]

  return {
    strokes,
    boundingBox: computeBoundingBox(strokes),
    startTime: firstPoint.t,
    endTime: lastPoint.t
  }
}
```

- [ ] **Step 4: 在 index.ts 中导出**

在 `solutions/recognition/src/index.ts` 中追加：
```ts
// 纯工具函数
export { groupByTime } from './group-by-time'
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd solutions/recognition && pnpm test`
Expected: ALL PASS

- [ ] **Step 6: 提交**

```bash
git add solutions/recognition/src/group-by-time.ts solutions/recognition/src/__tests__/group-by-time.spec.ts solutions/recognition/src/index.ts
git commit -m "feat(recognition): 添加 groupByTime 时间间隔分组函数"
```

### Task 6: translateToOrigin 坐标平移函数

**Files:**
- Create: `solutions/recognition/src/__tests__/translate.spec.ts`
- Create: `solutions/recognition/src/translate.ts`
- Modify: `solutions/recognition/src/index.ts`

- [ ] **Step 1: 写失败测试**

`solutions/recognition/src/__tests__/translate.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { translateToOrigin } from '../translate'
import type { Stroke } from '@inker/types'

function makeStroke(id: string, points: Array<{ x: number; y: number; t: number }>): Stroke {
  return {
    id,
    points: points.map(p => ({ ...p, p: 0.5 })),
    style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
    createdAt: points[0]?.t ?? 0
  }
}

describe('translateToOrigin', () => {
  it('将笔画坐标平移到包围盒左上角为原点', () => {
    const strokes = [makeStroke('s1', [
      { x: 100, y: 200, t: 0 },
      { x: 150, y: 250, t: 1 },
      { x: 120, y: 210, t: 2 }
    ])]
    const result = translateToOrigin(strokes)
    expect(result[0].points[0].x).toBe(0)
    expect(result[0].points[0].y).toBe(0)
    expect(result[0].points[1].x).toBe(50)
    expect(result[0].points[1].y).toBe(50)
    expect(result[0].points[2].x).toBe(20)
    expect(result[0].points[2].y).toBe(10)
  })

  it('多个笔画基于联合包围盒平移', () => {
    const strokes = [
      makeStroke('s1', [{ x: 50, y: 100, t: 0 }]),
      makeStroke('s2', [{ x: 100, y: 200, t: 1 }])
    ]
    const result = translateToOrigin(strokes)
    // 联合 minX=50, minY=100
    expect(result[0].points[0].x).toBe(0)
    expect(result[0].points[0].y).toBe(0)
    expect(result[1].points[0].x).toBe(50)
    expect(result[1].points[0].y).toBe(100)
  })

  it('保留原始笔画的其他属性', () => {
    const strokes = [makeStroke('s1', [{ x: 10, y: 20, t: 42 }])]
    const result = translateToOrigin(strokes)
    expect(result[0].id).toBe('s1')
    expect(result[0].points[0].t).toBe(42)
    expect(result[0].points[0].p).toBe(0.5)
    expect(result[0].style.color).toBe('#000')
    expect(result[0].createdAt).toBe(42)
  })

  it('空数组返回空数组', () => {
    expect(translateToOrigin([])).toEqual([])
  })

  it('已在原点的笔画不变', () => {
    const strokes = [makeStroke('s1', [{ x: 0, y: 0, t: 0 }, { x: 10, y: 20, t: 1 }])]
    const result = translateToOrigin(strokes)
    expect(result[0].points[0].x).toBe(0)
    expect(result[0].points[0].y).toBe(0)
    expect(result[0].points[1].x).toBe(10)
    expect(result[0].points[1].y).toBe(20)
  })

  it('不修改原始输入（不可变）', () => {
    const strokes = [makeStroke('s1', [{ x: 100, y: 200, t: 0 }])]
    translateToOrigin(strokes)
    expect(strokes[0].points[0].x).toBe(100)
    expect(strokes[0].points[0].y).toBe(200)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd solutions/recognition && pnpm test`
Expected: FAIL

- [ ] **Step 3: 实现 translateToOrigin**

`solutions/recognition/src/translate.ts`:

```ts
import type { Stroke } from '@inker/types'
import { computeBoundingBox } from '@inker/util'

/**
 * 将笔画坐标平移到包围盒左上角为原点
 * 不修改原始输入，返回新的笔画数组
 * @param strokes 笔画数组
 * @returns 坐标平移后的新笔画数组（单位仍为像素）
 */
export function translateToOrigin(strokes: readonly Stroke[]): Stroke[] {
  if (strokes.length === 0) return []

  const bbox = computeBoundingBox(strokes)

  return strokes.map(stroke => ({
    ...stroke,
    points: stroke.points.map(point => ({
      ...point,
      x: point.x - bbox.minX,
      y: point.y - bbox.minY
    }))
  }))
}
```

- [ ] **Step 4: 在 index.ts 中导出**

在 `solutions/recognition/src/index.ts` 中追加：
```ts
export { translateToOrigin } from './translate'
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd solutions/recognition && pnpm test`
Expected: ALL PASS

- [ ] **Step 6: 提交**

```bash
git add solutions/recognition/src/translate.ts solutions/recognition/src/__tests__/translate.spec.ts solutions/recognition/src/index.ts
git commit -m "feat(recognition): 添加 translateToOrigin 坐标平移函数"
```

### Task 7: SimpleJsonFormat 导出格式

**Files:**
- Create: `solutions/recognition/src/__tests__/simple-json.format.spec.ts`
- Create: `solutions/recognition/src/formats/simple-json.format.ts`
- Modify: `solutions/recognition/src/index.ts`

- [ ] **Step 1: 写失败测试**

`solutions/recognition/src/__tests__/simple-json.format.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SimpleJsonFormat } from '../formats/simple-json.format'
import type { Stroke } from '@inker/types'

function makeStroke(id: string, points: Array<{ x: number; y: number; t: number }>): Stroke {
  return {
    id,
    points: points.map(p => ({ ...p, p: 0.5 })),
    style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
    createdAt: points[0]?.t ?? 0
  }
}

describe('SimpleJsonFormat', () => {
  const format = new SimpleJsonFormat()

  it('name 属性为 simple-json', () => {
    expect(format.name).toBe('simple-json')
  })

  it('不带 boundingBox 选项时输出原始坐标', () => {
    const strokes = [makeStroke('s1', [
      { x: 100, y: 200, t: 0 },
      { x: 150, y: 250, t: 1 }
    ])]
    const result = format.convert(strokes)

    expect(result.strokes).toHaveLength(1)
    expect(result.strokes[0].id).toBe('s1')
    expect(result.strokes[0].points[0]).toEqual({ x: 100, y: 200, t: 0, p: 0.5 })
    expect(result.strokes[0].points[1]).toEqual({ x: 150, y: 250, t: 1, p: 0.5 })
    expect(result.strokes[0].style).toEqual({ type: 'pen', color: '#000', size: 2 })
    expect(result.boundingBox).toBeNull()
  })

  it('带 boundingBox: true 时坐标平移到包围盒原点', () => {
    const strokes = [makeStroke('s1', [
      { x: 100, y: 200, t: 0 },
      { x: 150, y: 250, t: 1 }
    ])]
    const result = format.convert(strokes, { boundingBox: true })

    // 坐标已平移：minX=100, minY=200
    expect(result.strokes[0].points[0]).toEqual({ x: 0, y: 0, t: 0, p: 0.5 })
    expect(result.strokes[0].points[1]).toEqual({ x: 50, y: 50, t: 1, p: 0.5 })
    expect(result.boundingBox).not.toBeNull()
    expect(result.boundingBox!.minX).toBe(100)
    expect(result.boundingBox!.minY).toBe(200)
    expect(result.boundingBox!.width).toBe(50)
    expect(result.boundingBox!.height).toBe(50)
  })

  it('boundingBox: false 时与不传等效', () => {
    const strokes = [makeStroke('s1', [{ x: 100, y: 200, t: 0 }])]
    const result = format.convert(strokes, { boundingBox: false })

    expect(result.strokes[0].points[0].x).toBe(100)
    expect(result.boundingBox).toBeNull()
  })

  it('多个笔画的联合输出', () => {
    const strokes = [
      makeStroke('s1', [{ x: 10, y: 20, t: 0 }]),
      makeStroke('s2', [{ x: 50, y: 60, t: 1 }])
    ]
    const result = format.convert(strokes, { boundingBox: true })

    expect(result.strokes).toHaveLength(2)
    // 联合 minX=10, minY=20
    expect(result.strokes[0].points[0]).toEqual({ x: 0, y: 0, t: 0, p: 0.5 })
    expect(result.strokes[1].points[0]).toEqual({ x: 40, y: 40, t: 1, p: 0.5 })
    expect(result.boundingBox!.width).toBe(40)
    expect(result.boundingBox!.height).toBe(40)
  })

  it('style 只保留 type/color/size 三个字段', () => {
    const strokes = [makeStroke('s1', [{ x: 0, y: 0, t: 0 }])]
    const result = format.convert(strokes)
    const style = result.strokes[0].style
    expect(Object.keys(style)).toEqual(['type', 'color', 'size'])
  })

  it('空数组返回空结果', () => {
    const result = format.convert([])
    expect(result.strokes).toHaveLength(0)
    expect(result.boundingBox).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd solutions/recognition && pnpm test`
Expected: FAIL

- [ ] **Step 3: 实现 SimpleJsonFormat**

`solutions/recognition/src/formats/simple-json.format.ts`:

```ts
import type { Stroke, BoundingBox } from '@inker/types'
import { computeBoundingBox } from '@inker/util'
import type { ExportFormat, ExportFormatOptions } from '../types'

/** SimpleJsonFormat 的输出结构 */
export interface SimpleJsonResult {
  strokes: Array<{
    id: string
    points: Array<{ x: number; y: number; t: number; p: number }>
    style: { type: string; color: string; size: number }
  }>
  boundingBox: BoundingBox | null
}

/**
 * 简单 JSON 导出格式
 * 将笔画数据转换为易于识别 API 消费的 JSON 结构
 */
export class SimpleJsonFormat implements ExportFormat<SimpleJsonResult> {
  readonly name = 'simple-json'

  convert(strokes: readonly Stroke[], options?: ExportFormatOptions): SimpleJsonResult {
    if (strokes.length === 0) {
      return { strokes: [], boundingBox: null }
    }

    const useBoundingBox = options?.boundingBox === true
    const bbox = useBoundingBox ? computeBoundingBox(strokes) : null
    const offsetX = bbox?.minX ?? 0
    const offsetY = bbox?.minY ?? 0

    return {
      strokes: strokes.map(stroke => ({
        id: stroke.id,
        points: stroke.points.map(point => ({
          x: useBoundingBox ? point.x - offsetX : point.x,
          y: useBoundingBox ? point.y - offsetY : point.y,
          t: point.t,
          p: point.p
        })),
        style: {
          type: stroke.style.type,
          color: stroke.style.color,
          size: stroke.style.size
        }
      })),
      boundingBox: bbox
    }
  }
}
```

- [ ] **Step 4: 在 index.ts 中导出**

在 `solutions/recognition/src/index.ts` 中追加：
```ts
// 格式
export { SimpleJsonFormat } from './formats/simple-json.format'
export type { SimpleJsonResult } from './formats/simple-json.format'
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd solutions/recognition && pnpm test`
Expected: ALL PASS

- [ ] **Step 6: 提交**

```bash
git add solutions/recognition/src/formats/ solutions/recognition/src/__tests__/simple-json.format.spec.ts solutions/recognition/src/index.ts
git commit -m "feat(recognition): 添加 SimpleJsonFormat 导出格式"
```

---

## Chunk 3: RecognitionHelper 事件驱动类

### Task 8: RecognitionHelper 实现

**Files:**
- Create: `solutions/recognition/src/__tests__/recognition-helper.spec.ts`
- Create: `solutions/recognition/src/recognition-helper.ts`
- Modify: `solutions/recognition/src/index.ts`

- [ ] **Step 1: 写失败测试**

`solutions/recognition/src/__tests__/recognition-helper.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RecognitionHelper } from '../recognition-helper'
import type { RecognitionTarget } from '../types'
import type { Stroke, DocumentSnapshot } from '@inker/types'

function makeStroke(id: string, points: Array<{ x: number; y: number; t: number }>): Stroke {
  return {
    id,
    points: points.map(p => ({ ...p, p: 0.5 })),
    style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
    createdAt: points[0]?.t ?? 0
  }
}

function makeSnapshot(strokes: Stroke[]): DocumentSnapshot {
  return {
    strokes: new Map(strokes.map(s => [s.id, s])),
    strokeOrder: strokes.map(s => s.id),
    timestamp: Date.now()
  }
}

function createMockTarget(snapshot: DocumentSnapshot): RecognitionTarget & { triggerStrokeEnd: (data: unknown) => void } {
  const handlers = new Map<string, Array<(data: unknown) => void>>()
  return {
    on(event: string, handler: (data: unknown) => void) {
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event)!.push(handler)
      return () => {
        const list = handlers.get(event)
        if (list) {
          const idx = list.indexOf(handler)
          if (idx >= 0) list.splice(idx, 1)
        }
      }
    },
    getSnapshot: vi.fn(() => snapshot),
    triggerStrokeEnd(data: unknown) {
      const list = handlers.get('stroke:end')
      list?.forEach(h => h(data))
    }
  }
}

describe('RecognitionHelper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('bindTo 后监听 stroke:end 事件', () => {
    const helper = new RecognitionHelper()
    const target = createMockTarget(makeSnapshot([]))
    const onSpy = vi.spyOn(target, 'on')

    helper.bindTo(target)

    expect(onSpy).toHaveBeenCalledWith('stroke:end', expect.any(Function))
    helper.dispose()
  })

  it('书写停顿后触发 onWritingComplete', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()

    helper.onWritingComplete(callback)
    helper.bindTo(target)

    target.triggerStrokeEnd({ stroke: stroke1 })
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0].strokes).toContain(stroke1)

    helper.dispose()
  })

  it('连续书写时重置定时器', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const stroke2 = makeStroke('s2', [{ x: 10, y: 10, t: 400 }])
    const target = createMockTarget(makeSnapshot([stroke1, stroke2]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()

    helper.onWritingComplete(callback)
    helper.bindTo(target)

    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(300)
    expect(callback).not.toHaveBeenCalled()

    target.triggerStrokeEnd({ stroke: stroke2 })
    vi.advanceTimersByTime(300)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(callback).toHaveBeenCalledTimes(1)

    helper.dispose()
  })

  it('不重复触发已处理的笔画', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()

    helper.onWritingComplete(callback)
    helper.bindTo(target)

    // 第一次触发
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)

    // 没有新笔画，再次触发 stroke:end（不应该发生，但防御性测试）
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)
    // callback 不应该被再次调用（没有新笔画）
    expect(callback).toHaveBeenCalledTimes(1)

    helper.dispose()
  })

  it('支持多个 listener', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const cb1 = vi.fn()
    const cb2 = vi.fn()

    helper.onWritingComplete(cb1)
    helper.onWritingComplete(cb2)
    helper.bindTo(target)

    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)

    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)

    helper.dispose()
  })

  it('取消订阅后不再收到通知', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()

    const unsub = helper.onWritingComplete(callback)
    helper.bindTo(target)

    unsub()

    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)

    expect(callback).not.toHaveBeenCalled()

    helper.dispose()
  })

  it('onWritingComplete 可在 bindTo 之前注册', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()

    // 先注册 callback
    helper.onWritingComplete(callback)
    // 后绑定
    helper.bindTo(target)

    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)

    expect(callback).toHaveBeenCalledTimes(1)

    helper.dispose()
  })

  it('getCurrentStrokes 返回当前所有笔画', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const stroke2 = makeStroke('s2', [{ x: 10, y: 10, t: 200 }])
    const target = createMockTarget(makeSnapshot([stroke1, stroke2]))
    const helper = new RecognitionHelper()

    helper.bindTo(target)
    const strokes = helper.getCurrentStrokes()

    expect(strokes).toHaveLength(2)
    expect(strokes[0].id).toBe('s1')
    expect(strokes[1].id).toBe('s2')

    helper.dispose()
  })

  it('未 bindTo 时调用 getCurrentStrokes 抛出异常', () => {
    const helper = new RecognitionHelper()
    expect(() => helper.getCurrentStrokes()).toThrow()
  })

  it('dispose 后调用方法抛出异常', () => {
    const helper = new RecognitionHelper()
    helper.dispose()

    expect(() => helper.getCurrentStrokes()).toThrow()
    expect(() => helper.onWritingComplete(() => {})).toThrow()
    expect(() => helper.bindTo({} as any)).toThrow()
  })

  it('dispose 清除定时器', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()

    helper.onWritingComplete(callback)
    helper.bindTo(target)

    target.triggerStrokeEnd({ stroke: stroke1 })
    helper.dispose()

    vi.advanceTimersByTime(500)
    expect(callback).not.toHaveBeenCalled()
  })

  it('默认 gapMs 为 500', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper()
    const callback = vi.fn()

    helper.onWritingComplete(callback)
    helper.bindTo(target)

    target.triggerStrokeEnd({ stroke: stroke1 })

    vi.advanceTimersByTime(499)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    helper.dispose()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd solutions/recognition && pnpm test`
Expected: FAIL

- [ ] **Step 3: 实现 RecognitionHelper**

`solutions/recognition/src/recognition-helper.ts`:

```ts
import type { Stroke } from '@inker/types'
import { groupByTime } from './group-by-time'
import type { RecognitionTarget, StrokeGroup } from './types'

/**
 * 事件驱动的识别辅助类
 * 绑定 Inker 实例后，在用户书写停顿时自动触发回调
 */
export class RecognitionHelper {
  private readonly gapMs: number
  private callbacks: Array<(group: StrokeGroup) => void> = []
  private target: RecognitionTarget | null = null
  private unsubscribe: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private processedStrokeIds = new Set<string>()
  private disposed = false

  constructor(options?: { gapMs?: number }) {
    this.gapMs = options?.gapMs ?? 500
  }

  /**
   * 绑定 Inker 实例（通过 RecognitionTarget 接口）
   */
  bindTo(target: RecognitionTarget): void {
    this.assertNotDisposed()
    this.target = target
    this.unsubscribe = target.on('stroke:end', () => {
      this.resetTimer()
    })
  }

  /**
   * 注册书写完成回调，返回取消订阅函数
   * 可在 bindTo 之前调用
   */
  onWritingComplete(callback: (group: StrokeGroup) => void): () => void {
    this.assertNotDisposed()
    this.callbacks.push(callback)
    return () => {
      const idx = this.callbacks.indexOf(callback)
      if (idx >= 0) this.callbacks.splice(idx, 1)
    }
  }

  /**
   * 获取当前所有笔画（按绘制顺序）
   * 需先调用 bindTo
   */
  getCurrentStrokes(): Stroke[] {
    this.assertNotDisposed()
    if (!this.target) {
      throw new Error('RecognitionHelper: 请先调用 bindTo 绑定目标')
    }
    const snapshot = this.target.getSnapshot()
    return snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)
  }

  dispose(): void {
    this.clearTimer()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.target = null
    this.callbacks = []
    this.processedStrokeIds.clear()
    this.disposed = true
  }

  private resetTimer(): void {
    this.clearTimer()
    this.timer = setTimeout(() => this.onTimerExpired(), this.gapMs)
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private onTimerExpired(): void {
    if (!this.target) return

    const snapshot = this.target.getSnapshot()
    const allStrokes = snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)

    // 找出未处理过的新笔画
    const newStrokes = allStrokes.filter(s => !this.processedStrokeIds.has(s.id))
    if (newStrokes.length === 0) return

    // 对全部笔画按时间分组，取包含新笔画的最新一组
    const groups = groupByTime(allStrokes, this.gapMs)
    const lastGroup = groups[groups.length - 1]

    if (!lastGroup) return

    // 检查最新组是否包含新笔画
    const hasNew = lastGroup.strokes.some(s => !this.processedStrokeIds.has(s.id))
    if (!hasNew) return

    // 标记所有笔画为已处理
    for (const stroke of lastGroup.strokes) {
      this.processedStrokeIds.add(stroke.id)
    }

    // 通知所有 listener
    for (const callback of this.callbacks) {
      callback(lastGroup)
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('RecognitionHelper: 已被 dispose')
    }
  }
}
```

- [ ] **Step 4: 在 index.ts 中导出**

在 `solutions/recognition/src/index.ts` 中追加：
```ts
// Helper
export { RecognitionHelper } from './recognition-helper'
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd solutions/recognition && pnpm test`
Expected: ALL PASS

- [ ] **Step 6: 运行全部相关测试**

Run: `cd D:/workspace/inker && pnpm -r test`
Expected: ALL PASS（所有包的测试都通过）

- [ ] **Step 7: 提交**

```bash
git add solutions/recognition/src/recognition-helper.ts solutions/recognition/src/__tests__/recognition-helper.spec.ts solutions/recognition/src/index.ts
git commit -m "feat(recognition): 添加 RecognitionHelper 事件驱动类"
```

---

## Chunk 4: 文档更新 + 最终验证

### Task 9: 更新项目文档

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 更新 CLAUDE.md 目录结构**

在 CLAUDE.md 的目录结构部分，在 `playground/` 之前添加：
```
├── solutions/              # 业务场景方案（不发布到 SDK）
│   └── recognition/        # @inker/recognition — 识别数据准备
```

- [ ] **Step 2: 更新 CLAUDE.md 依赖方向**

在"依赖方向"行之后补充 solutions 的依赖关系说明，将：
```
**依赖方向：** `shared/ ← libraries/ ← sdk/`，`third-parties/` 被 shared 和 libraries 引用，`playground/` 依赖 sdk。
```
改为：
```
**依赖方向：** `shared/ ← libraries/ ← sdk/`，`third-parties/` 被 shared 和 libraries 引用，`playground/` 依赖 sdk，`solutions/` 依赖 shared（不反向依赖 libraries/sdk）。
```

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: 更新 CLAUDE.md 反映 solutions/ 目录和 @inker/recognition 包"
```

### Task 10: 最终验证

- [ ] **Step 1: 全量类型检查**

Run: `cd D:/workspace/inker && pnpm -r typecheck`
Expected: ALL PASS

- [ ] **Step 2: 全量测试**

Run: `cd D:/workspace/inker && pnpm -r test`
Expected: ALL PASS

- [ ] **Step 3: 构建验证**

Run: `cd D:/workspace/inker && pnpm build`
Expected: 构建成功

- [ ] **Step 4: 最终提交（如有未提交的修正）**

如果验证过程中有修正，统一提交。
