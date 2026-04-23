# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Deprecated

- 整个包已废弃：`MainThreadStrategy`、`WorkerStrategy` 均标记 `@deprecated`
- 计算职责已内聚到各 RenderAdapter 内部（`@aw/render-canvas` / `@aw/render-offscreen`）
- EditorKernel 不再需要 `computeStrategy` 依赖

### Added

- 初始化包骨架
