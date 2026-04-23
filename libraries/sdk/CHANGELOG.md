# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- 初始化包骨架
- `Inker` 门面类：create/builder 静态方法，委托 EditorKernel
- `EditorBuilder` 构建器：组装 Kernel 依赖（StrokeProcessor 注入到 RenderAdapter）
- 公共 API：penStyle、undo/redo/clear、camera 控制、事件监听
- getSnapshot/getOperations/applyOperation/renderAdapter 方法（回放 + 导出）
