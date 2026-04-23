# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- 初始化包骨架
- `OffscreenRenderAdapter` 类：主线程代理，创建双 Canvas → transferControlToOffscreen → Worker
- `startRenderWorker()` 函数：Worker 侧渲染器，接收指令、计算轮廓、OffscreenCanvas 渲染
- 通过 `@aw/render-protocol` 的 WorkerBridge 实现主线程 ↔ Worker 通信
- 支持意图式 API：drawLiveStroke/commitStroke 接收 StrokePoint[] + StrokeStyle
- 橡皮擦轨迹：startEraserTrail/addEraserPoint/endEraserTrail/stopEraserTrail
- 异步模型：fire-and-forget 绘制 + flush() 同步屏障 + exportAsBlob/toDataURL 数据返回
- 25 个单元测试覆盖生命周期、指令转发、异步方法和 guard 行为
