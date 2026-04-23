# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Removed

- `OperationFactory` 类：生产代码未使用，EditorKernel 直接内联构造 Operation 字面量，删除以减少维护成本

### Added

- 初始化包骨架
- `StrokeDocument` 类：apply/undo/redo/getSnapshot/getOperations/getCheckpoints
- `SnapshotBuilder` 类：全量构建 build() + 增量构建 buildFromCheckpoint()
- `CoordinateSystem` 类：normalize/denormalize/resize 坐标转换
- Operation-based + Checkpoint 混合模式
- Undo/Redo 粒度为完整笔画（stroke:start → stroke:end）
- 支持 stroke:delete 和 stroke:clear 操作
