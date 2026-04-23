# 多点触控同时书写 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持多根手指/多支笔同时在同一画布上独立绘制笔画，互不干扰。

**Architecture:** 新增 StrokeSession 类管理 per-pointer 状态，PointerInputAdapter 从单 pointerId 改为 Set 多指针追踪，EditorKernel 用 Map<pointerId, StrokeSession> 编排多活跃笔画，RenderAdapter 新增 drawLiveStrokes 批量渲染方法。

**Tech Stack:** TypeScript, Vitest + happy-dom, Canvas 2D / OffscreenCanvas

**Spec:** `docs/superpowers/specs/2026-03-11-multi-pointer-design.md`

---

## Chunk 1: StrokeSession + 接口基础

### Task 1: StrokeSession 类

**Files:**
- Create: `libraries/core/src/stroke-session.ts`
- Create: `libraries/core/src/__tests__/stroke-session.spec.ts`

- [ ] **Step 1: 编写 StrokeSession 失败测试**

```typescript
// libraries/core/src/__tests__/stroke-session.spec.ts
import { describe, it, expect } from 'vitest'
import { StrokeSession } from '../stroke-session'
import type { StrokePoint } from '@aw/types'

function point(x: number, y: number, t = 0, p = 0.5): StrokePoint {
  return { x, y, t, p }
}

describe('StrokeSession', () => {
  it('构造时应正确存储 strokeId、pointerId 和首点', () => {
    const session = new StrokeSession(1, 'stroke-001', point(10, 20, 100), 100)
    expect(session.strokeId).toBe('stroke-001')
    expect(session.pointerId).toBe(1)
    expect(session.getPoints()).toEqual([point(10, 20, 100)])
    expect(session.pointCount).toBe(1)
  })

  it('addPoint 应追加到点序列', () => {
    const session = new StrokeSession(1, 's1', point(0, 0), 0)
    session.addPoint(point(10, 10, 16))
    session.addPoint(point(20, 20, 32))
    expect(session.pointCount).toBe(3)
    expect(session.getPoints()).toHaveLength(3)
  })

  it('getPoints 返回的数组不影响内部状态', () => {
    const session = new StrokeSession(1, 's1', point(0, 0), 0)
    const pts = session.getPoints()
    ;(pts as StrokePoint[]).push(point(99, 99))  // 尝试外部修改
    expect(session.pointCount).toBe(1)  // 内部不受影响
  })

  it('getLastPoint 应返回最后一个点', () => {
    const session = new StrokeSession(1, 's1', point(0, 0), 0)
    expect(session.getLastPoint()).toEqual(point(0, 0))
    session.addPoint(point(5, 5, 10))
    expect(session.getLastPoint()).toEqual(point(5, 5, 10))
  })

  it('startTimestamp 应返回构造时的时间戳', () => {
    const session = new StrokeSession(1, 's1', point(0, 0), 42)
    expect(session.startTimestamp).toBe(42)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd libraries/core && npx vitest run src/__tests__/stroke-session.spec.ts
```

Expected: FAIL — `Cannot find module '../stroke-session'`

- [ ] **Step 3: 实现 StrokeSession**

```typescript
// libraries/core/src/stroke-session.ts
import type { StrokePoint } from '@aw/types'

/**
 * 笔画会话
 * 管理单个指针的活跃笔画状态（pointerId → strokeId + 采样点序列）
 */
export class StrokeSession {
  readonly strokeId: string
  readonly pointerId: number
  readonly startTimestamp: number
  private points: StrokePoint[]

  constructor(
    pointerId: number,
    strokeId: string,
    firstPoint: StrokePoint,
    timestamp: number
  ) {
    this.pointerId = pointerId
    this.strokeId = strokeId
    this.startTimestamp = timestamp
    this.points = [firstPoint]
  }

  addPoint(point: StrokePoint): void {
    this.points.push(point)
  }

  getPoints(): readonly StrokePoint[] {
    return [...this.points]
  }

  getLastPoint(): StrokePoint {
    return this.points[this.points.length - 1]
  }

  get pointCount(): number {
    return this.points.length
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd libraries/core && npx vitest run src/__tests__/stroke-session.spec.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: 导出 StrokeSession**

在 `libraries/core/src/index.ts` 中添加导出：

```typescript
export { StrokeSession } from './stroke-session'
```

- [ ] **Step 6: 提交**

```bash
git add libraries/core/src/stroke-session.ts libraries/core/src/__tests__/stroke-session.spec.ts libraries/core/src/index.ts
git commit -m "feat: 新增 StrokeSession 类，管理 per-pointer 笔画状态"
```

---

### Task 2: RenderAdapterInterface 扩展

**Files:**
- Modify: `shared/types/src/render-adapter.types.ts:12-56`
- Modify: `libraries/core/src/render.adapter.ts:13-38`
- Modify: `libraries/render-protocol/src/types.ts:19-33`

- [ ] **Step 1: 在 RenderAdapterInterface 中新增 drawLiveStrokes 方法**

在 `shared/types/src/render-adapter.types.ts` 的 `clearLiveLayer()` 后（第 29 行之后）插入：

```typescript
  /** 批量绘制所有活跃笔画（内部先清除 live layer，再遍历绘制） */
  drawLiveStrokes(strokes: readonly StrokeData[]): void
```

- [ ] **Step 2: 在 RenderAdapter 抽象基类中改为 abstract 声明**

在 `libraries/core/src/render.adapter.ts` 的 `abstract clearLiveLayer()` 后（第 23 行之后）插入：

```typescript
  /** 批量绘制所有活跃笔画（每个适配器独立实现：先清除 live layer，再遍历绘制） */
  abstract drawLiveStrokes(strokes: readonly StrokeData[]): void
```

原因：所有现有适配器的 `drawLiveStroke` 内部都有 clearContext 逻辑，若提供默认实现（循环调用 drawLiveStroke）会在多笔画时互相清除，必须各自覆写。

- [ ] **Step 3: 在 RenderCommand 中新增 drawLiveStrokes 指令**

在 `libraries/render-protocol/src/types.ts` 的 RenderCommand 类型中（第 22 行 `drawLive` 之后）插入：

```typescript
  | { cmd: 'drawLiveStrokes'; strokes: StrokeData[] }
```

- [ ] **Step 4: 运行全量类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS（无类型错误）

- [ ] **Step 5: 提交**

```bash
git add shared/types/src/render-adapter.types.ts libraries/core/src/render.adapter.ts libraries/render-protocol/src/types.ts
git commit -m "feat: RenderAdapterInterface 新增 drawLiveStrokes 批量渲染方法"
```

---

## Chunk 2: 渲染适配器实现

### Task 3: CanvasRenderAdapter 实现 drawLiveStrokes

**Files:**
- Modify: `libraries/render-canvas/src/canvas-render.adapter.ts:76-104`

- [ ] **Step 1: 编写 drawLiveStrokes 失败测试**

在现有测试文件中（如不存在则创建 `libraries/render-canvas/src/__tests__/canvas-render.adapter.spec.ts`）新增用例。

先检查是否已有测试文件：

```bash
ls libraries/render-canvas/src/__tests__/ 2>/dev/null || echo "NO_TESTS_DIR"
```

如果没有，创建测试文件：

```typescript
// libraries/render-canvas/src/__tests__/draw-live-strokes.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CanvasRenderAdapter } from '../canvas-render.adapter'
import type { StrokeProcessorInterface, StrokePoint, StrokeStyle } from '@aw/types'

function point(x: number, y: number): StrokePoint {
  return { x, y, t: 0, p: 0.5 }
}

const style: StrokeStyle = { type: 'pen', color: '#000', width: 2, opacity: 1 }

function createMockProcessor(): StrokeProcessorInterface {
  return {
    computeOutline: vi.fn(() => ({
      segments: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }]
    })),
    computeErasure: vi.fn(() => [])
  } as unknown as StrokeProcessorInterface
}

describe('CanvasRenderAdapter.drawLiveStrokes', () => {
  let adapter: CanvasRenderAdapter
  let processor: StrokeProcessorInterface

  beforeEach(() => {
    processor = createMockProcessor()
    adapter = new CanvasRenderAdapter(processor)
    const container = document.createElement('div')
    adapter.attach(container, 800, 600)
  })

  it('空数组应仅清除 live layer', () => {
    const clearSpy = vi.spyOn(adapter, 'clearLiveLayer')
    adapter.drawLiveStrokes([])
    expect(clearSpy).toHaveBeenCalled()
  })

  it('3 条笔画应调用 3 次 computeOutline', () => {
    const strokes = [
      { points: [point(0, 0), point(10, 10)] as readonly StrokePoint[], style },
      { points: [point(20, 20), point(30, 30)] as readonly StrokePoint[], style },
      { points: [point(40, 40), point(50, 50)] as readonly StrokePoint[], style }
    ]
    adapter.drawLiveStrokes(strokes)
    expect(processor.computeOutline).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd libraries/render-canvas && npx vitest run src/__tests__/draw-live-strokes.spec.ts
```

Expected: FAIL — 基类默认实现中 `drawLiveStroke` 内部调用 `clearContext` 会清除前一笔。需要覆写。

- [ ] **Step 3: 在 CanvasRenderAdapter 中覆写 drawLiveStrokes**

在 `libraries/render-canvas/src/canvas-render.adapter.ts` 的 `clearLiveLayer()` 方法后（第 104 行之后）插入：

```typescript
  /**
   * 批量绘制所有活跃笔画
   * 实现基类 abstract 声明：先清除 live layer，再遍历计算轮廓并绘制（不逐笔清除）
   */
  drawLiveStrokes(strokes: readonly StrokeData[]): void {
    if (!this.layerManager) return
    const ctx = this.layerManager.getLiveContext()
    this.clearContext(ctx)
    for (const stroke of strokes) {
      const outline = this.strokeProcessor.computeOutline(stroke.points, stroke.style, false)
      if (outline) {
        this.drawPath(ctx, geometryToPath2D(outline), stroke.style)
      }
    }
  }
```

注意：覆写后 `drawLiveStroke`（单数）内部的 `this.clearContext(ctx)` 保留不变（单笔画场景仍有效）。

- [ ] **Step 4: 运行测试确认通过**

```bash
cd libraries/render-canvas && npx vitest run src/__tests__/draw-live-strokes.spec.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add libraries/render-canvas/src/canvas-render.adapter.ts libraries/render-canvas/src/__tests__/draw-live-strokes.spec.ts
git commit -m "feat: CanvasRenderAdapter 实现 drawLiveStrokes 批量渲染"
```

---

### Task 4: OffscreenRenderAdapter + Worker 实现 drawLiveStrokes

**Files:**
- Modify: `libraries/render-offscreen/src/offscreen-render.adapter.ts:76-86`
- Modify: `libraries/render-offscreen/src/offscreen-render.worker.ts:105-115`

- [ ] **Step 1: OffscreenRenderAdapter 添加 drawLiveStrokes 方法**

在 `libraries/render-offscreen/src/offscreen-render.adapter.ts` 的 `clearLiveLayer()` 方法后（第 86 行之后）插入：

```typescript
  drawLiveStrokes(strokes: readonly StrokeData[]): void {
    this.bridge?.send({
      cmd: 'drawLiveStrokes',
      strokes: strokes.map(s => ({ points: [...s.points], style: s.style }))
    })
  }
```

需要在文件顶部的 import 中确认 `StrokeStyle` 已导入（已有）。

- [ ] **Step 2: Worker 侧处理 drawLiveStrokes 指令**

在 `libraries/render-offscreen/src/offscreen-render.worker.ts` 的 `handleCommand` 函数中，`case 'drawLive'` 分支后（第 115 行之后）插入：

```typescript
      case 'drawLiveStrokes':
        if (!liveCtx) break
        clearContext(liveCtx)
        for (const stroke of cmd.strokes) {
          computeAndDraw(liveCtx, stroke.points, stroke.style, false)
        }
        break
```

- [ ] **Step 3: 运行类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add libraries/render-offscreen/src/offscreen-render.adapter.ts libraries/render-offscreen/src/offscreen-render.worker.ts
git commit -m "feat: OffscreenRenderAdapter + Worker 实现 drawLiveStrokes"
```

---

## Chunk 3: 输入层 + 核心层多指针改造

### Task 5: PointerInputAdapter 多指针追踪

**Files:**
- Modify: `libraries/input-pointer/src/pointer-input.adapter.ts:19,54,103-126`
- Modify: `libraries/input-pointer/src/__tests__/pointer-input.adapter.spec.ts`

- [ ] **Step 1: 编写多指针失败测试**

在 `libraries/input-pointer/src/__tests__/pointer-input.adapter.spec.ts` 末尾 `})` 之前新增 `describe` 块：

```typescript
  describe('多指针追踪', () => {
    /** 创建 PointerEvent 的辅助函数 */
    function createPointerEvent(
      type: string,
      options: PointerEventInit = {}
    ): PointerEvent {
      return new PointerEvent(type, {
        clientX: 100,
        clientY: 200,
        pressure: 0.5,
        pointerId: 1,
        pointerType: 'touch',
        bubbles: true,
        ...options
      })
    }

    it('双指 down 应发出两个独立的 down 事件', () => {
      const events: InputEvent[] = []
      adapter.onInput = e => events.push(e)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))

      const downs = events.filter(e => e.type === 'down')
      expect(downs).toHaveLength(2)
      expect(downs[0].pointerId).toBe(1)
      expect(downs[1].pointerId).toBe(2)
    })

    it('双指 move 应各自独立响应', () => {
      const events: InputEvent[] = []
      adapter.onInput = e => events.push(e)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 110 }))
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 120 }))

      const moves = events.filter(e => e.type === 'move')
      expect(moves).toHaveLength(2)
      expect(moves[0].pointerId).toBe(1)
      expect(moves[1].pointerId).toBe(2)
    })

    it('一指 up 后另一指应继续响应 move', () => {
      const events: InputEvent[] = []
      adapter.onInput = e => events.push(e)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 130 }))

      const movesAfterUp = events.filter(e => e.type === 'move' && e.pointerId === 2)
      expect(movesAfterUp).toHaveLength(1)
    })

    it('未 down 的 pointerId 发送 move 应被忽略', () => {
      const events: InputEvent[] = []
      adapter.onInput = e => events.push(e)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 99 }))

      const moves = events.filter(e => e.type === 'move')
      expect(moves).toHaveLength(0)
    })

    it('detach 后所有指针追踪应清空', () => {
      const events: InputEvent[] = []
      adapter.onInput = e => events.push(e)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      adapter.detach()

      // 重新 attach，旧指针不应残留
      adapter.onInput = e => events.push(e)
      adapter.attach(element)
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1 }))

      const movesAfterReattach = events.filter(e => e.type === 'move')
      expect(movesAfterReattach).toHaveLength(0)
    })
  })
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd libraries/input-pointer && npx vitest run src/__tests__/pointer-input.adapter.spec.ts
```

Expected: FAIL — "双指 down 应发出两个独立的 down 事件" 失败（当前只发出 1 个）

- [ ] **Step 3: 改造 PointerInputAdapter**

在 `libraries/input-pointer/src/pointer-input.adapter.ts` 中：

1. 第 19 行：将 `private activePointerId: number | null = null` 替换为：
```typescript
  /** 当前活跃的指针 ID 集合（支持多指针同时追踪） */
  private activePointerIds: Set<number> = new Set()
```

2. 第 54 行：将 `this.activePointerId = null` 替换为：
```typescript
    this.activePointerIds.clear()
```

3. 第 103-109 行：将 `onPointerDown` 替换为：
```typescript
  private onPointerDown(e: PointerEvent): void {
    if (!this.isPointerTypeAllowed(e.pointerType)) return
    e.preventDefault()
    this.activePointerIds.add(e.pointerId)
    this.emit('down', e)
  }
```

4. 第 111-114 行：将 `onPointerMove` 替换为：
```typescript
  private onPointerMove(e: PointerEvent): void {
    if (!this.activePointerIds.has(e.pointerId)) return
    this.emit('move', e)
  }
```

5. 第 116-120 行：将 `onPointerUp` 替换为：
```typescript
  private onPointerUp(e: PointerEvent): void {
    if (!this.activePointerIds.has(e.pointerId)) return
    this.emit('up', e)
    this.activePointerIds.delete(e.pointerId)
  }
```

6. 第 122-126 行：将 `onPointerCancel` 替换为：
```typescript
  private onPointerCancel(e: PointerEvent): void {
    if (!this.activePointerIds.has(e.pointerId)) return
    this.emit('cancel', e)
    this.activePointerIds.delete(e.pointerId)
  }
```

- [ ] **Step 4: 运行全部测试确认通过**

```bash
cd libraries/input-pointer && npx vitest run
```

Expected: 全部 PASS（含新增多指针测试 + 原有单指针测试回归）

- [ ] **Step 5: 提交**

```bash
git add libraries/input-pointer/src/pointer-input.adapter.ts libraries/input-pointer/src/__tests__/pointer-input.adapter.spec.ts
git commit -m "feat: PointerInputAdapter 支持多指针同时追踪"
```

---

### Task 6: EditorKernel 多指针改造

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts:67-250,281-318,326-328,422-431`
- Create: `libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts`

此 Task 最大，拆为子步骤。

- [ ] **Step 1: 编写多指针画笔基础测试**

```typescript
// libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorKernel } from '../editor-kernel.service'
import type {
  InputAdapterInterface,
  RenderAdapterInterface,
  InputEvent,
  Camera
} from '@aw/types'

// 复用 mock 工厂（与 editor-kernel.service.spec.ts 结构一致）
function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      dispose: vi.fn()
    },
    inputAdapter: {
      attach: vi.fn(),
      detach: vi.fn(),
      setAllowedPointerTypes: vi.fn(),
      dispose: vi.fn(),
      onInput: null as ((event: InputEvent) => void) | null
    } satisfies InputAdapterInterface,
    renderAdapter: {
      attach: vi.fn(),
      detach: vi.fn(),
      resize: vi.fn(),
      drawLiveStroke: vi.fn(),
      drawLiveStrokes: vi.fn(),
      commitStroke: vi.fn(),
      clearLiveLayer: vi.fn(),
      redrawAll: vi.fn(),
      clearAll: vi.fn(),
      setCamera: vi.fn(),
      startEraserTrail: vi.fn(),
      addEraserPoint: vi.fn(),
      endEraserTrail: vi.fn(),
      stopEraserTrail: vi.fn(),
      flush: vi.fn(() => Promise.resolve()),
      toDataURL: vi.fn(() => Promise.resolve('')),
      exportAsBlob: vi.fn(() => Promise.resolve(new Blob())),
      dispose: vi.fn()
    } satisfies RenderAdapterInterface,
    document: {
      apply: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      getSnapshot: vi.fn(() => ({
        strokes: new Map(),
        strokeOrder: [],
        timestamp: 0
      })),
      getOperations: vi.fn(() => []),
      canUndo: false,
      canRedo: false
    },
    coordinateSystem: {
      screenToWorld: vi.fn((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
      worldToScreen: vi.fn((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
      resizeContainer: vi.fn(),
      computeFitCamera: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      camera: { x: 0, y: 0, zoom: 1 } as Camera,
      setCamera: vi.fn(),
      toNormalized: vi.fn((p: { x: number; y: number }) => ({ x: p.x / 800, y: p.y / 600 })),
      fromNormalized: vi.fn((p: { x: number; y: number }) => ({ x: p.x * 800, y: p.y * 600 })),
      documentWidth: 800,
      documentHeight: 600,
      containerWidth: 800,
      containerHeight: 600
    }
  }
}

function downEvent(pointerId: number, x = 100, y = 200, ts = 1000): InputEvent {
  return { type: 'down', point: { x, y, pressure: 0.5 }, pointerId, pointerType: 'touch', timestamp: ts }
}

function moveEvent(pointerId: number, x = 110, y = 210, ts = 1016): InputEvent {
  return { type: 'move', point: { x, y, pressure: 0.6 }, pointerId, pointerType: 'touch', timestamp: ts }
}

function upEvent(pointerId: number, x = 120, y = 220, ts = 1100): InputEvent {
  return { type: 'up', point: { x, y, pressure: 0 }, pointerId, pointerType: 'touch', timestamp: ts }
}

function cancelEvent(pointerId: number): InputEvent {
  return { type: 'cancel', point: { x: 0, y: 0, pressure: 0 }, pointerId, pointerType: 'touch', timestamp: 1200 }
}

describe('EditorKernel 多指针', () => {
  let deps: ReturnType<typeof createMockDeps>
  let kernel: EditorKernel

  beforeEach(() => {
    deps = createMockDeps()
    kernel = new EditorKernel(deps)
  })

  describe('画笔模式 — 多指并发', () => {
    it('双指同时画笔：应产生两个独立的 stroke:start', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(downEvent(2, 200, 300))

      const startCalls = deps.document.apply.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'stroke:start'
      )
      expect(startCalls).toHaveLength(2)
      expect(startCalls[0][0].strokeId).not.toBe(startCalls[1][0].strokeId)
    })

    it('双指 move 应各自触发 drawLiveStrokes（包含两条笔画）', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(downEvent(2, 200, 300))
      kernel.handleInput(moveEvent(1, 110, 210))
      kernel.handleInput(moveEvent(2, 210, 310))

      // 最后一次 drawLiveStrokes 应包含 2 条笔画
      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall).toBeDefined()
      expect(lastCall![0]).toHaveLength(2)
    })

    it('一指先抬起应 commitStroke，另一指继续', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(downEvent(2, 200, 300))
      kernel.handleInput(moveEvent(1))
      kernel.handleInput(moveEvent(2, 210, 310))
      kernel.handleInput(upEvent(1))

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      // 抬起后 drawLiveStrokes 应只剩 1 条
      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall![0]).toHaveLength(1)
    })

    it('所有指都抬起后应 clearLiveLayer', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(moveEvent(1))
      kernel.handleInput(upEvent(1))

      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })

    it('三指画笔，中间一指先抬起，剩余两指继续', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(downEvent(2, 200, 300))
      kernel.handleInput(downEvent(3, 300, 400))
      kernel.handleInput(moveEvent(1))
      kernel.handleInput(moveEvent(2, 210, 310))
      kernel.handleInput(moveEvent(3, 310, 410))
      kernel.handleInput(upEvent(2))

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall![0]).toHaveLength(2)
    })
  })

  describe('橡皮擦模式 — 单指锁', () => {
    beforeEach(() => {
      kernel.penStyle = { type: 'eraser', color: '#000', width: 10, opacity: 1 }
    })

    it('橡皮擦模式第一指应锁定', () => {
      kernel.handleInput(downEvent(1))
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)
    })

    it('橡皮擦模式第二指 down 应被忽略', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(downEvent(2))
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)
    })

    it('橡皮擦锁定指针 up 后应释放锁', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(upEvent(1))
      // 释放后，再次 down 应能锁定
      kernel.handleInput(downEvent(3))
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(2)
    })
  })

  describe('模式切换 — 活跃笔画处理', () => {
    it('画笔→橡皮擦切换应结束所有活跃画笔 session', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(downEvent(2, 200, 300))
      kernel.handleInput(moveEvent(1))
      kernel.handleInput(moveEvent(2, 210, 310))

      // 切换到橡皮擦
      kernel.penStyle = { type: 'eraser', color: '#000', width: 10, opacity: 1 }

      // 应 commitStroke 两次（两笔画自动提交）
      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })

    it('橡皮擦→画笔切换应结束橡皮擦 session 并释放锁', () => {
      kernel.penStyle = { type: 'eraser', color: '#000', width: 10, opacity: 1 }
      kernel.handleInput(downEvent(1))
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)

      // 切换回画笔
      kernel.penStyle = { type: 'pen', color: '#000', width: 2, opacity: 1 }

      expect(deps.renderAdapter.endEraserTrail).toHaveBeenCalled()
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()

      // 锁已释放，新指针应能正常画笔
      kernel.handleInput(downEvent(2))
      const startCalls = deps.document.apply.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'stroke:start'
      )
      expect(startCalls).toHaveLength(1)
    })
  })

  describe('边界情况', () => {
    it('pointercancel 应等同 up（正常提交笔画）', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(moveEvent(1))
      kernel.handleInput(cancelEvent(1))

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
    })

    it('undo 在多指绘制中应先结束所有活跃 session', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(downEvent(2, 200, 300))

      kernel.undo()

      // 两笔画应先 commitStroke，再执行 undo
      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.document.undo).toHaveBeenCalledTimes(1)
    })

    it('快速点触（仅 down+up，无 move）应正常提交', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(upEvent(1))

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd libraries/core && npx vitest run src/__tests__/editor-kernel.multi-pointer.spec.ts
```

Expected: FAIL — 多指 down 时旧 strokeId 被覆盖

- [ ] **Step 3: 改造 EditorKernel 状态变量**

在 `libraries/core/src/editor-kernel.service.ts` 中：

1. 在文件顶部添加 import：
```typescript
import { StrokeSession } from './stroke-session'
```

2. 替换第 67-74 行的状态变量：

将：
```typescript
  /** 当前进行中的笔画 ID */
  private activeStrokeId: string | null = null
  /** 当前进行中的笔画采样点（世界坐标） */
  private activePoints: StrokePoint[] = []
  /** 橡皮擦模式：待删除的笔迹 ID 集合 */
  private pendingDeleteIds: Set<string> = new Set()
  /** 橡皮擦模式：擦除轨迹点（世界坐标） */
  private eraserPoints: StrokePoint[] = []
```

替换为：
```typescript
  /** 活跃笔画会话（pointerId → StrokeSession） */
  private activeSessions: Map<number, StrokeSession> = new Map()
  /** 橡皮擦模式：锁定的指针 ID（单指针锁） */
  private activeEraserPointerId: number | null = null
  /** 橡皮擦模式：待删除的笔迹 ID 集合 */
  private pendingDeleteIds: Set<string> = new Set()
```

- [ ] **Step 4: 添加 startSession / updateSession / endSession 生命周期方法**

在 `handleCancel` 方法后、`undo` 方法前（约第 250 行之后）插入：

```typescript
  // ===== 多指针会话生命周期 =====

  /** 启动新笔画会话 */
  private startSession(pointerId: number, point: StrokePoint, timestamp: number): void {
    const strokeId = generateUid()
    const session = new StrokeSession(pointerId, strokeId, point, timestamp)
    this.activeSessions.set(pointerId, session)
    this.deps.document.apply({
      type: 'stroke:start',
      strokeId,
      style: { ...this._penStyle },
      point,
      timestamp
    })
  }

  /** 更新笔画会话（追加采样点） */
  private updateSession(pointerId: number, point: StrokePoint): void {
    const session = this.activeSessions.get(pointerId)
    if (!session) return
    session.addPoint(point)
    this.deps.document.apply({
      type: 'stroke:addPoint',
      strokeId: session.strokeId,
      point
    })
  }

  /** 结束笔画会话 */
  private endSession(pointerId: number, timestamp: number): void {
    const session = this.activeSessions.get(pointerId)
    if (!session) return

    // 橡皮擦模式：提交擦除
    if (this.isEraserType(this._penStyle)) {
      if (this.pendingDeleteIds.size > 0) {
        this.deps.document.apply({
          type: 'stroke:delete',
          strokeIds: [...this.pendingDeleteIds],
          timestamp
        })
        this.redrawFromSnapshot()
        this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
      }
      this.deps.renderAdapter.endEraserTrail()
      this.activeEraserPointerId = null
      this.pendingDeleteIds = new Set()
      this.activeSessions.delete(pointerId)
      return
    }

    // 画笔模式：提交笔画
    this.deps.document.apply({
      type: 'stroke:end',
      strokeId: session.strokeId,
      timestamp
    })
    this.deps.renderAdapter.commitStroke(session.getPoints(), this._penStyle)
    this.activeSessions.delete(pointerId)
    this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
  }

  /** 结束所有活跃会话 */
  private endAllSessions(): void {
    const timestamp = Date.now()
    for (const pointerId of [...this.activeSessions.keys()]) {
      this.endSession(pointerId, timestamp)
    }
    this.deps.renderAdapter.clearLiveLayer()
  }

  /** 收集所有活跃会话的笔画数据，用于 drawLiveStrokes */
  private collectLiveStrokes(): StrokeData[] {
    const strokes: StrokeData[] = []
    for (const session of this.activeSessions.values()) {
      strokes.push({ points: session.getPoints(), style: this._penStyle })
    }
    return strokes
  }
```

- [ ] **Step 5: 改造 handleDown**

将第 109-144 行的 `handleDown` 替换为：

```typescript
  /** 处理按下事件 */
  private handleDown(event: InputEvent): void {
    const worldPoint = this.deps.coordinateSystem.screenToWorld({
      x: event.point.x,
      y: event.point.y
    })

    const point: StrokePoint = {
      x: worldPoint.x,
      y: worldPoint.y,
      p: event.point.pressure,
      t: event.timestamp
    }

    // 橡皮擦模式：单指针锁
    if (this.isEraserType(this._penStyle)) {
      if (this.activeEraserPointerId !== null) return // 已有橡皮擦在工作，忽略
      this.activeEraserPointerId = event.pointerId
      this.pendingDeleteIds = new Set()
      // 直接创建 session 追踪轨迹点，不发 stroke:start（橡皮擦不需要）
      const session = new StrokeSession(event.pointerId, '__eraser__', point, event.timestamp)
      this.activeSessions.set(event.pointerId, session)
      this.deps.renderAdapter.startEraserTrail(this._penStyle.width)
      this.deps.renderAdapter.addEraserPoint(point)
      return
    }

    // 画笔模式：为该指针创建新 session
    this.startSession(event.pointerId, point, event.timestamp)
  }
```

- [ ] **Step 6: 改造 handleMove**

将第 147-194 行的 `handleMove` 替换为：

```typescript
  /** 处理移动事件 */
  private handleMove(event: InputEvent): void {
    const session = this.activeSessions.get(event.pointerId)
    if (!session) return

    const worldPoint = this.deps.coordinateSystem.screenToWorld({
      x: event.point.x,
      y: event.point.y
    })

    const point: StrokePoint = {
      x: worldPoint.x,
      y: worldPoint.y,
      p: event.point.pressure,
      t: event.timestamp
    }

    this.updateSession(event.pointerId, point)

    // 橡皮擦模式：碰撞检测 + 轨迹
    if (this.isEraserType(this._penStyle)) {
      const eraserProc = this.deps.eraserProcessor
      if (eraserProc?.computeErasure) {
        const snapshot = this.deps.document.getSnapshot()
        const hitIds = eraserProc.computeErasure(
          session.getPoints(),
          this._penStyle,
          snapshot.strokes
        )
        for (const id of hitIds) {
          this.pendingDeleteIds.add(id)
        }
        this.redrawWithHighlight(this.pendingDeleteIds)
      }
      this.deps.renderAdapter.addEraserPoint(point)
      return
    }

    // 画笔模式：批量渲染所有活跃笔画
    this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
  }
```

- [ ] **Step 7: 改造 handleUp**

将第 197-235 行的 `handleUp` 替换为：

```typescript
  /** 处理抬起事件 */
  private handleUp(event: InputEvent): void {
    this.endSession(event.pointerId, event.timestamp)

    if (this.activeSessions.size > 0) {
      this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
    } else {
      this.deps.renderAdapter.clearLiveLayer()
    }
  }
```

- [ ] **Step 8: 改造 handleCancel**

将第 238-250 行的 `handleCancel` 替换为：

```typescript
  /** 处理取消事件（浏览器 pointercancel = 系统中断，等同正常抬手） */
  private handleCancel(event: InputEvent): void {
    this.endSession(event.pointerId, event.timestamp)

    if (this.activeSessions.size > 0) {
      this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
    } else {
      this.deps.renderAdapter.clearLiveLayer()
    }
  }
```

同时修改 `handleInput` 中的 cancel 分支（第 102-104 行）：

将：
```typescript
      case 'cancel':
        this.handleCancel()
        break
```

替换为：
```typescript
      case 'cancel':
        this.handleCancel(event)
        break
```

- [ ] **Step 9: 改造 penStyle setter**

将第 326-328 行的 setter 替换为：

```typescript
  /** 设置笔画样式（如有活跃笔画会先全部提交） */
  set penStyle(style: StrokeStyle) {
    if (this.activeSessions.size > 0) {
      this.endAllSessions()
    }
    this._penStyle = { ...style }
  }
```

- [ ] **Step 10: 改造 undo/redo**

将第 253-257 行的 `undo` 替换为：

```typescript
  /** 撤销 */
  undo(): void {
    if (this.disposed) return
    if (this.activeSessions.size > 0) this.endAllSessions()
    this.deps.document.undo()
    this.redrawFromSnapshot()
  }
```

将第 260-264 行的 `redo` 替换为：

```typescript
  /** 重做 */
  redo(): void {
    if (this.disposed) return
    if (this.activeSessions.size > 0) this.endAllSessions()
    this.deps.document.redo()
    this.redrawFromSnapshot()
  }
```

- [ ] **Step 11: 改造 applyOperation**

将第 281-318 行的 `applyOperation` 替换为：

```typescript
  /** 回放使用的合成 pointerId（类顶部常量） */
  private static readonly REPLAY_POINTER_ID = -1

  /**
   * 应用单个操作并渲染
   * 用于外部回放驱动，直接管理 session 避免 double document.apply
   */
  applyOperation(op: Operation): void {
    if (this.disposed) return
    this.deps.document.apply(op)

    switch (op.type) {
      case 'stroke:start': {
        this._penStyle = { ...op.style }
        // 直接创建 session，不走 startSession（避免 double document.apply）
        const session = new StrokeSession(
          EditorKernel.REPLAY_POINTER_ID, op.strokeId, op.point, op.timestamp
        )
        this.activeSessions.set(EditorKernel.REPLAY_POINTER_ID, session)
        break
      }

      case 'stroke:addPoint': {
        const session = this.activeSessions.get(EditorKernel.REPLAY_POINTER_ID)
        if (!session) break
        session.addPoint(op.point)
        this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
        break
      }

      case 'stroke:end': {
        const session = this.activeSessions.get(EditorKernel.REPLAY_POINTER_ID)
        if (!session) break
        this.deps.renderAdapter.commitStroke(session.getPoints(), this._penStyle)
        this.activeSessions.delete(EditorKernel.REPLAY_POINTER_ID)
        this.deps.renderAdapter.clearLiveLayer()
        this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
        break
      }

      case 'stroke:delete':
        this.redrawFromSnapshot()
        this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
        break

      case 'stroke:clear':
        this.deps.renderAdapter.clearAll()
        this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
        break
    }
  }
```

- [ ] **Step 12: 改造 dispose**

将第 422-431 行的 `dispose` 替换为：

```typescript
  /** 销毁编辑器，释放所有资源 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.activeSessions.clear()
    this.activeEraserPointerId = null
    this.deps.inputAdapter.dispose()
    this.deps.renderAdapter.dispose()
    this.deps.eventBus.dispose()
  }
```

- [ ] **Step 13: 运行多指针测试确认通过**

```bash
cd libraries/core && npx vitest run src/__tests__/editor-kernel.multi-pointer.spec.ts
```

Expected: 全部 PASS

- [ ] **Step 14: 提交**

```bash
git add libraries/core/src/editor-kernel.service.ts libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts
git commit -m "feat: EditorKernel 支持多指针同时书写"
```

---

## Chunk 4: 回归修复 + 收尾

### Task 7: 更新现有测试 mock + 回归

> **前置条件**：Task 2 完成后，现有测试的 `satisfies RenderAdapterInterface` 会编译失败。
> 必须在运行任何 `@aw/core` 测试前先完成本 Task 的 Step 1（添加 drawLiveStrokes mock）。

**Files:**
- Modify: `libraries/core/src/__tests__/editor-kernel.service.spec.ts`

现有测试的 mock `renderAdapter` 缺少 `drawLiveStrokes` 方法，需要补充。同时现有测试中引用了 `clearLiveLayer` + `drawLiveStroke` 的调用模式，改造后变为 `drawLiveStrokes`，需要更新断言。

- [ ] **Step 1: 在现有 mock 中添加 drawLiveStrokes**

在 `libraries/core/src/__tests__/editor-kernel.service.spec.ts` 的 `createMockDeps` 函数中，`renderAdapter` 对象里添加：

```typescript
      drawLiveStrokes: vi.fn(),
```

（在 `drawLiveStroke: vi.fn(),` 之后）

- [ ] **Step 2: 更新现有测试中的渲染调用断言**

搜索现有测试中所有断言 `clearLiveLayer` + `drawLiveStroke` 组合的地方，更新为断言 `drawLiveStrokes`。

具体模式：
- 原来断言 `clearLiveLayer` + `drawLiveStroke` 被连续调用 → 改为断言 `drawLiveStrokes` 被调用
- 原来断言 `commitStroke` + `clearLiveLayer` 在 up 时被调用 → 改为断言 `commitStroke` 被调用 + `clearLiveLayer` 被调用

需要逐个检查并修复。

- [ ] **Step 3: 运行全部 core 包测试**

```bash
cd libraries/core && npx vitest run
```

Expected: 全部 PASS

- [ ] **Step 4: 运行全量类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add libraries/core/src/__tests__/editor-kernel.service.spec.ts
git commit -m "fix: 更新现有 EditorKernel 测试适配多指针改造"
```

---

### Task 8: visibilitychange 监听器

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts`

- [ ] **Step 1: 在 EditorKernel 中添加 visibilitychange 测试**

在 `editor-kernel.multi-pointer.spec.ts` 中追加：

```typescript
  describe('visibilitychange', () => {
    it('页面隐藏时应结束所有活跃 session', () => {
      kernel.handleInput(downEvent(1))
      kernel.handleInput(downEvent(2, 200, 300))

      // 模拟 visibilitychange
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()

      // 恢复
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    })
  })
```

- [ ] **Step 2: 在 EditorKernel 构造函数中注册 visibilitychange 监听**

在构造函数末尾（第 84 行之后）添加：

```typescript
    // 页面隐藏时结束所有活跃笔画
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
```

添加实例方法：

```typescript
  /** 页面隐藏时结束所有活跃笔画 */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && this.activeSessions.size > 0) {
      this.endAllSessions()
    }
  }
```

在 `dispose` 中添加清理：

```typescript
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
```

- [ ] **Step 3: 运行测试**

```bash
cd libraries/core && npx vitest run src/__tests__/editor-kernel.multi-pointer.spec.ts
```

Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add libraries/core/src/editor-kernel.service.ts libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts
git commit -m "feat: EditorKernel 监听 visibilitychange，页面隐藏时结束活跃笔画"
```

---

### Task 9: 全量验证

- [ ] **Step 1: 运行所有包测试**

```bash
cd libraries/core && npx vitest run
cd ../input-pointer && npx vitest run
cd ../render-canvas && npx vitest run
cd ../render-offscreen && npx vitest run
```

Expected: 全部 PASS

- [ ] **Step 2: 全量类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: 构建验证**

```bash
npm run build
```

Expected: 构建成功

- [ ] **Step 4: 同步文档**

更新 `CLAUDE.md` 关键部分：
- 在"EditorKernel"描述中添加"支持多指针同时书写"
- 在"核心抽象"中添加 StrokeSession 条目
- 在"关键文件"表中添加 `stroke-session.ts`

更新 CHANGELOG.md：
- Added: 多点触控同时书写支持

- [ ] **Step 5: 最终提交**

```bash
git add CLAUDE.md CHANGELOG.md
git commit -m "docs: 同步多点触控改造文档"
```
