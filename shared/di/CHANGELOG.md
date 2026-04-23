# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- 初始化包骨架
- `Container` 类：register/resolve/has/dispose
- `Provider` 接口：token + useFactory + scope（singleton/transient）
- `InjectionToken` 工具类：类型安全的注入标识符
- singleton 实例缓存与 dispose 生命周期管理
- 依赖解析链支持（useFactory 接收 container 参数）
