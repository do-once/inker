# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- 初始化包骨架
- 从 `src/worker/strokers/freehand/source/` 迁移 perfect-freehand 源码
- `getStroke()`：从输入点集生成笔画轮廓多边形
- `getStrokePoints()`：将输入点转换为带压力和方向信息的笔画点
- `getStrokeOutlinePoints()`：从笔画点生成轮廓点数组
- `getStrokeRadius()`：根据压力值计算笔画半径
- `simulatePressure()`：基于绘制速度模拟压力值
- `vec.ts`：二维向量工具函数（add/sub/mul/div/per/len/uni/dist/lrp/med/dpr 等）
- `types.ts`：Vec2、StrokeOptions、StrokePoint 类型定义
- `constants.ts`：算法常量（端帽分段数、压力变化率等）

### Changed

- 文件名从 camelCase 改为 kebab-case（如 getStroke.ts → get-stroke.ts）
- 内部导入路径同步更新
- 注释翻译为中文
- 修复 `per()` 函数的 `-0` 问题以通过严格相等测试
