import {
  CORNER_CAP_SEGMENTS,
  END_CAP_SEGMENTS,
  END_NOISE_THRESHOLD,
  FIXED_PI,
  MIN_RADIUS,
  START_CAP_SEGMENTS,
} from './constants'
import { getStrokeRadius } from './get-stroke-radius'
import { simulatePressure } from './simulate-pressure'
import type { StrokeOptions, StrokePoint, Vec2 } from './types'
import {
  add,
  addInto,
  dist2,
  dpr,
  lrpInto,
  mul,
  mulInto,
  neg,
  per,
  perInto,
  prj,
  rotAround,
  rotAroundInto,
  sub,
  subInto,
  uni,
} from './vec'

/** 用于热循环中无分配计算的临时缓冲区 */
const _offset: Vec2 = [0, 0]
const _tl: Vec2 = [0, 0]
const _tr: Vec2 = [0, 0]

/**
 * 为极短笔画绘制圆点。
 */
function drawDot(center: Vec2, radius: number): Vec2[] {
  const offsetPoint = add(center, [1, 1])
  const start = prj(center, uni(per(sub(center, offsetPoint))), -radius)
  const dotPts: Vec2[] = []
  const step = 1 / START_CAP_SEGMENTS
  for (let t = step; t <= 1; t += step) {
    dotPts.push(rotAround(start, center, FIXED_PI * 2 * t))
  }
  return dotPts
}

/**
 * 在起始点绘制圆形端帽，从右侧点绕起始点旋转到左侧。
 */
function drawRoundStartCap(
  center: Vec2,
  rightPoint: Vec2,
  segments: number
): Vec2[] {
  const cap: Vec2[] = []
  const step = 1 / segments
  for (let t = step; t <= 1; t += step) {
    cap.push(rotAround(rightPoint, center, FIXED_PI * t))
  }
  return cap
}

/**
 * 在起始点绘制平头端帽。
 */
function drawFlatStartCap(
  center: Vec2,
  leftPoint: Vec2,
  rightPoint: Vec2
): Vec2[] {
  const cornersVector = sub(leftPoint, rightPoint)
  const offsetA = mul(cornersVector, 0.5)
  const offsetB = mul(cornersVector, 0.51)
  return [
    sub(center, offsetA),
    sub(center, offsetB),
    add(center, offsetB),
    add(center, offsetA),
  ]
}

/**
 * 绘制圆形结束端帽（1.5 圈以正确处理尖锐的结束转角）。
 */
function drawRoundEndCap(
  center: Vec2,
  direction: Vec2,
  radius: number,
  segments: number
): Vec2[] {
  const cap: Vec2[] = []
  const start = prj(center, direction, radius)
  const step = 1 / segments
  for (let t = step; t < 1; t += step) {
    cap.push(rotAround(start, center, FIXED_PI * 3 * t))
  }
  return cap
}

/**
 * 绘制平头结束端帽。
 */
function drawFlatEndCap(center: Vec2, direction: Vec2, radius: number): Vec2[] {
  return [
    add(center, mul(direction, radius)),
    add(center, mul(direction, radius * 0.99)),
    sub(center, mul(direction, radius * 0.99)),
    sub(center, mul(direction, radius)),
  ]
}

/**
 * 根据 taper 选项值计算渐细距离。
 * - false 或 undefined：不渐细（0）
 * - true：渐细全长（size 和 totalLength 的较大值）
 * - number：使用指定的渐细距离
 */
function computeTaperDistance(
  taper: boolean | number | undefined,
  size: number,
  totalLength: number
): number {
  if (taper === false || taper === undefined) return 0
  if (taper === true) return Math.max(size, totalLength)
  return taper
}

/**
 * 通过平均前几个点来计算初始压力。
 * 防止"粗起笔"，因为手绘线条几乎总是从缓慢开始。
 */
function computeInitialPressure(
  points: StrokePoint[],
  shouldSimulatePressure: boolean,
  size: number
): number {
  return points.slice(0, 10).reduce((acc, curr) => {
    let pressure = curr.pressure
    if (shouldSimulatePressure) {
      pressure = simulatePressure(acc, curr.distance, size)
    }
    return (acc + pressure) / 2
  }, points[0].pressure)
}

/**
 * ## getStrokeOutlinePoints
 * @description 获取表示笔画轮廓的点数组（`[x, y]` 格式）。
 * @param points 由 `getStrokePoints` 返回的 StrokePoint 数组。
 * @param options （可选）配置对象。
 * @param options.size 笔画基准大小（直径）。
 * @param options.thinning 压感对笔画粗细的影响程度。
 * @param options.smoothing 笔画边缘平滑程度。
 * @param options.easing 应用于每个点压力值的缓动函数。
 * @param options.simulatePressure 是否根据速度模拟压力。
 * @param options.start 线条起始处的端帽、渐细和缓动配置。
 * @param options.end 线条结束处的端帽、渐细和缓动配置。
 * @param options.last 是否将输入点视为已完成的笔画。
 */
export function getStrokeOutlinePoints(
  points: StrokePoint[],
  options: Partial<StrokeOptions> = {} as Partial<StrokeOptions>
): Vec2[] {
  const {
    size = 16,
    smoothing = 0.5,
    thinning = 0.5,
    simulatePressure: shouldSimulatePressure = true,
    easing = (t) => t,
    start = {},
    end = {},
    last: isComplete = false,
  } = options

  const { cap: capStart = true, easing: taperStartEase = (t) => t * (2 - t) } =
    start

  const { cap: capEnd = true, easing: taperEndEase = (t) => --t * t * t + 1 } =
    end

  // 空数组或负尺寸无法处理
  if (points.length === 0 || size <= 0) {
    return []
  }

  // 线条总长度
  const totalLength = points[points.length - 1].runningLength

  const taperStart = computeTaperDistance(start.taper, size, totalLength)
  const taperEnd = computeTaperDistance(end.taper, size, totalLength)

  // 点间最小允许距离（平方值）
  const minDistance = Math.pow(size * smoothing, 2)

  // 收集的左侧和右侧轮廓点
  const leftPts: Vec2[] = []
  const rightPts: Vec2[] = []

  // 前一个压力值（从前几个点平均以防止粗起笔）
  let prevPressure = computeInitialPressure(
    points,
    shouldSimulatePressure,
    size
  )

  // 当前半径
  let radius = getStrokeRadius(
    size,
    thinning,
    points[points.length - 1].pressure,
    easing
  )

  // 第一个保存点的半径
  let firstRadius: number | undefined = undefined

  // 前一个方向向量
  let prevVector = points[0].vector

  // 前一个左侧和右侧点
  let prevLeftPoint = points[0].point
  let prevRightPoint = prevLeftPoint

  // 临时左侧和右侧点
  let tempLeftPoint: Vec2 = prevLeftPoint
  let tempRightPoint: Vec2 = prevRightPoint

  // 跟踪前一个点是否为尖角，避免重复检测同一尖角
  let isPrevPointSharpCorner = false

  /*
    查找轮廓的左侧和右侧点

    遍历所有点，填充 rightPts 和 leftPts 数组，
    跳过首尾点（稍后添加端帽）。
  */

  for (let i = 0; i < points.length; i++) {
    let { pressure } = points[i]
    const { point, vector, distance, runningLength } = points[i]
    const isLastPoint = i === points.length - 1

    // 移除线条末端的噪声
    if (!isLastPoint && totalLength - runningLength < END_NOISE_THRESHOLD) {
      continue
    }

    /*
      计算半径

      如果没有压感效果，当前点半径为 size 的一半；
      否则，根据当前（真实或模拟的）压力值计算。
    */

    if (thinning) {
      if (shouldSimulatePressure) {
        // 模拟压力时，基于当前点与前一个点的距离和笔画大小计算
        pressure = simulatePressure(prevPressure, distance, size)
      }

      radius = getStrokeRadius(size, thinning, pressure, easing)
    } else {
      radius = size / 2
    }

    if (firstRadius === undefined) {
      firstRadius = radius
    }

    /*
      应用渐细效果

      如果当前长度在起始或结束的渐细范围内，
      计算渐细强度，取两端较小值应用到半径上。
    */

    const taperStartStrength =
      runningLength < taperStart
        ? taperStartEase(runningLength / taperStart)
        : 1

    const taperEndStrength =
      totalLength - runningLength < taperEnd
        ? taperEndEase((totalLength - runningLength) / taperEnd)
        : 1

    radius = Math.max(
      MIN_RADIUS,
      radius * Math.min(taperStartStrength, taperEndStrength)
    )

    /* 添加左右侧点 */

    /*
      处理尖角

      计算当前方向向量与下一个方向向量的点积。
      如果下一个方向向量与当前方向向量超过直角，在当前点绘制端帽。
    */

    const nextVector = (!isLastPoint ? points[i + 1] : points[i]).vector
    const nextDpr = !isLastPoint ? dpr(vector, nextVector) : 1.0
    const prevDpr = dpr(vector, prevVector)

    const isPointSharpCorner = prevDpr < 0 && !isPrevPointSharpCorner
    const isNextPointSharpCorner = nextDpr !== null && nextDpr < 0

    if (isPointSharpCorner || isNextPointSharpCorner) {
      // 尖角处理：绘制圆形端帽并继续处理下一个点

      // 使用可变操作计算偏移量
      perInto(_offset, prevVector)
      mulInto(_offset, _offset, radius)

      const step = 1 / CORNER_CAP_SEGMENTS
      for (let t = 0; t <= 1; t += step) {
        // 计算左侧点：将 (point - offset) 绕 point 旋转
        subInto(_tl, point, _offset)
        rotAroundInto(_tl, _tl, point, FIXED_PI * t)
        tempLeftPoint = [_tl[0], _tl[1]]
        leftPts.push(tempLeftPoint)

        // 计算右侧点：将 (point + offset) 绕 point 旋转
        addInto(_tr, point, _offset)
        rotAroundInto(_tr, _tr, point, FIXED_PI * -t)
        tempRightPoint = [_tr[0], _tr[1]]
        rightPts.push(tempRightPoint)
      }

      prevLeftPoint = tempLeftPoint
      prevRightPoint = tempRightPoint

      if (isNextPointSharpCorner) {
        isPrevPointSharpCorner = true
      }
      continue
    }

    isPrevPointSharpCorner = false

    // 处理最后一个点
    if (isLastPoint) {
      perInto(_offset, vector)
      mulInto(_offset, _offset, radius)
      leftPts.push(sub(point, _offset))
      rightPts.push(add(point, _offset))
      continue
    }

    /*
      添加常规点

      将点投影到当前点的两侧，使用计算的半径作为距离。
      如果某侧点到该侧前一个点的距离大于最小距离（或转角较尖锐），
      则将该点添加到该侧的点数组中。
    */

    // 使用可变操作计算偏移量
    lrpInto(_offset, nextVector, vector, nextDpr)
    perInto(_offset, _offset)
    mulInto(_offset, _offset, radius)

    subInto(_tl, point, _offset)
    tempLeftPoint = [_tl[0], _tl[1]]

    if (i <= 1 || dist2(prevLeftPoint, tempLeftPoint) > minDistance) {
      leftPts.push(tempLeftPoint)
      prevLeftPoint = tempLeftPoint
    }

    addInto(_tr, point, _offset)
    tempRightPoint = [_tr[0], _tr[1]]

    if (i <= 1 || dist2(prevRightPoint, tempRightPoint) > minDistance) {
      rightPts.push(tempRightPoint)
      prevRightPoint = tempRightPoint
    }

    // 为下一次迭代设置变量
    prevPressure = pressure
    prevVector = vector
  }

  /*
    绘制端帽

    现在我们有了线条两侧的点，需要在首尾绘制端帽。
    渐细线条没有端帽，但极短线条可能有圆点。
  */

  const firstPoint: Vec2 = [points[0].point[0], points[0].point[1]]

  const lastPoint: Vec2 =
    points.length > 1
      ? [points[points.length - 1].point[0], points[points.length - 1].point[1]]
      : add(points[0].point, [1, 1])

  const startCap: Vec2[] = []

  const endCap: Vec2[] = []

  // 为极短或已完成笔画绘制圆点
  if (points.length === 1) {
    if (!(taperStart || taperEnd) || isComplete) {
      return drawDot(firstPoint, firstRadius || radius)
    }
  } else {
    // 绘制起始端帽（渐细线条除外）
    if (taperStart || (taperEnd && points.length === 1)) {
      // 起始点已渐细，无需处理
    } else if (capStart) {
      startCap.push(
        ...drawRoundStartCap(firstPoint, rightPts[0], START_CAP_SEGMENTS)
      )
    } else {
      startCap.push(...drawFlatStartCap(firstPoint, leftPts[0], rightPts[0]))
    }

    // 绘制结束端帽（渐细线条除外）
    const direction = per(neg(points[points.length - 1].vector))

    if (taperEnd || (taperStart && points.length === 1)) {
      // 渐细结尾 — 将最后一个点推入线条
      endCap.push(lastPoint)
    } else if (capEnd) {
      endCap.push(
        ...drawRoundEndCap(lastPoint, direction, radius, END_CAP_SEGMENTS)
      )
    } else {
      endCap.push(...drawFlatEndCap(lastPoint, direction, radius))
    }
  }

  /*
    按正确的绕行顺序返回点：
    从左侧开始，绕过结束端帽，沿右侧返回，最后完成起始端帽。
  */

  return leftPts.concat(endCap, rightPts.reverse(), startCap)
}
