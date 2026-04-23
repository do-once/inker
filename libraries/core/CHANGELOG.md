# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- 初始化包骨架
- `EventBus` 类：on/off/once/emit/dispose 事件总线
- `ServiceTokens`：全局服务 DI Token（EVENT_BUS、INPUT_ADAPTER 等 7 个）
- 抽象基类：InputAdapter、RenderAdapter、StrokeProcessor、ComputeStrategy
- `EraserTrail` 类：橡皮擦轨迹宽度衰减效果（时间衰减 + 长度衰减 + easeOut 缓动）
- `RenderAdapter.drawEraserTrail()` 接口：填充模式渲染轨迹闭合轮廓
- `geometryToPath2D()` 工具函数：OutlineGeometry → Path2D 转换（共享给 render-canvas 和 render-offscreen）

### Changed

- `RenderAdapter` 接口：drawLiveStroke/commitStroke 改为接收 `StrokePoint[]` + `StrokeStyle`（意图式 API）
- `RenderAdapter` 新增橡皮擦轨迹方法：startEraserTrail/addEraserPoint/endEraserTrail/stopEraserTrail
- `RenderAdapter` 新增 exportAsBlob/flush 异步方法
- `EditorKernel` 不再依赖 StrokeProcessor 和 ComputeStrategy（渲染计算内聚到 RenderAdapter）

### Deprecated

- `ComputeStrategy` 抽象基类：计算职责已内聚到 RenderAdapter
