# Freehand 参数对齐官网 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** StrokeStyle 继承 freehand StrokeOptions 类型，Playground 对齐官网全部 freehand 参数配置，新增"官网默认"一键切换按钮

**Architecture:** 底层类型 StrokeStyle 通过 Omit+Pick 继承 freehand 的 StrokeOptions（排除不可序列化字段），`width` 统一改为 `size`，`taperStart`/`taperEnd` 改为嵌套 `start`/`end` 结构。新增 EasingType 字符串联合类型 + EASING_FUNCTIONS 函数映射表。Playground UI 新增 Easing 下拉、Cap 复选框和"官网默认"按钮。

**Tech Stack:** TypeScript, Vue 3 Composition API, perfect-freehand, Vitest

**设计文档:** `docs/superpowers/specs/2026-03-11-freehand-params-alignment-design.md`

---

## Chunk 1: 类型层 + Freehand 包

### Task 1: @aw/types — 重写 StrokeStyle 类型 + EditorTheme width→size

**Files:**
- Modify: `shared/types/src/stroke-style.types.ts`
- Modify: `shared/types/src/editor-options.types.ts`（EditorTheme width→size）
- Modify: `shared/types/src/index.ts`（新增 EasingType 导出）

- [ ] **Step 1: 重写 stroke-style.types.ts**

将整个文件替换为：

```typescript
/**
 * 笔画样式
 */
import type { StrokeOptions } from '@aw/freehand'

/** 笔画类型 */
export type StrokeType = 'pen' | 'eraser' | 'marker' | 'pencil' | 'wiper'

/** 压感缓动函数类型（对齐 perfect-freehand 官网 19 种） */
export type EasingType =
  | 'linear'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  | 'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint'
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo'

/**
 * 从 StrokeOptions 中提取可序列化的扁平字段
 * 排除：easing（函数）、start/end（嵌套，需特殊处理）、last（内部字段）
 */
type SerializableStrokeOptions = Readonly<
  Omit<StrokeOptions, 'easing' | 'start' | 'end' | 'last'>
>

/**
 * 笔画起始/结束的渐细+端帽配置
 * 复用 freehand StrokeOptions['start'] 的 cap/taper 字段，排除 easing 函数
 */
export type StrokeTaper = Readonly<
  Omit<NonNullable<StrokeOptions['start']>, 'easing'>
>

/**
 * 笔画样式定义
 * 继承 freehand StrokeOptions 的可序列化字段（size/thinning/smoothing/streamline/simulatePressure）
 * 新增绘图专用字段（type/color/opacity）和可序列化的 easing/start/end
 */
export interface StrokeStyle extends SerializableStrokeOptions {
  /** 笔画类型 */
  readonly type: StrokeType
  /** 颜色值 */
  readonly color: string
  /** 笔画基准大小（直径），继承自 StrokeOptions.size，收窄为 required */
  readonly size: number
  /** 不透明度（0-1） */
  readonly opacity: number
  /** 压感缓动类型（可序列化字符串，替代 StrokeOptions 中的函数） */
  readonly easing?: EasingType
  /** 起始端配置（渐细 + 端帽） */
  readonly start?: StrokeTaper
  /** 结束端配置（渐细 + 端帽） */
  readonly end?: StrokeTaper
}
```

- [ ] **Step 2: 更新 EditorTheme width→size**

`shared/types/src/editor-options.types.ts` 中 `EditorTheme` 的三处 `width` 全部改为 `size`：

```typescript
export interface EditorTheme {
  readonly ink: {
    readonly color: string
    readonly size: number
    readonly opacity: number
  }
  readonly eraser: {
    readonly size: number
    readonly cursor?: string
  }
  readonly marker: {
    readonly color: string
    readonly size: number
    readonly opacity: number
  }
}
```

- [ ] **Step 3: 更新 index.ts 导出**

在 `shared/types/src/index.ts` 的 StrokeStyle 导出行，新增 `EasingType` 和 `StrokeTaper`：

```typescript
// 原来：
export type { StrokeType, StrokeStyle } from './stroke-style.types'
// 改为：
export type { StrokeType, StrokeStyle, EasingType, StrokeTaper } from './stroke-style.types'
```

- [ ] **Step 4: 确认 @aw/types 的 package.json 已声明 @aw/freehand 依赖**

检查 `shared/types/package.json`，如果 dependencies 中没有 `@aw/freehand`，需要添加（type-only 依赖也需要声明）。

- [ ] **Step 5: 运行类型检查**

```bash
cd shared/types && npx tsc --noEmit
```

此时会有大量下游编译错误（width → size 等），这是预期的，确认本包自身类型正确即可。

- [ ] **Step 6: 提交**

```bash
git add shared/types/
git commit -m "refactor: StrokeStyle 继承 freehand StrokeOptions，width→size，新增 EasingType"
```

---

### Task 2: @aw/freehand — 新增 Easing 函数映射

**Files:**
- Create: `third-parties/freehand/src/easings.ts`
- Modify: `third-parties/freehand/src/index.ts`

- [ ] **Step 1: 创建 easings.ts**

```typescript
import type { EasingType } from '@aw/types'

/**
 * Easing 函数映射表
 * 19 种缓动函数，对齐 perfect-freehand 官网
 * key 为可序列化的 EasingType 字符串，value 为实际的缓动函数
 */
export const EASING_FUNCTIONS: Record<EasingType, (t: number) => number> = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: t => t * t * t,
  easeOutCubic: t => --t * t * t + 1,
  easeInOutCubic: t =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: t => t * t * t * t,
  easeOutQuart: t => 1 - --t * t * t * t,
  easeInOutQuart: t =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
  easeInQuint: t => t * t * t * t * t,
  easeOutQuint: t => 1 + --t * t * t * t * t,
  easeInOutQuint: t =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,
  easeInSine: t => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: t => Math.sin((t * Math.PI) / 2),
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: t =>
    t <= 0
      ? 0
      : t >= 1
        ? 1
        : t < 0.5
          ? Math.pow(2, 20 * t - 10) / 2
          : (2 - Math.pow(2, -20 * t + 10)) / 2
}
```

- [ ] **Step 2: 更新 index.ts 导出**

在 `third-parties/freehand/src/index.ts` 末尾添加：

```typescript
export { EASING_FUNCTIONS } from './easings'
```

- [ ] **Step 3: 确认循环依赖**

`@aw/types` import type from `@aw/freehand`（type-only），`@aw/freehand` import type from `@aw/types`（type-only）。两个都是 type-only import，不会产生运行时循环依赖。确认 TypeScript 编译无报错。

```bash
cd third-parties/freehand && npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add third-parties/freehand/
git commit -m "feat: 新增 EASING_FUNCTIONS 映射表（19 种缓动函数对齐官网）"
```

---

## Chunk 2: 核心库层 width→size 迁移

### Task 3: @aw/brush-freehand — FreehandProcessor 参数对齐

**Files:**
- Modify: `libraries/brush-freehand/src/freehand.processor.ts`
- Modify: `libraries/brush-freehand/src/rect-eraser.processor.ts`
- Modify: `libraries/brush-freehand/src/__tests__/freehand.processor.spec.ts`

- [ ] **Step 1: 更新 FreehandProcessor**

`libraries/brush-freehand/src/freehand.processor.ts` 第 33-42 行，getStroke 调用改为：

```typescript
    // 调用 getStroke 计算轮廓点
    const outline = getStroke(inputPoints, {
      size: style.size,
      last: complete,
      simulatePressure: style.simulatePressure ?? true,
      thinning: style.thinning,
      smoothing: style.smoothing,
      streamline: style.streamline,
      easing: style.easing ? EASING_FUNCTIONS[style.easing] : undefined,
      start: style.start,
      end: style.end
    })
```

同时在文件顶部添加 import：

```typescript
import { getStroke, EASING_FUNCTIONS } from '@aw/freehand'
```

注意：由于 StrokeStyle 不再有索引签名，字段直接访问，无需 `as` 类型断言。start/end 结构与 StrokeOptions 的 start/end 兼容（StrokeTaper 是 StrokeOptions['start'] 的子类型），直接透传。

- [ ] **Step 2: 更新 RectEraserProcessor**

`libraries/brush-freehand/src/rect-eraser.processor.ts` 第 88 行：

```typescript
// 原来：
const tolerance = Math.max(eraserStyle.width / 2, MIN_TOLERANCE)
// 改为：
const tolerance = Math.max(eraserStyle.size / 2, MIN_TOLERANCE)
```

- [ ] **Step 3: 更新测试文件**

`libraries/brush-freehand/src/__tests__/freehand.processor.spec.ts`：

1. 第 22 行 defaultStyle：`width: 2` → `size: 2`
2. 第 109 行测试名称：`'不同 width 应影响输出'` → `'不同 size 应影响输出'`
3. 第 113-114 行：`width: 1` → `size: 1`，`width: 10` → `size: 10`
4. 第 199-205 行：`taperStart: 50, taperEnd: 30` → `start: { taper: 50 }, end: { taper: 30 }`
5. 测试名称 199 行：`'设置 taperStart/taperEnd 应返回有效路径'` → `'设置 start/end taper 应返回有效路径'`

新增一个 easing 测试用例：

```typescript
    it('设置 easing 应返回有效路径', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)
      const style: StrokeStyle = {
        ...defaultStyle,
        easing: 'easeOutQuad'
      }

      const result = processor.computeOutline(points, style, true)

      expectValidOutline(result)
    })
```

- [ ] **Step 4: 运行测试**

```bash
cd libraries/brush-freehand && npx vitest run
```

Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add libraries/brush-freehand/
git commit -m "refactor: FreehandProcessor 对齐 StrokeStyle 新类型（size/start/end/easing）"
```

---

### Task 4: @aw/core — EditorKernel 默认样式迁移

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts`

- [ ] **Step 1: 更新默认 penStyle**

第 62-67 行：

```typescript
// 原来：
  private _penStyle: StrokeStyle = {
    type: 'pen',
    color: '#000000',
    width: 2,
    opacity: 1
  }
// 改为：
  private _penStyle: StrokeStyle = {
    type: 'pen',
    color: '#000000',
    size: 2,
    opacity: 1
  }
```

- [ ] **Step 2: 更新橡皮擦轨迹调用**

第 134 行：

```typescript
// 原来：
this.deps.renderAdapter.startEraserTrail(this._penStyle.width)
// 改为：
this.deps.renderAdapter.startEraserTrail(this._penStyle.size)
```

- [ ] **Step 3: 全文搜索确认无遗漏**

在 `libraries/core/src/` 目录搜索 `.width` 引用，确保所有 StrokeStyle.width 引用都已更新。注意：`containerWidth` 等非 StrokeStyle 的 width 不需要改。

- [ ] **Step 4: 提交**

```bash
git add libraries/core/
git commit -m "refactor: EditorKernel 默认样式 width→size"
```

---

### Task 5: @aw/sdk — Facade + Builder 迁移

**Files:**
- Modify: `libraries/sdk/src/animal-writing.facade.ts`

- [ ] **Step 1: 更新 AnimalWriting.create()**

`libraries/sdk/src/animal-writing.facade.ts` 第 27-31 行：

```typescript
// 原来：
    if (options.penStyle) {
      builder.withPenStyle({
        type: options.penStyle.type ?? 'pen',
        color: options.penStyle.color ?? '#000000',
        width: options.penStyle.width ?? 2,
        opacity: options.penStyle.opacity ?? 1
      })
    }
// 改为：
    if (options.penStyle) {
      builder.withPenStyle({
        type: options.penStyle.type ?? 'pen',
        color: options.penStyle.color ?? '#000000',
        size: options.penStyle.size ?? 2,
        opacity: options.penStyle.opacity ?? 1
      })
    }
```

- [ ] **Step 2: 提交**

```bash
git add libraries/sdk/
git commit -m "refactor: SDK facade 默认样式 width→size"
```

---

### Task 6: @aw/model — 测试文件迁移 + 序列化兼容

**Files:**
- Modify: `libraries/model/src/__tests__/operation-factory.service.spec.ts`
- Modify: `libraries/model/src/__tests__/snapshot-builder.service.spec.ts`
- Modify: `libraries/model/src/__tests__/stroke-document.model.spec.ts`
- Modify: `libraries/model/src/__tests__/operation-serializer.spec.ts`

- [ ] **Step 1: 批量更新测试中的 StrokeStyle 字面量**

所有测试中的 `width: 2`（在 StrokeStyle 上下文中）→ `size: 2`，`width: 3` → `size: 3` 等。

注意区分：`documentSize: { width: 800, height: 600 }` 中的 `width` 是 Size 类型，**不要改**。

- [ ] **Step 2: 运行 model 包测试**

```bash
cd libraries/model && npx vitest run
```

Expected: 全部通过

- [ ] **Step 3: 提交**

```bash
git add libraries/model/
git commit -m "refactor: model 测试 StrokeStyle width→size"
```

---

### Task 7: 全局类型检查

- [ ] **Step 1: 在项目根目录运行全局类型检查**

```bash
npx tsc --noEmit
```

或各包分别检查，修复所有 TypeScript 编译错误。重点关注还有没有遗漏的 `.width` 引用（在 StrokeStyle 上下文中）。

- [ ] **Step 2: 全局搜索遗漏**

搜索整个项目中 `\.width` 在 StrokeStyle 上下文中的引用，确认全部更新完毕。

注意以下 `width` 引用**不需要改**：
- `Size` 类型中的 `width`（文档/容器尺寸）
- Canvas 元素的 `width`（物理像素宽度）
- `containerWidth`、`documentWidth` 等（坐标系统）

- [ ] **Step 3: 运行全部测试**

```bash
npm test
```

- [ ] **Step 4: 提交（如有修复）**

```bash
git add -A
git commit -m "fix: 修复全局类型检查中的遗漏引用"
```

---

## Chunk 3: Playground UI 层

### Task 8: useEditor.ts — 状态管理层更新

**Files:**
- Modify: `playground/app/src/composables/useEditor.ts`

- [ ] **Step 1: 更新 DEFAULT_STYLE_PARAMS**

第 10-20 行替换为：

```typescript
/** 样式参数默认值 */
const DEFAULT_STYLE_PARAMS = {
  color: '#000000',
  size: 2,
  opacity: 1,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: 'linear' as EasingType,
  simulatePressure: true,
  taperStart: 0,
  capStart: true,
  taperEnd: 0,
  capEnd: true
}
```

注意：此处 UI 层保持 `taperStart`/`taperEnd`/`capStart`/`capEnd` 扁平命名（方便 v-model 双向绑定），在 `syncStyle()` 中转换为嵌套结构。

- [ ] **Step 2: 更新 toolPresets**

第 22-28 行：所有 `width` → `size`：

```typescript
const toolPresets: Record<ToolType, Partial<StrokeStyle>> = {
  pen: { type: 'pen', color: '#000000', size: 2, opacity: 1 },
  marker: { type: 'marker', color: '#ff6600', size: 12, opacity: 0.6 },
  pencil: { type: 'pencil', color: '#333333', size: 1, opacity: 0.8 },
  eraser: { type: 'eraser', color: '#ffffff', size: 20, opacity: 1 }
}
```

- [ ] **Step 3: 新增官网默认预设 + import**

在文件顶部 import 中添加 `EasingType`：

```typescript
import type { StrokeStyle, Operation, EasingType } from '@aw/types'
```

在 toolPresets 下方新增：

```typescript
/** perfect-freehand 官网默认参数 */
const OFFICIAL_DEFAULTS = {
  size: 1,
  thinning: 0.5,
  streamline: 0.5,
  smoothing: 0.5,
  easing: 'linear' as EasingType,
  simulatePressure: true,
  taperStart: 0,
  capStart: true,
  taperEnd: 0,
  capEnd: true
}
```

- [ ] **Step 4: 更新 syncStyle()**

第 171-185 行替换为：

```typescript
  /** 同步 styleParams 到编辑器 */
  function syncStyle() {
    if (!editor.value) return
    editor.value.penStyle = {
      type: currentTool.value === 'eraser' ? 'eraser' : currentTool.value,
      color: styleParams.color,
      size: styleParams.size,
      opacity: styleParams.opacity,
      thinning: styleParams.thinning,
      smoothing: styleParams.smoothing,
      streamline: styleParams.streamline,
      easing: styleParams.easing as EasingType,
      simulatePressure: styleParams.simulatePressure,
      start: { taper: styleParams.taperStart, cap: styleParams.capStart },
      end: { taper: styleParams.taperEnd, cap: styleParams.capEnd }
    }
  }
```

- [ ] **Step 5: 更新 setTool() 和 resetParams()**

第 188-211 行，所有 `.width` → `.size`：

```typescript
  function setTool(tool: ToolType) {
    currentTool.value = tool
    const preset = toolPresets[tool]
    if (tool !== 'eraser') {
      styleParams.color = preset.color as string
      styleParams.size = preset.size as number
      styleParams.opacity = preset.opacity as number
    }
    syncStyle()
  }

  function resetParams() {
    const preset = toolPresets[currentTool.value]
    Object.assign(styleParams, {
      ...DEFAULT_STYLE_PARAMS,
      color: preset.color as string,
      size: preset.size as number,
      opacity: preset.opacity as number
    })
  }
```

- [ ] **Step 6: 新增 applyOfficialDefaults() 函数**

在 resetParams 下方添加：

```typescript
  /** 应用官网默认参数（用于对比效果） */
  function applyOfficialDefaults() {
    Object.assign(styleParams, OFFICIAL_DEFAULTS)
  }
```

并在 return 对象中导出 `applyOfficialDefaults`。

- [ ] **Step 7: 提交**

```bash
git add playground/app/src/composables/useEditor.ts
git commit -m "refactor: useEditor 对齐 StrokeStyle 新类型，新增官网默认预设"
```

---

### Task 9: StylePanel.vue — width→size

**Files:**
- Modify: `playground/app/src/components/StylePanel.vue`

- [ ] **Step 1: 更新 props 和 emits**

```typescript
// props：width → size
const props = defineProps<{
  color: string
  size: number
  opacity: number
}>()

const emit = defineEmits<{
  'update:color': [value: string]
  'update:size': [value: number]
  'update:opacity': [value: number]
}>()
```

- [ ] **Step 2: 更新模板**

slider 的 label 改为 "大小"（对齐官网 "Size"），绑定改为 size：

```html
    <SliderControl
      label="大小"
      :min="1"
      :max="50"
      :step="1"
      :model-value="props.size"
      @update:model-value="emit('update:size', $event)"
    />
```

- [ ] **Step 3: 提交**

```bash
git add playground/app/src/components/StylePanel.vue
git commit -m "refactor: StylePanel width→size"
```

---

### Task 10: FreehandPanel.vue — 新增 Easing/Cap 控件 + 官网默认按钮

**Files:**
- Modify: `playground/app/src/components/FreehandPanel.vue`

- [ ] **Step 1: 更新 props 和 emits**

```typescript
<script setup lang="ts">
import SliderControl from './SliderControl.vue'
import type { EasingType } from '@aw/types'

const EASING_OPTIONS: EasingType[] = [
  'linear',
  'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
  'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
  'easeInQuart', 'easeOutQuart', 'easeInOutQuart',
  'easeInQuint', 'easeOutQuint', 'easeInOutQuint',
  'easeInSine', 'easeOutSine', 'easeInOutSine',
  'easeInExpo', 'easeOutExpo', 'easeInOutExpo'
]

const props = defineProps<{
  thinning: number
  smoothing: number
  streamline: number
  easing: EasingType
  simulatePressure: boolean
  taperStart: number
  capStart: boolean
  taperEnd: number
  capEnd: boolean
}>()

const emit = defineEmits<{
  'update:thinning': [value: number]
  'update:smoothing': [value: number]
  'update:streamline': [value: number]
  'update:easing': [value: EasingType]
  'update:simulatePressure': [value: boolean]
  'update:taperStart': [value: number]
  'update:capStart': [value: boolean]
  'update:taperEnd': [value: number]
  'update:capEnd': [value: boolean]
  'applyOfficialDefaults': []
}>()
</script>
```

- [ ] **Step 2: 更新模板**

在 Streamline slider 之后、simulatePressure 之前，新增 Easing 下拉：

```html
    <div class="select-row">
      <span class="select-label">缓动</span>
      <select
        :value="props.easing"
        @change="emit('update:easing', ($event.target as HTMLSelectElement).value as EasingType)"
        class="select-input"
      >
        <option v-for="opt in EASING_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </div>
```

在 taperStart slider 之后，新增 Cap Start 复选框：

```html
    <label class="checkbox-row">
      <input
        type="checkbox"
        :checked="props.capStart"
        @change="emit('update:capStart', ($event.target as HTMLInputElement).checked)"
      />
      <span>起始端帽</span>
    </label>
```

在 taperEnd slider 之后，新增 Cap End 复选框：

```html
    <label class="checkbox-row">
      <input
        type="checkbox"
        :checked="props.capEnd"
        @change="emit('update:capEnd', ($event.target as HTMLInputElement).checked)"
      />
      <span>结束端帽</span>
    </label>
```

在面板底部新增"官网默认"按钮：

```html
    <button class="official-btn" @click="emit('applyOfficialDefaults')">
      官网默认
    </button>
```

- [ ] **Step 3: 新增样式**

在 `<style scoped>` 中添加：

```css
.select-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.select-label {
  font-size: 12px;
  color: #666;
}
.select-input {
  width: 120px;
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.official-btn {
  width: 100%;
  padding: 6px 0;
  margin-top: 8px;
  font-size: 12px;
  color: #1a73e8;
  background: #e8f0fe;
  border: 1px solid #d2e3fc;
  border-radius: 4px;
  cursor: pointer;
}
.official-btn:hover {
  background: #d2e3fc;
}
```

- [ ] **Step 4: 提交**

```bash
git add playground/app/src/components/FreehandPanel.vue
git commit -m "feat: FreehandPanel 新增 Easing 下拉、Cap 复选框和官网默认按钮"
```

---

### Task 11: App.vue — 更新双向绑定

**Files:**
- Modify: `playground/app/src/App.vue`

- [ ] **Step 1: 更新 StylePanel 绑定**

```html
<!-- 原来 -->
<StylePanel
  v-model:color="styleParams.color"
  v-model:width="styleParams.width"
  v-model:opacity="styleParams.opacity"
/>
<!-- 改为 -->
<StylePanel
  v-model:color="styleParams.color"
  v-model:size="styleParams.size"
  v-model:opacity="styleParams.opacity"
/>
```

- [ ] **Step 2: 更新 FreehandPanel 绑定**

```html
<!-- 原来 -->
<FreehandPanel
  v-model:thinning="styleParams.thinning"
  v-model:smoothing="styleParams.smoothing"
  v-model:streamline="styleParams.streamline"
  v-model:simulate-pressure="styleParams.simulatePressure"
  v-model:taper-start="styleParams.taperStart"
  v-model:taper-end="styleParams.taperEnd"
/>
<!-- 改为 -->
<FreehandPanel
  v-model:thinning="styleParams.thinning"
  v-model:smoothing="styleParams.smoothing"
  v-model:streamline="styleParams.streamline"
  v-model:easing="styleParams.easing"
  v-model:simulate-pressure="styleParams.simulatePressure"
  v-model:taper-start="styleParams.taperStart"
  v-model:cap-start="styleParams.capStart"
  v-model:taper-end="styleParams.taperEnd"
  v-model:cap-end="styleParams.capEnd"
  @apply-official-defaults="applyOfficialDefaults"
/>
```

- [ ] **Step 3: 在 useEditor 解构中新增 applyOfficialDefaults**

```typescript
const {
  // ... 现有字段 ...
  applyOfficialDefaults,
  dispose
} = useEditor()
```

- [ ] **Step 4: 提交**

```bash
git add playground/app/src/App.vue
git commit -m "feat: App.vue 接入 easing/cap 双向绑定和官网默认按钮"
```

---

## Chunk 4: 文档更新 + 验证

### Task 12: 文档同步

**Files:**
- Modify: `libraries/brush-freehand/README.md`（更新 API 示例中的 width→size、taperStart→start 等）
- Modify: `CLAUDE.md`（如果有 width 引用需要更新）

- [ ] **Step 1: 更新 brush-freehand README**

检查 `libraries/brush-freehand/README.md` 中的代码示例，将 `width`/`taperStart`/`taperEnd` 更新为新字段名。

- [ ] **Step 2: 检查并更新 CLAUDE.md**

搜索 CLAUDE.md 中是否引用了 `width` 或 `taperStart`/`taperEnd` 字段，如有则更新。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "docs: 同步文档中的 StrokeStyle 字段名变更"
```

---

### Task 13: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 手动验证清单**

1. 打开 playground，默认钢笔书写正常
2. 切换马克笔、铅笔、橡皮擦，各工具正常工作
3. 调节 Size 滑块，笔画粗细实时变化
4. 调节 Thinning/Smoothing/Streamline 滑块，效果实时变化
5. Easing 下拉菜单包含 19 个选项，切换后书写效果有差异
6. Cap Start/End 复选框切换，起始/结束端帽效果变化
7. Taper Start/End 滑块调节，渐细效果变化
8. 点击"官网默认"按钮，所有参数重置为官网默认值
9. 点击"重置参数"按钮，参数恢复为当前工具默认值
10. 撤销/重做正常
11. 导出 JSON → 导入 JSON，笔画恢复正常
12. 回放功能正常

- [ ] **Step 3: 对比验证**

1. 在 playground 中点击"官网默认"按钮
2. 书写几笔
3. 在 perfect-freehand 官网（默认参数）书写类似笔画
4. 对比两者流畅度差异

---

## 注意事项

### 序列化兼容性

`width` → `size` 是 breaking change。已有的导出 JSON 文件中 `stroke:start` operation 的 `style` 字段包含 `width`。如果需要兼容旧数据，应在 `jsonToOperations()` 中添加迁移逻辑（将 `width` 映射到 `size`）。本次暂不实现迁移，因为项目仍在 v3.0 开发阶段，无生产数据需要迁移。

### Canvas/Container width 不受影响

所有 Canvas 元素物理尺寸的 `width`、CoordinateSystem 的 `containerWidth`/`documentWidth` 等与 StrokeStyle 无关，**不需要改**。
