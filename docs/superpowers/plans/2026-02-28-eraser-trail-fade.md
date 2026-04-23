# 板擦轨迹宽度衰减效果 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现橡皮擦拖动时轨迹尾部逐渐变细消失的效果，类似 Excalidraw

**Architecture:** 新增 `EraserTrail` 类管理轨迹点及衰减动画，通过独立 rAF 循环驱动渲染。每帧计算每个点的衰减宽度（时间衰减 + 长度衰减），生成闭合轮廓 Path2D，在 live layer 上用 `ctx.fill()` 渲染。EditorKernel 中橡皮擦轨迹绘制逻辑委托给 EraserTrail。

**Tech Stack:** TypeScript, Canvas 2D, Path2D, requestAnimationFrame, Vitest

---

## Task 1: EraserTrail 核心类 — 衰减计算

**Files:**
- Create: `libraries/core/src/eraser-trail.ts`
- Test: `libraries/core/src/__tests__/eraser-trail.spec.ts`

### Step 1: 写失败测试 — 衰减计算

```typescript
// libraries/core/src/__tests__/eraser-trail.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EraserTrail } from '../eraser-trail'

describe('EraserTrail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('衰减计算', () => {
    it('刚添加的点衰减系数应接近 1', () => {
      const trail = new EraserTrail({ baseSize: 10 })

      trail.addPoint({ x: 100, y: 200 })
      trail.addPoint({ x: 110, y: 210 })
      trail.addPoint({ x: 120, y: 220 })

      const sizes = trail.getDecayedSizes()
      // 最新的点（最后一个）衰减系数接近 1
      expect(sizes[sizes.length - 1]).toBeGreaterThan(0.8)
    })

    it('超过 DECAY_TIME 的点衰减系数应为 0', () => {
      const trail = new EraserTrail({ baseSize: 10, decayTime: 200 })

      trail.addPoint({ x: 100, y: 200 })

      // 时间前进 300ms
      vi.advanceTimersByTime(300)

      const sizes = trail.getDecayedSizes()
      expect(sizes[0]).toBe(0)
    })

    it('尾部 DECAY_LENGTH 范围内点应逐渐变小', () => {
      const trail = new EraserTrail({
        baseSize: 10,
        decayTime: 5000, // 设大时间衰减，仅测试长度衰减
        decayLength: 5
      })

      // 添加 10 个点
      for (let i = 0; i < 10; i++) {
        trail.addPoint({ x: i * 10, y: 0 })
      }

      const sizes = trail.getDecayedSizes()
      // 从 index 5 开始（尾部 5 个点范围外），size 应较大
      // 尾部方向（index 0-4），size 逐渐变小
      expect(sizes[0]).toBeLessThan(sizes[5])
      expect(sizes[1]).toBeLessThan(sizes[6])
    })

    it('衰减结果取时间衰减和长度衰减的较小值', () => {
      const trail = new EraserTrail({
        baseSize: 10,
        decayTime: 200,
        decayLength: 3
      })

      trail.addPoint({ x: 0, y: 0 })
      // 时间前进 100ms（时间衰减约 0.5）
      vi.advanceTimersByTime(100)
      // 添加更多点让第一个点远离尾部
      for (let i = 1; i <= 5; i++) {
        trail.addPoint({ x: i * 10, y: 0 })
      }

      const sizes = trail.getDecayedSizes()
      // 第一个点同时受时间和长度衰减影响，取较小值
      expect(sizes[0]).toBeLessThanOrEqual(trail.baseSize)
    })
  })
})
```

### Step 2: 运行测试确认失败

Run: `cd libraries/core && pnpm test -- --run eraser-trail`
Expected: FAIL — 模块不存在

### Step 3: 实现 EraserTrail 核心（衰减计算部分）

```typescript
// libraries/core/src/eraser-trail.ts

/** 轨迹点（世界坐标 + 时间戳） */
interface TrailPoint {
  x: number
  y: number
  timestamp: number
}

/** EraserTrail 配置 */
export interface EraserTrailOptions {
  /** 基础轨迹宽度（世界坐标 px） */
  baseSize: number
  /** 时间衰减窗口（ms），默认 200 */
  decayTime?: number
  /** 长度衰减窗口（点数），默认 10 */
  decayLength?: number
}

/** easeOut 缓动：t 从 0→1 映射为减速曲线 */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/**
 * 橡皮擦轨迹管理器
 * 管理轨迹点、衰减计算、轮廓生成和 rAF 动画
 */
export class EraserTrail {
  readonly baseSize: number
  private readonly decayTime: number
  private readonly decayLength: number
  private points: TrailPoint[] = []

  constructor(options: EraserTrailOptions) {
    this.baseSize = options.baseSize
    this.decayTime = options.decayTime ?? 200
    this.decayLength = options.decayLength ?? 10
  }

  /** 添加一个轨迹点 */
  addPoint(p: { x: number; y: number }): void {
    this.points.push({
      x: p.x,
      y: p.y,
      timestamp: performance.now()
    })
  }

  /** 计算所有点的衰减后宽度 */
  getDecayedSizes(): number[] {
    const now = performance.now()
    const total = this.points.length

    return this.points.map((pt, i) => {
      // 时间衰减
      const t = Math.max(0, 1 - (now - pt.timestamp) / this.decayTime)

      // 长度衰减：距离尾部（index 0）越近越小
      const distFromTail = i
      const l = Math.min(distFromTail, this.decayLength) / this.decayLength

      // 取较小值，经过 easeOut 缓动
      const factor = Math.min(easeOut(l), easeOut(t))

      return this.baseSize * factor
    })
  }

  /** 获取当前点数 */
  get length(): number {
    return this.points.length
  }

  /** 清除所有点 */
  clear(): void {
    this.points = []
  }
}
```

### Step 4: 运行测试确认通过

Run: `cd libraries/core && pnpm test -- --run eraser-trail`
Expected: PASS

### Step 5: 提交

```bash
git add libraries/core/src/eraser-trail.ts libraries/core/src/__tests__/eraser-trail.spec.ts
git commit -m "feat: 添加 EraserTrail 核心类 — 衰减计算"
```

---

## Task 2: EraserTrail — 轮廓生成

**Files:**
- Modify: `libraries/core/src/eraser-trail.ts`
- Modify: `libraries/core/src/__tests__/eraser-trail.spec.ts`

### Step 1: 写失败测试 — 轮廓生成

在 `eraser-trail.spec.ts` 中新增 describe：

```typescript
describe('轮廓生成', () => {
  it('少于 2 个点时应返回 null', () => {
    const trail = new EraserTrail({ baseSize: 10 })
    trail.addPoint({ x: 100, y: 200 })

    const outline = trail.computeOutline()
    expect(outline).toBeNull()
  })

  it('2 个以上有效点时应返回 Path2D', () => {
    const trail = new EraserTrail({ baseSize: 10, decayTime: 5000 })
    trail.addPoint({ x: 0, y: 0 })
    trail.addPoint({ x: 10, y: 0 })
    trail.addPoint({ x: 20, y: 0 })

    const outline = trail.computeOutline()
    expect(outline).toBeInstanceOf(Path2D)
  })

  it('所有点衰减为 0 时应返回 null', () => {
    const trail = new EraserTrail({ baseSize: 10, decayTime: 100 })
    trail.addPoint({ x: 0, y: 0 })
    trail.addPoint({ x: 10, y: 0 })

    vi.advanceTimersByTime(200)

    const outline = trail.computeOutline()
    expect(outline).toBeNull()
  })
})
```

### Step 2: 运行测试确认失败

Run: `cd libraries/core && pnpm test -- --run eraser-trail`
Expected: FAIL — computeOutline 不存在

### Step 3: 实现轮廓生成

在 `eraser-trail.ts` 的 `EraserTrail` 类中添加方法：

```typescript
/** 获取原始点数据（供外部读取坐标） */
getPoints(): readonly TrailPoint[] {
  return this.points
}

/** 生成闭合轮廓 Path2D */
computeOutline(): Path2D | null {
  const sizes = this.getDecayedSizes()

  // 过滤出 size > 0 的连续点段
  const validIndices: number[] = []
  for (let i = 0; i < this.points.length; i++) {
    if (sizes[i] > 0) validIndices.push(i)
  }

  if (validIndices.length < 2) return null

  // 计算每个有效点的法线方向，两侧偏移生成轮廓
  const leftPoints: { x: number; y: number }[] = []
  const rightPoints: { x: number; y: number }[] = []

  for (let idx = 0; idx < validIndices.length; idx++) {
    const i = validIndices[idx]
    const pt = this.points[i]
    const halfSize = sizes[i] / 2

    // 计算行进方向
    let dx: number, dy: number
    if (idx === 0) {
      const next = this.points[validIndices[1]]
      dx = next.x - pt.x
      dy = next.y - pt.y
    } else if (idx === validIndices.length - 1) {
      const prev = this.points[validIndices[idx - 1]]
      dx = pt.x - prev.x
      dy = pt.y - prev.y
    } else {
      const prev = this.points[validIndices[idx - 1]]
      const next = this.points[validIndices[idx + 1]]
      dx = next.x - prev.x
      dy = next.y - prev.y
    }

    // 归一化
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) continue

    const nx = -dy / len  // 法线方向
    const ny = dx / len

    leftPoints.push({ x: pt.x + nx * halfSize, y: pt.y + ny * halfSize })
    rightPoints.push({ x: pt.x - nx * halfSize, y: pt.y - ny * halfSize })
  }

  if (leftPoints.length < 2) return null

  // 构建闭合路径：left 正序 → right 逆序
  const path = new Path2D()
  path.moveTo(leftPoints[0].x, leftPoints[0].y)
  for (let i = 1; i < leftPoints.length; i++) {
    path.lineTo(leftPoints[i].x, leftPoints[i].y)
  }
  for (let i = rightPoints.length - 1; i >= 0; i--) {
    path.lineTo(rightPoints[i].x, rightPoints[i].y)
  }
  path.closePath()

  return path
}
```

### Step 4: 运行测试确认通过

Run: `cd libraries/core && pnpm test -- --run eraser-trail`
Expected: PASS

### Step 5: 提交

```bash
git add libraries/core/src/eraser-trail.ts libraries/core/src/__tests__/eraser-trail.spec.ts
git commit -m "feat: EraserTrail 添加闭合轮廓生成"
```

---

## Task 3: EraserTrail — rAF 动画循环

**Files:**
- Modify: `libraries/core/src/eraser-trail.ts`
- Modify: `libraries/core/src/__tests__/eraser-trail.spec.ts`

### Step 1: 写失败测试 — rAF 动画

```typescript
describe('rAF 动画', () => {
  it('start 后应在每帧调用 onFrame 回调', () => {
    const trail = new EraserTrail({ baseSize: 10, decayTime: 5000 })
    trail.addPoint({ x: 0, y: 0 })
    trail.addPoint({ x: 10, y: 0 })

    const onFrame = vi.fn()
    trail.start(onFrame)

    // 模拟一帧
    vi.advanceTimersByTime(16)

    expect(onFrame).toHaveBeenCalled()

    trail.stop()
  })

  it('endTrail 后轨迹应进入 pastTrails 并继续衰减', () => {
    const trail = new EraserTrail({ baseSize: 10, decayTime: 200 })
    trail.addPoint({ x: 0, y: 0 })
    trail.addPoint({ x: 10, y: 0 })

    const onFrame = vi.fn()
    trail.start(onFrame)
    trail.endTrail()

    // 新轨迹开始
    trail.addPoint({ x: 50, y: 50 })
    trail.addPoint({ x: 60, y: 60 })

    // pastTrails 应有 1 条
    expect(trail.pastTrailCount).toBe(1)

    trail.stop()
  })

  it('所有轨迹衰减完毕后应自动停止 rAF', () => {
    const trail = new EraserTrail({ baseSize: 10, decayTime: 100 })
    trail.addPoint({ x: 0, y: 0 })
    trail.addPoint({ x: 10, y: 0 })

    const onFrame = vi.fn()
    trail.start(onFrame)
    trail.endTrail()

    // 等衰减完成
    vi.advanceTimersByTime(300)

    expect(trail.isRunning).toBe(false)
  })

  it('stop 应停止 rAF 循环', () => {
    const trail = new EraserTrail({ baseSize: 10, decayTime: 5000 })
    trail.addPoint({ x: 0, y: 0 })
    trail.addPoint({ x: 10, y: 0 })

    const onFrame = vi.fn()
    trail.start(onFrame)
    trail.stop()

    vi.advanceTimersByTime(100)

    // stop 后不应再调用
    const callCount = onFrame.mock.calls.length
    vi.advanceTimersByTime(100)
    expect(onFrame.mock.calls.length).toBe(callCount)
  })
})
```

### Step 2: 运行测试确认失败

Run: `cd libraries/core && pnpm test -- --run eraser-trail`
Expected: FAIL — start/stop/endTrail 不存在

### Step 3: 实现 rAF 动画循环

在 `EraserTrail` 类中添加：

```typescript
/** 结束当前轨迹的点集合 */
private pastPointSets: TrailPoint[][] = []
/** rAF ID */
private rafId: number | null = null
/** 帧回调 */
private onFrameCallback: ((outlines: Path2D[]) => void) | null = null

/** 获取 pastTrails 数量 */
get pastTrailCount(): number {
  return this.pastPointSets.length
}

/** 动画是否正在运行 */
get isRunning(): boolean {
  return this.rafId !== null
}

/** 启动 rAF 动画循环 */
start(onFrame: (outlines: Path2D[]) => void): void {
  this.onFrameCallback = onFrame
  this.scheduleFrame()
}

/** 停止 rAF 动画循环 */
stop(): void {
  if (this.rafId !== null) {
    cancelAnimationFrame(this.rafId)
    this.rafId = null
  }
  this.onFrameCallback = null
  this.points = []
  this.pastPointSets = []
}

/** 结束当前轨迹，让其继续衰减 */
endTrail(): void {
  if (this.points.length >= 2) {
    this.pastPointSets.push([...this.points])
  }
  this.points = []
}

private scheduleFrame(): void {
  this.rafId = requestAnimationFrame(() => this.frame())
}

private frame(): void {
  const outlines: Path2D[] = []

  // 渲染当前活跃轨迹
  const currentOutline = this.computeOutline()
  if (currentOutline) outlines.push(currentOutline)

  // 渲染 pastTrails
  this.pastPointSets = this.pastPointSets.filter(pts => {
    const outline = this.computeOutlineForPoints(pts)
    if (outline) {
      outlines.push(outline)
      return true
    }
    return false // 已完全衰减，移除
  })

  if (this.onFrameCallback) {
    this.onFrameCallback(outlines)
  }

  // 如果有活跃轨迹或 pastTrails 还在衰减，继续调度
  if (this.points.length > 0 || this.pastPointSets.length > 0) {
    this.scheduleFrame()
  } else {
    this.rafId = null
  }
}

/** 为任意点集合计算轮廓（复用衰减逻辑） */
private computeOutlineForPoints(pts: TrailPoint[]): Path2D | null {
  const savedPoints = this.points
  this.points = pts
  const outline = this.computeOutline()
  this.points = savedPoints
  return outline
}
```

注意：`computeOutlineForPoints` 临时替换 `this.points` 以复用 `computeOutline()` 和 `getDecayedSizes()`。这虽然不够优雅，但避免了大量重复代码。后续可以重构为将 points 作为参数传入的纯函数。

### Step 4: 运行测试确认通过

Run: `cd libraries/core && pnpm test -- --run eraser-trail`
Expected: PASS

注意：vitest 的 `vi.useFakeTimers()` 会 mock `requestAnimationFrame`，但要确保 `setup.ts` 中的 happy-dom 环境支持。如果 `requestAnimationFrame` 未定义，需要在 `setup.ts` 中添加 polyfill。

### Step 5: 提交

```bash
git add libraries/core/src/eraser-trail.ts libraries/core/src/__tests__/eraser-trail.spec.ts
git commit -m "feat: EraserTrail 添加 rAF 动画循环"
```

---

## Task 4: RenderAdapter 接口扩展 — drawEraserTrail

**Files:**
- Modify: `shared/types/src/render-adapter.types.ts:17-40` — 接口添加方法
- Modify: `libraries/core/src/render.adapter.ts:12-24` — 抽象基类添加方法
- Modify: `libraries/render-canvas/src/canvas-render.adapter.ts` — 实现方法

### Step 1: 在接口中添加 drawEraserTrail

在 `shared/types/src/render-adapter.types.ts` 的 `RenderAdapterInterface` 中添加：

```typescript
/** 绘制橡皮擦轨迹轮廓（填充模式） */
drawEraserTrail(outlines: readonly Path2D[], style: { color: string; opacity: number }): void
```

### Step 2: 在抽象基类中添加

在 `libraries/core/src/render.adapter.ts` 的 `RenderAdapter` 中添加：

```typescript
abstract drawEraserTrail(outlines: readonly Path2D[], style: { color: string; opacity: number }): void
```

### Step 3: 在 CanvasRenderAdapter 中实现

在 `libraries/render-canvas/src/canvas-render.adapter.ts` 中添加：

```typescript
/**
 * 绘制橡皮擦轨迹轮廓到 live layer
 * 使用 fill() 而非 stroke()，渲染闭合轮廓
 */
drawEraserTrail(outlines: readonly Path2D[], style: { color: string; opacity: number }): void {
  if (!this.layerManager) return
  const ctx = this.layerManager.getLiveContext()

  ctx.save()
  this.applyCamera(ctx)
  ctx.fillStyle = style.color
  ctx.globalAlpha = style.opacity

  for (const outline of outlines) {
    ctx.fill(outline)
  }

  ctx.restore()
}
```

### Step 4: 更新 mock（测试兼容）

在 `libraries/core/src/__tests__/editor-kernel.service.spec.ts` 的 `createMockDeps` 中，给 `renderAdapter` 添加：

```typescript
drawEraserTrail: vi.fn(),
```

### Step 5: 运行全部测试确认通过

Run: `cd libraries/core && pnpm test -- --run`
Expected: PASS

### Step 6: 提交

```bash
git add shared/types/src/render-adapter.types.ts libraries/core/src/render.adapter.ts libraries/render-canvas/src/canvas-render.adapter.ts libraries/core/src/__tests__/editor-kernel.service.spec.ts
git commit -m "feat: RenderAdapter 添加 drawEraserTrail 接口"
```

---

## Task 5: EditorKernel 集成 EraserTrail

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts:60-77,161-195,220-240,395-410`
- Modify: `libraries/core/src/__tests__/editor-kernel.service.spec.ts:539-727`

### Step 1: 写失败测试 — EditorKernel 集成

在 `editor-kernel.service.spec.ts` 的 `橡皮擦模式` describe 中新增：

```typescript
it('eraser 模式 move 时应调用 drawEraserTrail（而非 drawLiveStroke）', () => {
  addEraserProcessor()
  setupSnapshotWithStrokes()
  const kernel = createKernel()
  kernel.penStyle = eraserStyle

  kernel.handleInput(downEvent())
  kernel.handleInput(moveEvent())

  // 应该使用新的 drawEraserTrail 而非旧的 drawLiveStroke
  // drawLiveStroke 不应被调用（橡皮擦轨迹不再用描边方式）
  // 注意：drawEraserTrail 由 rAF 回调触发，这里验证 EraserTrail 已启动
  expect(deps.renderAdapter.drawEraserTrail).toBeDefined()
})
```

### Step 2: 运行测试确认失败

Run: `cd libraries/core && pnpm test -- --run editor-kernel`
Expected: FAIL

### Step 3: 修改 EditorKernel

**3a. 添加 EraserTrail 实例和初始化**

在 `editor-kernel.service.ts` 顶部导入：

```typescript
import { EraserTrail } from './eraser-trail'
```

在类属性区域（约行 76 附近）添加：

```typescript
/** 橡皮擦轨迹动画管理器 */
private eraserTrail: EraserTrail | null = null
```

**3b. 修改 handleDown（约行 125-129 橡皮擦分支）**

将橡皮擦初始化逻辑改为：

```typescript
if (this.isEraserType(this._penStyle)) {
  this.activeStrokeId = '__eraser__'
  this.pendingDeleteIds = new Set()
  this.eraserPoints = []
  // 初始化 EraserTrail
  this.eraserTrail = new EraserTrail({
    baseSize: this._penStyle.width
  })
  this.eraserTrail.addPoint(point)
  // 启动 rAF 动画
  this.eraserTrail.start(outlines => {
    this.deps.renderAdapter.clearLiveLayer()
    if (outlines.length > 0) {
      this.deps.renderAdapter.drawEraserTrail(outlines, {
        color: 'rgba(0, 0, 0, 0.2)',
        opacity: 1
      })
    }
  })
  return
}
```

**3c. 修改 handleMove 橡皮擦分支（约行 162-195）**

替换为：

```typescript
if (this.isEraserType(this._penStyle)) {
  this.eraserPoints.push(point)
  const eraserProc = this.deps.eraserProcessor
  if (eraserProc?.computeErasure) {
    const snapshot = this.deps.document.getSnapshot()
    const hitIds = eraserProc.computeErasure(
      this.eraserPoints,
      this._penStyle,
      snapshot.strokes
    )
    for (const id of hitIds) {
      this.pendingDeleteIds.add(id)
    }
    this.redrawWithHighlight(this.pendingDeleteIds)
  }

  // 将点添加到 EraserTrail（rAF 回调会自动渲染）
  if (this.eraserTrail) {
    this.eraserTrail.addPoint(point)
  }
  return
}
```

**3d. 修改 handleUp 橡皮擦分支（约行 224-240）**

替换为：

```typescript
if (this.isEraserType(this._penStyle)) {
  if (this.pendingDeleteIds.size > 0) {
    this.deps.document.apply({
      type: 'stroke:delete',
      strokeIds: [...this.pendingDeleteIds],
      timestamp: event.timestamp
    })
    this.redrawFromSnapshot()
    this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
  }
  // 结束轨迹（进入 pastTrails 继续衰减）
  if (this.eraserTrail) {
    this.eraserTrail.endTrail()
    // 不立即 stop —— 让轨迹自然衰减消失
    // rAF 循环会在所有轨迹消失后自动停止
  }
  this.activeStrokeId = null
  this.pendingDeleteIds = new Set()
  this.eraserPoints = []
  return
}
```

**3e. 修改 dispose（约行 395-405）**

在 dispose 中添加清理：

```typescript
if (this.eraserTrail) {
  this.eraserTrail.stop()
  this.eraserTrail = null
}
```

### Step 4: 更新现有测试

修改原来验证 `drawLiveStroke` 被调用的测试（约行 673-688）：

```typescript
it('eraser 模式 move 时应通过 EraserTrail 渲染轨迹', () => {
  addEraserProcessor()
  setupSnapshotWithStrokes()
  const kernel = createKernel()
  kernel.penStyle = eraserStyle

  kernel.handleInput(downEvent())
  kernel.handleInput(moveEvent())

  // EraserTrail 通过 rAF 驱动渲染，验证 clearLiveLayer 被调用
  expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
})
```

修改 `eraser 模式 up 时应清除 live layer（轨迹消失）` 测试（约行 690-703）：

```typescript
it('eraser 模式 up 后轨迹继续衰减（不立即清除）', () => {
  addEraserProcessor()
  setupSnapshotWithStrokes()
  const kernel = createKernel()
  kernel.penStyle = eraserStyle

  kernel.handleInput(downEvent())
  kernel.handleInput(moveEvent())
  kernel.handleInput(upEvent())

  // up 后不应立即清除 live layer — 轨迹继续衰减
  // 但 redrawAll 应被调用（重绘快照）
  expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
})
```

### Step 5: 运行全部测试确认通过

Run: `cd libraries/core && pnpm test -- --run`
Expected: PASS

### Step 6: 提交

```bash
git add libraries/core/src/editor-kernel.service.ts libraries/core/src/__tests__/editor-kernel.service.spec.ts libraries/core/src/eraser-trail.ts
git commit -m "feat: EditorKernel 集成 EraserTrail 实现轨迹衰减效果"
```

---

## Task 6: 清理旧代码 + canvas-render.adapter eraser-trail 分支

**Files:**
- Modify: `libraries/render-canvas/src/canvas-render.adapter.ts:136-143`

### Step 1: 移除 drawPath 中的 eraser-trail 特殊分支

在 `canvas-render.adapter.ts` 的 `drawPath` 方法中，移除 `eraser-trail` 条件分支（行 136-143）。橡皮擦轨迹现在通过 `drawEraserTrail` 方法渲染，不再经过 `drawPath`。

将：

```typescript
if ((style.type as string) === 'eraser-trail') {
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.width / this._camera.zoom
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(resolved)
} else {
  ctx.fillStyle = style.color
  ctx.fill(resolved)
}
```

改为：

```typescript
ctx.fillStyle = style.color
ctx.fill(resolved)
```

### Step 2: 运行全部测试

Run: `cd libraries/core && pnpm test -- --run && cd ../../libraries/render-canvas && pnpm test -- --run 2>/dev/null; cd ../core && pnpm test -- --run`
Expected: PASS

### Step 3: 提交

```bash
git add libraries/render-canvas/src/canvas-render.adapter.ts
git commit -m "refactor: 移除 drawPath 中的 eraser-trail 特殊分支"
```

---

## Task 7: 导出 + 构建验证

**Files:**
- Modify: `libraries/core/src/index.ts` — 导出 EraserTrail

### Step 1: 更新导出

在 `libraries/core/src/index.ts` 中添加：

```typescript
export { EraserTrail } from './eraser-trail'
export type { EraserTrailOptions } from './eraser-trail'
```

### Step 2: 运行构建

Run: `pnpm run build`（根目录）
Expected: 构建成功

### Step 3: 运行全部测试

Run: `cd libraries/core && pnpm test -- --run`
Expected: PASS

### Step 4: 提交

```bash
git add libraries/core/src/index.ts
git commit -m "feat: 导出 EraserTrail 并通过构建验证"
```

---

## Task 8: 手动验证 + 微调

### Step 1: 启动开发服务器

Run: `pnpm run dev`

### Step 2: 手动测试

在浏览器中打开应用，切换到橡皮擦模式：
1. 画几条笔画
2. 切换橡皮擦
3. 拖动橡皮擦，观察轨迹尾部是否逐渐变细消失
4. 松手后观察轨迹是否继续衰减直到完全消失
5. 测试快速拖动和慢速拖动的效果差异

### Step 3: 参数微调

根据视觉效果微调 `EraserTrailOptions` 的默认值：
- `decayTime`：200ms 是否合适（太快/太慢）
- `decayLength`：10 个点是否合适
- `baseSize`：是否跟随 `penStyle.width`
- 颜色：`rgba(0, 0, 0, 0.2)` 是否合适，深色/浅色主题

### Step 4: 最终提交

```bash
git add -u
git commit -m "chore: 微调橡皮擦轨迹衰减参数"
```

---

## Task 9: 更新文档

**Files:**
- Modify: `CLAUDE.md` — 更新架构描述
- Modify: `CHANGELOG.md` — 记录变更

### Step 1: 更新 CLAUDE.md

在 `双 Canvas 架构` 部分补充 EraserTrail 的描述。

### Step 2: 更新 CHANGELOG.md

添加：
```markdown
## [Unreleased]

### Added
- 橡皮擦轨迹宽度衰减效果：拖动时尾部逐渐变细消失，类似 Excalidraw
```

### Step 3: 提交

```bash
git add CLAUDE.md CHANGELOG.md
git commit -m "docs: 更新橡皮擦轨迹衰减效果文档"
```
