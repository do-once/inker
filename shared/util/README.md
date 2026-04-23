# @inker/util

Inker SDK 的通用工具函数库。纯函数，无副作用。

## API

### 颜色解析

```typescript
import { colorToRGB } from '@inker/util'
import type { RGBAColor } from '@inker/util'

// 支持格式：#RGB、#RRGGBB、#RRGGBBAA、rgb()、rgba()
colorToRGB('#ff0000')       // { r: 255, g: 0, b: 0, a: 1 }
colorToRGB('#f00')          // { r: 255, g: 0, b: 0, a: 1 }
colorToRGB('#ff000080')     // { r: 255, g: 0, b: 0, a: 0.5 }
colorToRGB('rgb(255,0,0)')  // { r: 255, g: 0, b: 0, a: 1 }
```

### ID 生成

```typescript
import { generateUid } from '@inker/util'

// 基于时间戳 + 计数器 + 随机数，同毫秒内不重复
generateUid()  // "m1abc-0001-x7k2p3q9"
```

### 数学工具

```typescript
import { round, distance } from '@inker/util'

round(3.14159, 2)  // 3.14

distance({ x: 0, y: 0 }, { x: 3, y: 4 })  // 5
```

### 坐标归一化

用于序列化/导出场景，将世界坐标与归一化坐标互转：

```typescript
import { toNormalized, fromNormalized } from '@inker/util'

// 世界坐标 → 归一化（0-1）
toNormalized({ x: 500, y: 300 }, { width: 1000, height: 600 })
// { x: 0.5, y: 0.5 }

// 归一化 → 世界坐标
fromNormalized({ x: 0.5, y: 0.5 }, { width: 1000, height: 600 })
// { x: 500, y: 300 }
```

## 文件结构

| 文件 | 说明 |
|------|------|
| `color.util.ts` | 颜色字符串解析（hex / rgb / rgba） |
| `uid.util.ts` | 唯一 ID 生成 |
| `round.util.ts` | 精度四舍五入 |
| `geometry.util.ts` | 距离计算、坐标归一化/反归一化 |
