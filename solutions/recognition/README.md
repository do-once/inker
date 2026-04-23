# @inker/recognition

手写识别数据准备层——将 Inker 笔画数据转换为识别 API 所需的格式。本包不内置任何识别算法。

## 功能特性

- 按时间间隔对笔画分组（`groupByTime`），自动切断字/词边界
- 坐标平移到包围盒原点（`translateToBBoxOrigin`），零副作用纯函数
- 策略模式导出格式（`ExportFormat<T>`），扩展新格式不改动已有代码
- 事件驱动书写监听（`RecognitionHelper`），防抖 + 去重，开箱即用
- 仅依赖 `@inker/types` 和 `@inker/util`，不依赖任何 Inker 运行时

## 快速开始

最简使用方式：创建 `RecognitionHelper`，绑定到 `inker` 实例，监听书写完成事件。

```ts
import { RecognitionHelper } from '@inker/recognition'

const helper = new RecognitionHelper({ gapMs: 500 })
helper.bindTo(inker) // inker 为 @inker/sdk 的 Inker 实例

helper.onWritingComplete(group => {
  // 用户停笔超过 500ms 后自动触发
  // group.strokes — 本次书写的笔画（世界坐标）
  recognitionApi.recognize(group)
})

// 页面卸载时销毁
helper.dispose()
```

## 目录结构

```
solutions/recognition/
├── src/
│   ├── index.ts                    # 包入口，统一导出
│   ├── types.ts                    # 核心类型定义
│   ├── group-by-time.ts            # 时间分组工具函数
│   ├── translate.ts                # 坐标平移工具函数
│   ├── recognition-helper.ts       # 事件驱动识别辅助类
│   └── formats/
│       └── simple-json.format.ts   # SimpleJson 格式转换器
├── package.json
├── vite.config.ts
└── vitest.config.ts
```

**依赖方向**：`shared/ ← solutions/`，本包仅依赖 `@inker/types`（纯接口）和 `@inker/util`（工具函数），不依赖 `libraries/` 或 `sdk/`。

## API 参考

### 核心类型

```ts
// 笔画分组结果
interface StrokeGroup {
  strokes: Stroke[]
  startTime: number
  endTime: number
}

// 导出格式策略接口
interface ExportFormat<T> {
  readonly name: string
  convert(strokes: Stroke[], options?: ExportFormatOptions): T
}

// 导出选项
interface ExportFormatOptions {
  toBBoxOrigin?: boolean // true 时：坐标平移到原点，输出中附带包围盒
}

// 绑定目标接口（鸭子类型，兼容 Inker 门面类）
interface RecognitionTarget {
  on(event: string, handler: (data: unknown) => void): () => void
  getSnapshot(): DocumentSnapshot
}
```

### 工具函数

#### `groupByTime(strokes: Stroke[], gapMs: number): StrokeGroup[]`

按时间间隔对笔画分组。比较相邻笔画"前一笔最后一点时间戳"与"当前笔第一点时间戳"之差，差值 `>= gapMs` 时切断分组。空数组返回 `[]`。

```ts
import { groupByTime } from '@inker/recognition'

const snapshot = inker.getSnapshot()
// 必须按绘制顺序传入——见下方坐标语义章节
const strokes = snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)
const groups = groupByTime(strokes, 500)
// groups[0].strokes — 第一组笔画
// computeBBox(groups[0].strokes) — 第一组的包围盒
```

#### `translateToBBoxOrigin(strokes: Stroke[]): Stroke[]`

将笔画坐标平移，使包围盒左上角位于原点 `(0, 0)`。不可变操作，返回新的笔画数组，不修改原始数据。

```ts
import { translateToBBoxOrigin } from '@inker/recognition'

const translated = translateToBBoxOrigin(strokes)
// strokes 不变，translated 是平移后的新数组
```

### 内置导出格式

#### `SimpleJsonFormat`

`implements ExportFormat<SimpleJsonResult>`，`name = 'simple-json'`。

输出结构：

```ts
interface SimpleJsonResult {
  strokes: Array<{
    id: string
    points: Array<{ x: number; y: number; t: number; p: number }>
    style: { type: string; color: string; size: number }
  }>
  boundingBox: BBox | null
}
```

| 选项 | 行为 |
|------|------|
| `toBBoxOrigin: true` | 计算包围盒，将坐标平移到原点，`boundingBox` 字段有值 |
| 不传 / `false` | 保持原始世界坐标，`boundingBox` 为 `null` |

`style` 字段只保留 `type`、`color`、`size`，过滤 `opacity` 等内部字段。

```ts
import { SimpleJsonFormat } from '@inker/recognition'

const format = new SimpleJsonFormat()

// 保持世界坐标
const raw = format.convert(strokes)

// 平移到原点并附带包围盒
const normalized = format.convert(strokes, { toBBoxOrigin: true })
```

### RecognitionHelper

事件驱动的识别辅助类，监听 `stroke:end` 事件，在书写暂停（防抖）后触发回调。

**内部机制**：防抖（`setTimeout gapMs`）+ 去重（`processedStrokeIds` Set），每次 `stroke:end` 重置定时器，定时器到期后取快照、分组、触发回调；已处理的 `strokeId` 不会重复报告。

```ts
// 构造参数：gapMs 默认 500ms
const helper = new RecognitionHelper({ gapMs?: number })
```

| 方法 | 说明 |
|------|------|
| `bindTo(target: RecognitionTarget)` | 订阅目标的 `stroke:end` 事件，可多次调用切换目标 |
| `onWritingComplete(callback: (group: StrokeGroup) => void): () => void` | 注册书写完成回调，返回取消订阅函数 |
| `getCurrentStrokes(): Stroke[]` | 同步获取当前全部笔画（需先调用 `bindTo`） |
| `dispose()` | 清理所有资源（取消订阅、清除定时器、清空回调） |

> [!WARNING]
> `dispose()` 后调用任何方法将抛出异常，请确保在销毁前停止所有使用。

## 集成指南

### 场景 A：事件驱动自动触发识别

适用于需要实时响应用户书写、无需手动触发识别的场景。

```ts
import { RecognitionHelper } from '@inker/recognition'

const helper = new RecognitionHelper({ gapMs: 500 })
helper.bindTo(inker)

const unsubscribe = helper.onWritingComplete(group => {
  // group.strokes — 本次书写的笔画（世界坐标）
  recognitionApi.recognize(group)
})

// 只取消某个回调订阅
unsubscribe()

// 或销毁整个 helper（清理全部资源）
helper.dispose()
```

### 场景 B：业务层主动触发识别

适用于由用户操作（点击按钮、提交表单）触发识别的场景。

```ts
import { groupByTime, SimpleJsonFormat } from '@inker/recognition'

const format = new SimpleJsonFormat()

button.onclick = () => {
  const snapshot = inker.getSnapshot()
  const strokes = snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)
  const groups = groupByTime(strokes, 500)
  // 取最后一组（最新书写内容）
  const data = format.convert(groups[groups.length - 1].strokes, { toBBoxOrigin: true })
  recognitionApi.recognize(data)
}
```

### 场景 C：只用坐标工具函数

适用于业务层自行管理生命周期，只借助工具函数做数据处理的场景。

```ts
import { computeBBox } from '@inker/util'
import { translateToBBoxOrigin } from '@inker/recognition'

// 获取包围盒（不平移）
const bbox = computeBBox(strokes)

// 平移到原点（不修改原数组）
const translated = translateToBBoxOrigin(strokes)
```

## 坐标语义

所有工具函数和格式输出默认保持**世界坐标**（绝对像素 px）：

- `translateToBBoxOrigin` 平移到包围盒左上角为原点，单位仍是 px
- `ExportFormat.convert` 的 `toBBoxOrigin` 选项控制是否自动做包围盒平移
- 归一化坐标由业务层自行处理

> [!WARNING]
> 调用 `groupByTime` 时，笔画必须按**绘制顺序**传入。
>
> ```ts
> // 正确：使用 strokeOrder 保证顺序
> const strokes = snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)
>
> // 错误：Map.values() 的迭代顺序不保证是绘制顺序
> const strokes = [...snapshot.strokes.values()]
> ```

## 自定义格式

实现 `ExportFormat<T>` 接口即可接入策略模式，无需修改任何已有代码：

```ts
import type { ExportFormat, ExportFormatOptions } from '@inker/recognition'
import type { Stroke } from '@inker/types'

// 示例：将笔画输出为某 OCR API 所需的点数组格式
class MyApiFormat implements ExportFormat<{ ink: number[][][] }> {
  name = 'my-api'

  convert(strokes: Stroke[], _options?: ExportFormatOptions) {
    return {
      ink: strokes.map(stroke =>
        stroke.points.map(p => [p.x, p.y, p.pressure ?? 0.5])
      )
    }
  }
}

// 使用方式与内置格式完全一致
const format = new MyApiFormat()
const data = format.convert(strokes)
```

## 未来规划

以下功能尚未实现，记录实现思路供后续参考。

### 坐标归一化

**接口**：`normalizeStrokes(strokes: Stroke[], targetSize?: Size): Stroke[]`

**实现思路**：

1. `computeBBox` 获取包围盒
2. `translateToBBoxOrigin` 平移到原点
3. 按包围盒长边等比缩放到目标范围（保持宽高比）
4. 可复用 `@inker/util` 的 `toNormalized` 做单点计算

也可作为 `ExportFormat.convert` 的 options 扩展：`{ toBBoxOrigin?: boolean; normalize?: boolean }`

> [!NOTE]
> 归一化会丢失绝对尺寸信息（大字小字归一化后形状相同），某些识别算法需要尺寸信息时不应归一化。

### 空间距离分组

**接口**：`groupByDistance(strokes: Stroke[], threshold: number): StrokeGroup[]`

基于笔画间距（而非时间间隔）进行分组，适用于按空间位置区分不同字/词的场景。

**实现思路**：计算相邻笔画包围盒的最短距离，超过阈值则切断分组。

### 更多导出格式

实现新的 `ExportFormat` 即可（InkML、UNIPEN 等），策略模式天然支持扩展，不需要改动任何已有代码。
