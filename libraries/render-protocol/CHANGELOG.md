# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- 初始化包骨架
- `RenderCommand` 类型：主线程 → Worker 渲染指令（15 种）
- `RequestCommand` 类型：request-response 指令子集（flush/export/toDataURL），调用方无需提供 id
- `RenderResponse` 类型：Worker → 主线程响应（3 种）
- `InitCommand` 类型：初始化指令（传输 OffscreenCanvas）
- `WorkerBridgeHost` 类：主线程侧 Bridge（send/request 模式 + 错误处理）
- `WorkerBridgeWorker` 类：Worker 侧 Bridge（onMessage/respond 模式）
