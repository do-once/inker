# 多点触控同时书写设计文档

> 日期：2026-03-11
> 状态：已批准

## 目标

为 AnimalWriting SDK 添加多点触控同时书写支持，允许多根手指/多支笔同时在同一画布上独立绘制笔画，互不干扰。

## 设计决策

| 决策项 | 结论 |
|--------|------|
| 笔刷样式 | 所有指针共用当前 penStyle |
| 并发限制 | 不限制 |
| 撤销行为 | 撤销最后结束（stroke:end）的笔画 |
| 橡皮擦并发 | 不允许一指画另一指擦，橡皮擦模式下单指针锁 |
| 渲染接口 | 新增 drawLiveStrokes 批量方法（方案 B） |
| 架构方案 | StrokeSession 抽象（方案 2），兼顾扩展性 |

## 整体架构

### 改造层与不变层

| 层 | 是否改造 | 说明 |
|----|---------|------|
| PointerInputAdapter | 改造 | 单 activePointerId → Set 多指针追踪 |
| EditorKernel | 改造 | 单笔画变量 → Map + StrokeSession |
| RenderAdapterInterface | 扩展 | 新增 drawLiveStrokes 批量方法 |
| 各 RenderAdapter 实现 | 扩展 | 实现 drawLiveStrokes |
| RenderCommand 协议 | 扩展 | 新增 drawLiveStrokes 命令 |
| StrokeDocument | 不变 | Operation 模型天然支持多笔画 |
| StrokeProcessor | 不变 | 无状态纯函数 |
| Camera / 坐标系 | 不变 | 与笔画数量无关 |

## Section 1：StrokeSession 数据结构

### 新增文件

`libraries/core/src/stroke-session.ts`

```typescript
interface StrokeSessionState {
  strokeId: string
  pointerId: number
  points: StrokePoint[]
  startTimestamp: number
}

class StrokeSession {
  readonly strokeId: string
  readonly pointerId: number
  private points: StrokePoint[] = []
  private startTimestamp: number

  constructor(pointerId: number, strokeId: string, firstPoint: StrokePoint, timestamp: number)

  addPoint(point: StrokePoint): void
  getPoints(): readonly StrokePoint[]
  getLastPoint(): StrokePoint | null
  get pointCount(): number
}
```

### EditorKernel 状态变化

```
// 删除
- private activeStrokeId: string | null = null
- private activePoints: StrokePoint[] = []
- private eraserPoints: StrokePoint[] = []

// 新增
+ private activeSessions: Map<number, StrokeSession> = new Map()
+ private activeEraserPointerId: number | null = null  // 橡皮擦单指针锁

// 保留不变
  private pendingDeleteIds: Set<string> = new Set()
```

## Section 2：PointerInputAdapter 改造

`libraries/input-pointer/src/pointer-input.adapter.ts`

```
// 删除
- private activePointerId: number | null = null

// 新增
+ private activePointerIds: Set<number> = new Set()
```

事件处理变化：

| 事件 | 当前 | 改造后 |
|------|------|--------|
| pointerdown | `activePointerId = e.pointerId`（覆盖） | `activePointerIds.add(e.pointerId)` |
| pointermove | `activePointerId !== e.pointerId` → 忽略 | `!activePointerIds.has(e.pointerId)` → 忽略 |
| pointerup | `activePointerId = null` | `activePointerIds.delete(e.pointerId)` |
| pointercancel | 同 up | 同 up |
| detach | `activePointerId = null` | `activePointerIds.clear()` |

不变：`isPointerTypeAllowed()` 过滤、`InputEvent` 类型（已有 pointerId）、`PointExtractor`。

## Section 3：EditorKernel 改造

`libraries/core/src/editor-kernel.service.ts`

### 生命周期方法

三个对称的内部方法，管状态和文档：

```
startSession(pointerId, point, timestamp) →
  strokeId = generateUid()
  session = new StrokeSession(pointerId, strokeId, point, timestamp)
  activeSessions.set(pointerId, session)
  document.apply('stroke:start', strokeId, point)

updateSession(pointerId, point) →
  session = activeSessions.get(pointerId)
  if !session → return
  session.addPoint(point)
  document.apply('stroke:addPoint', session.strokeId, point)

endSession(pointerId) →
  session = activeSessions.get(pointerId)
  if !session → return
  document.apply('stroke:end', session.strokeId)
  renderAdapter.commitStroke(session.getPoints(), penStyle)
  activeSessions.delete(pointerId)
  if pointerId === activeEraserPointerId:
    activeEraserPointerId = null
    eraserTrail.stop()
```

### 事件分发层

handleDown/Move/Up 为薄分发层，负责坐标转换、模式判断、渲染触发：

```
handleDown(event) →
  point = screenToWorld(event)
  if 橡皮擦模式:
    if activeEraserPointerId !== null → return
    activeEraserPointerId = event.pointerId
    startSession(event.pointerId, point, event.timestamp)
    eraserTrail.start(...)
  else:
    startSession(event.pointerId, point, event.timestamp)

handleMove(event) →
  point = screenToWorld(event)
  updateSession(event.pointerId, point)
  if 橡皮擦模式:
    碰撞检测 + eraserTrail.addPoint
  else:
    renderAdapter.drawLiveStrokes(收集所有活跃session)

handleUp(event) →
  endSession(event.pointerId)
  if activeSessions.size > 0:
    renderAdapter.drawLiveStrokes(剩余活跃session)
  else:
    renderAdapter.clearLiveLayer()

handleCancel(event) →
  // 注意：需要改造，接收 event 参数并提取 pointerId
  // 浏览器 pointercancel 通常是系统中断（如系统弹窗、触摸被劫持），并非用户主动取消意图
  // 因此 cancel 语义等同正常抬手提交（endSession），而非丢弃笔画
  endSession(event.pointerId)  // 复用 handleUp 分支逻辑
  if activeSessions.size > 0:
    renderAdapter.drawLiveStrokes(剩余活跃session)
  else:
    renderAdapter.clearLiveLayer()
  // handleInput 的 cancel 分支也需改造：handleCancel() → handleCancel(event)

visibilitychange → for each pointerId: endSession(pointerId); clearLiveLayer()
// 注意：visibilitychange 是新增监听器，需在 EditorKernel 的 init/dispose 中注册和销毁
```

## Section 3.5：applyOperation 改造方案

回放场景使用合成 pointerId（`REPLAY_POINTER_ID = -1`），将回放逻辑完全接入多指针管线，避免维护独立的单笔画变量。

```
const REPLAY_POINTER_ID = -1

applyOperation(op: Operation) →
  document.apply(op)

  switch op.type:
    case 'stroke:start':
      penStyle = op.style
      startSession(REPLAY_POINTER_ID, op.point, op.timestamp)

    case 'stroke:addPoint':
      updateSession(REPLAY_POINTER_ID, op.point)
      // drawLiveStrokes 在 updateSession 内触发（与正常绘制路径一致）

    case 'stroke:end':
      endSession(REPLAY_POINTER_ID)
      // commitStroke、clearLiveLayer 已在 endSession 内处理

    case 'stroke:delete':
      redrawFromSnapshot()

    case 'stroke:clear':
      renderAdapter.clearAll()
```

优点：回放逻辑不再单独维护 `activeStrokeId` / `activePoints`，完全复用多指针管线，减少状态分叉。

## Section 4：RenderAdapter 接口扩展

`shared/types/src/render-adapter.types.ts`

### 接口变化

```typescript
interface RenderAdapterInterface {
  // 保留（不变）
  drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  clearLiveLayer(): void

  // 新增：批量渲染所有活跃笔画
  // 内部包含清除逻辑：先 clearLiveLayer，再遍历绘制每条笔画
  // handleMove 不再单独调用 clearLiveLayer()，改为统一调用此方法
  drawLiveStrokes(strokes: readonly { points: readonly StrokePoint[]; style: StrokeStyle }[]): void

  // 其余方法不变（attach/detach/resize/dispose/setCamera/redrawAll/clearAll/
  // startEraserTrail/addEraserPoint/endEraserTrail/stopEraserTrail/flush/exportAsBlob/toDataURL）
}
```

### 各适配器实现

**CanvasRenderAdapter**：清除 live context → 遍历绘制所有笔画。

**OffscreenRenderAdapter**：通过 bridge.send 发送 drawLiveStrokes 命令，Worker 侧同样清除+遍历绘制。

**SvgRenderAdapter**：清除 live SVG 组 → 遍历追加 path 元素。（未来，当前未实现）

### 通信协议扩展

`libraries/render-protocol/src/types.ts` 新增命令：

```typescript
| { cmd: 'drawLiveStrokes'; strokes: { points: StrokePoint[]; style: StrokeStyle }[] }
```

### 抽象基类扩展

`libraries/core/src/render.adapter.ts` 需新增 `abstract drawLiveStrokes` 声明，建议同时提供默认实现以支持渐进迁移：

```typescript
// 新增抽象方法声明
abstract drawLiveStrokes(strokes: readonly { points: readonly StrokePoint[]; style: StrokeStyle }[]): void

// 或提供默认实现，子类可选择覆盖（遍历调用 drawLiveStroke）
drawLiveStrokes(strokes: readonly { points: readonly StrokePoint[]; style: StrokeStyle }[]): void {
  this.clearLiveLayer()
  for (const stroke of strokes) {
    this.drawLiveStroke(stroke.points, stroke.style)
  }
}
```

### 向后兼容

`drawLiveStroke`（单数）保留。`drawLiveStrokes` 内部可复用单笔画绘制逻辑。EditorKernel 统一调用 `drawLiveStrokes`，单指针时传长度为 1 的数组。

## Section 5：橡皮擦模式处理

### 行为规则

| 场景 | 行为 |
|------|------|
| 橡皮擦模式，第一指按下 | 锁定 activeEraserPointerId，创建 session |
| 橡皮擦模式，第二指按下 | 忽略（锁已被占用） |
| 橡皮擦模式，锁定指针抬起 | endSession + 释放锁 |

### 模式切换时的活跃笔画处理

这是对现有 `penStyle` setter 的行为变更（从简单赋值变为可能触发活跃笔画结束），不是新增逻辑：

```
// 当前（简单赋值）
set penStyle(style: StrokeStyle) {
  _penStyle = { ...style }
}

// 改造后（变更行为：先结束活跃笔画再切换）
set penStyle(newStyle) →
  if activeSessions.size > 0:
    for each pointerId of activeSessions.keys():
      endSession(pointerId)  // 复用 endSession，等同用户抬手
    clearLiveLayer()
  _penStyle = newStyle
```

模式切换后，仍在屏幕上的手指的后续 move/up 事件会因 `activeSessions.get()` 返回 undefined 而被静默忽略。PointerInputAdapter 在 pointerup 时正常从 activePointerIds 中移除，状态一致。

### EraserTrail 无需改造

橡皮擦单指针锁保证同一时刻只有一个 EraserTrail 实例在工作，与现有逻辑完全兼容。

## Section 6：边界情况

| 场景 | 处理 |
|------|------|
| 快速点触（单点笔画） | StrokeProcessor 对单点生成圆点轮廓，正常提交 |
| pointercancel | 等同 up，endSession 正常提交笔画（系统中断，非用户主动取消意图） |
| visibilitychange(hidden) | 遍历所有 activeSessions 调用 endSession + clearLiveLayer（新增监听器，需在 EditorKernel init/dispose 中注册和销毁） |
| destroy | 同 visibilitychange，全部结束后清理资源 |
| 模式切换中手指仍在屏幕 | 静默忽略后续 move/up（session 已不存在） |
| undo 在多指绘制中触发 | 先对所有活跃 session 调用 endSession（结束并提交所有进行中的笔画），再执行 undo |

## Section 7：测试策略

### StrokeSession 单测

`libraries/core/src/__tests__/stroke-session.spec.ts`

- 构造：strokeId、pointerId、首点正确存储
- addPoint：点序列递增
- getLastPoint：空/非空
- pointCount：与 addPoint 次数一致

### EditorKernel 多指针集成测试

`libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts`

- 双指同时画笔：两个 stroke:start → 各自 addPoint → 各自 stroke:end
- 三指画笔，中间一指先抬起：该笔画 commit，剩余继续
- 橡皮擦单指锁：第一指锁定，第二指 down 被忽略
- 画笔→橡皮擦切换（有活跃笔画）：所有 session endSession
- 橡皮擦→画笔切换：橡皮擦 session 结束，锁释放
- pointercancel：等同 up
- visibilitychange：所有 session 结束
- 快速点触：正常提交

### PointerInputAdapter 多指针测试

扩展 `libraries/input-pointer/src/__tests__/pointer-input.adapter.spec.ts`

- 双指 down：两次事件均发出
- 双指 move：各 pointerId 独立
- 一指 up 另一指继续
- 未知 pointerId 的 move 被忽略

### RenderAdapter 批量渲染测试

各适配器包现有测试中扩展：

- drawLiveStrokes 空数组：仅清除
- drawLiveStrokes 3 笔：清除一次 + 绘制三次
- drawLiveStrokes 后 commitStroke：live 减一笔，render 增一笔

## 改造文件清单

| 文件 | 改造类型 |
|------|---------|
| `libraries/core/src/stroke-session.ts` | 新增 |
| `libraries/core/src/__tests__/stroke-session.spec.ts` | 新增 |
| `libraries/core/src/__tests__/editor-kernel.multi-pointer.spec.ts` | 新增 |
| `libraries/input-pointer/src/pointer-input.adapter.ts` | 修改 |
| `libraries/core/src/editor-kernel.service.ts` | 修改 |
| `shared/types/src/render-adapter.types.ts` | 修改 |
| `libraries/core/src/render.adapter.ts` | 修改（新增 `abstract drawLiveStrokes` 声明，建议提供默认实现支持渐进迁移） |
| `libraries/render-canvas/src/canvas-render.adapter.ts` | 修改 |
| `libraries/render-offscreen/src/offscreen-render.adapter.ts` | 修改 |
| `libraries/render-offscreen/src/offscreen-render.worker.ts` | 修改 |
| `libraries/render-protocol/src/types.ts` | 修改 |
| `libraries/render-svg/src/svg-render.adapter.ts` | 修改（未来，当前未实现） |
| `libraries/input-pointer/src/__tests__/pointer-input.adapter.spec.ts` | 扩展 |
