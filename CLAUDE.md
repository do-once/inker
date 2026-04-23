# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

## 语言

- 请始终使用中文与我交流
- 代码注释使用中文
- Git 提交信息使用中文

## 项目概述

Inker 是一个模型驱动的数字墨迹 SDK，采用输入-模型-渲染三层解耦架构。输入适配器与渲染器均可插拔替换，内置 Canvas 2D、OffscreenCanvas Worker、SVG 三种渲染器；所有数据变更由 Operation 驱动，Operation 即 source of truth，天然支持撤销/重做与笔迹回放。提供多种笔刷（钢笔、墨水笔、马克笔、铅笔）、橡皮擦模式、压感模拟、多指同时书写、视口缩放/平移等能力。

## 常用命令

- **开发服务器**：`pnpm dev`
- **构建**：`pnpm build`

使用 Vitest + happy-dom 作为测试框架，各包独立配置 `vitest.config.ts`。TypeScript 仅用于类型检查（`noEmit: true`），不产生编译输出。

## 代码风格

Prettier 配置（`.prettierrc`）：2 空格缩进、无分号、单引号、无尾逗号、箭头函数省略括号。

## 目录结构

```
inker/
├── shared/                 # 共享包（被所有库依赖）
│   ├── types/              # @inker/types — 纯接口，零 runtime
│   ├── di/                 # @inker/di — DI 容器
│   └── util/               # @inker/util — 工具函数、easing 映射
├── libraries/              # 核心功能库
│   ├── core/               # @inker/core — EditorKernel 编排层
│   ├── model/              # @inker/model — StrokeDocument 数据模型
│   ├── input-pointer/      # @inker/input-pointer — 指针输入适配器
│   ├── brush-freehand/     # @inker/brush-freehand — 笔刷 + 橡皮擦
│   ├── render-canvas/      # @inker/render-canvas — Canvas 2D 渲染
│   ├── render-offscreen/   # @inker/render-offscreen — OffscreenCanvas Worker
│   ├── render-protocol/    # @inker/render-protocol — Worker 通信协议
│   ├── render-svg/         # @inker/render-svg — SVG 渲染
│   ├── playback/           # @inker/playback — 笔迹回放
│   ├── sdk/                # @inker/sdk — 门面包（唯一全依赖入口）
│   └── compute-worker/     # ~~@inker/compute-worker~~ — 已废弃
├── third-parties/          # 第三方库源码（保持与上游一致）
│   └── freehand/           # @inker/freehand — perfect-freehand
├── solutions/              # 业务场景方案（不发布到 SDK）
│   └── recognition/        # @inker/recognition — 识别数据准备
├── playground/             # 调试应用（不发布）
│   └── app/                # Vue 3 交互式 playground
├── run-control/            # 构建配置
│   └── web-rig/            # @inker/web-rig — 共享 tsconfig/vite
├── scripts/                # 构建脚本
│   └── copy-dist/          # 产物拷贝
├── dist/                   # 构建产物（ES + UMD + .d.ts）
└── docs/                   # 文档、设计规格、实施计划
```

**依赖方向：** `shared/ ← libraries/ ← sdk/`，`third-parties/` 被 shared 和 libraries 引用，`playground/` 依赖 sdk，`solutions/` 依赖 shared（不反向依赖 libraries/sdk）。

## 架构

### 渲染管线（可插拔多渲染器）

采用意图式 API 架构——EditorKernel 只发"画什么"，RenderAdapter 内部处理"怎么画"。

**数据流：**

```
PointerInputAdapter → EditorKernel（via startStroke/addStrokePoint/endStroke）→ RenderAdapter.drawLiveStroke(points, style)
                                                                              → 内部: computeOutline → OutlineGeometry → 渲染
```

**三种渲染适配器：**

| 适配器                                              | 计算位置   | 渲染位置                  | 通信方式                   |
| --------------------------------------------------- | ---------- | ------------------------- | -------------------------- |
| `CanvasRenderAdapter`（@inker/render-canvas）       | 主线程同步 | 主线程 Canvas 2D          | 直接调用                   |
| `SvgRenderAdapter`（@inker/render-svg）             | 主线程同步 | 主线程 DOM                | 直接调用                   |
| `OffscreenRenderAdapter`（@inker/render-offscreen） | Worker 内  | Worker 内 OffscreenCanvas | WorkerBridge (postMessage) |

**关键设计：**

- `StrokeProcessor.computeOutline()` 返回 `OutlineGeometry`（通用几何格式，非 Path2D），各渲染器自行转换为原生格式
- EditorKernel 是纯协调层，不持有 StrokeProcessor 或 ComputeStrategy，渲染/计算职责完全内聚到 RenderAdapter
- 橡皮擦轨迹（EraserTrail）由 RenderAdapter 内部管理
- 异步模型：绘制命令 fire-and-forget（void），`flush()` 提供显式同步屏障，导出操作自动 flush
- 通信协议独立为 `@inker/render-protocol` 包（RenderCommand/RenderResponse 类型 + WorkerBridge 传输桥）

### 核心抽象

- **StrokeDocument**（`@inker/model`）— Operation-based + Checkpoint 混合模式的笔画数据管理
- **EditorKernel**（`@inker/core`）— 纯协调层，编排输入 → 模型 → 渲染的生命周期，支持多指针同时书写
- **StrokeSession**（`@inker/core`）— 笔画会话，管理 per-stroke 活跃笔画状态
- **StrokeProcessor**（`@inker/brush-freehand`）— 笔画轮廓计算，返回 OutlineGeometry
- **RenderAdapter**（`@inker/render-canvas` / `@inker/render-offscreen`）— 内聚计算+渲染+橡皮擦轨迹
- **EraserTrail**（`@inker/core`）— 橡皮擦轨迹衰减动画（宽度衰减 + rAF 循环）
- **WorkerBridge**（`@inker/render-protocol`）— Worker 通信桥（send/request 模式）

### 公共 API

入口：`Inker.create({ element })` 快速创建，或 `Inker.builder()` 自定义构建。`Inker` 类暴露的方法：`undo`、`redo`、`clear`、`resize`、`zoomAt`、`pan`、`zoomToFit`、`setCamera`、`on`、`off`、`dispose`。属性：`penStyle`（读写）、`canUndo`、`canRedo`、`isEmpty`、`strokeCount`、`camera`、`renderAdapter`。

**SDK Facade（v3.0+）新增 API：**

- `getSnapshot(): DocumentSnapshot` — 获取文档快照（笔画数据）
- `getOperations(): Operation[]` — 获取全部操作记录（回放用）
- `applyOperation(op: Operation): void` — 应用单个操作并渲染（回放驱动）
- `get renderAdapter: RenderAdapterInterface` — 暴露渲染适配器引用（图片导出用，调用 `exportAsBlob(format, quality?)`）

**操作序列化（`@inker/model`）：**

- `operationsToJSON(operations, documentSize): string` — 操作序列序列化为 JSON
- `jsonToOperations(json): { operations, documentSize }` — JSON 反序列化为操作序列

### 双 Canvas 架构

每个编辑器实例创建两个叠放的 Canvas：

- **capturing canvas**（live layer）— 接收指针事件，用于绘制过程中的临时笔画渲染和橡皮擦轨迹
- **rendering canvas** — 存储已完成的笔画，指针事件穿透（`pointerEvents: none`）

### 橡皮擦轨迹衰减

`EraserTrail`（`libraries/core/src/eraser-trail.ts`）管理橡皮擦拖动时的轨迹渲染：

- **宽度衰减**：轨迹尾部逐渐变细消失，类似 Excalidraw 效果
- **双维度衰减**：时间衰减（200ms）+ 长度衰减（尾部 10 个点），经 easeOut 缓动，取较小值
- **闭合轮廓**：每帧计算衰减宽度后，通过法线偏移生成闭合 Path2D，用 `ctx.fill()` 渲染
- **独立 rAF 循环**：松手后轨迹继续衰减直到完全消失，所有轨迹消失后自动停止

### 坐标系 + Camera 架构

运行时全程使用绝对坐标（世界坐标 px）。Camera 管理视口变换，resize/zoom/pan 统一为 camera 状态变化。

- **世界坐标**：笔画采样点以绝对像素存储，StrokeProcessor 直接消费世界坐标
- **Camera**：`{ x, y, zoom }` — 视口左上角在世界坐标中的位置 + 缩放倍率
- **坐标变换**：`screenToWorld(p) = { x: p.x/zoom + cam.x, y: p.y/zoom + cam.y }`
- **Canvas 变换**：通过 `ctx.setTransform(dpr*zoom, 0, 0, dpr*zoom, -cam.x*dpr*zoom, -cam.y*dpr*zoom)` 统一处理
- **序列化**：对外提供 `toNormalized()`/`fromNormalized()` 工具方法（基于 documentSize）

数据流：`输入(screen px) → screenToWorld → 存储(world px) → computeOutline(world px) → camera transform → 渲染(screen px)`

## 关键文件

| 文件                                                         | 用途                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `shared/types/src/render-adapter.types.ts`                   | RenderAdapterInterface — 统一渲染器接口                      |
| `shared/types/src/outline-geometry.types.ts`                 | OutlineGeometry — 渲染器无关几何格式                         |
| `shared/types/src/stroke-processor.types.ts`                 | StrokeProcessorInterface — 返回 OutlineGeometry              |
| `libraries/core/src/editor-kernel.service.ts`                | EditorKernel — 纯协调层                                      |
| `shared/types/src/input-adapter.types.ts`                    | StrokeInputReceiver + InputAdapterInterface — 输入接收者接口 |
| `libraries/core/src/stroke-session.ts`                       | 笔画会话 — per-stroke 活跃状态管理                           |
| `libraries/core/src/eraser-trail.ts`                         | 橡皮擦轨迹衰减管理器 — 衰减计算、轮廓生成、rAF 动画          |
| `libraries/brush-freehand/src/freehand.processor.ts`         | 自由手写笔刷 — 轮廓计算                                      |
| `libraries/brush-freehand/src/rect-eraser.processor.ts`      | 矩形橡皮擦 — 碰撞检测                                        |
| `libraries/render-canvas/src/canvas-render.adapter.ts`       | 主线程 Canvas 2D 渲染适配器                                  |
| `libraries/render-offscreen/src/offscreen-render.adapter.ts` | OffscreenCanvas 主线程代理                                   |
| `libraries/render-offscreen/src/offscreen-render.worker.ts`  | Worker 侧渲染器                                              |
| `libraries/render-protocol/src/types.ts`                     | RenderCommand/RenderResponse 通信协议                        |
| `libraries/render-protocol/src/worker-bridge.ts`             | WorkerBridge 传输桥                                          |
| `libraries/sdk/src/editor.builder.ts`                        | EditorBuilder — DI 组装                                      |
| `libraries/sdk/src/inker.facade.ts`                          | Inker 门面类                                                 |

## 构建产物

- `dist/InkerSdk.umd.js` — UMD 模块（约 72KB，未压缩）
- 构建配置中禁用了代码压缩和 Source Map
