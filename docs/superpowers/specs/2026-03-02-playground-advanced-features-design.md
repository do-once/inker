# Playground 高级功能设计：笔迹回放 + 导出

日期：2026-03-02

## 概述

为 playground 添加两个高级功能：**笔迹回放**和**导出（PNG/JSON）**，展示 SDK 的完整应用场景。

## 范围

本次只做第一批功能：
- 笔迹回放（PlaybackPanel）
- 导出 PNG / JSON（ExportPanel）

网格/参考线、多页切换暂缓（网格留后续迭代，多页留 v4.0）。

---

## 一、笔迹回放

### 架构决策

**方案 B：外部组合** — SDK 暴露基础数据方法，`@aw/playback` 独立消费，playground 自行组装。

理由：
- 与 SDK Facade 解耦，回放是可选增强能力
- `@aw/playback` 已完整实现（StrokePlayer + PlaybackTimeline），只需 SDK 暴露数据

### SDK 层改动

`AnimalWriting.facade.ts` 新增：

```typescript
/** 获取全部操作序列 */
getOperations(): Operation[]

/** 应用单个操作（用于回放驱动） */
applyOperation(op: Operation): void

/** 获取文档快照 */
getSnapshot(): DocumentSnapshot
```

### Playground 组件

新增 `PlaybackPanel.vue`：
- 播放 / 暂停 / 停止按钮行
- 进度条（显示当前进度百分比）
- 速度选择（0.5x / 1x / 2x）
- 总时长显示
- 播放时禁用绘图输入

### 数据流

```
用户点击播放
  → playground 调用 editor.getOperations()
  → 创建 StrokePlayer(operations)
  → player.onOperation = op => editor.applyOperation(op)
  → player.play()
  → 编辑器逐步重绘
```

---

## 二、导出功能

### 架构决策

#### 图片导出

- `RenderAdapterInterface` 新增 `exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>`
- 每种渲染器各自实现（Canvas 2D → `canvas.toBlob()`，后续 SVG → 序列化 DOM）
- SDK Facade 不添加导出方法，消费者通过 `editor.renderAdapter.exportAsBlob()` 调用
- Blob → 文件下载由业务自行处理（playground 内部写 `downloadBlob()` 工具函数）

#### JSON 导出

- 序列化/反序列化放入 `@aw/model` 包（序列化是模型层的天然职责）
- SDK Facade 暴露 `getSnapshot(): DocumentSnapshot`（数据访问）
- SDK Facade 暴露 `loadSnapshot(snapshot: DocumentSnapshot): void`（数据导入）

#### JSON 数据格式

```typescript
interface ExportData {
  version: string              // 格式版本号，如 "1.0"
  documentSize: Size           // { width, height }
  strokes: Array<{
    id: string
    points: StrokePoint[]      // 绝对世界坐标（px）
    style: StrokeStyle
    createdAt: number
  }>
}
```

- 默认存储绝对世界坐标 + documentSize
- 归一化方法已存在于 `@aw/util`（`toNormalized(point, size)` / `fromNormalized(point, size)`），消费者按需调用
- 不强制归一化，保持数据无损

#### 序列化 API（@aw/model）

```typescript
/** 将 DocumentSnapshot 序列化为 JSON 字符串 */
export function snapshotToJSON(snapshot: DocumentSnapshot, documentSize: Size): string

/** 将 JSON 字符串反序列化为 DocumentSnapshot */
export function jsonToSnapshot(json: string): { snapshot: DocumentSnapshot; documentSize: Size }
```

### Playground 组件

新增 `ExportPanel.vue`：
- "导出 PNG" 按钮 — 调用 `editor.renderAdapter.exportAsBlob('png')` → 下载
- "导出 JSON" 按钮 — 调用 `editor.getSnapshot()` → `snapshotToJSON()` → 下载
- "导入 JSON" 按钮 — 文件选择器 → `jsonToSnapshot()` → `editor.loadSnapshot()`

---

## 三、SDK Facade 新增 API 汇总

| 方法 | 返回类型 | 用途 |
|------|---------|------|
| `getOperations()` | `Operation[]` | 获取操作序列（回放用） |
| `applyOperation(op)` | `void` | 应用单个操作（回放驱动） |
| `getSnapshot()` | `DocumentSnapshot` | 获取文档快照（导出用） |
| `loadSnapshot(snapshot)` | `void` | 加载文档快照（导入用） |
| `renderAdapter` (getter) | `RenderAdapterInterface` | 暴露渲染适配器引用（图片导出用） |

## 四、RenderAdapterInterface 新增方法

```typescript
interface RenderAdapterInterface {
  // ... 现有方法 ...

  /** 导出当前渲染结果为 Blob */
  exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>
}
```

## 五、包改动范围

| 包 | 改动 | 类型 |
|-----|------|------|
| `@aw/types` | `RenderAdapterInterface` 新增 `exportAsBlob()` | 接口扩展 |
| `@aw/render-canvas` | `CanvasRenderAdapter` 实现 `exportAsBlob()` | 实现 |
| `@aw/sdk` | Facade 新增 `getOperations` / `applyOperation` / `getSnapshot` / `loadSnapshot` / `renderAdapter` | API 扩展 |
| `@aw/model` | 新增 `snapshotToJSON()` / `jsonToSnapshot()` | 序列化工具 |
| `playground` | 新增 `PlaybackPanel.vue` / `ExportPanel.vue`，更新 `useEditor.ts` / `App.vue` | UI 组件 |

## 六、多渲染器兼容性

图片导出通过 `RenderAdapterInterface.exportAsBlob()` 接口抽象，每种渲染器提供自己的实现：

| 渲染器 | exportAsBlob 实现 |
|--------|------------------|
| Canvas 2D (`@aw/render-canvas`) | `canvas.toBlob(callback, mimeType, quality)` |
| SVG (`@aw/render-svg`，规划中) | 序列化 SVG DOM → `new Blob([svgString])` |
| OffscreenCanvas (`@aw/render-offscreen`，规划中) | `offscreen.convertToBlob({ type, quality })` |

JSON 导出操作数据模型（DocumentSnapshot），与渲染器完全无关。

## 七、暂缓功能

| 功能 | 原因 | 计划 |
|------|------|------|
| 网格/参考线 | SDK 无现有支撑，需新增渲染层 | 后续迭代 |
| 多页切换 | 需要改动 Operation 模型 + StrokeDocument + EditorKernel，破坏性重构 | v4.0 规划 |
| SVG 导出 | 依赖 `@aw/render-svg` 实现 | 渲染器实现后自动获得 |
