import PolyBool from 'polybooljs'
import type { PathPoint } from '../types/design'
import { samplePath } from './path'

/** 布尔运算模式 */
export type BooleanMode = 'union' | 'subtract' | 'intersect' | 'exclude'

/** 参与布尔的形状（绝对坐标）：矩形或路径 */
export interface ShapePoly {
  type: 'rect' | 'path'
  x: number
  y: number
  width: number
  height: number
  points?: PathPoint[]
  closed?: boolean
}

/** 形状 → 多边形点集（矩形取四角，路径按曲线采样） */
export function shapeToPolygon(s: ShapePoly): { x: number; y: number }[] {
  if (s.type === 'rect') {
    const x = s.x
    const y = s.y
    const w = s.width
    const h = s.height
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]
  }
  const pts = s.points ?? []
  if (pts.length < 2) return []
  return samplePath(pts, s.closed, 10)
}

function shoelace(pts: { x: number; y: number }[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}

/**
 * 对一组形状执行布尔运算，返回结果多边形点集。
 * 限制：只返回**面积最大的单一外环**（单轮廓结果），多个不相交区域暂不支持。
 */
export function booleanPolygons(shapes: ShapePoly[], mode: BooleanMode): { x: number; y: number }[] {
  const polys = shapes.map(shapeToPolygon).filter((p) => p.length >= 3)
  if (polys.length < 2) return []
  const toPb = (pts: { x: number; y: number }[]) => ({
    regions: [pts.map((p) => [p.x, p.y])],
    inverted: false,
  })
  let segments = PolyBool.segments(toPb(polys[0]))
  for (let i = 1; i < polys.length; i++) {
    const comb = PolyBool.combine(segments, PolyBool.segments(toPb(polys[i])))
    const sel =
      mode === 'union'
        ? PolyBool.selectUnion(comb)
        : mode === 'subtract'
          ? PolyBool.selectDifference(comb)
          : mode === 'intersect'
            ? PolyBool.selectIntersect(comb)
            : PolyBool.selectXor(comb)
    const next = PolyBool.polygon(sel)
    if (next.regions.length === 0) return []
    segments = PolyBool.segments(next)
  }
  const result = PolyBool.polygon(segments)
  let best: { x: number; y: number }[] | null = null
  let bestArea = -1
  for (const region of result.regions) {
    const pts = region.map(([px, py]) => ({ x: px, y: py }))
    const area = Math.abs(shoelace(pts))
    if (area > bestArea) {
      bestArea = area
      best = pts
    }
  }
  return best ?? []
}
