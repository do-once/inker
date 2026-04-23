# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed

- 时间戳统一使用 Unix epoch 毫秒（`Date.now()` 语义）：`PointerInputAdapter` 在 `startStroke`、`addStrokePoint`、`endStroke` 调用中均传入 `Date.now()`，不再依赖 `PointerEvent.timeStamp`（后者为相对于页面加载的毫秒数，跨环境语义不一致）
- `PointExtractor.extract()` 返回类型明确为 `RawPoint | null`（`RawPoint` 含 `x`、`y`、`pressure`，不含 `timestamp`；时间戳由调用方负责生成）

### Added

- 初始化包骨架
- `PointExtractor` 类：从 PointerEvent 提取坐标，支持基于距离阈值的点去重
- `PressureSimulator` 类：基于距离/速度的压力模拟，带平滑步进限制
- `PointerInputAdapter` 类：Pointer Events 输入适配器，转换 PointerEvent 为 InputEvent
- 支持 pointerdown/pointermove/pointerup/pointercancel 事件
- 支持指针类型过滤（mouse/touch/pen）
- 支持 attach/detach/dispose 生命周期
