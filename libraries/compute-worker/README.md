# @inker/compute-worker

> **⚠️ 已废弃** — 计算职责已内聚到各 RenderAdapter 内部，不再需要独立的计算策略包。
> 请使用 `@inker/render-canvas`（主线程同步计算）或 `@inker/render-offscreen`（Worker 内计算+渲染）替代。

Inker SDK 的计算策略模块。使用策略模式封装笔画轮廓计算的执行环境（主线程 / Web Worker）。

## 迁移指南

之前通过 `MainThreadStrategy` / `WorkerStrategy` 分离计算环境的方式已被废弃。
新架构中，各 RenderAdapter 内部自行处理 `computeOutline` 计算：

| 旧方式 | 新方式 |
|--------|--------|
| `MainThreadStrategy` + `CanvasRenderAdapter` | `CanvasRenderAdapter`（内部同步计算） |
| `WorkerStrategy` + `CanvasRenderAdapter` | `OffscreenRenderAdapter`（Worker 内计算+渲染） |

EditorKernel 不再接受 `computeStrategy` 依赖，只需注入 `renderAdapter` 即可。
