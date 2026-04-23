# @inker/recognition 设计文档

> 日期：2026-03-12
> 状态：设计确认

## 背景与动机

业务方需要集成 Inker 实现手写识别（如用户在舞台区书写数字/文字，通过识别算法生成对应文本）。Inker 作为纯墨迹 SDK，应保持独立性，不内置识别能力。需要一个独立的上层方案包，为识别算法准备笔画数据。

## 设计决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 识别能力放哪里 | Inker 外部，独立包 | 保持 Inker 纯墨迹 SDK 定位 |
| 包的数量 | 一个包 `@inker/recognition` | tree-shaking 解决按需引入，无需拆包 |
| 目录位置 | `solutions/recognition/` | 新增 `solutions/` 顶层目录，放面向特定业务场景的上层方案 |
| 格式导出机制 | `ExportFormat` 策略接口 | 可扩展，后续按需添加格式实现 |
| 自动分组触发 | 监听 `stroke:end` 事件 | 比 `document:changed` + 变化方向判断更精确，避免 redo/undo 误触发 |
| 命名 `StrokeExporter` → `ExportFormat` | `ExportFormat` | 原名看不出策略意图，`ExportFormat` 语义更自然 |
| 去掉 `formatStrokes` 包装函数 | 直接调用 `format.convert()` | `formatStrokes` 只是透传，无额外逻辑，属于不必要的抽象 |
| `computeBoundingBox` 放置位置 | `@inker/util`（shared/util） | 通用几何计算，和识别无关，其他包也可能需要 |
| 坐标语义 | 输出保持世界坐标（px） | 归一化是有损操作，尺寸信息对某些识别算法有用 |
| `normalizeStrokes` | 不纳入首次实现 | YAGNI，等业务方真正需要时再加，实现思路已记录 |
| `ExportFormat.convert` 的 `boundingBox` 参数 | `options?: { boundingBox?: boolean }` 开关控制 | boundingBox 不是必须的，用开关控制是否内部计算并平移坐标 |

## 目录结构

```
inker/
├── shared/
│   └── util/                     # @inker/util（新增 computeBoundingBox）
├── solutions/                    # 基于 Inker 核心数据的上层方案包（新增）
│   └── recognition/              # @inker/recognition
│       ├── src/
│       │   ├── index.ts          # 公共导出
│       │   ├── group-by-time.ts  # 时间间隔分组
│       │   ├── translate.ts      # 坐标平移
│       │   ├── formats/
│       │   │   └── simple-json.format.ts  # 内置 SimpleJsonFormat
│       │   ├── recognition-helper.ts      # 事件驱动 Helper
│       │   └── types.ts          # 包内类型定义
│       ├── package.json
│       └── vitest.config.ts
```

## 依赖关系

```
@inker/types（BoundingBox 类型） ← @inker/util（computeBoundingBox 函数）
                                        ↑
                                  @inker/recognition
                                        ↑
                                   业务层消费
```

- `@inker/recognition` 依赖 `@inker/types`（类型定义，含 `BoundingBox`）和 `@inker/util`（`computeBoundingBox`）
- 不依赖 `@inker/core`、`@inker/sdk` 或任何运行时包
- Inker SDK 本体不感知此包的存在

## 前置依赖

### stroke:end 事件 emit

Inker kernel（`editor-kernel.service.ts`）需补上 `stroke:end` 事件的 emit。该事件已定义在 `EventMap` 中但当前未实际触发。

**实现要求**：

- **事件 payload**：`{ stroke: Stroke }`，从 apply 后的 snapshot 中取 `snapshot.strokes.get(strokeId)`
- **仅画笔触发**：橡皮擦操作结束时不 emit `stroke:end`（橡皮擦对应的是 `stroke:delete` 语义）
- **插入位置**：在 `endStroke` 方法中，`activeSessions.delete()` 之后、`eventBus.emit('document:changed')` 之前。此时数据已提交、渲染已提交、会话已清理，状态最完整。具体事件（`stroke:end`）先于通用事件（`document:changed`）触发，语义自然

```
① document.apply({ type: 'stroke:end', ... })   // 数据提交
② renderAdapter.commitStroke(...)                 // 渲染提交
③ activeSessions.delete(strokeId)                 // 会话清理
④ eventBus.emit('stroke:end', { stroke })         // ← 新增
⑤ eventBus.emit('document:changed', snapshot)     // 通用变更事件
```

### BoundingBox 类型添加到 @inker/types

在 `shared/types/src/geometry.types.ts` 中新增 `BoundingBox` 接口，与现有的 `Point`、`Rect`、`Size` 并列。纯接口、零 runtime，符合 `@inker/types` 的定位。

### computeBoundingBox 函数添加到 @inker/util

在 `shared/util/src/geometry.util.ts` 中新增 `computeBoundingBox` 函数，与现有的 `toNormalized`/`fromNormalized` 放在一起。函数返回 `BoundingBox`（类型来自 `@inker/types`）。

## 坐标语义

**所有工具函数和格式输出默认保持世界坐标（绝对像素）**。

- `StrokePoint.x/y` 是世界坐标（world px），这是 Inker 内部的存储格式
- `translateToOrigin` 平移到包围盒左上角为原点，单位仍是 px
- `ExportFormat.convert` 的 `boundingBox` 选项控制是否做包围盒平移
- 识别算法如需归一化坐标，由业务层调用 `@inker/util` 的 `toNormalized` 或自行处理

**重要**：调用 `groupByTime` 时，笔画应按绘制顺序传入。正确做法：

```ts
const snapshot = inker.getSnapshot()
const strokes = snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)
```

不要用 `[...snapshot.strokes.values()]`，`Map.values()` 的迭代顺序不保证是绘制顺序。

## 公共 API

### 类型定义

```ts
// 位于 @inker/types（geometry.types.ts）
interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

// 位于 @inker/recognition
interface StrokeGroup {
  strokes: Stroke[]
  boundingBox: BoundingBox
  startTime: number    // 该组第一个点的时间戳
  endTime: number      // 该组最后一个点的时间戳
}

interface ExportFormat<T> {
  readonly name: string  // 格式标识，如 'simple-json'
  convert(strokes: Stroke[], options?: { boundingBox?: boolean }): T
}

interface RecognitionTarget {
  on(event: string, handler: (data: unknown) => void): () => void
  getSnapshot(): DocumentSnapshot
}
```

### 纯工具函数

```ts
// @inker/util 新增
computeBoundingBox(strokes: Stroke[]): BoundingBox

// @inker/recognition
// 按时间间隔将连续笔画分为若干组
groupByTime(strokes: Stroke[], gapMs: number): StrokeGroup[]

// 将笔画坐标平移到包围盒左上角为原点
translateToOrigin(strokes: Stroke[]): Stroke[]
```

### 内置格式

```ts
class SimpleJsonFormat implements ExportFormat<SimpleJsonResult> {
  readonly name = 'simple-json'

  convert(strokes: Stroke[], options?: { boundingBox?: boolean }): SimpleJsonResult
}

interface SimpleJsonResult {
  strokes: Array<{
    id: string
    points: Array<{ x: number; y: number; t: number; p: number }>
    style: { type: string; color: string; size: number }
  }>
  boundingBox: BoundingBox | null  // boundingBox 选项为 true 时有值，否则为 null
}
```

**`boundingBox` 选项行为**：

- `{ boundingBox: true }` → 内部调用 `computeBoundingBox`，将坐标平移到包围盒原点后输出，`SimpleJsonResult.boundingBox` 有值
- 不传或 `false` → 保持原始世界坐标，`SimpleJsonResult.boundingBox` 为 null

### RecognitionHelper

```ts
class RecognitionHelper {
  constructor(options?: { gapMs?: number })  // 默认 500ms

  // 绑定 Inker 实例（通过 RecognitionTarget 接口）
  bindTo(target: RecognitionTarget): void

  // 书写停顿时自动触发回调，返回取消订阅函数
  // 支持多个 listener 同时注册，每个都会收到通知
  onWritingComplete(callback: (group: StrokeGroup) => void): () => void

  // 手动获取当前所有笔画（需先 bindTo，否则抛出异常）
  getCurrentStrokes(): Stroke[]

  dispose(): void
}
```

**内部机制**：

```
bindTo(inker)
  → 监听 stroke:end 事件
    → 每次触发，重置定时器（gapMs）
      → 定时器到期 = 用户书写停顿
        → 取 snapshot，按 strokeOrder 取笔画
          → 用 groupByTime 分组
            → 取最新一组（包含新笔画），触发 onWritingComplete 回调
```

**边界行为**：

- 支持多个 listener 同时注册（`onWritingComplete` 可调用多次），每个 callback 都会收到通知
- 通过记录已处理的 strokeId 集合，避免重复触发
- `onWritingComplete` 可在 `bindTo` 之前调用（仅存储 callback，绑定后生效）
- `bindTo` 之前调用 `getCurrentStrokes` 抛出异常
- `dispose` 之后调用任何方法抛出异常（与 `Inker.dispose()` 行为一致）
- `dispose` 时取消事件监听、清除定时器、清空回调

## 使用场景

### 场景 A：自动触发识别（时间间隔分组）

```ts
import { RecognitionHelper } from '@inker/recognition'

const helper = new RecognitionHelper({ gapMs: 500 })
helper.bindTo(inker)

helper.onWritingComplete(group => {
  // group.strokes — 本次书写的笔画（世界坐标）
  // group.boundingBox — 包围盒
  recognitionApi.recognize(group)
})

// 销毁
helper.dispose()
```

### 场景 B：业务层主动触发识别

```ts
import { groupByTime, SimpleJsonFormat } from '@inker/recognition'

const format = new SimpleJsonFormat()

button.onclick = () => {
  const snapshot = inker.getSnapshot()
  const strokes = snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)
  const groups = groupByTime(strokes, 500)
  const data = format.convert(groups[0].strokes, { boundingBox: true })
  recognitionApi.recognize(data)
}
```

### 场景 C：只用坐标工具函数

```ts
import { computeBoundingBox } from '@inker/util'
import { translateToOrigin } from '@inker/recognition'

const bbox = computeBoundingBox(strokes)
const translated = translateToOrigin(strokes)
```

## 未来扩展点

以下能力已在设计中预留扩展空间，但不在首次实现范围内：

### 坐标归一化

`normalizeStrokes(strokes: Stroke[], targetSize?: Size): Stroke[]`

在包围盒平移基础上，将坐标缩放到 0-1 范围（或指定目标尺寸）。实现思路：

1. 调用 `computeBoundingBox` 获取包围盒
2. 调用 `translateToOrigin` 平移到原点
3. 按包围盒长边等比缩放到目标范围（保持宽高比）
4. 可复用 `@inker/util` 的 `toNormalized` 做单点计算

注意：归一化会丢失绝对尺寸信息（大字和小字归一化后形状相同）。某些识别算法需要尺寸信息时不应归一化。

可作为 `ExportFormat.convert` 的 `options` 扩展：`{ boundingBox?: boolean; normalize?: boolean }`。

### 更多导出格式

实现新的 `ExportFormat` 即可（InkML、UNIPEN 等），不需要改动已有代码。

### 空间距离分组

`groupByDistance(strokes: Stroke[], threshold: number): StrokeGroup[]` — 基于笔画间距分组。

## solutions/ 目录定位

`solutions/` 是新增的顶层目录，与 `shared/`、`libraries/`、`third-parties/` 同级。

**定位**：基于 Inker 核心数据构建的、面向特定业务场景的上层方案包。这些包依赖 Inker 的类型和数据，但 Inker 本体不依赖它们。

**与其他目录的区别**：

- `shared/` — Inker 内部共享的基础设施
- `libraries/` — Inker 核心功能
- `solutions/` — Inker 之上的业务场景方案，可选引入

**准入标准**：

- 面向特定业务场景（识别、协作、持久化等），不是 Inker 核心功能
- 依赖 `@inker/types` 和/或 `@inker/util`，不依赖 Inker 运行时包
- Inker 本体不反向依赖 solutions 中的包
