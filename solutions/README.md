# solutions/

基于 Inker 核心数据构建的、面向特定业务场景的上层方案包。

## 定位

这些包依赖 Inker 的类型和数据，但 Inker 本体不依赖它们。业务方按需引入。

## 与其他目录的区别

- `shared/` — Inker 内部共享的基础设施
- `libraries/` — Inker 核心功能
- `solutions/` — Inker 之上的业务场景方案，可选引入

## 准入标准

- 面向特定业务场景（识别、协作、持久化等），不是 Inker 核心功能
- 依赖 `@inker/types` 和/或 `@inker/util`，不依赖 Inker 运行时包
- Inker 本体不反向依赖 solutions 中的包
