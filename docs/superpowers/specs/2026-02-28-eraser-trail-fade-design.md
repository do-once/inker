# 板擦轨迹宽度衰减效果设计

## 背景

当前橡皮擦拖动时绘制固定宽度的红色半透明轨迹（opacity 0.5），松手后瞬间消失。
目标是实现类似 Excalidraw 的效果：轨迹尾部逐渐变细直到消失。

## 设计决策

| 维度 | 决策 |
|------|------|
| 视觉效果 | 宽度衰减（size decay），尾部逐渐变细消失 |
| 衰减策略 | 时间衰减（200ms）+ 长度衰减（10 个点），easeOut 缓动，取较小值 |
| 渲染方式 | Canvas fill()，在 live layer 上绘制闭合轮廓 |
| 动画驱动 | 独立 rAF 循环，松手后继续衰减直到消失 |

## 核心组件：EraserTrail

### 职责

- 管理轨迹点（世界坐标 + 时间戳）
- 计算每个点的衰减宽度
- 生成闭合轮廓路径（Path2D）
- 驱动 rAF 动画循环

### 衰减策略

双维度衰减，取较小值，经过 easeOut 缓动：

```
sizeMapping(point) {
  // 时间衰减：200ms 内衰减为 0
  t = max(0, 1 - (now - point.timestamp) / DECAY_TIME)

  // 长度衰减：尾部 10 个点范围内逐渐变细
  l = (DECAY_LENGTH - min(DECAY_LENGTH, totalLength - currentIndex)) / DECAY_LENGTH

  return min(easeOut(l), easeOut(t))
}
```

### 轮廓生成算法

1. 过滤 size > 0 的点
2. 对每个点，在法线方向（垂直于行进方向）两侧偏移 size/2
3. 构建闭合路径：leftPoints（正序）→ rightPoints（逆序）→ 闭合
4. 转为 Path2D 对象

## 数据流

```
EditorKernel.handleMove()
  → eraserTrail.addPoint(worldPoint)
  → rAF 循环每帧：
    1. 计算衰减宽度
    2. 生成闭合轮廓
    3. clearLiveLayer()
    4. ctx.fill(outlinePath)

EditorKernel.handleUp()
  → eraserTrail.endTrail()
  → 轨迹进入 pastTrails，继续衰减直到消失

全部消失 → 停止 rAF
```

## 文件变更

| 操作 | 文件 | 职责 |
|------|------|------|
| 新增 | `libraries/core/src/eraser-trail.ts` | EraserTrail 类 |
| 修改 | `libraries/core/src/editor-kernel.service.ts` | 使用 EraserTrail 替代直接绘制轨迹 |
| 修改 | `libraries/render-canvas/src/canvas-render.adapter.ts` | 支持渲染 Path2D 轮廓（fill） |

## 不做的事情

- 不引入 SVG 层
- 不引入 `@excalidraw/laser-pointer` 外部依赖
- 不修改碰撞检测逻辑
- 不修改删除操作和文档模型

## 参考

- [Excalidraw EraserTrail 实现](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/eraser/index.ts)
- [@excalidraw/laser-pointer](https://www.npmjs.com/package/@excalidraw/laser-pointer)
