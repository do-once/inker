# shared — 共享包

被所有库和应用共同依赖的基础包。

## 包列表

| 包 | 目录 | 说明 |
|---|------|------|
| @inker/types | `types/` | 纯接口定义，零 runtime 代码 |
| @inker/di | `di/` | 轻量 DI 容器 |
| @inker/util | `util/` | 工具函数（几何计算、easing 映射等） |

## 依赖约束

- shared 包之间可互相依赖
- shared 包不得依赖 libraries/ 或 playground/
- @inker/types 是最底层包，仅允许 type-only 依赖 @inker/freehand
