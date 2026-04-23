# Freehand 参数对齐官网设计

## 背景

当前 AnimalWriting 的书写效果不如 [perfect-freehand 官网演示](https://www.perfectfreehand.com/) 流畅。需要在 playground 中完整对齐官网参数配置，以便快速对比排查是否为参数差异导致。

## 目标

1. `StrokeStyle` 类型继承 `StrokeOptions`，复用 freehand 字段定义，消除语义重复
2. Playground FreehandPanel 对齐官网全部可配参数（含 19 种 Easing、Cap Start/End）
3. 新增"官网默认"快捷按钮，一键切换至官网默认参数进行对比

## 类型设计

### EasingType（19 种，对齐官网）

```typescript
export type EasingType =
  | 'linear'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  | 'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint'
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo'
```

### StrokeStyle 继承 StrokeOptions

```typescript
import type { StrokeOptions } from '@aw/freehand'

// 排除不可序列化（easing 函数）和内部字段（last）
type SerializableStrokeOptions = Readonly<
  Omit<StrokeOptions, 'easing' | 'start' | 'end' | 'last'>
>

// 复用 freehand 的 start/end 结构，仅排除 easing 函数
type StrokeTaper = Readonly<
  Omit<NonNullable<StrokeOptions['start']>, 'easing'>
>

export interface StrokeStyle extends SerializableStrokeOptions {
  readonly type: StrokeType
  readonly color: string
  readonly size: number         // 从 StrokeOptions 继承，收窄为 required
  readonly opacity: number
  readonly easing?: EasingType  // 替换函数为可序列化枚举
  readonly start?: StrokeTaper
  readonly end?: StrokeTaper
}
```

**关键变更：**
- `width` → `size`（对齐 freehand 字段名）
- `taperStart`/`taperEnd` → `start.taper`/`end.taper`（对齐 freehand 嵌套结构）
- 新增 `easing`（EasingType）、`start.cap`、`end.cap`
- 去掉 `[key: string]: unknown` 索引签名

### Easing 函数映射

位置：`@aw/freehand` 包导出

```typescript
export const EASING_FUNCTIONS: Record<EasingType, (t: number) => number> = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  // ... 共 19 个，完整实现来自官网源码
}
```

数据流：`UI 下拉菜单 → EasingType 字符串 → StrokeStyle.easing → FreehandProcessor → EASING_FUNCTIONS[easing] → getStroke({ easing: fn })`

## 影响范围

### @aw/types (`shared/types/`)
- `stroke-style.types.ts`：重写 StrokeStyle，新增 EasingType、StrokeTaper
- `editor-options.types.ts`：EditorTheme 的 `width` → `size`（与 StrokeStyle 同语义，统一改名）

### @aw/freehand (`third-parties/freehand/`)
- 新增 `easings.ts`：导出 `EASING_FUNCTIONS` 映射表和 `EasingType`
- 更新 `index.ts`：导出新模块

### @aw/brush-freehand (`libraries/brush-freehand/`)
- `freehand.processor.ts`：
  - `width` → `size`
  - `taperStart`/`taperEnd` → `start`/`end` 直接透传
  - 新增 easing 查表映射、cap 透传

### @aw/core (`libraries/core/`)
- `editor-kernel.service.ts`：默认 penStyle `width` → `size`

### @aw/sdk (`libraries/sdk/`)
- EditorBuilder / Facade 中 `width` → `size`

### @aw/model (`libraries/model/`)
- 检查序列化/反序列化是否涉及 width 字段

### playground (`playground/app/`)
- `useEditor.ts`：
  - DEFAULT_STYLE_PARAMS 全部字段更新
  - toolPresets 更新（width → size）
  - syncStyle 更新
  - 新增"官网默认"预设常量
- `FreehandPanel.vue`：
  - 新增 Easing 下拉菜单（19 选项）
  - 新增 Cap Start / Cap End 复选框
  - 新增"官网默认"快捷按钮
- `StylePanel.vue`：width → size

## 官网默认参数预设

```typescript
const OFFICIAL_DEFAULTS = {
  size: 1,
  thinning: 0.5,
  streamline: 0.5,
  smoothing: 0.5,
  easing: 'linear' as EasingType,
  simulatePressure: true,
  start: { taper: 0, cap: true },
  end: { taper: 0, cap: true },
}
```

## 不在本次范围

- `start.easing` / `end.easing`（官网 UI 未暴露，暂不实现）
- 渲染器层改动（参数透传在 Processor 层完成，渲染器不感知）
- 新笔刷类型（仅增加参数配置能力）
