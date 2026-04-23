# 识别格式重设计规格

## 背景

`@inker/recognition` 包的 Format 设计和 playground 的参数控制存在以下问题：

1. **命名不一致**：项目中 `BoundingBox`/`boundingBox`/`computeBoundingBox` 混用全称，应统一为 `BBox` 简写
2. **`StrokeGroup` 耦合**：`groupByTime` 在分组时预计算 `boundingBox`，不需要 bbox 的消费者也被迫承担计算开销
3. **`translateToOrigin` 命名歧义**：没有体现"基于 BBox"这一关键信息
4. **`ExportFormatOptions.boundingBox` 命名不准确**：`boundingBox: true` 实际触发的是"计算 bbox + 坐标平移"，不仅仅是"包含 bbox"
5. **Playground 参数冗余**：`translateEnabled` 和 `includeBoundingBox` 两个开关功能重叠，因为 `SimpleJsonFormat` 内部 `boundingBox: true` 已同时完成 bbox 计算和坐标平移

## 改动范围

### 一、全项目 BBox 命名统一

| 位置 | 原名 | 新名 |
|------|------|------|
| `@inker/util` | `BoundingBox` 类型 | `BBox` |
| `@inker/util` | `computeBoundingBox()` | `computeBBox()` |
| `@inker/types` | 若有 `BoundingBox` 引用 | `BBox` |
| 所有引用上述类型/函数的文件 | `BoundingBox` / `computeBoundingBox` | `BBox` / `computeBBox` |

### 二、`@inker/recognition` 包改动

#### StrokeGroup 接口

移除 `boundingBox` 字段，`groupByTime` 只负责时间分组：

```typescript
// 改动前
interface StrokeGroup {
  readonly strokes: Stroke[]
  readonly boundingBox: BoundingBox  // 移除
  readonly startTime: number
  readonly endTime: number
}

// 改动后
interface StrokeGroup {
  readonly strokes: Stroke[]
  readonly startTime: number
  readonly endTime: number
}
```

消费者需要 bbox 时自行调用 `computeBBox(group.strokes)`。

#### 函数重命名

`translateToOrigin` → `translateToBBoxOrigin`

新名称体现"基于 BBox 偏移"的语义。函数行为不变：计算所有笔画的联合 BBox，将坐标平移使 BBox 左上角对齐到 (0,0)。

#### ExportFormatOptions

`boundingBox` → `toBBoxOrigin`

```typescript
// 改动前
interface ExportFormatOptions {
  readonly boundingBox?: boolean
}

// 改动后
interface ExportFormatOptions {
  readonly toBBoxOrigin?: boolean
}
```

- `toBBoxOrigin: true` → 计算 bbox + 平移坐标到 bbox 原点 + 输出含 bbox
- `toBBoxOrigin: false`/不传 → 世界坐标原样输出，不含 bbox

命名设计：选项名 `toBBoxOrigin` 表达意图（"坐标要到 bbox 原点"），与函数名 `translateToBBoxOrigin`（动作）互补不冲突。

#### SimpleJsonFormat

内部适配新的 `toBBoxOrigin` 选项名，行为不变。

### 三、Playground 简化

#### useRecognitionEditor.ts

- 移除 `translateEnabled` ref
- 移除手动调用 `translateToOrigin` 的逻辑
- 移除 `mergeGroupBoundingBoxes` 辅助函数
- 新增 `toBBoxOrigin: Ref<boolean>` ref（默认 true）
- 新增 `selectedFormat` ref 用于格式选择
- `updateJsonResult()` 简化为直接调用 `format.convert(allStrokes, { toBBoxOrigin: toBBoxOrigin.value })`

#### RecognitionScene.vue

- 移除 "平移到原点" 开关
- 将 "包含包围盒" 开关改为 "平移到包围盒原点"，映射到 `toBBoxOrigin`
- 新增 format 下拉选择器（当前仅 "Simple JSON"，通过 ExportFormat 接口预留扩展）
- gapMs 滑块不变

#### RecognitionDataPanel.vue

- 适配 `StrokeGroup` 接口变化（移除 bbox 相关显示，或改为按需计算）

## 不变的部分

- `@inker/recognition` 包的 `RecognitionHelper` 不修改
- `groupByTime` 的分组逻辑不变（只移除 bbox 计算）
- 整体布局、自动/手动模式、路由配置不变
- `translateToBBoxOrigin` 函数仍作为独立工具导出

## 约束

- 不新增外部依赖
- 不修改路由或场景注册
- 全项目 BBox 重命名需确保所有引用同步更新
