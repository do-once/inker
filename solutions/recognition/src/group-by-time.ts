import type { Stroke } from '@inker/types'
import type { StrokeGroup } from './types'

/**
 * 按时间间隔将连续笔画分为若干组
 * 两笔之间的时间间隔大于等于 gapMs 则分为不同组
 * @param strokes 按绘制顺序排列的笔画数组
 * @param gapMs 分组间隔阈值（毫秒）
 */
export function groupByTime(strokes: readonly Stroke[], gapMs: number): StrokeGroup[] {
  if (strokes.length === 0) return []

  const groups: StrokeGroup[] = []
  let currentGroup: Stroke[] = [strokes[0]]

  for (let i = 1; i < strokes.length; i++) {
    const prevStroke = strokes[i - 1]
    const currStroke = strokes[i]
    const prevEnd = prevStroke.points[prevStroke.points.length - 1].t
    const currStart = currStroke.points[0].t

    if (currStart - prevEnd >= gapMs) {
      groups.push(buildGroup(currentGroup))
      currentGroup = [currStroke]
    } else {
      currentGroup.push(currStroke)
    }
  }

  groups.push(buildGroup(currentGroup))
  return groups
}

function buildGroup(strokes: Stroke[]): StrokeGroup {
  const firstPoint = strokes[0].points[0]
  const lastStroke = strokes[strokes.length - 1]
  const lastPoint = lastStroke.points[lastStroke.points.length - 1]

  return {
    strokes,
    startTime: firstPoint.t,
    endTime: lastPoint.t
  }
}
