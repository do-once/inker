# Changelog

## [Unreleased]

### Added
- 多点触控同时书写支持（多指/多笔同时独立绘制）

### Changed
- EditorKernel API 从 InputEvent/handleInput 模型改为笔画语义 startStroke/addStrokePoint/endStroke（implements StrokeInputReceiver）
- InputAdapterInterface 简化为 bindKernel + dispose，删除 attach/detach/setAllowedPointerTypes/onInput
- activeSessions key 从 pointerId(number) 改为 strokeId(string)，修复多指回放粘连 bug

### Removed
- 删除 InputEvent 类型（@inker/types）
- 删除 InputAdapter 抽象基类（@inker/core）
- 删除 EditorKernel.handleInput / REPLAY_POINTER_ID
- 删除 activeEraserPointerId，改为 activeEraserStrokeId
