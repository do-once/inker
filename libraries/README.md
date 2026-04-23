# libraries — 核心库

Inker SDK 的功能实现层，每个包负责一个独立职责。

## 包列表

| 包 | 目录 | 说明 |
|---|------|------|
| @inker/core | `core/` | EditorKernel 编排层 — 协调输入→模型→渲染 |
| @inker/model | `model/` | StrokeDocument — Operation-based 数据模型 |
| @inker/input-pointer | `input-pointer/` | 指针输入适配器（Pointer Events） |
| @inker/brush-freehand | `brush-freehand/` | 自由手写笔刷 + 矩形橡皮擦 |
| @inker/render-canvas | `render-canvas/` | 主线程 Canvas 2D 渲染适配器 |
| @inker/render-offscreen | `render-offscreen/` | OffscreenCanvas Worker 渲染适配器 |
| @inker/render-protocol | `render-protocol/` | Worker 通信协议（RenderCommand/Response） |
| @inker/render-svg | `render-svg/` | SVG 渲染适配器 |
| @inker/playback | `playback/` | 笔迹回放引擎 |
| @inker/sdk | `sdk/` | 门面包 — 唯一可依赖全部包的入口 |
| ~~@inker/compute-worker~~ | `compute-worker/` | 已废弃 |

## 依赖约束

- libraries 包可依赖 shared/ 和 third-parties/
- libraries 包之间可互相依赖，但避免循环
- @inker/sdk 是唯一的"全依赖"门面包
