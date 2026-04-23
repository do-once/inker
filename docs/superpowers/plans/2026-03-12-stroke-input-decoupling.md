# 笔画输入解耦重构 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EditorKernel API 从输入事件模型转向笔画语义模型，修复多指回放粘连 bug，彻底解耦输入源

**Architecture:** 删除 InputEvent/InputAdapter 抽象基类/handleInput，EditorKernel 暴露 startStroke/addStrokePoint/endStroke 语义方法（implements StrokeInputReceiver），适配器通过 bindKernel 绑定后直接调用方法

**Tech Stack:** TypeScript, Vitest, happy-dom

---

## 前置分析结论

### 坐标系决策

`startStroke` / `addStrokePoint` 的 `point` 参数类型为 **`RawPoint`（屏幕坐标）**，坐标转换（`screenToWorld`）保留在 EditorKernel 内部。理由：适配器不应知道坐标系，与现有实现保持一致。

### penStyle 获取决策

penStyle 不放在 `StrokeInputReceiver` 接口上。kernel 内部直接使用 `this._penStyle`，适配器不需要读取也不需要传递 style。

### StrokeInputReceiver 最终签名

```typescript
interface StrokeInputReceiver {
  startStroke(strokeId: string, point: RawPoint, timestamp: number): void
  addStrokePoint(strokeId: string, point: RawPoint): void
  endStroke(strokeId: string, timestamp: number): void
}
```

---

## Task 1：改造 @aw/types — 类型定义

**Files:**
- Modify: `shared/types/src/input-adapter.types.ts`
- Modify: `shared/types/src/index.ts`

不需要写测试（纯类型改动，TypeScript 编译器就是测试）。

### Step 1.1：改写 input-adapter.types.ts

- [ ] 打开 `shared/types/src/input-adapter.types.ts`，将文件内容完整替换为：

```typescript
/**
 * 输入适配器相关类型
 */

/** 指针类型 */
export type PointerType = 'mouse' | 'touch' | 'pen'

/** 原始输入坐标点（屏幕坐标，未转换为世界坐标） */
export interface RawPoint {
  /** x 像素坐标 */
  readonly x: number
  /** y 像素坐标 */
  readonly y: number
  /** 压力值（0-1），无压感设备为 0 */
  readonly pressure: number
}

/** 笔画输入接收者接口 — EditorKernel 实现此接口 */
export interface StrokeInputReceiver {
  /** 开始一条新笔画 */
  startStroke(strokeId: string, point: RawPoint, timestamp: number): void
  /** 追加采样点 */
  addStrokePoint(strokeId: string, point: RawPoint): void
  /** 结束笔画 */
  endStroke(strokeId: string, timestamp: number): void
}

/** 输入适配器接口 */
export interface InputAdapterInterface {
  /** 绑定 kernel，建立输入→内核通道 */
  bindKernel(kernel: StrokeInputReceiver): void
  /** 销毁适配器，释放资源 */
  dispose(): void
}
```

> 注意：`StrokeInputReceiver` 接口仅依赖 `RawPoint`，无需引入 `StrokeStyle`，不存在循环依赖风险。

### Step 1.2：更新 index.ts 导出

- [ ] 打开 `shared/types/src/index.ts`，将输入适配器导出部分从：

```typescript
// 输入适配器
export type {
  PointerType,
  RawPoint,
  InputEvent,
  InputAdapterInterface
} from './input-adapter.types'
```

改为：

```typescript
// 输入适配器
export type {
  PointerType,
  RawPoint,
  StrokeInputReceiver,
  InputAdapterInterface
} from './input-adapter.types'
```

### Step 1.3：提交

- [ ] `git add shared/types/src/input-adapter.types.ts shared/types/src/index.ts`
- [ ] `git commit -m "refactor: 删除 InputEvent，新增 StrokeInputReceiver，改造 InputAdapterInterface"`

---

## Task 2：改造 StrokeSession — 删除 pointerId

**Files:**
- Modify: `libraries/core/src/stroke-session.ts`
- Modify: `libraries/core/src/__tests__/stroke-session.spec.ts`

### Step 2.1：先写失败测试

- [ ] 打开 `libraries/core/src/__tests__/stroke-session.spec.ts`，将文件完整替换为：

```typescript
import { describe, it, expect } from 'vitest'
import { StrokeSession } from '../stroke-session'
import type { StrokePoint } from '@aw/types'

function point(x: number, y: number, t = 0, p = 0.5): StrokePoint {
  return { x, y, t, p }
}

describe('StrokeSession', () => {
  it('构造时应正确存储 strokeId 和首点', () => {
    const session = new StrokeSession('stroke-001', point(10, 20, 100), 100)
    expect(session.strokeId).toBe('stroke-001')
    expect(session.getPoints()).toEqual([point(10, 20, 100)])
    expect(session.pointCount).toBe(1)
  })

  it('addPoint 应追加到点序列', () => {
    const session = new StrokeSession('s1', point(0, 0), 0)
    session.addPoint(point(10, 10, 16))
    session.addPoint(point(20, 20, 32))
    expect(session.pointCount).toBe(3)
    expect(session.getPoints()).toHaveLength(3)
  })

  it('getPoints 返回的数组不影响内部状态', () => {
    const session = new StrokeSession('s1', point(0, 0), 0)
    const pts = session.getPoints()
    ;(pts as StrokePoint[]).push(point(99, 99))
    expect(session.pointCount).toBe(1)
  })

  it('getLastPoint 应返回最后一个点', () => {
    const session = new StrokeSession('s1', point(0, 0), 0)
    expect(session.getLastPoint()).toEqual(point(0, 0))
    session.addPoint(point(5, 5, 10))
    expect(session.getLastPoint()).toEqual(point(5, 5, 10))
  })

  it('startTimestamp 应返回构造时的时间戳', () => {
    const session = new StrokeSession('s1', point(0, 0), 42)
    expect(session.startTimestamp).toBe(42)
  })
})
```

- [ ] 运行 `cd libraries/core && npx vitest run src/__tests__/stroke-session.spec.ts`，预期：部分测试失败（因为构造函数签名不同）

### Step 2.2：修改 stroke-session.ts

- [ ] 打开 `libraries/core/src/stroke-session.ts`，将文件完整替换为：

```typescript
import type { StrokePoint } from '@aw/types'

/**
 * 笔画会话
 * 管理单条活跃笔画状态（strokeId + 采样点序列）
 */
export class StrokeSession {
  readonly strokeId: string
  readonly startTimestamp: number
  private points: StrokePoint[]

  constructor(
    strokeId: string,
    firstPoint: StrokePoint,
    timestamp: number
  ) {
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

### Step 2.3：验证测试通过

- [ ] 运行 `cd libraries/core && npx vitest run src/__tests__/stroke-session.spec.ts`，预期：全部通过

### Step 2.4：提交

- [ ] `git add libraries/core/src/stroke-session.ts libraries/core/src/__tests__/stroke-session.spec.ts`
- [ ] `git commit -m "refactor: StrokeSession 删除 pointerId 字段，strokeId 是唯一标识"`

---

## Task 3：改造 EditorKernel — 核心重构

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts`
- Modify: `libraries/core/src/__tests__/editor-kernel.service.spec.ts`
- Modify: `libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts`

这是最大的任务，分多步进行。

### Step 3.1：先写失败测试 — editor-kernel.service.spec.ts

- [ ] 打开 `libraries/core/src/__tests__/editor-kernel.service.spec.ts`，将文件完整替换为：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorKernel } from '../editor-kernel.service'
import type {
  InputAdapterInterface,
  RenderAdapterInterface,
  StrokeProcessorInterface,
  StrokeStyle,
  StrokeType,
  StrokeInputReceiver,
  RawPoint,
  Camera
} from '@aw/types'

// ===== Mock 工厂函数 =====

/** 创建全套 mock 依赖 */
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
      bindKernel: vi.fn(),
      dispose: vi.fn()
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
      toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
      exportAsBlob: vi.fn(() => Promise.resolve(new Blob([], { type: 'image/png' }))),
      dispose: vi.fn()
    } satisfies RenderAdapterInterface,
    document: {
      apply: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      getSnapshot: vi.fn(() => ({
        strokes: new Map() as Map<string, any>,
        strokeOrder: [] as string[],
        timestamp: 0
      })),
      getOperations: vi.fn(() => [] as unknown[]),
      canUndo: false,
      canRedo: false
    },
    coordinateSystem: {
      screenToWorld: vi.fn((p: { x: number; y: number }) => ({
        x: p.x,
        y: p.y
      })),
      worldToScreen: vi.fn((p: { x: number; y: number }) => ({
        x: p.x,
        y: p.y
      })),
      resizeContainer: vi.fn(),
      computeFitCamera: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      camera: { x: 0, y: 0, zoom: 1 } as Camera,
      setCamera: vi.fn(),
      toNormalized: vi.fn((p: { x: number; y: number }) => ({
        x: p.x / 800,
        y: p.y / 600
      })),
      fromNormalized: vi.fn((p: { x: number; y: number }) => ({
        x: p.x * 800,
        y: p.y * 600
      })),
      documentWidth: 800,
      documentHeight: 600,
      containerWidth: 800,
      containerHeight: 600
    },
    eraserProcessor: undefined as StrokeProcessorInterface | undefined
  }
}

const defaultStyle: StrokeStyle = {
  type: 'pen',
  color: '#000000',
  size: 2,
  opacity: 1
}

/** 构造 RawPoint */
function raw(x: number, y: number, pressure = 0.5): RawPoint {
  return { x, y, pressure }
}

describe('EditorKernel', () => {
  let deps: ReturnType<typeof createMockDeps>

  beforeEach(() => {
    deps = createMockDeps()
  })

  function createKernel() {
    return new EditorKernel(deps)
  }

  // ===== 1. 构造 & 初始化 =====

  describe('构造 & 初始化', () => {
    it('应能正常构造（传入全部 mock 依赖）', () => {
      const kernel = createKernel()

      expect(kernel).toBeDefined()
      expect(kernel).toBeInstanceOf(EditorKernel)
    })

    it('构造后不再自动注册 inputAdapter.onInput（改用 bindKernel）', () => {
      createKernel()

      // bindKernel 由 EditorBuilder 在构造后调用，kernel 本身不主动调用
      expect(deps.inputAdapter.bindKernel).not.toHaveBeenCalled()
    })
  })

  // ===== 2. startStroke — pointerDown 语义 =====

  describe('startStroke', () => {
    it('调用 startStroke 时应调用 coordinateSystem.screenToWorld 转换坐标', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)

      expect(deps.coordinateSystem.screenToWorld).toHaveBeenCalled()
      const callArg = (deps.coordinateSystem.screenToWorld as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArg.x).toBe(100)
      expect(callArg.y).toBe(200)
    })

    it('startStroke 应调用 document.apply 传入 stroke:start 操作', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)

      expect(deps.document.apply).toHaveBeenCalled()
      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.type).toBe('stroke:start')
    })

    it('stroke:start 操作应包含世界坐标点', () => {
      deps.coordinateSystem.screenToWorld = vi.fn((p: { x: number; y: number }) => ({
        x: p.x * 2,
        y: p.y * 2
      }))
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200, 0.5), 1000)

      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.type).toBe('stroke:start')
      expect(op.point.x).toBe(200)
      expect(op.point.y).toBe(400)
    })

    it('stroke:start 操作应包含传入的笔画样式和时间戳', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200, 0.5), 1000)

      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.type).toBe('stroke:start')
      expect(op.style).toMatchObject(defaultStyle)
      expect(op.timestamp).toBe(1000)
    })
  })

  // ===== 3. addStrokePoint — pointerMove 语义 =====

  describe('addStrokePoint', () => {
    it('调用 addStrokePoint 时应调用 document.apply 传入 stroke:addPoint 操作', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const addPointCall = calls.find((c: any[]) => c[0].type === 'stroke:addPoint')
      expect(addPointCall).toBeDefined()
    })

    it('addStrokePoint 应触发渲染（drawLiveStrokes 被调用）', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))

      expect(deps.renderAdapter.drawLiveStrokes).toHaveBeenCalled()
    })

    it('未 startStroke 直接 addStrokePoint 不应触发任何操作', () => {
      const kernel = createKernel()

      kernel.addStrokePoint('nonexistent', raw(110, 210))

      expect(deps.document.apply).not.toHaveBeenCalled()
      expect(deps.renderAdapter.drawLiveStrokes).not.toHaveBeenCalled()
    })
  })

  // ===== 4. endStroke — pointerUp 语义 =====

  describe('endStroke', () => {
    it('调用 endStroke 时应调用 document.apply 传入 stroke:end 操作', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const endCall = calls.find((c: any[]) => c[0].type === 'stroke:end')
      expect(endCall).toBeDefined()
    })

    it('stroke:end 操作应包含时间戳', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const endCall = calls.find((c: any[]) => c[0].type === 'stroke:end')
      expect(endCall![0].timestamp).toBe(1100)
    })

    it('endStroke 应调用 renderAdapter.commitStroke', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalled()
    })

    it('endStroke 应调用 renderAdapter.clearLiveLayer', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })

    it('endStroke 应通过 eventBus 发出 document:changed 事件', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'document:changed',
        expect.anything()
      )
    })

    it('未 startStroke 直接 endStroke 不应触发任何操作', () => {
      const kernel = createKernel()

      kernel.endStroke('nonexistent', 1100)

      expect(deps.document.apply).not.toHaveBeenCalled()
      expect(deps.renderAdapter.commitStroke).not.toHaveBeenCalled()
    })
  })

  // ===== 4.5 渲染委托参数 =====

  describe('渲染委托参数', () => {
    it('addStrokePoint 时 drawLiveStrokes 传入包含 (points, style) 的笔画数组', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))

      expect(deps.renderAdapter.drawLiveStrokes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            points: expect.any(Array),
            style: expect.objectContaining({ type: 'pen' })
          })
        ])
      )
    })

    it('endStroke 时 commitStroke 传入 (points, style)', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ type: 'pen' })
      )
    })

    it('redrawFromSnapshot 使用 redrawAll(strokes)', () => {
      const strokeMap = new Map([
        ['s1', { id: 's1', points: [{ x: 400, y: 300, p: 0.5, t: 0 }], style: defaultStyle, createdAt: 0 }]
      ])
      deps.document.getSnapshot = vi.fn(() => ({
        strokes: strokeMap,
        strokeOrder: ['s1'],
        timestamp: 0
      }))
      const kernel = createKernel()

      kernel.undo()

      expect(deps.renderAdapter.redrawAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            points: expect.any(Array),
            style: expect.objectContaining({ type: 'pen' })
          })
        ])
      )
    })
  })

  // ===== 5. undo / redo / clear =====

  describe('undo / redo / clear', () => {
    it('undo() 应调用 document.undo()', () => {
      const kernel = createKernel()
      kernel.undo()
      expect(deps.document.undo).toHaveBeenCalled()
    })

    it('undo() 应触发 redrawAll', () => {
      const kernel = createKernel()
      kernel.undo()
      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    })

    it('redo() 应调用 document.redo()', () => {
      const kernel = createKernel()
      kernel.redo()
      expect(deps.document.redo).toHaveBeenCalled()
    })

    it('redo() 应触发 redrawAll', () => {
      const kernel = createKernel()
      kernel.redo()
      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    })

    it('clear() 应调用 document.apply(stroke:clear)', () => {
      const kernel = createKernel()
      kernel.clear()

      expect(deps.document.apply).toHaveBeenCalled()
      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.type).toBe('stroke:clear')
    })

    it('clear() 应调用 renderAdapter.clearAll', () => {
      const kernel = createKernel()
      kernel.clear()
      expect(deps.renderAdapter.clearAll).toHaveBeenCalled()
    })
  })

  // ===== 6. penStyle getter/setter =====

  describe('penStyle getter/setter', () => {
    it('get penStyle 应返回当前样式', () => {
      const kernel = createKernel()
      const style = kernel.penStyle

      expect(style).toBeDefined()
      expect(style.type).toBeDefined()
      expect(style.color).toBeDefined()
      expect(style.size).toBeGreaterThan(0)
    })

    it('set penStyle 应更新样式', () => {
      const kernel = createKernel()
      const newStyle: StrokeStyle = { type: 'marker', color: '#ff0000', size: 5, opacity: 0.8 }

      kernel.penStyle = newStyle

      expect(kernel.penStyle.type).toBe('marker')
      expect(kernel.penStyle.color).toBe('#ff0000')
    })

    it('设置 penStyle 后，新笔画应使用新样式', () => {
      const kernel = createKernel()
      const markerStyle: StrokeStyle = { type: 'marker', color: '#00ff00', size: 10, opacity: 0.6 }

      kernel.penStyle = markerStyle
      kernel.startStroke('s1', raw(100, 200), 1000)

      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.style.type).toBe('marker')
      expect(op.style.color).toBe('#00ff00')
    })
  })

  // ===== 7. 状态代理属性 =====

  describe('状态代理属性', () => {
    it('canUndo 应代理到 document.canUndo', () => {
      deps.document.canUndo = false
      const kernel = createKernel()
      expect(kernel.canUndo).toBe(false)

      deps.document.canUndo = true
      expect(kernel.canUndo).toBe(true)
    })

    it('canRedo 应代理到 document.canRedo', () => {
      deps.document.canRedo = false
      const kernel = createKernel()
      expect(kernel.canRedo).toBe(false)

      deps.document.canRedo = true
      expect(kernel.canRedo).toBe(true)
    })

    it('isEmpty 应基于 document snapshot 判断', () => {
      const kernel = createKernel()
      expect(kernel.isEmpty).toBe(true)
    })

    it('isEmpty 在有笔画时应返回 false', () => {
      const strokeMap = new Map([['stroke-1', { id: 'stroke-1', points: [], style: defaultStyle, createdAt: 0 }]])
      deps.document.getSnapshot = vi.fn(() => ({
        strokes: strokeMap,
        strokeOrder: ['stroke-1'],
        timestamp: 0
      }))
      const kernel = createKernel()
      expect(kernel.isEmpty).toBe(false)
    })

    it('strokeCount 应返回 document snapshot 中的笔画数量', () => {
      const kernel = createKernel()
      expect(kernel.strokeCount).toBe(0)
    })
  })

  // ===== 8. 橡皮擦模式 =====

  describe('橡皮擦模式', () => {
    const eraserStyle: StrokeStyle = { type: 'eraser', color: '#ffffff', size: 20, opacity: 1 }

    function addEraserProcessor() {
      deps.eraserProcessor = {
        supportedTypes: ['eraser', 'wiper'] as readonly StrokeType[],
        computeOutline: vi.fn(() => null),
        computeErasure: vi.fn(() => ['stroke-1'])
      } satisfies StrokeProcessorInterface
    }

    function setupSnapshotWithStrokes() {
      const strokeMap = new Map([
        ['stroke-1', { id: 'stroke-1', points: [{ x: 400, y: 300, p: 0.5, t: 0 }], style: defaultStyle, createdAt: 0 }],
        ['stroke-2', { id: 'stroke-2', points: [{ x: 640, y: 480, p: 0.5, t: 0 }], style: defaultStyle, createdAt: 0 }]
      ])
      deps.document.getSnapshot = vi.fn(() => ({
        strokes: strokeMap,
        strokeOrder: ['stroke-1', 'stroke-2'],
        timestamp: 0
      }))
    }

    it('eraser 模式 startStroke 时不应生成 stroke:start', () => {
      addEraserProcessor()
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      expect(calls.length).toBe(0)
    })

    it('eraser 模式 addStrokePoint 时应调用 eraserProcessor.computeErasure', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))

      expect(deps.eraserProcessor!.computeErasure).toHaveBeenCalled()
    })

    it('eraser 模式 addStrokePoint 时应调用 redrawAll（高亮重绘）', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))

      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    })

    it('eraser 模式 endStroke 时应生成 stroke:delete 操作', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))
      kernel.endStroke('s1', 1100)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const deleteCall = calls.find((c: any[]) => c[0].type === 'stroke:delete')
      expect(deleteCall).toBeDefined()
      expect(deleteCall![0].strokeIds).toContain('stroke-1')
    })

    it('eraser 模式 endStroke 后应触发 redrawFromSnapshot', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))
      kernel.endStroke('s1', 1100)

      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    })

    it('eraser 模式 endStroke 后应发出 document:changed 事件', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))
      kernel.endStroke('s1', 1100)

      expect(deps.eventBus.emit).toHaveBeenCalledWith('document:changed', expect.anything())
    })

    it('无命中时 endStroke 不应生成 stroke:delete', () => {
      deps.eraserProcessor = {
        supportedTypes: ['eraser', 'wiper'] as readonly StrokeType[],
        computeOutline: vi.fn(() => null),
        computeErasure: vi.fn(() => [])
      } satisfies StrokeProcessorInterface
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6))
      kernel.endStroke('s1', 1100)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const deleteCall = calls.find((c: any[]) => c[0].type === 'stroke:delete')
      expect(deleteCall).toBeUndefined()
    })

    it('非 eraser 模式不受影响（回归测试）', () => {
      addEraserProcessor()
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0][0].type).toBe('stroke:start')
    })
  })

  // ===== 9. Camera API =====

  describe('Camera API', () => {
    it('camera 应返回 coordinateSystem 的 camera', () => {
      deps.coordinateSystem.camera = { x: 10, y: 20, zoom: 2 }
      const kernel = createKernel()
      expect(kernel.camera).toEqual({ x: 10, y: 20, zoom: 2 })
    })

    it('setCamera 应同步更新 coordinateSystem 和 renderAdapter', () => {
      const kernel = createKernel()
      const newCamera: Camera = { x: 50, y: 100, zoom: 1.5 }

      kernel.setCamera(newCamera)

      expect(deps.coordinateSystem.setCamera).toHaveBeenCalledWith(newCamera)
      expect(deps.renderAdapter.setCamera).toHaveBeenCalledWith(newCamera)
    })

    it('resize 应更新容器尺寸并自动 fit', () => {
      const kernel = createKernel()
      kernel.resize(1024, 768)

      expect(deps.coordinateSystem.resizeContainer).toHaveBeenCalledWith(1024, 768)
      expect(deps.renderAdapter.resize).toHaveBeenCalledWith(1024, 768)
      expect(deps.coordinateSystem.computeFitCamera).toHaveBeenCalled()
    })

    it('zoomToFit 应调用 computeFitCamera 并设置 camera', () => {
      deps.coordinateSystem.computeFitCamera = vi.fn(() => ({ x: 5, y: 10, zoom: 0.8 }))
      const kernel = createKernel()

      kernel.zoomToFit()

      expect(deps.coordinateSystem.computeFitCamera).toHaveBeenCalled()
      expect(deps.coordinateSystem.setCamera).toHaveBeenCalledWith({ x: 5, y: 10, zoom: 0.8 })
    })

    it('pan 应偏移 camera 位置', () => {
      deps.coordinateSystem.camera = { x: 0, y: 0, zoom: 1 }
      const kernel = createKernel()

      kernel.pan(100, 50)

      expect(deps.coordinateSystem.setCamera).toHaveBeenCalledWith(
        expect.objectContaining({ x: -100, y: -50, zoom: 1 })
      )
    })
  })

  // ===== 10. getSnapshot =====

  describe('getSnapshot', () => {
    it('应委托给 document.getSnapshot()', () => {
      const expectedSnapshot = {
        strokes: new Map([['s1', { id: 's1', points: [], style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 }, createdAt: 0 }]]),
        strokeOrder: ['s1'],
        timestamp: 123
      }
      deps.document.getSnapshot.mockReturnValue(expectedSnapshot)
      const kernel = createKernel()

      const snapshot = kernel.getSnapshot()

      expect(snapshot).toBe(expectedSnapshot)
      expect(deps.document.getSnapshot).toHaveBeenCalled()
      kernel.dispose()
    })
  })

  // ===== 11. getOperations =====

  describe('getOperations', () => {
    it('应委托给 document.getOperations()', () => {
      const ops = [{ type: 'stroke:clear', timestamp: 100 }]
      deps.document.getOperations.mockReturnValue(ops)
      const kernel = createKernel()

      const result = kernel.getOperations()

      expect(result).toBe(ops)
      kernel.dispose()
    })
  })

  // ===== 12. renderAdapter =====

  describe('renderAdapter', () => {
    it('应返回 deps 中的 renderAdapter 引用', () => {
      const kernel = createKernel()

      expect(kernel.renderAdapter).toBe(deps.renderAdapter)
      kernel.dispose()
    })
  })

  // ===== 13. applyOperation =====

  describe('applyOperation', () => {
    it('stroke:start 应调用 document.apply', () => {
      const kernel = createKernel()
      const op = {
        type: 'stroke:start' as const,
        strokeId: 's1',
        style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
        point: { x: 10, y: 20, p: 0.5, t: 100 },
        timestamp: 100
      }

      kernel.applyOperation(op)

      expect(deps.document.apply).toHaveBeenCalledWith(op)
      kernel.dispose()
    })

    it('stroke:addPoint 应渲染到 live layer', () => {
      const kernel = createKernel()

      kernel.applyOperation({
        type: 'stroke:start',
        strokeId: 's1',
        style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
        point: { x: 10, y: 20, p: 0.5, t: 100 },
        timestamp: 100
      })

      kernel.applyOperation({
        type: 'stroke:addPoint',
        strokeId: 's1',
        point: { x: 30, y: 40, p: 0.6, t: 150 }
      })

      expect(deps.renderAdapter.drawLiveStrokes).toHaveBeenCalled()
      kernel.dispose()
    })

    it('stroke:end 应提交到持久层并发出事件', () => {
      const kernel = createKernel()

      kernel.applyOperation({
        type: 'stroke:start',
        strokeId: 's1',
        style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
        point: { x: 10, y: 20, p: 0.5, t: 100 },
        timestamp: 100
      })
      kernel.applyOperation({
        type: 'stroke:end',
        strokeId: 's1',
        timestamp: 200
      })

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalled()
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
      expect(deps.eventBus.emit).toHaveBeenCalledWith('document:changed', expect.anything())
      kernel.dispose()
    })

    it('stroke:clear 应清除所有渲染', () => {
      const kernel = createKernel()

      kernel.applyOperation({ type: 'stroke:clear', timestamp: 100 })

      expect(deps.document.apply).toHaveBeenCalled()
      expect(deps.renderAdapter.clearAll).toHaveBeenCalled()
      kernel.dispose()
    })

    it('stroke:delete 应重绘快照', () => {
      const kernel = createKernel()

      kernel.applyOperation({
        type: 'stroke:delete',
        strokeIds: ['s1'],
        timestamp: 100
      })

      expect(deps.document.apply).toHaveBeenCalled()
      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
      kernel.dispose()
    })
  })

  // ===== 14. dispose =====

  describe('dispose', () => {
    it('dispose 应调用 inputAdapter.dispose', () => {
      const kernel = createKernel()
      kernel.dispose()
      expect(deps.inputAdapter.dispose).toHaveBeenCalled()
    })

    it('dispose 应调用 renderAdapter.dispose', () => {
      const kernel = createKernel()
      kernel.dispose()
      expect(deps.renderAdapter.dispose).toHaveBeenCalled()
    })

    it('dispose 应调用 eventBus.dispose', () => {
      const kernel = createKernel()
      kernel.dispose()
      expect(deps.eventBus.dispose).toHaveBeenCalled()
    })

    it('dispose 后再次调用不应抛错', () => {
      const kernel = createKernel()
      kernel.dispose()
      expect(() => kernel.dispose()).not.toThrow()
    })
  })
})
```

### Step 3.2：先写失败测试 — editor-kernel.multi-pointer.spec.ts

- [ ] 打开 `libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts`，将文件完整替换为：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorKernel } from '../editor-kernel.service'
import type {
  InputAdapterInterface,
  RenderAdapterInterface,
  StrokeStyle,
  RawPoint,
  Camera
} from '@aw/types'

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
      bindKernel: vi.fn(),
      dispose: vi.fn()
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

const penStyle: StrokeStyle = { type: 'pen', color: '#000', size: 2, opacity: 1 }
const eraserStyle: StrokeStyle = { type: 'eraser', color: '#000', size: 10, opacity: 1 }

function raw(x = 100, y = 200, pressure = 0.5): RawPoint {
  return { x, y, pressure }
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
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)

      const startCalls = deps.document.apply.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'stroke:start'
      )
      expect(startCalls).toHaveLength(2)
      expect(startCalls[0][0].strokeId).toBe('stroke-1')
      expect(startCalls[1][0].strokeId).toBe('stroke-2')
    })

    it('双指 addStrokePoint 应各自触发 drawLiveStrokes（包含两条笔画）', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)
      kernel.addStrokePoint('stroke-1', raw(110, 210))
      kernel.addStrokePoint('stroke-2', raw(210, 310))

      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall).toBeDefined()
      expect(lastCall![0]).toHaveLength(2)
    })

    it('一指先 endStroke 应 commitStroke，另一指继续', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)
      kernel.addStrokePoint('stroke-1', raw(110, 210))
      kernel.addStrokePoint('stroke-2', raw(210, 310))
      kernel.endStroke('stroke-1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall![0]).toHaveLength(1)
    })

    it('所有指都 endStroke 后应 clearLiveLayer', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.addStrokePoint('stroke-1', raw(110, 210))
      kernel.endStroke('stroke-1', 1100)

      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })

    it('三指画笔，中间一指先 endStroke，剩余两指继续', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)
      kernel.startStroke('stroke-3', raw(300, 400), 1002)
      kernel.addStrokePoint('stroke-1', raw(110, 210))
      kernel.addStrokePoint('stroke-2', raw(210, 310))
      kernel.addStrokePoint('stroke-3', raw(310, 410))
      kernel.endStroke('stroke-2', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall![0]).toHaveLength(2)
    })
  })

  describe('橡皮擦模式 — 单笔画锁', () => {
    it('橡皮擦模式第一笔应锁定', () => {
      kernel.startStroke('eraser-1', raw(100, 200), 1000)
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)
    })

    it('橡皮擦模式第二笔 startStroke 应被忽略', () => {
      kernel.startStroke('eraser-1', raw(100, 200), 1000)
      kernel.startStroke('eraser-2', raw(200, 300), 1001)
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)
    })

    it('橡皮擦锁定笔画 endStroke 后应释放锁', () => {
      kernel.startStroke('eraser-1', raw(100, 200), 1000)
      kernel.endStroke('eraser-1', 1100)
      kernel.startStroke('eraser-3', raw(300, 400), 1200)
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(2)
    })
  })

  describe('模式切换 — 活跃笔画处理', () => {
    it('画笔→橡皮擦切换应结束所有活跃画笔 session', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)
      kernel.addStrokePoint('stroke-1', raw(110, 210))
      kernel.addStrokePoint('stroke-2', raw(210, 310))

      kernel.penStyle = eraserStyle

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })

    it('橡皮擦→画笔切换应结束橡皮擦 session 并释放锁', () => {
      kernel.penStyle = eraserStyle
      kernel.startStroke('eraser-1', raw(100, 200), 1000)
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)

      kernel.penStyle = penStyle

      expect(deps.renderAdapter.endEraserTrail).toHaveBeenCalled()
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()

      kernel.startStroke('stroke-2', raw(200, 300), 1200)
      const startCalls = deps.document.apply.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'stroke:start'
      )
      expect(startCalls).toHaveLength(1)
    })
  })

  describe('边界情况', () => {
    it('pointercancel 语义（endStroke）应正常提交笔画', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.addStrokePoint('stroke-1', raw(110, 210))
      // cancel 由适配器转换为 endStroke，kernel 层无需区分
      kernel.endStroke('stroke-1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
    })

    it('undo 在多指绘制中应先结束所有活跃 session', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)

      kernel.undo()

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.document.undo).toHaveBeenCalledTimes(1)
    })

    it('快速点触（仅 startStroke+endStroke，无 addStrokePoint）应正常提交', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.endStroke('stroke-1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })
  })

  describe('visibilitychange', () => {
    it('页面隐藏时应结束所有活跃 session', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()

      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    })
  })
})
```

- [ ] 运行 `cd libraries/core && npx vitest run src/__tests__/editor-kernel.service.spec.ts src/__tests__/editor-kernel.multi-pointer.spec.ts`，预期：大量测试失败

### Step 3.3：实现新版 editor-kernel.service.ts

- [ ] 打开 `libraries/core/src/editor-kernel.service.ts`，将文件完整替换为：

```typescript
import type {
  InputAdapterInterface,
  RenderAdapterInterface,
  StrokeProcessorInterface,
  StrokeStyle,
  StrokeInputReceiver,
  RawPoint,
  StrokePoint,
  StrokeData,
  DocumentSnapshot,
  Camera,
  Point,
  Operation
} from '@aw/types'
import { StrokeSession } from './stroke-session'

/** EditorKernel 的依赖项 */
export interface EditorKernelDeps {
  eventBus: {
    on(event: string, handler: (data: unknown) => void): () => void
    off(event: string, handler: (data: unknown) => void): void
    emit(event: string, data?: unknown): void
    dispose(): void
  }
  inputAdapter: InputAdapterInterface
  renderAdapter: RenderAdapterInterface
  document: {
    apply(op: unknown): void
    undo(): void
    redo(): void
    getSnapshot(): DocumentSnapshot
    getOperations(): readonly unknown[]
    canUndo: boolean
    canRedo: boolean
  }
  coordinateSystem: {
    screenToWorld(point: Point): Point
    worldToScreen(point: Point): Point
    resizeContainer(width: number, height: number): void
    computeFitCamera(): Camera
    get camera(): Camera
    setCamera(camera: Camera): void
    toNormalized(point: Point): Point
    fromNormalized(point: Point): Point
    documentWidth: number
    documentHeight: number
    containerWidth: number
    containerHeight: number
  }
  /** 可选的橡皮擦处理器，用于碰撞检测 */
  eraserProcessor?: StrokeProcessorInterface
}

/**
 * 编辑器核心编排层
 * 纯协调层，不含渲染或计算逻辑
 * 实现 StrokeInputReceiver 接口，接受输入适配器的直接调用
 */
export class EditorKernel implements StrokeInputReceiver {
  private deps: EditorKernelDeps
  /** 当前笔画样式 */
  private _penStyle: StrokeStyle = {
    type: 'pen',
    color: '#000000',
    size: 2,
    opacity: 1
  }
  /** 活跃笔画会话（strokeId → StrokeSession） */
  private activeSessions: Map<string, StrokeSession> = new Map()
  /** 橡皮擦模式：锁定的笔画 ID（单笔画锁） */
  private activeEraserStrokeId: string | null = null
  /** 橡皮擦模式：待删除的笔迹 ID 集合 */
  private pendingDeleteIds: Set<string> = new Set()
  /** 是否已销毁 */
  private disposed = false
  /** visibilitychange 事件处理器（已绑定 this，用于注销） */
  private handleVisibilityChange: () => void

  constructor(deps: EditorKernelDeps) {
    this.deps = deps
    // 页面隐藏时结束所有活跃笔画
    this.handleVisibilityChange = this.onVisibilityChange.bind(this)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  // ===== StrokeInputReceiver 实现 =====

  /** 当前笔画样式（EditorKernel 自身属性，不属于 StrokeInputReceiver 接口） */
  get penStyle(): StrokeStyle {
    return this._penStyle
  }

  /**
   * 开始一条新笔画
   * 对应 pointerDown 语义
   */
  startStroke(strokeId: string, point: RawPoint, timestamp: number): void {
    if (this.disposed) return

    const worldPoint = this.deps.coordinateSystem.screenToWorld({
      x: point.x,
      y: point.y
    })

    const strokePoint: StrokePoint = {
      x: worldPoint.x,
      y: worldPoint.y,
      p: point.pressure,
      t: timestamp
    }

    // 橡皮擦模式：单笔画锁
    if (this.isEraserType(this._penStyle)) {
      if (this.activeEraserStrokeId !== null) return // 已有橡皮擦在工作，忽略
      this.activeEraserStrokeId = strokeId
      this.pendingDeleteIds = new Set()
      // 直接创建 session 追踪轨迹点，不发 stroke:start（橡皮擦不需要）
      const session = new StrokeSession(strokeId, strokePoint, timestamp)
      this.activeSessions.set(strokeId, session)
      this.deps.renderAdapter.startEraserTrail(this._penStyle.size)
      this.deps.renderAdapter.addEraserPoint(strokePoint)
      return
    }

    // 画笔模式：创建新 session 并发送 stroke:start
    const session = new StrokeSession(strokeId, strokePoint, timestamp)
    this.activeSessions.set(strokeId, session)
    this.deps.document.apply({
      type: 'stroke:start',
      strokeId,
      style: { ...this._penStyle },
      point: strokePoint,
      timestamp
    })
  }

  /**
   * 追加笔画采样点
   * 对应 pointerMove 语义
   */
  addStrokePoint(strokeId: string, point: RawPoint): void {
    if (this.disposed) return

    const session = this.activeSessions.get(strokeId)
    if (!session) return

    const worldPoint = this.deps.coordinateSystem.screenToWorld({
      x: point.x,
      y: point.y
    })

    const strokePoint: StrokePoint = {
      x: worldPoint.x,
      y: worldPoint.y,
      p: point.pressure,
      t: Date.now()
    }

    session.addPoint(strokePoint)

    // 橡皮擦模式：碰撞检测 + 轨迹
    if (this.activeEraserStrokeId === strokeId) {
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
      this.deps.renderAdapter.addEraserPoint(strokePoint)
      return
    }

    // 画笔模式：追加点到文档，并批量渲染所有活跃笔画
    this.deps.document.apply({
      type: 'stroke:addPoint',
      strokeId: session.strokeId,
      point: strokePoint
    })
    this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
  }

  /**
   * 结束笔画
   * 对应 pointerUp / pointerCancel 语义（适配器已将 cancel 转换为 endStroke）
   */
  endStroke(strokeId: string, timestamp: number): void {
    if (this.disposed) return

    const session = this.activeSessions.get(strokeId)
    if (!session) return

    // 橡皮擦模式：提交擦除
    if (this.activeEraserStrokeId === strokeId) {
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
      this.activeEraserStrokeId = null
      this.pendingDeleteIds = new Set()
      this.activeSessions.delete(strokeId)
      return
    }

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
  }

  // ===== 多指针会话生命周期 =====

  /** 结束所有活跃会话 */
  private endAllSessions(): void {
    const timestamp = Date.now()
    for (const strokeId of [...this.activeSessions.keys()]) {
      this.endStroke(strokeId, timestamp)
    }
    this.deps.renderAdapter.clearLiveLayer()
  }

  /** 页面隐藏时结束所有活跃笔画 */
  private onVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && this.activeSessions.size > 0) {
      this.endAllSessions()
    }
  }

  /** 收集所有活跃会话的笔画数据，用于 drawLiveStrokes */
  private collectLiveStrokes(): StrokeData[] {
    const strokes: StrokeData[] = []
    for (const session of this.activeSessions.values()) {
      strokes.push({ points: session.getPoints(), style: this._penStyle })
    }
    return strokes
  }

  // ===== 撤销/重做/清除 =====

  /** 撤销 */
  undo(): void {
    if (this.disposed) return
    if (this.activeSessions.size > 0) this.endAllSessions()
    this.deps.document.undo()
    this.redrawFromSnapshot()
  }

  /** 重做 */
  redo(): void {
    if (this.disposed) return
    if (this.activeSessions.size > 0) this.endAllSessions()
    this.deps.document.redo()
    this.redrawFromSnapshot()
  }

  /** 清除所有笔画 */
  clear(): void {
    if (this.disposed) return
    this.deps.document.apply({
      type: 'stroke:clear',
      timestamp: Date.now()
    })
    this.deps.renderAdapter.clearAll()
    this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
  }

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
        // 直接创建 session，用 op.strokeId 作为 key
        const session = new StrokeSession(op.strokeId, op.point, op.timestamp)
        this.activeSessions.set(op.strokeId, session)
        break
      }

      case 'stroke:addPoint': {
        const session = this.activeSessions.get(op.strokeId)
        if (!session) break
        session.addPoint(op.point)
        this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
        break
      }

      case 'stroke:end': {
        const session = this.activeSessions.get(op.strokeId)
        if (!session) break
        this.deps.renderAdapter.commitStroke(session.getPoints(), this._penStyle)
        this.activeSessions.delete(op.strokeId)
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

  /** 设置笔画样式（如有活跃笔画会先全部提交） */
  set penStyle(style: StrokeStyle) {
    if (this.activeSessions.size > 0) {
      this.endAllSessions()
    }
    this._penStyle = { ...style }
  }

  /** 是否可以撤销 */
  get canUndo(): boolean {
    return this.deps.document.canUndo
  }

  /** 是否可以重做 */
  get canRedo(): boolean {
    return this.deps.document.canRedo
  }

  /** 文档是否为空 */
  get isEmpty(): boolean {
    return this.deps.document.getSnapshot().strokes.size === 0
  }

  /** 笔画数量 */
  get strokeCount(): number {
    return this.deps.document.getSnapshot().strokes.size
  }

  /** 获取文档快照 */
  getSnapshot(): DocumentSnapshot {
    return this.deps.document.getSnapshot()
  }

  /** 获取全部操作记录 */
  getOperations(): readonly unknown[] {
    return this.deps.document.getOperations()
  }

  /** 暴露渲染适配器引用（用于图片导出） */
  get renderAdapter(): RenderAdapterInterface {
    return this.deps.renderAdapter
  }

  // ===== Camera API =====

  /** 获取当前 camera */
  get camera(): Camera {
    return this.deps.coordinateSystem.camera
  }

  /** 设置 camera 并同步到渲染层 */
  setCamera(camera: Camera): void {
    this.deps.coordinateSystem.setCamera(camera)
    this.deps.renderAdapter.setCamera(camera)
    this.redrawFromSnapshot()
  }

  /** 更新容器尺寸并自动 fit */
  resize(containerWidth: number, containerHeight: number): void {
    this.deps.coordinateSystem.resizeContainer(containerWidth, containerHeight)
    this.deps.renderAdapter.resize(containerWidth, containerHeight)
    const fitCamera = this.deps.coordinateSystem.computeFitCamera()
    this.setCamera(fitCamera)
  }

  /**
   * 锚点缩放
   * 缩放后保持屏幕锚点对应的世界坐标不变
   */
  zoomTo(screenAnchorX: number, screenAnchorY: number, newZoom: number): void {
    const cs = this.deps.coordinateSystem
    const worldAnchor = cs.screenToWorld({ x: screenAnchorX, y: screenAnchorY })
    const newCamera: Camera = {
      x: worldAnchor.x - screenAnchorX / newZoom,
      y: worldAnchor.y - screenAnchorY / newZoom,
      zoom: newZoom
    }
    this.setCamera(newCamera)
  }

  /** 平移（屏幕像素增量） */
  pan(deltaScreenX: number, deltaScreenY: number): void {
    const cs = this.deps.coordinateSystem
    const cam = cs.camera
    const newCamera: Camera = {
      x: cam.x - deltaScreenX / cam.zoom,
      y: cam.y - deltaScreenY / cam.zoom,
      zoom: cam.zoom
    }
    this.setCamera(newCamera)
  }

  /** 自动 fit 文档到容器 */
  zoomToFit(): void {
    const fitCamera = this.deps.coordinateSystem.computeFitCamera()
    this.setCamera(fitCamera)
  }

  /** 销毁编辑器，释放所有资源 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.activeSessions.clear()
    this.activeEraserStrokeId = null
    this.deps.inputAdapter.dispose()
    this.deps.renderAdapter.dispose()
    this.deps.eventBus.dispose()
  }

  /** 判断当前样式是否为擦除模式 */
  private isEraserType(style: StrokeStyle): boolean {
    return style.type === 'eraser' || style.type === 'wiper'
  }

  /** 高亮重绘：命中的笔迹降低透明度 */
  private redrawWithHighlight(highlightIds: Set<string>): void {
    const snapshot = this.deps.document.getSnapshot()
    const strokes: StrokeData[] = []
    for (const strokeId of snapshot.strokeOrder) {
      const stroke = snapshot.strokes.get(strokeId)
      if (!stroke) continue
      const style = highlightIds.has(strokeId)
        ? { ...stroke.style, opacity: 0.3 }
        : stroke.style
      strokes.push({ points: stroke.points, style })
    }
    this.deps.renderAdapter.redrawAll(strokes)
  }

  /** 从文档快照重绘所有笔画 */
  private redrawFromSnapshot(): void {
    const snapshot = this.deps.document.getSnapshot()
    const strokes: StrokeData[] = []
    for (const strokeId of snapshot.strokeOrder) {
      const stroke = snapshot.strokes.get(strokeId)
      if (stroke) strokes.push({ points: stroke.points, style: stroke.style })
    }
    this.deps.renderAdapter.redrawAll(strokes)
  }
}
```

### Step 3.4：验证测试通过

- [ ] 运行 `cd libraries/core && npx vitest run src/__tests__/editor-kernel.service.spec.ts src/__tests__/editor-kernel.multi-pointer.spec.ts src/__tests__/stroke-session.spec.ts`，预期：全部通过

### Step 3.5：提交

- [ ] `git add libraries/core/src/editor-kernel.service.ts libraries/core/src/__tests__/editor-kernel.service.spec.ts libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts`
- [ ] `git commit -m "refactor: EditorKernel 实现 StrokeInputReceiver，用 strokeId 替换 pointerId，删除 handleInput/REPLAY_POINTER_ID"`

---

## Task 4：删除 InputAdapter 抽象基类

**Files:**
- Delete: `libraries/core/src/input.adapter.ts`
- Modify: `libraries/core/src/index.ts`

### Step 4.1：删除文件

- [ ] 删除文件 `libraries/core/src/input.adapter.ts`
  ```bash
  rm libraries/core/src/input.adapter.ts
  ```

### Step 4.2：更新 index.ts

- [ ] 打开 `libraries/core/src/index.ts`，删除 InputAdapter 导出行：

将：
```typescript
// 抽象基类
export { InputAdapter } from './input.adapter'
export { RenderAdapter } from './render.adapter'
export { StrokeProcessor } from './stroke.processor'
export { ComputeStrategy } from './compute.strategy'
```

改为：
```typescript
// 抽象基类
export { RenderAdapter } from './render.adapter'
export { StrokeProcessor } from './stroke.processor'
export { ComputeStrategy } from './compute.strategy'
```

### Step 4.3：提交

- [ ] `git add -u libraries/core/src/`
- [ ] `git commit -m "refactor: 删除 InputAdapter 抽象基类，无可共享逻辑（YAGNI）"`

---

## Task 5：改造 PointerInputAdapter

**Files:**
- Modify: `libraries/input-pointer/src/pointer-input.adapter.ts`
- Modify: `libraries/input-pointer/src/__tests__/pointer-input.adapter.spec.ts`

### Step 5.1：先写失败测试

- [ ] 打开 `libraries/input-pointer/src/__tests__/pointer-input.adapter.spec.ts`，将文件完整替换为：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PointerInputAdapter } from '../pointer-input.adapter'
import type { StrokeInputReceiver, PointerType, RawPoint } from '@aw/types'

/** 创建 mock StrokeInputReceiver */
function createMockKernel(): StrokeInputReceiver {
  return {
    startStroke: vi.fn(),
    addStrokePoint: vi.fn(),
    endStroke: vi.fn()
  }
}

describe('PointerInputAdapter', () => {
  let element: HTMLElement
  let adapter: PointerInputAdapter

  beforeEach(() => {
    element = document.createElement('div')
    document.body.appendChild(element)
    adapter = new PointerInputAdapter()
  })

  afterEach(() => {
    adapter.dispose()
    document.body.removeChild(element)
  })

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
      pointerType: 'mouse',
      bubbles: true,
      ...options
    })
  }

  describe('attach — 绑定事件监听', () => {
    it('attach 到 HTMLElement 后应注册事件监听', () => {
      const spy = vi.spyOn(element, 'addEventListener')

      adapter.attach(element)

      const eventTypes = spy.mock.calls.map(call => call[0])
      expect(eventTypes).toContain('pointerdown')
      expect(eventTypes).toContain('pointermove')
      expect(eventTypes).toContain('pointerup')
      expect(eventTypes).toContain('pointercancel')
    })

    it('attach 后应设置 touch-action: none', () => {
      adapter.attach(element)
      expect(element.style.touchAction).toBe('none')
    })

    it('attach 前有 touchAction 值时，detach 后应恢复', () => {
      element.style.touchAction = 'auto'

      adapter.attach(element)
      expect(element.style.touchAction).toBe('none')

      adapter.detach()
      expect(element.style.touchAction).toBe('auto')
    })
  })

  describe('bindKernel — 绑定内核', () => {
    it('bindKernel 后 pointerdown 应调用 kernel.startStroke', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))

      expect(kernel.startStroke).toHaveBeenCalledTimes(1)
    })

    it('bindKernel 后 pointermove 应调用 kernel.addStrokePoint', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))
      element.dispatchEvent(createPointerEvent('pointermove', { clientX: 110, clientY: 210 }))

      expect(kernel.addStrokePoint).toHaveBeenCalledTimes(1)
    })

    it('bindKernel 后 pointerup 应调用 kernel.endStroke', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))
      element.dispatchEvent(createPointerEvent('pointerup'))

      expect(kernel.endStroke).toHaveBeenCalledTimes(1)
    })

    it('pointercancel 应转换为 kernel.endStroke（不泄漏 cancel 到内核）', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))
      element.dispatchEvent(createPointerEvent('pointercancel'))

      expect(kernel.endStroke).toHaveBeenCalledTimes(1)
    })

    it('startStroke 应传入 strokeId、RawPoint 和 timestamp', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))

      expect(kernel.startStroke).toHaveBeenCalledWith(
        expect.any(String),   // strokeId (UUID)
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), pressure: expect.any(Number) }),
        expect.any(Number)    // timestamp
      )
    })
  })

  describe('pointerToStroke 映射', () => {
    it('每次 pointerdown 应生成不同的 strokeId', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))

      const strokeIds = (kernel.startStroke as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])
      expect(strokeIds[0]).not.toBe(strokeIds[1])
    })

    it('双指 down：同一 addStrokePoint 调用传入正确的 strokeId', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))

      const strokeId1 = (kernel.startStroke as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const strokeId2 = (kernel.startStroke as ReturnType<typeof vi.fn>).mock.calls[1][0]
      expect(strokeId1).not.toBe(strokeId2)

      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 110 }))
      const moveStrokeId = (kernel.addStrokePoint as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(moveStrokeId).toBe(strokeId1)
    })

    it('pointerup 后该 pointerId 的映射应被删除（后续 move 被忽略）', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 120 }))

      expect(kernel.addStrokePoint).not.toHaveBeenCalled()
    })
  })

  describe('setAllowedPointerTypes — 指针类型过滤', () => {
    it('默认允许所有指针类型', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'mouse', pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'touch', pointerId: 2 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 2 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'pen', pointerId: 3 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 3 }))

      expect(kernel.startStroke).toHaveBeenCalledTimes(3)
    })

    it('setAllowedPointerTypes 应过滤非允许类型', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.setAllowedPointerTypes(['pen'] as PointerType[])
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'mouse', pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'pen', pointerId: 2 }))

      expect(kernel.startStroke).toHaveBeenCalledTimes(1)
    })
  })

  describe('detach — 解绑事件', () => {
    it('detach 后不再触发事件', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)
      adapter.detach()

      element.dispatchEvent(createPointerEvent('pointerdown'))

      expect(kernel.startStroke).not.toHaveBeenCalled()
    })
  })

  describe('dispose — 清理所有监听', () => {
    it('dispose 应清理所有事件监听', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)
      adapter.dispose()

      element.dispatchEvent(createPointerEvent('pointerdown'))

      expect(kernel.startStroke).not.toHaveBeenCalled()
    })

    it('dispose 后再次调用 dispose 不应抛错', () => {
      adapter.attach(element)
      adapter.dispose()
      expect(() => adapter.dispose()).not.toThrow()
    })
  })

  describe('多指针追踪', () => {
    it('双指 down：两次 startStroke 均被调用', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))

      expect(kernel.startStroke).toHaveBeenCalledTimes(2)
    })

    it('一指 up 另一指继续（未知 pointerId 的 move 被忽略）', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      // 指针 2 继续 move（应正常触发）
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 210 }))
      // 指针 1 move（应被忽略，因为已 up）
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 120 }))

      expect(kernel.addStrokePoint).toHaveBeenCalledTimes(1)
    })

    it('未知 pointerId 的 move 被忽略', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 99, clientX: 150 }))

      expect(kernel.addStrokePoint).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] 运行 `cd libraries/input-pointer && npx vitest run src/__tests__/pointer-input.adapter.spec.ts`，预期：大量测试失败

### Step 5.2：实现新版 pointer-input.adapter.ts

- [ ] 打开 `libraries/input-pointer/src/pointer-input.adapter.ts`，将文件完整替换为：

```typescript
import type { InputAdapterInterface, StrokeInputReceiver, PointerType, RawPoint } from '@aw/types'
import { generateUid } from '@aw/util'
import { PointExtractor } from './point-extractor.service'

/**
 * Pointer Events 输入适配器
 * 将浏览器 PointerEvent 转换为 StrokeInputReceiver 方法调用
 * pointerId → strokeId 映射在适配器内部维护，不泄漏到内核
 */
export class PointerInputAdapter implements InputAdapterInterface {
  /** 绑定的 DOM 元素 */
  private element: HTMLElement | null = null
  /** 绑定前的原始 touchAction 值 */
  private originalTouchAction: string = ''
  /** 坐标提取器 */
  private readonly extractor = new PointExtractor()
  /** 允许的指针类型，null 表示允许所有 */
  private allowedTypes: PointerType[] | null = null
  /** 当前活跃的指针 ID → strokeId 映射 */
  private pointerToStroke: Map<number, string> = new Map()
  /** 绑定的内核 */
  private kernel: StrokeInputReceiver | null = null

  /** 事件处理器引用（用于移除监听） */
  private readonly handlePointerDown = (e: PointerEvent) => this.onPointerDown(e)
  private readonly handlePointerMove = (e: PointerEvent) => this.onPointerMove(e)
  private readonly handlePointerUp = (e: PointerEvent) => this.onPointerUp(e)
  private readonly handlePointerCancel = (e: PointerEvent) => this.onPointerCancel(e)

  /**
   * 绑定内核，建立输入→内核通道
   */
  bindKernel(kernel: StrokeInputReceiver): void {
    this.kernel = kernel
  }

  /**
   * 绑定到 DOM 元素，开始监听指针事件
   */
  attach(element: HTMLElement): void {
    this.element = element
    // 禁止浏览器默认手势（滚动、缩放），防止数位板/触屏事件被拦截
    this.originalTouchAction = element.style.touchAction
    element.style.touchAction = 'none'
    element.addEventListener('pointerdown', this.handlePointerDown)
    element.addEventListener('pointermove', this.handlePointerMove)
    element.addEventListener('pointerup', this.handlePointerUp)
    element.addEventListener('pointercancel', this.handlePointerCancel)
  }

  /**
   * 解绑 DOM 元素，停止监听
   */
  detach(): void {
    if (this.element) {
      this.element.removeEventListener('pointerdown', this.handlePointerDown)
      this.element.removeEventListener('pointermove', this.handlePointerMove)
      this.element.removeEventListener('pointerup', this.handlePointerUp)
      this.element.removeEventListener('pointercancel', this.handlePointerCancel)
      // 恢复原始 touchAction 值
      this.element.style.touchAction = this.originalTouchAction
      this.element = null
    }
    this.pointerToStroke.clear()
  }

  /**
   * 设置允许的指针类型
   */
  setAllowedPointerTypes(types: PointerType[]): void {
    this.allowedTypes = types
  }

  /**
   * 销毁适配器，释放所有资源
   */
  dispose(): void {
    this.detach()
    this.kernel = null
  }

  /** 检查指针类型是否被允许 */
  private isPointerTypeAllowed(pointerType: string): boolean {
    if (this.allowedTypes === null) return true
    return this.allowedTypes.includes(pointerType as PointerType)
  }

  /** 获取容器偏移量 */
  private getOffset(): { left: number; top: number } {
    if (!this.element) return { left: 0, top: 0 }
    const rect = this.element.getBoundingClientRect()
    return { left: rect.left, top: rect.top }
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.isPointerTypeAllowed(e.pointerType)) return
    if (!this.kernel) return
    // 阻止浏览器默认行为（如文本选择、手势导航）
    e.preventDefault()

    const point = this.extractor.extract(e, this.getOffset())
    if (!point) return

    const rawPoint: RawPoint = { x: point.x, y: point.y, pressure: point.pressure }
    const strokeId = generateUid()
    this.pointerToStroke.set(e.pointerId, strokeId)

    this.kernel.startStroke(strokeId, rawPoint, point.timestamp)
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.kernel) return
    const strokeId = this.pointerToStroke.get(e.pointerId)
    if (!strokeId) return

    const point = this.extractor.extract(e, this.getOffset())
    if (!point) return

    const rawPoint: RawPoint = { x: point.x, y: point.y, pressure: point.pressure }
    this.kernel.addStrokePoint(strokeId, rawPoint)
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.kernel) return
    const strokeId = this.pointerToStroke.get(e.pointerId)
    if (!strokeId) return

    const point = this.extractor.extract(e, this.getOffset())
    const timestamp = point?.timestamp ?? Date.now()

    this.kernel.endStroke(strokeId, timestamp)
    this.pointerToStroke.delete(e.pointerId)
  }

  private onPointerCancel(e: PointerEvent): void {
    if (!this.kernel) return
    const strokeId = this.pointerToStroke.get(e.pointerId)
    if (!strokeId) return

    // cancel 转换为 endStroke，cancel 语义不泄漏到内核
    this.kernel.endStroke(strokeId, Date.now())
    this.pointerToStroke.delete(e.pointerId)
  }
}
```

### Step 5.3：验证测试通过

- [ ] 运行 `cd libraries/input-pointer && npx vitest run src/__tests__/pointer-input.adapter.spec.ts`，预期：全部通过

### Step 5.4：提交

- [ ] `git add libraries/input-pointer/src/pointer-input.adapter.ts libraries/input-pointer/src/__tests__/pointer-input.adapter.spec.ts`
- [ ] `git commit -m "refactor: PointerInputAdapter 改用 bindKernel，内部维护 pointerToStroke 映射，cancel 转 endStroke"`

---

## Task 6：改造 EditorBuilder — DI 组装

**Files:**
- Modify: `libraries/sdk/src/editor.builder.ts`

### Step 6.1：更新 EditorBuilder

- [ ] 打开 `libraries/sdk/src/editor.builder.ts`，定位到 `build()` 方法中的 PointerInputAdapter 创建和 EditorKernel 组装部分：

将：
```typescript
    // 创建或使用自定义输入适配器
    const inputAdapter = this.inputAdapter ?? new PointerInputAdapter()
    inputAdapter.attach(element)

    if (this.allowedPointerTypes) {
      inputAdapter.setAllowedPointerTypes(this.allowedPointerTypes)
    }
```

改为：
```typescript
    // 创建或使用自定义输入适配器
    const inputAdapter = this.inputAdapter ?? new PointerInputAdapter()

    if (this.allowedPointerTypes && 'setAllowedPointerTypes' in inputAdapter) {
      (inputAdapter as PointerInputAdapter).setAllowedPointerTypes(this.allowedPointerTypes)
    }
```

并将 EditorKernel 组装之后，在 `if (this.initialPenStyle)` 之前，新增 `bindKernel` 调用：

将：
```typescript
    // 组装 EditorKernel
    const kernel = new EditorKernel({
      eventBus,
      inputAdapter,
      renderAdapter,
      document,
      coordinateSystem,
      eraserProcessor
    })

    // 设置初始笔画样式
    if (this.initialPenStyle) {
```

改为：
```typescript
    // 组装 EditorKernel
    const kernel = new EditorKernel({
      eventBus,
      inputAdapter,
      renderAdapter,
      document,
      coordinateSystem,
      eraserProcessor
    })

    // 绑定输入适配器到内核（适配器直接调用内核方法）
    inputAdapter.bindKernel(kernel)

    // 绑定到 DOM 元素（在 bindKernel 之后，确保事件触发时 kernel 已就绪）
    if ('attach' in inputAdapter) {
      (inputAdapter as PointerInputAdapter).attach(element)
    }

    // 设置初始笔画样式
    if (this.initialPenStyle) {
```

> 注意：`setAllowedPointerTypes` 和 `attach` 是 PointerInputAdapter 的平台特定方法，不在 InputAdapterInterface 上。对于 `withInputAdapter` 传入的自定义适配器，调用者应在传入前自行完成 attach。若需要更严格的类型支持，可将 `attach` 和 `setAllowedPointerTypes` 提升为可选方法或单独接口。

### Step 6.2：更新 import

- [ ] 在 `editor.builder.ts` 顶部，确认 `PointerInputAdapter` 仍然被 import（用于类型转换）：

```typescript
import { PointerInputAdapter } from '@aw/input-pointer'
```

该 import 已存在，无需修改。

### Step 6.3：提交

- [ ] `git add libraries/sdk/src/editor.builder.ts`
- [ ] `git commit -m "refactor: EditorBuilder 在 kernel 构造后调用 bindKernel，解耦输入绑定时机"`

---

## Task 7：更新文档

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `libraries/core/README.md`
- Modify: `libraries/input-pointer/README.md`
- Modify: `shared/types/README.md`
- Modify: `libraries/sdk/README.md`
- Modify: `CHANGELOG.md`

### Step 7.1：更新 CLAUDE.md

- [ ] 打开 `CLAUDE.md`，更新以下部分：

**核心抽象** 中 `StrokeSession` 的描述，将 `管理 per-pointer 活跃笔画状态` 改为 `管理 per-stroke 活跃笔画状态`。

**架构 → 数据流** 部分，将：
```
PointerInputAdapter → EditorKernel → RenderAdapter.drawLiveStroke(points, style)
```
改为：
```
PointerInputAdapter → EditorKernel（via startStroke/addStrokePoint/endStroke）→ RenderAdapter.drawLiveStroke(points, style)
```

**关键文件** 表中新增一行：
```
| `shared/types/src/input-adapter.types.ts` | StrokeInputReceiver + InputAdapterInterface — 输入接收者接口 |
```

并删除原来没有该文件的行（如有的话只是更新描述）。

**核心抽象** 中删除 `InputAdapter 抽象基类` 相关提及（如有）。

### Step 7.2：更新 README.md

- [ ] 打开 `README.md`，更新时序图，将：
```
Input->>Kernel: InputEvent (down/move/up)
```
改为：
```
Input->>Kernel: startStroke / addStrokePoint / endStroke(strokeId)
```

将 `Note over Kernel: pointerDown` 等注释更新为 `startStroke`、`addStrokePoint`、`endStroke`。

### Step 7.3：更新 libraries/core/README.md

- [ ] 打开 `libraries/core/README.md`，更新以下内容：

**EditorKernel 架构** 图中，将 `input_handler["输入处理<br/>handleDown / handleMove / handleUp"]` 改为 `input_handler["输入接收<br/>startStroke / addStrokePoint / endStroke"]`。

**绘制流程** 时序图中，将 `Input->>Kernel: InputEvent(down/move/up)` 相关改为直接方法调用描述。

**橡皮擦流程** 时序图中，将 `Note over Kernel: handleDown（擦除模式）` 改为 `Note over Kernel: startStroke（擦除模式）`，其他 handle* 同理。

**抽象基类** 表中，删除 `InputAdapter` 那一行。

### Step 7.4：更新 libraries/input-pointer/README.md

- [ ] 打开 `libraries/input-pointer/README.md`，更新 **API** 部分：

将旧的 `onInput` 回调示例：
```typescript
adapter.onInput = (event) => { ... }
```
替换为 `bindKernel` 描述：
```typescript
// 绑定内核（由 EditorBuilder 在构造 EditorKernel 后调用）
adapter.bindKernel(kernel)

// 绑定 DOM 元素
adapter.attach(element)

// 限制允许的指针类型
adapter.setAllowedPointerTypes(['pen', 'touch'])

// 解绑 / 销毁
adapter.detach()
adapter.dispose()
```

更新 **输入管线** 说明，将最终输出从 `InputEvent（统一事件）` 改为 `kernel.startStroke / addStrokePoint / endStroke`。

### Step 7.5：更新 shared/types/README.md

- [ ] 打开 `shared/types/README.md`，更新 **适配器接口** 部分：

将 `InputAdapterInterface` 子图中的方法列表从：
```
attach_i["attach(element)"]
detach_i["detach()"]
onInput["onInput callback"]
setPointer["setAllowedPointerTypes()"]
```
改为：
```
bindKernel["bindKernel(kernel: StrokeInputReceiver)"]
dispose_i["dispose()"]
```

新增 `StrokeInputReceiver` 子图：
```
subgraph "StrokeInputReceiver"
  startStroke["startStroke(strokeId, point, timestamp)"]
  addPoint["addStrokePoint(strokeId, point)"]
  endStroke["endStroke(strokeId, timestamp)"]
end
```

删除 `InputEvent` 的引用（类型体系图中的 `InputAdapter --> InputEvent --> RawPoint & PointerType` 改为 `InputAdapter --> StrokeInputReceiver` 和 `StrokeInputReceiver --> RawPoint`）。

文件结构表中更新 `input-adapter.types.ts` 的说明：将 `InputAdapterInterface` 改为 `InputAdapterInterface + StrokeInputReceiver`，删除 `InputEvent` 提及。

### Step 7.6：更新 libraries/sdk/README.md

- [ ] 打开 `libraries/sdk/README.md`，更新 **构建流程** 时序图：

在 `Builder->>Builder: EditorKernel(deps)` 之后新增：
```
Builder->>Builder: inputAdapter.bindKernel(kernel)
Builder->>Builder: inputAdapter.attach(element)
```

### Step 7.7：更新 CHANGELOG.md

- [ ] 打开 `CHANGELOG.md`，在 `[Unreleased]` 部分新增：

```markdown
### Changed
- EditorKernel API 从 InputEvent/handleInput 模型改为笔画语义 startStroke/addStrokePoint/endStroke（implements StrokeInputReceiver）
- InputAdapterInterface 简化为 bindKernel + dispose，删除 attach/detach/setAllowedPointerTypes/onInput
- activeSessions key 从 pointerId(number) 改为 strokeId(string)，修复多指回放粘连 bug

### Removed
- 删除 InputEvent 类型（@aw/types）
- 删除 InputAdapter 抽象基类（@aw/core）
- 删除 EditorKernel.handleInput / REPLAY_POINTER_ID
- 删除 activeEraserPointerId，改为 activeEraserStrokeId
```

### Step 7.8：提交

- [ ] `git add CLAUDE.md README.md libraries/core/README.md libraries/input-pointer/README.md shared/types/README.md libraries/sdk/README.md CHANGELOG.md`
- [ ] `git commit -m "docs: 同步文档，更新输入模型术语（InputEvent→StrokeInputReceiver，handleInput→startStroke/addStrokePoint/endStroke）"`

---

## Task 8：全量验证

### Step 8.1：运行 @aw/core 全量测试

- [ ] `cd libraries/core && npx vitest run`
- [ ] 预期：所有测试通过，0 failures

### Step 8.2：运行 @aw/input-pointer 全量测试

- [ ] `cd libraries/input-pointer && npx vitest run`
- [ ] 预期：所有测试通过，0 failures

### Step 8.3：运行根目录全量测试

- [ ] `cd /path/to/handwriting && npx vitest run`
- [ ] 预期：所有包测试全部通过

### Step 8.4：TypeScript 类型检查

- [ ] `npx tsc --noEmit`（从根目录运行）
- [ ] 预期：0 errors

### Step 8.5：构建验证

- [ ] `npm run build`
- [ ] 预期：构建成功，输出 `dist/AnimalWriting.es.js` 和 `dist/AnimalWriting.umd.js`

### Step 8.6：最终提交（如有遗漏的 fix）

- [ ] 如有 TypeScript 编译错误或测试失败，逐一修复后提交：`git commit -m "fix: 修复类型检查错误/测试失败"`

---

## 注意事项与潜在风险

### 1. addStrokePoint 中的时间戳

当前 `addStrokePoint` 实现中用 `Date.now()` 作为 StrokePoint 的时间戳。原来的 `handleMove` 通过 `InputEvent.timestamp` 获取时间戳，但 `addStrokePoint(strokeId, RawPoint)` 的 `RawPoint` 不含 timestamp。

**解决方案：** 接受这个轻微的差异。若需要精确时间戳，可以将 `addStrokePoint` 签名扩展为 `addStrokePoint(strokeId: string, point: RawPoint, timestamp?: number)` 并在 PointerInputAdapter 中传入 `point.timestamp`。当前实现先用 `Date.now()` 保持简单。

### 2. EditorBuilder 中自定义适配器的 attach

`withInputAdapter(adapter)` 传入的自定义适配器不会自动被 `attach(element)`。这是有意设计：自定义适配器可能不是 DOM 绑定的（原生容器适配器）。调用者负责自行完成 `attach`。

### 3. TypeScript satisfies 约束

测试文件中 `satisfies InputAdapterInterface` 约束需要与新版接口对齐：新接口只有 `bindKernel` 和 `dispose`，删除了 `attach/detach/setAllowedPointerTypes/onInput`。
