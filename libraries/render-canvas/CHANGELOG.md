# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- 初始化包骨架
- `CanvasLayerManager` 类：双层 Canvas 管理（live layer + render layer），DPI 缩放，resize 支持
- `CanvasRenderAdapter` 类：继承 RenderAdapter，使用双层 Canvas 架构
- clearLiveLayer / clearAll / redrawAll：清除和重绘支持
- resize / toDataURL / dispose 生命周期方法
- happy-dom Canvas API polyfill（测试环境用）

### Changed

- `CanvasRenderAdapter` 构造函数：注入 `StrokeProcessor`，内部完成 computeOutline → OutlineGeometry → Path2D 转换
- drawLiveStroke / commitStroke：接收 `StrokePoint[]` + `StrokeStyle`（意图式 API，内部计算轮廓）
- 新增橡皮擦轨迹管理：startEraserTrail/addEraserPoint/endEraserTrail/stopEraserTrail
- 新增 exportAsBlob/flush 异步方法
