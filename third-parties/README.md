# third-parties — 第三方库源码

从上游 fork 或迁移的第三方库。源码应尽量保持与上游一致，便于后续更新。

## 包列表

| 包 | 目录 | 上游 | 说明 |
|---|------|------|------|
| @inker/freehand | `freehand/` | [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | 笔画轮廓生成算法 |

## 维护原则

- 不在此目录添加自定义代码（如 easing 映射表应放在 shared/util）
- 更新上游时可直接替换源码文件
- 自定义扩展通过包装层（如 @inker/brush-freehand）实现
