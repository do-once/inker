# 时间戳统一设计：全链路使用绝对时间

## 背景

### Bug 根因

commit `686c0b2` 重构 EditorKernel 时，`addStrokePoint` 方法中 `StrokePoint.t` 被改为 `Date.now()`（Unix epoch），而 `startStroke/endStroke` 的 timestamp 仍来自 `PointerEvent.timeStamp`（页面加载后相对时间）。两个时钟域差约 55 年，导致 PlaybackTimeline 计算 relativeTime 时 `stroke:addPoint` 操作的偏移量高达数万亿毫秒，永远不会被 `getOperationsUntil()` 返回，回放只显示起始一点。

### 扩展性需求

未来输入源包括：原生移动端报点（Android/iOS bridge）、录制文件回放、远程协作、程序化输入。各平台的相对时间基准不同（页面加载 / 系统启动 / 进程启动），唯一跨平台公约数是 Unix epoch 绝对时间。

## 设计决策

### 决策 1：统一使用 Unix epoch 毫秒（`Date.now()` 语义）

- 所有 `StrokePoint.t` 和 `Operation.timestamp` 均为 Unix epoch ms
- InputAdapter 是时间戳生产者，Kernel 只消费不生产
- PlaybackTimeline 内部转换为相对时间（已有逻辑，不变）

### 决策 2：timestamp 作为方法参数传入，不放入 RawPoint

```typescript
interface StrokeInputReceiver {
  startStroke(strokeId: string, point: RawPoint, timestamp: number): void
  addStrokePoint(strokeId: string, point: RawPoint, timestamp: number): void
  endStroke(strokeId: string, timestamp: number): void
}
```

理由：RawPoint 保持纯坐标+压力语义；三个方法签名对称统一。

### 决策 3：Kernel 不提供 timestamp 默认值

强制调用方显式传入时间戳。隐式默认值正是本次 bug 的根因。

### 决策 4：删除 OperationFactory

OperationFactory 在生产代码中未使用，Operation 是纯 readonly 接口，TypeScript 类型检查已保证字面量正确性。保留只增加维护成本和不一致风险。

### 决策 5：删除 PointExtractor 中的 TimestampedPoint

`PointerEvent.timeStamp` 不再被使用（统一用 `Date.now()`），`PointExtractor.extract()` 返回 `RawPoint | null`。

## 改动范围

### 核心改动（3 个文件）

| 文件 | 改动 |
|------|------|
| `shared/types/src/input-adapter.types.ts` | `addStrokePoint` 签名加 `timestamp` |
| `libraries/core/src/editor-kernel.service.ts` | `addStrokePoint` 使用传入的 `timestamp` |
| `libraries/input-pointer/src/pointer-input.adapter.ts` | 三个事件统一 `Date.now()`，`addStrokePoint` 传 `timestamp` |

### 删除（2 个文件）

| 文件 | 改动 |
|------|------|
| `libraries/model/src/operation-factory.service.ts` | 删除 |
| `libraries/model/src/__tests__/operation-factory.service.spec.ts` | 删除 |

### 适配（6 个文件）

| 文件 | 改动 |
|------|------|
| `shared/types/src/stroke-point.types.ts` | `t` 字段注释修正 |
| `libraries/input-pointer/src/point-extractor.service.ts` | 删除 `TimestampedPoint`，返回 `RawPoint \| null` |
| `libraries/model/src/index.ts` | 移除 OperationFactory 导出 |
| `libraries/model/README.md` | 移除 OperationFactory 章节 |
| `libraries/core/src/__tests__/editor-kernel.service.spec.ts` | `addStrokePoint` 调用加 `timestamp` |
| `libraries/input-pointer/src/__tests__/` | 适配测试变更 |

## 不做的事

- 不做 timestamp 可选 + 默认值
- 不做时钟校准/NTP 同步（协作场景的独立课题）
- 不改 PlaybackTimeline / StrokePlayer / StrokeDocument / OperationSerializer
