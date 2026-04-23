# OffscreenCanvas 渲染架构重构 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将计算+渲染统一转入 Worker（OffscreenCanvas），释放 UI 主线程，同时统一多渲染器架构（Canvas 2D / SVG / OffscreenCanvas 可插拔切换）。

**Architecture:** 核心变化是将 computeOutline + Canvas 绑定操作内聚到 RenderAdapter 内部。EditorKernel 只发"意图"（StrokePoint[] + StrokeStyle），不再关心计算和渲染细节。通信协议抽象为独立包 @aw/render-protocol（消息类型 + WorkerBridge），异步模型采用 fire-and-forget + flush 屏障。

**Tech Stack:** TypeScript, Vitest, OffscreenCanvas API, Web Workers, postMessage

**Design Doc:** `docs/plans/2026-03-02-offscreen-canvas-design.md`

---

## Phase 1: 类型基础

### Task 1: @aw/types — 新增 OutlineGeometry 和更新 StrokeProcessorInterface

**Files:**
- Create: `shared/types/src/outline-geometry.types.ts`
- Modify: `shared/types/src/stroke-processor.types.ts`
- Modify: `shared/types/src/index.ts`

**Step 1: 创建 OutlineGeometry 类型**

```typescript
// shared/types/src/outline-geometry.types.ts
import type { Point } from './geometry.types'

/** 通用笔画轮廓几何数据（渲染器无关） */
export interface OutlineGeometry {
  /** 轮廓多边形顶点（闭合路径），世界坐标 */
  readonly points: readonly Point[]
}
```

**Step 2: 更新 StrokeProcessorInterface 返回类型**

```typescript
// shared/types/src/stroke-processor.types.ts
import type { OutlineGeometry } from './outline-geometry.types'
// ... 其他 import 不变

export interface StrokeProcessorInterface {
  readonly supportedTypes: readonly StrokeType[]

  computeOutline(
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): OutlineGeometry | null    // 不再返回 Path2D

  computeErasure?(
    eraserPoints: readonly StrokePoint[],
    eraserStyle: StrokeStyle,
    existingStrokes: ReadonlyMap<string, Stroke>
  ): string[]
}
```

**Step 3: 更新 index.ts 导出 OutlineGeometry**

在 `shared/types/src/index.ts` 中添加：

```typescript
// 轮廓几何
export type { OutlineGeometry } from './outline-geometry.types'
```

**Step 4: 运行 typecheck 确认编译通过**

Run: `cd shared/types && npx tsc --noEmit`
Expected: 编译错误（下游包引用旧返回类型），这是预期的——后续 Task 逐步修复

**Step 5: Commit**

```bash
git add shared/types/src/
git commit -m "feat(types): 新增 OutlineGeometry 类型，StrokeProcessor 返回通用几何"
```

---

### Task 2: @aw/types — RenderAdapterInterface 重新设计

**Files:**
- Modify: `shared/types/src/render-adapter.types.ts`
- Modify: `shared/types/src/index.ts`

**Step 1: 新增 StrokeData 类型，替代 RenderedStroke**

```typescript
// shared/types/src/render-adapter.types.ts（替换旧的 RenderedStroke）
import type { StrokePoint } from './stroke-point.types'
import type { StrokeStyle } from './stroke-style.types'
import type { Camera } from './camera.types'

/** 笔画数据（点序列 + 样式，用于渲染适配器消费） */
export interface StrokeData {
  readonly points: readonly StrokePoint[]
  readonly style: StrokeStyle
}
```

**Step 2: 重写 RenderAdapterInterface**

```typescript
/** 渲染适配器接口 */
export interface RenderAdapterInterface {
  // === 生命周期 ===
  attach(element: HTMLElement, width: number, height: number): void
  detach(): void
  resize(width: number, height: number): void
  dispose(): void

  // === 绘制命令（fire-and-forget） ===
  /** 绘制实时笔画（每次 move 事件调用） */
  drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  /** 提交笔画到持久层（笔画结束时调用） */
  commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  /** 清除实时层 */
  clearLiveLayer(): void
  /** 重绘所有已完成的笔画 */
  redrawAll(strokes: readonly StrokeData[]): void
  /** 清除所有渲染内容 */
  clearAll(): void
  /** 设置视口变换 */
  setCamera(camera: Camera): void

  // === 橡皮擦轨迹管理 ===
  /** 启动橡皮擦轨迹动画 */
  startEraserTrail(baseSize: number): void
  /** 添加橡皮擦轨迹点 */
  addEraserPoint(point: { x: number; y: number }): void
  /** 结束当前轨迹（进入衰减） */
  endEraserTrail(): void
  /** 停止轨迹动画并清理 */
  stopEraserTrail(): void

  // === 同步屏障 ===
  /** 等待所有已发出的绘制命令执行完毕 */
  flush(): Promise<void>

  // === 数据返回（async） ===
  exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>
  toDataURL(): Promise<string>
}
```

**Step 3: 更新 index.ts 导出**

```typescript
// 渲染适配器
export type {
  StrokeData,              // 替代旧的 RenderedStroke
  RenderAdapterInterface
} from './render-adapter.types'
```

注意：移除 `RenderedStroke` 导出。后续 Task 需要更新所有引用。

**Step 4: Commit**

```bash
git add shared/types/src/
git commit -m "feat(types): 重新设计 RenderAdapterInterface，意图式 API + flush 屏障"
```

---

## Phase 2: 实现层更新

### Task 3: @aw/core — 更新抽象基类

**Files:**
- Modify: `libraries/core/src/stroke.processor.ts`
- Modify: `libraries/core/src/render.adapter.ts`
- Modify: `libraries/core/src/index.ts`

**Step 1: 更新 StrokeProcessor 抽象基类**

```typescript
// libraries/core/src/stroke.processor.ts
import type {
  StrokeProcessorInterface,
  StrokePoint,
  StrokeStyle,
  StrokeType,
  Stroke,
  OutlineGeometry
} from '@aw/types'

export abstract class StrokeProcessor implements StrokeProcessorInterface {
  abstract readonly supportedTypes: readonly StrokeType[]

  abstract computeOutline(
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): OutlineGeometry | null

  computeErasure?(
    eraserPoints: readonly StrokePoint[],
    eraserStyle: StrokeStyle,
    existingStrokes: ReadonlyMap<string, Stroke>
  ): string[]
}
```

**Step 2: 更新 RenderAdapter 抽象基类**

```typescript
// libraries/core/src/render.adapter.ts
import type {
  RenderAdapterInterface,
  StrokeData,
  StrokePoint,
  StrokeStyle,
  Camera
} from '@aw/types'

export abstract class RenderAdapter implements RenderAdapterInterface {
  // 生命周期
  abstract attach(element: HTMLElement, width: number, height: number): void
  abstract detach(): void
  abstract resize(width: number, height: number): void
  abstract dispose(): void

  // 绘制命令
  abstract drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  abstract commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  abstract clearLiveLayer(): void
  abstract redrawAll(strokes: readonly StrokeData[]): void
  abstract clearAll(): void
  abstract setCamera(camera: Camera): void

  // 橡皮擦轨迹
  abstract startEraserTrail(baseSize: number): void
  abstract addEraserPoint(point: { x: number; y: number }): void
  abstract endEraserTrail(): void
  abstract stopEraserTrail(): void

  // 同步屏障 + 数据返回
  abstract flush(): Promise<void>
  abstract exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>
  abstract toDataURL(): Promise<string>
}
```

**Step 3: Commit**

```bash
git add libraries/core/src/
git commit -m "refactor(core): 更新 StrokeProcessor 和 RenderAdapter 抽象基类"
```

---

### Task 4: @aw/brush-freehand — 返回 OutlineGeometry

**Files:**
- Modify: `libraries/brush-freehand/src/freehand.processor.ts`
- Modify: `libraries/brush-freehand/src/__tests__/freehand.processor.spec.ts`

**Step 1: 更新 FreehandProcessor.computeOutline**

关键变化：`getStroke()` 返回 `[number, number][]`，现在直接包装为 `OutlineGeometry` 而非构建 Path2D。

```typescript
// libraries/brush-freehand/src/freehand.processor.ts
import { StrokeProcessor } from '@aw/core'
import { getStroke } from '@aw/freehand'
import type { StrokePoint, StrokeStyle, StrokeType, OutlineGeometry } from '@aw/types'

// 删除 outlineToSvgPath 函数（不再需要）

export class FreehandProcessor extends StrokeProcessor {
  readonly supportedTypes: readonly StrokeType[] = ['pen', 'marker', 'pencil']

  computeOutline(
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): OutlineGeometry | null {
    if (points.length === 0) return null

    const inputPoints = points.map(p => ({
      x: p.x,
      y: p.y,
      pressure: p.p
    }))

    const outline = getStroke(inputPoints, {
      size: style.width,
      last: complete,
      simulatePressure: (style.simulatePressure as boolean) ?? true,
      thinning: style.thinning as number | undefined,
      smoothing: style.smoothing as number | undefined,
      streamline: style.streamline as number | undefined,
      start: style.taperStart != null ? { taper: style.taperStart as number } : undefined,
      end: style.taperEnd != null ? { taper: style.taperEnd as number } : undefined
    })

    if (!outline || outline.length < 2) return null

    // 直接返回通用几何数据
    return {
      points: outline.map(([x, y]) => ({ x, y }))
    }
  }
}
```

**Step 2: 更新测试 — 断言返回 OutlineGeometry 而非 Path2D**

修改 `freehand.processor.spec.ts` 中所有 `expect(result).toBeInstanceOf(Path2D)` 为：

```typescript
expect(result).not.toBeNull()
expect(result!.points).toBeDefined()
expect(result!.points.length).toBeGreaterThan(0)
// 验证每个点有 x, y 属性
expect(result!.points[0]).toHaveProperty('x')
expect(result!.points[0]).toHaveProperty('y')
```

**Step 3: 运行测试**

Run: `cd libraries/brush-freehand && npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add libraries/brush-freehand/
git commit -m "refactor(brush-freehand): computeOutline 返回 OutlineGeometry"
```

---

### Task 5: @aw/render-canvas — 集成计算 + 橡皮擦轨迹管理

**Files:**
- Modify: `libraries/render-canvas/src/canvas-render.adapter.ts`
- Modify: `libraries/render-canvas/src/__tests__/canvas-render.adapter.spec.ts`

这是最大的单个 Task。核心变化：
1. 构造函数接收 `StrokeProcessorInterface`
2. draw/commit/redrawAll 接收 StrokePoint[]，内部调 strokeProcessor → OutlineGeometry → Path2D
3. 内部管理 EraserTrail
4. 新增 flush()（返回 Promise.resolve）
5. toDataURL 变为 async

**Step 1: 新增 OutlineGeometry → Path2D 转换工具方法**

```typescript
import type { OutlineGeometry } from '@aw/types'

/** 将 OutlineGeometry 转换为 Path2D */
function geometryToPath2D(geometry: OutlineGeometry): Path2D {
  const path = new Path2D()
  const pts = geometry.points
  if (pts.length < 2) return path
  path.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    path.lineTo(pts[i].x, pts[i].y)
  }
  path.closePath()
  return path
}
```

**Step 2: 重写 CanvasRenderAdapter**

```typescript
export class CanvasRenderAdapter extends RenderAdapter {
  private layerManager: CanvasLayerManager | null = null
  private _camera: Camera = { x: 0, y: 0, zoom: 1 }
  private _containerWidth = 0
  private _containerHeight = 0
  private eraserTrail: EraserTrail | null = null

  constructor(private strokeProcessor: StrokeProcessorInterface) {
    super()
  }

  // attach / detach / resize / setCamera / clearAll / clearLiveLayer
  // 保持不变

  drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void {
    if (!this.layerManager) return
    const outline = this.strokeProcessor.computeOutline(points, style, false)
    if (!outline) return
    const ctx = this.layerManager.getLiveContext()
    this.drawPath(ctx, geometryToPath2D(outline), style)
  }

  commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void {
    if (!this.layerManager) return
    const outline = this.strokeProcessor.computeOutline(points, style, true)
    if (!outline) return
    const ctx = this.layerManager.getRenderContext()
    this.drawPath(ctx, geometryToPath2D(outline), style)
  }

  redrawAll(strokes: readonly StrokeData[]): void {
    if (!this.layerManager) return
    const ctx = this.layerManager.getRenderContext()
    this.clearContext(ctx)
    for (const stroke of strokes) {
      const outline = this.strokeProcessor.computeOutline(stroke.points, stroke.style, true)
      if (outline) {
        this.drawPath(ctx, geometryToPath2D(outline), stroke.style)
      }
    }
  }

  // 橡皮擦轨迹管理
  startEraserTrail(baseSize: number): void {
    if (this.eraserTrail) this.eraserTrail.stop()
    this.eraserTrail = new EraserTrail({ baseSize })
    this.eraserTrail.start(outlines => {
      this.clearLiveLayer()
      if (!this.layerManager || outlines.length === 0) return
      const ctx = this.layerManager.getLiveContext()
      ctx.save()
      this.applyCamera(ctx)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.globalAlpha = 1
      for (const outline of outlines) ctx.fill(outline)
      ctx.restore()
    })
  }

  addEraserPoint(point: { x: number; y: number }): void {
    this.eraserTrail?.addPoint(point)
  }

  endEraserTrail(): void {
    this.eraserTrail?.endTrail()
  }

  stopEraserTrail(): void {
    if (this.eraserTrail) {
      this.eraserTrail.stop()
      this.eraserTrail = null
    }
  }

  flush(): Promise<void> {
    return Promise.resolve()
  }

  toDataURL(): Promise<string> {
    if (!this.layerManager) return Promise.resolve('')
    const ctx = this.layerManager.getRenderContext()
    return Promise.resolve((ctx.canvas as HTMLCanvasElement).toDataURL())
  }

  // exportAsBlob 保持不变（已经是 async）

  dispose(): void {
    this.stopEraserTrail()
    this.detach()
  }

  // drawPath / applyCamera / clearContext 私有方法保持不变
  // drawPath 签名简化为只接受 Path2D（不再接受 string）
}
```

**Step 3: 更新测试**

测试需要提供 mock StrokeProcessor：

```typescript
import type { OutlineGeometry, StrokePoint, StrokeStyle } from '@aw/types'

const mockProcessor = {
  supportedTypes: ['pen'] as const,
  computeOutline: (points: readonly StrokePoint[], _style: StrokeStyle, _complete: boolean): OutlineGeometry | null => {
    if (points.length === 0) return null
    return { points: points.map(p => ({ x: p.x, y: p.y })) }
  }
}

// 创建 adapter 时传入 mock
const adapter = new CanvasRenderAdapter(mockProcessor)
```

更新所有测试中的 `drawLiveStroke(path2d, style)` 调用为 `drawLiveStroke(points, style)`。

**Step 4: 运行测试**

Run: `cd libraries/render-canvas && npx vitest run`
Expected: PASS

**Step 5: Commit**

```bash
git add libraries/render-canvas/
git commit -m "refactor(render-canvas): 集成计算 + 橡皮擦轨迹，接口改为意图式"
```

---

### Task 6: @aw/core — EditorKernel 简化

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts`
- Modify: `libraries/core/src/index.ts`（如有导出变化）

**核心变化：**
- 移除 `strokeProcessor` 和 `computeStrategy` 依赖（渲染计算已内聚到 RenderAdapter）
- 保留 `eraserProcessor`（碰撞检测仍在 EditorKernel）
- handleMove/handleUp 简化：直接调 renderAdapter.drawLiveStroke(points, style)
- applyOperation 简化：同上
- redrawFromSnapshot/redrawWithHighlight 简化：传 StrokeData[] 给 renderAdapter.redrawAll
- 橡皮擦轨迹管理委托给 renderAdapter

**Step 1: 更新 EditorKernelDeps**

```typescript
export interface EditorKernelDeps {
  eventBus: { /* 不变 */ }
  inputAdapter: InputAdapterInterface
  renderAdapter: RenderAdapterInterface
  // 移除 strokeProcessor 和 computeStrategy
  document: { /* 不变 */ }
  coordinateSystem: { /* 不变 */ }
  eraserProcessor?: StrokeProcessorInterface  // 保留，用于碰撞检测
}
```

**Step 2: 简化 handleMove**

```typescript
private handleMove(event: InputEvent): void {
  if (!this.activeStrokeId) return
  const point = this.toWorldStrokePoint(event)

  if (this.isEraserType(this._penStyle)) {
    this.eraserPoints.push(point)
    // 碰撞检测
    const eraserProc = this.deps.eraserProcessor
    if (eraserProc?.computeErasure) {
      const snapshot = this.deps.document.getSnapshot()
      const hitIds = eraserProc.computeErasure(this.eraserPoints, this._penStyle, snapshot.strokes)
      for (const id of hitIds) this.pendingDeleteIds.add(id)
      this.redrawWithHighlight(this.pendingDeleteIds)
    }
    // 轨迹点委托给渲染适配器
    this.deps.renderAdapter.addEraserPoint(point)
    return
  }

  this.activePoints.push(point)
  this.deps.document.apply({ type: 'stroke:addPoint', strokeId: this.activeStrokeId, point })

  // 直接发意图，不再调 strokeProcessor
  this.deps.renderAdapter.clearLiveLayer()
  this.deps.renderAdapter.drawLiveStroke(this.activePoints, this._penStyle)
}
```

**Step 3: 简化 handleDown 橡皮擦部分**

```typescript
// 替换 EraserTrail 创建逻辑：
this.deps.renderAdapter.startEraserTrail(this._penStyle.width)
this.deps.renderAdapter.addEraserPoint(point)
// 移除 this.eraserTrail 相关代码
```

**Step 4: 简化 handleUp**

```typescript
// 普通笔画：
this.deps.renderAdapter.commitStroke(this.activePoints, this._penStyle)
this.deps.renderAdapter.clearLiveLayer()

// 橡皮擦：
this.deps.renderAdapter.endEraserTrail()
```

**Step 5: 简化 handleCancel**

```typescript
this.deps.renderAdapter.stopEraserTrail()
// 移除 this.eraserTrail 相关代码
```

**Step 6: 简化 redrawFromSnapshot 和 redrawWithHighlight**

```typescript
private redrawFromSnapshot(): void {
  const snapshot = this.deps.document.getSnapshot()
  const strokes: StrokeData[] = []
  for (const strokeId of snapshot.strokeOrder) {
    const stroke = snapshot.strokes.get(strokeId)
    if (stroke) strokes.push({ points: stroke.points, style: stroke.style })
  }
  this.deps.renderAdapter.redrawAll(strokes)
}

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
```

**Step 7: 简化 applyOperation**

```typescript
case 'stroke:addPoint':
  if (!this.activeStrokeId) break
  this.activePoints.push(op.point)
  this.deps.renderAdapter.clearLiveLayer()
  this.deps.renderAdapter.drawLiveStroke(this.activePoints, this._penStyle)
  break

case 'stroke:end':
  this.deps.renderAdapter.commitStroke(this.activePoints, this._penStyle)
  this.deps.renderAdapter.clearLiveLayer()
  // ...
  break
```

**Step 8: 移除 EraserTrail import 和成员变量**

从 EditorKernel 中移除：
- `import { EraserTrail } from './eraser-trail'`
- `private eraserTrail: EraserTrail | null = null`
- dispose 中的 eraserTrail 清理

**Step 9: 运行全量测试**

Run: `npx vitest run --reporter=verbose` (from root)
Expected: 可能有部分测试因 EditorKernelDeps 变化需调整

**Step 10: Commit**

```bash
git add libraries/core/
git commit -m "refactor(core): EditorKernel 简化，不再直接调 strokeProcessor"
```

---

### Task 7: @aw/sdk — EditorBuilder 适配

**Files:**
- Modify: `libraries/sdk/src/editor.builder.ts`

**Step 1: 更新 EditorBuilder.build()**

```typescript
// 创建笔画处理器
const strokeProcessor = this.strokeProcessor ?? new FreehandProcessor()
const eraserProcessor = this.eraserProcessor ?? new RectEraserProcessor()

// 创建渲染适配器 —— 传入 strokeProcessor
const renderAdapter = this.renderAdapter ?? new CanvasRenderAdapter(strokeProcessor)
renderAdapter.attach(element, width, height)

// 移除 computeStrategy 创建
// const computeStrategy = new MainThreadStrategy()  ← 删除

// 组装 EditorKernel —— 移除 strokeProcessor 和 computeStrategy
const kernel = new EditorKernel({
  eventBus,
  inputAdapter,
  renderAdapter,
  document,
  coordinateSystem,
  eraserProcessor
})
```

**Step 2: 移除 MainThreadStrategy import**

```typescript
// 删除: import { MainThreadStrategy } from '@aw/compute-worker'
```

**Step 3: 运行构建检查**

Run: `cd libraries/sdk && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add libraries/sdk/
git commit -m "refactor(sdk): EditorBuilder 适配新的 RenderAdapter 接口"
```

---

## Phase 3: 通信协议包

### Task 8: @aw/render-protocol — 创建新包

**Files:**
- Create: `libraries/render-protocol/package.json`
- Create: `libraries/render-protocol/tsconfig.json`
- Create: `libraries/render-protocol/src/index.ts`
- Create: `libraries/render-protocol/src/types.ts`
- Create: `libraries/render-protocol/src/worker-bridge.ts`
- Create: `libraries/render-protocol/src/__tests__/worker-bridge.spec.ts`
- Create: `libraries/render-protocol/vitest.config.ts`

**Step 1: 创建 package.json**

```json
{
  "name": "@aw/render-protocol",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aw/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../run-control/tsconfig.lib.json",
  "include": ["src"]
}
```

**Step 3: 创建 vitest.config.ts**

```typescript
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../run-control/vitest.config.base'

export default mergeConfig(baseConfig, defineConfig({
  test: { root: '.' }
}))
```

**Step 4: 定义消息类型**

```typescript
// libraries/render-protocol/src/types.ts
import type { StrokePoint, StrokeStyle, StrokeData, Camera } from '@aw/types'

/** 主线程 → Worker 的渲染指令 */
export type RenderCommand =
  | { cmd: 'drawLive'; points: StrokePoint[]; style: StrokeStyle }
  | { cmd: 'commit'; points: StrokePoint[]; style: StrokeStyle }
  | { cmd: 'clearLive' }
  | { cmd: 'redrawAll'; strokes: StrokeData[] }
  | { cmd: 'clearAll' }
  | { cmd: 'setCamera'; camera: Camera }
  | { cmd: 'resize'; width: number; height: number }
  | { cmd: 'startEraserTrail'; baseSize: number }
  | { cmd: 'addEraserPoint'; point: { x: number; y: number } }
  | { cmd: 'endEraserTrail' }
  | { cmd: 'stopEraserTrail' }
  | { cmd: 'flush'; id: number }
  | { cmd: 'export'; id: number; format: 'png' | 'jpeg'; quality?: number }
  | { cmd: 'toDataURL'; id: number }

/** Worker → 主线程的响应 */
export type RenderResponse =
  | { cmd: 'flushed'; id: number }
  | { cmd: 'exported'; id: number; blob: Blob }
  | { cmd: 'dataURL'; id: number; url: string }
```

**Step 5: 实现 WorkerBridge**

```typescript
// libraries/render-protocol/src/worker-bridge.ts
import type { RenderCommand, RenderResponse } from './types'

/** 主线程侧 Bridge：向 Worker 发送指令 */
export class WorkerBridgeHost {
  private nextId = 1
  private pending = new Map<number, {
    resolve: (resp: RenderResponse) => void
    reject: (err: Error) => void
  }>()

  constructor(private worker: Worker) {
    this.worker.onmessage = (e: MessageEvent<RenderResponse>) => {
      const resp = e.data
      if ('id' in resp) {
        const entry = this.pending.get(resp.id)
        if (entry) {
          this.pending.delete(resp.id)
          entry.resolve(resp)
        }
      }
    }
  }

  /** fire-and-forget 发送 */
  send(cmd: RenderCommand): void {
    this.worker.postMessage(cmd)
  }

  /** request-response 发送 */
  request(cmd: RenderCommand & { id?: number }): Promise<RenderResponse> {
    const id = this.nextId++
    const tagged = { ...cmd, id }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage(tagged)
    })
  }

  dispose(): void {
    this.worker.terminate()
    for (const entry of this.pending.values()) {
      entry.reject(new Error('WorkerBridge disposed'))
    }
    this.pending.clear()
  }
}

/** Worker 侧 Bridge：接收指令并分发 */
export class WorkerBridgeWorker {
  private handler: ((cmd: RenderCommand) => void) | null = null

  /** 注册指令处理器 */
  onMessage(handler: (cmd: RenderCommand) => void): void {
    this.handler = handler
    self.onmessage = (e: MessageEvent<RenderCommand>) => {
      handler(e.data)
    }
  }

  /** 发送响应到主线程 */
  respond(resp: RenderResponse): void {
    self.postMessage(resp)
  }
}
```

**Step 6: 导出**

```typescript
// libraries/render-protocol/src/index.ts
export type { RenderCommand, RenderResponse } from './types'
export { WorkerBridgeHost, WorkerBridgeWorker } from './worker-bridge'
```

**Step 7: 编写测试**

```typescript
// libraries/render-protocol/src/__tests__/worker-bridge.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { WorkerBridgeHost } from '../worker-bridge'

// Mock Worker
function createMockWorker() {
  let handler: ((e: MessageEvent) => void) | null = null
  const posted: unknown[] = []
  return {
    postMessage: (data: unknown) => { posted.push(data) },
    set onmessage(fn: ((e: MessageEvent) => void) | null) { handler = fn },
    get onmessage() { return handler },
    terminate: vi.fn(),
    // 模拟 Worker 回复
    simulateResponse(data: unknown) {
      handler?.({ data } as MessageEvent)
    },
    posted
  }
}

describe('WorkerBridgeHost', () => {
  it('send 发送指令不等待回复', () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    bridge.send({ cmd: 'clearLive' })
    expect(worker.posted).toHaveLength(1)
    expect(worker.posted[0]).toEqual({ cmd: 'clearLive' })
  })

  it('request 发送指令并等待回复', async () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    const promise = bridge.request({ cmd: 'flush' })
    // 模拟 Worker 回复
    const sentCmd = worker.posted[0] as { cmd: string; id: number }
    worker.simulateResponse({ cmd: 'flushed', id: sentCmd.id })
    const resp = await promise
    expect(resp).toEqual({ cmd: 'flushed', id: sentCmd.id })
  })

  it('dispose 终止 Worker 并 reject 所有 pending', async () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    const promise = bridge.request({ cmd: 'flush' })
    bridge.dispose()
    await expect(promise).rejects.toThrow('WorkerBridge disposed')
    expect(worker.terminate).toHaveBeenCalled()
  })
})
```

**Step 8: 运行 pnpm install 和测试**

Run: `pnpm install && cd libraries/render-protocol && npx vitest run`
Expected: PASS

**Step 9: Commit**

```bash
git add libraries/render-protocol/ pnpm-lock.yaml
git commit -m "feat(render-protocol): 新增渲染通信协议包（消息类型 + WorkerBridge）"
```

---

## Phase 4: OffscreenCanvas 实现

### Task 9: @aw/render-offscreen — 主线程 Proxy

**Files:**
- Modify: `libraries/render-offscreen/package.json`
- Create: `libraries/render-offscreen/src/offscreen-render.adapter.ts`
- Modify: `libraries/render-offscreen/src/index.ts`

**Step 1: 更新 package.json 依赖**

```json
{
  "dependencies": {
    "@aw/types": "workspace:*",
    "@aw/core": "workspace:*",
    "@aw/render-protocol": "workspace:*"
  }
}
```

**Step 2: 实现 OffscreenRenderAdapter**

这是主线程侧的 proxy。它创建 Canvas、转移控制权、通过 WorkerBridge 发送指令。

```typescript
// libraries/render-offscreen/src/offscreen-render.adapter.ts
import { RenderAdapter } from '@aw/core'
import type { StrokePoint, StrokeStyle, StrokeData, Camera } from '@aw/types'
import { WorkerBridgeHost } from '@aw/render-protocol'

export class OffscreenRenderAdapter extends RenderAdapter {
  private bridge: WorkerBridgeHost | null = null
  private liveCanvas: HTMLCanvasElement | null = null
  private renderCanvas: HTMLCanvasElement | null = null
  private workerInstance: Worker | null = null

  constructor(private workerUrl: string | URL) {
    super()
  }

  attach(element: HTMLElement, width: number, height: number): void {
    // 创建双 Canvas
    this.renderCanvas = this.createCanvas(width, height)
    this.renderCanvas.style.pointerEvents = 'none'
    element.appendChild(this.renderCanvas)

    this.liveCanvas = this.createCanvas(width, height)
    element.appendChild(this.liveCanvas)

    // 转移控制权到 Worker
    const offscreenRender = this.renderCanvas.transferControlToOffscreen()
    const offscreenLive = this.liveCanvas.transferControlToOffscreen()

    // 启动 Worker
    this.workerInstance = new Worker(this.workerUrl, { type: 'module' })
    this.bridge = new WorkerBridgeHost(this.workerInstance)

    // 发送初始化消息（transfer OffscreenCanvas）
    this.workerInstance.postMessage(
      { cmd: 'init', renderCanvas: offscreenRender, liveCanvas: offscreenLive, width, height },
      [offscreenRender, offscreenLive]
    )
  }

  detach(): void {
    if (this.liveCanvas?.parentElement) this.liveCanvas.parentElement.removeChild(this.liveCanvas)
    if (this.renderCanvas?.parentElement) this.renderCanvas.parentElement.removeChild(this.renderCanvas)
    this.liveCanvas = null
    this.renderCanvas = null
  }

  resize(width: number, height: number): void {
    this.bridge?.send({ cmd: 'resize', width, height })
  }

  drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void {
    this.bridge?.send({ cmd: 'drawLive', points: [...points], style })
  }

  commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void {
    this.bridge?.send({ cmd: 'commit', points: [...points], style })
  }

  clearLiveLayer(): void {
    this.bridge?.send({ cmd: 'clearLive' })
  }

  redrawAll(strokes: readonly StrokeData[]): void {
    this.bridge?.send({ cmd: 'redrawAll', strokes: strokes.map(s => ({ points: [...s.points], style: s.style })) })
  }

  clearAll(): void {
    this.bridge?.send({ cmd: 'clearAll' })
  }

  setCamera(camera: Camera): void {
    this.bridge?.send({ cmd: 'setCamera', camera })
  }

  startEraserTrail(baseSize: number): void {
    this.bridge?.send({ cmd: 'startEraserTrail', baseSize })
  }

  addEraserPoint(point: { x: number; y: number }): void {
    this.bridge?.send({ cmd: 'addEraserPoint', point })
  }

  endEraserTrail(): void {
    this.bridge?.send({ cmd: 'endEraserTrail' })
  }

  stopEraserTrail(): void {
    this.bridge?.send({ cmd: 'stopEraserTrail' })
  }

  async flush(): Promise<void> {
    if (!this.bridge) return
    await this.bridge.request({ cmd: 'flush' })
  }

  async exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob> {
    if (!this.bridge) return new Blob([], { type: `image/${format}` })
    const resp = await this.bridge.request({ cmd: 'export', format, quality })
    if (resp.cmd === 'exported') return resp.blob
    return new Blob([], { type: `image/${format}` })
  }

  async toDataURL(): Promise<string> {
    if (!this.bridge) return ''
    const resp = await this.bridge.request({ cmd: 'toDataURL' })
    if (resp.cmd === 'dataURL') return resp.url
    return ''
  }

  dispose(): void {
    this.bridge?.dispose()
    this.bridge = null
    this.workerInstance = null
    this.detach()
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    return canvas
  }
}
```

**Step 3: 导出**

```typescript
// libraries/render-offscreen/src/index.ts
export { OffscreenRenderAdapter } from './offscreen-render.adapter'
```

**Step 4: Commit**

```bash
git add libraries/render-offscreen/
git commit -m "feat(render-offscreen): 实现主线程 OffscreenRenderAdapter proxy"
```

---

### Task 10: @aw/render-offscreen — Worker 侧渲染器

**Files:**
- Create: `libraries/render-offscreen/src/offscreen-render.worker.ts`

这是在 Worker 线程中运行的渲染器。接收指令、计算轮廓、绘制 OffscreenCanvas。

**Step 1: 实现 Worker 侧渲染器**

```typescript
// libraries/render-offscreen/src/offscreen-render.worker.ts
import type { StrokeProcessorInterface, StrokePoint, StrokeStyle, StrokeData, Camera, OutlineGeometry } from '@aw/types'
import { EraserTrail } from '@aw/core'
import { WorkerBridgeWorker } from '@aw/render-protocol'
import type { RenderCommand } from '@aw/render-protocol'

/** OutlineGeometry → Path2D */
function geometryToPath2D(geometry: OutlineGeometry): Path2D {
  const path = new Path2D()
  const pts = geometry.points
  if (pts.length < 2) return path
  path.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y)
  path.closePath()
  return path
}

/** Worker 启动入口 */
export function startRenderWorker(strokeProcessor: StrokeProcessorInterface): void {
  const bridge = new WorkerBridgeWorker()

  let liveCanvas: OffscreenCanvas | null = null
  let renderCanvas: OffscreenCanvas | null = null
  let liveCtx: OffscreenCanvasRenderingContext2D | null = null
  let renderCtx: OffscreenCanvasRenderingContext2D | null = null
  let camera: Camera = { x: 0, y: 0, zoom: 1 }
  let containerWidth = 0
  let containerHeight = 0
  let eraserTrail: EraserTrail | null = null

  // 处理初始化消息（带 Transferable）
  self.onmessage = (e: MessageEvent) => {
    if (e.data.cmd === 'init') {
      renderCanvas = e.data.renderCanvas
      liveCanvas = e.data.liveCanvas
      containerWidth = e.data.width
      containerHeight = e.data.height
      renderCtx = renderCanvas!.getContext('2d')!
      liveCtx = liveCanvas!.getContext('2d')!
      // 切换到 bridge 的消息处理
      bridge.onMessage(handleCommand)
    }
  }

  function applyCamera(ctx: OffscreenCanvasRenderingContext2D): void {
    const dpr = self.devicePixelRatio || 1
    ctx.setTransform(
      dpr * camera.zoom, 0,
      0, dpr * camera.zoom,
      -camera.x * dpr * camera.zoom,
      -camera.y * dpr * camera.zoom
    )
  }

  function clearContext(ctx: OffscreenCanvasRenderingContext2D): void {
    const dpr = self.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, containerWidth, containerHeight)
  }

  function drawPath(ctx: OffscreenCanvasRenderingContext2D, path: Path2D, style: StrokeStyle): void {
    ctx.save()
    applyCamera(ctx)
    ctx.globalAlpha = style.opacity
    ctx.fillStyle = style.color
    ctx.fill(path)
    ctx.restore()
  }

  function computeAndDraw(ctx: OffscreenCanvasRenderingContext2D, points: readonly StrokePoint[], style: StrokeStyle, complete: boolean): void {
    const outline = strokeProcessor.computeOutline(points, style, complete)
    if (outline) drawPath(ctx, geometryToPath2D(outline), style)
  }

  function handleCommand(cmd: RenderCommand): void {
    switch (cmd.cmd) {
      case 'drawLive':
        if (!liveCtx) break
        clearContext(liveCtx)
        computeAndDraw(liveCtx, cmd.points, cmd.style, false)
        break

      case 'commit':
        if (!renderCtx) break
        computeAndDraw(renderCtx, cmd.points, cmd.style, true)
        break

      case 'clearLive':
        if (liveCtx) clearContext(liveCtx)
        break

      case 'redrawAll':
        if (!renderCtx) break
        clearContext(renderCtx)
        for (const stroke of cmd.strokes) {
          computeAndDraw(renderCtx, stroke.points, stroke.style, true)
        }
        break

      case 'clearAll':
        if (liveCtx) clearContext(liveCtx)
        if (renderCtx) clearContext(renderCtx)
        break

      case 'setCamera':
        camera = cmd.camera
        break

      case 'resize': {
        containerWidth = cmd.width
        containerHeight = cmd.height
        const dpr = self.devicePixelRatio || 1
        if (liveCanvas) { liveCanvas.width = cmd.width * dpr; liveCanvas.height = cmd.height * dpr }
        if (renderCanvas) { renderCanvas.width = cmd.width * dpr; renderCanvas.height = cmd.height * dpr }
        break
      }

      case 'startEraserTrail':
        if (eraserTrail) eraserTrail.stop()
        eraserTrail = new EraserTrail({ baseSize: cmd.baseSize })
        eraserTrail.start(outlines => {
          if (!liveCtx) return
          clearContext(liveCtx)
          if (outlines.length === 0) return
          liveCtx.save()
          applyCamera(liveCtx)
          liveCtx.fillStyle = 'rgba(0, 0, 0, 0.2)'
          liveCtx.globalAlpha = 1
          for (const outline of outlines) liveCtx.fill(outline)
          liveCtx.restore()
        })
        break

      case 'addEraserPoint':
        eraserTrail?.addPoint(cmd.point)
        break

      case 'endEraserTrail':
        eraserTrail?.endTrail()
        break

      case 'stopEraserTrail':
        if (eraserTrail) { eraserTrail.stop(); eraserTrail = null }
        break

      case 'flush':
        // 到达这里时所有先前指令已执行完毕
        bridge.respond({ cmd: 'flushed', id: (cmd as { id: number }).id })
        break

      case 'export': {
        const { id, format, quality } = cmd as { id: number; format: 'png' | 'jpeg'; quality?: number }
        if (!renderCanvas) {
          bridge.respond({ cmd: 'exported', id, blob: new Blob([], { type: `image/${format}` }) })
          break
        }
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
        renderCanvas.convertToBlob({ type: mimeType, quality }).then(blob => {
          bridge.respond({ cmd: 'exported', id, blob })
        })
        break
      }

      case 'toDataURL': {
        const { id: urlId } = cmd as { id: number }
        // OffscreenCanvas 没有 toDataURL，用 convertToBlob + FileReader 模拟
        if (!renderCanvas) {
          bridge.respond({ cmd: 'dataURL', id: urlId, url: '' })
          break
        }
        renderCanvas.convertToBlob({ type: 'image/png' }).then(blob => {
          const reader = new FileReaderSync()
          const url = reader.readAsDataURL(blob)
          bridge.respond({ cmd: 'dataURL', id: urlId, url })
        })
        break
      }
    }
  }
}
```

**Step 2: 更新 index.ts 导出**

```typescript
// libraries/render-offscreen/src/index.ts
export { OffscreenRenderAdapter } from './offscreen-render.adapter'
export { startRenderWorker } from './offscreen-render.worker'
```

**Step 3: Commit**

```bash
git add libraries/render-offscreen/
git commit -m "feat(render-offscreen): 实现 Worker 侧 OffscreenCanvas 渲染器"
```

---

## Phase 5: 收尾

### Task 11: @aw/compute-worker — 标记废弃

**Files:**
- Modify: `libraries/compute-worker/src/index.ts`

计算职责已内聚到各 RenderAdapter 内部。@aw/compute-worker 的 MainThreadStrategy 目前仍被部分代码引用，暂时保留但标记废弃。

**Step 1: 添加废弃标记**

在 `libraries/compute-worker/src/index.ts` 顶部添加注释：

```typescript
/**
 * @deprecated 计算职责已内聚到 RenderAdapter 内部。
 * 本包将在后续版本移除。请勿在新代码中使用。
 */
```

**Step 2: Commit**

```bash
git add libraries/compute-worker/
git commit -m "chore(compute-worker): 标记废弃，计算已内聚到 RenderAdapter"
```

---

### Task 12: 全量回归 + 文档同步

**Files:**
- Modify: `CLAUDE.md`（架构段落更新）
- Modify: `CHANGELOG.md`

**Step 1: 运行全量类型检查**

Run: `npx tsc --build --force` 或逐包 `npx tsc --noEmit`
Expected: PASS（所有类型对齐）

**Step 2: 运行全量测试**

Run: `npx vitest run`
Expected: PASS

**Step 3: 更新 CLAUDE.md**

更新架构段落，反映新的渲染管线：
- RenderAdapter 内聚了 compute + render
- @aw/render-protocol 通信协议
- @aw/render-offscreen 的实现
- 移除 ComputeStrategy 相关描述

**Step 4: 更新 CHANGELOG.md**

记录 Breaking Changes：
- `RenderAdapterInterface` 签名变更
- `StrokeProcessorInterface.computeOutline` 返回 `OutlineGeometry | null`
- `EditorKernelDeps` 移除 `strokeProcessor` 和 `computeStrategy`
- 新增 `@aw/render-protocol` 包

**Step 5: Commit**

```bash
git add CLAUDE.md CHANGELOG.md
git commit -m "docs: 同步 OffscreenCanvas 架构重构的文档变更"
```

---

## 依赖关系图

```
Task 1 (types: OutlineGeometry) ──┐
Task 2 (types: RenderAdapter)  ───┤
                                  ├→ Task 3 (core: 抽象基类)
                                  │      ├→ Task 4 (brush-freehand)
                                  │      ├→ Task 5 (render-canvas) ─→ Task 6 (EditorKernel) ─→ Task 7 (SDK)
                                  │      │
                                  ├→ Task 8 (render-protocol) ─→ Task 9 (offscreen proxy)
                                  │                            ─→ Task 10 (offscreen worker)
                                  │
                                  └→ Task 11 (compute-worker 废弃)
                                  └→ Task 12 (回归 + 文档)
```

## 风险点

| 风险 | 缓解措施 |
|------|---------|
| happy-dom 不支持 OffscreenCanvas / transferControlToOffscreen | Task 9-10 的测试可能需要 mock 或使用 @vitest/browser |
| EraserTrail 在 Worker 中使用 requestAnimationFrame | OffscreenCanvas 的 Worker 支持 rAF，但需验证 |
| FileReaderSync 在 Worker 中的可用性 | toDataURL 的 Worker 实现需要测试，可能需要替代方案 |
| 大量 postMessage 的序列化开销 | 高频 drawLive 可能需要考虑 Transferable 或节流 |
