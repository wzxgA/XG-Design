import type { PathPoint } from '../types/design'

/** 坐标四舍五入（减少 svg d 长度） */
function r(v: number): number {
  return Math.round(v * 100) / 100
}

/** 三次贝塞尔在 t 处的点 */
function cubicAt(p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, t: number): { x: number; y: number } {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0x + b * p1x + c * p2x + d * p3x,
    y: a * p0y + b * p1y + c * p2y + d * p3y,
  }
}

/**
 * 生成 SVG path d 字符串（坐标相对图层左上角）。
 * 规则：当前锚点有 handleOut 或下一锚点有 handleIn 时为三次贝塞尔（C），否则直线（L）；闭合末尾补 Z。
 */
export function pathToSvgD(points: PathPoint[], closed = false): string {
  const n = points.length
  if (n === 0) return ''
  const d: string[] = [`M ${r(points[0].x)} ${r(points[0].y)}`]
  for (let i = 0; i < n; i++) {
    if (i === n - 1 && !closed) break
    const p = points[i]
    const q = points[(i + 1) % n]
    const c1x = p.x + (p.handleOut?.x ?? 0)
    const c1y = p.y + (p.handleOut?.y ?? 0)
    const c2x = q.x + (q.handleIn?.x ?? 0)
    const c2y = q.y + (q.handleIn?.y ?? 0)
    if (p.handleOut || q.handleIn) {
      d.push(`C ${r(c1x)} ${r(c1y)}, ${r(c2x)} ${r(c2y)}, ${r(q.x)} ${r(q.y)}`)
    } else {
      d.push(`L ${r(q.x)} ${r(q.y)}`)
    }
  }
  if (closed) d.push('Z')
  return d.join(' ')
}

/**
 * 将路径采样为折线点集（供布尔运算 / 命中测试 / 包围盒）。
 * 闭合路径不重复首点；每段曲线按 perSeg 段线性近似。
 */
export function samplePath(points: PathPoint[], closed = false, perSeg = 10): { x: number; y: number }[] {
  const n = points.length
  if (n === 0) return []
  const out: { x: number; y: number }[] = [{ x: points[0].x, y: points[0].y }]
  for (let i = 0; i < n; i++) {
    if (i === n - 1 && !closed) break
    const p = points[i]
    const q = points[(i + 1) % n]
    const hasC = !!p.handleOut || !!q.handleIn
    if (!hasC) {
      out.push({ x: q.x, y: q.y })
    } else {
      const c1x = p.x + (p.handleOut?.x ?? 0)
      const c1y = p.y + (p.handleOut?.y ?? 0)
      const c2x = q.x + (q.handleIn?.x ?? 0)
      const c2y = q.y + (q.handleIn?.y ?? 0)
      for (let s = 1; s <= perSeg; s++) {
        out.push(cubicAt(p.x, p.y, c1x, c1y, c2x, c2y, q.x, q.y, s / perSeg))
      }
    }
  }
  return out
}

/** 路径包围盒（含贝塞尔控制点；曲线位于其控制点凸包内，故为安全的 AABB 上界） */
export function computePathBounds(points: PathPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const push = (x: number, y: number) => {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  for (const p of points) {
    push(p.x, p.y)
    if (p.handleIn) push(p.x + p.handleIn.x, p.y + p.handleIn.y)
    if (p.handleOut) push(p.x + p.handleOut.x, p.y + p.handleOut.y)
  }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  return { minX, minY, maxX, maxY }
}

/** 点到线段最近距离的平方 */
function dist2ToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    const ex = px - ax
    const ey = py - ay
    return ex * ex + ey * ey
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const ex = px - (ax + t * dx)
  const ey = py - (ay + t * dy)
  return ex * ex + ey * ey
}

/** 命中测试：点到采样路径折线的最短距离是否在容差内（描边命中） */
export function hitTestPath(points: PathPoint[], closed: boolean, px: number, py: number, tolerance = 4): boolean {
  const sampled = samplePath(points, closed, 8)
  if (sampled.length < 2) return false
  const tol2 = tolerance * tolerance
  for (let i = 0; i < sampled.length - 1; i++) {
    if (dist2ToSeg(px, py, sampled[i].x, sampled[i].y, sampled[i + 1].x, sampled[i + 1].y) <= tol2) return true
  }
  // 闭合路径补上末段
  if (closed && sampled.length >= 2) {
    const last = sampled[sampled.length - 1]
    if (dist2ToSeg(px, py, last.x, last.y, sampled[0].x, sampled[0].y) <= tol2) return true
  }
  return false
}

/**
 * 在闭合/开放路径上，把外部点投影到最近采样点并插入对应锚点（用于"路径上双击加锚点"）。
 * 返回插入后的新锚点数组；投影在最近采样点所在线段的两端锚点间插入（曲线段在参数 t 处插入）。
 */
export function insertPointNear(points: PathPoint[], closed: boolean, px: number, py: number): PathPoint[] {
  const n = points.length
  if (n < 2) return [...points]
  let best = Infinity
  let bestSeg = -1
  let bestT = 0
  // 对每段采样，找最近点
  for (let i = 0; i < n; i++) {
    if (i === n - 1 && !closed) break
    const p = points[i]
    const q = points[(i + 1) % n]
    const hasC = !!p.handleOut || !!q.handleIn
    const samples = hasC
      ? (() => {
          const c1x = p.x + (p.handleOut?.x ?? 0)
          const c1y = p.y + (p.handleOut?.y ?? 0)
          const c2x = q.x + (q.handleIn?.x ?? 0)
          const c2y = q.y + (q.handleIn?.y ?? 0)
          const arr: { x: number; y: number }[] = []
          for (let s = 0; s <= 10; s++) arr.push(cubicAt(p.x, p.y, c1x, c1y, c2x, c2y, q.x, q.y, s / 10))
          return arr
        })()
      : [
          { x: p.x, y: p.y },
          { x: q.x, y: q.y },
        ]
    for (let s = 0; s < samples.length - 1; s++) {
      const d = dist2ToSeg(px, py, samples[s].x, samples[s].y, samples[s + 1].x, samples[s + 1].y)
      if (d < best) {
        best = d
        bestSeg = i
        bestT = s / (samples.length - 1)
      }
    }
  }
  if (bestSeg < 0) return [...points]
  const insertAt = bestSeg + 1
  const newPt: PathPoint = { x: px, y: py }
  const next = [...points]
  next.splice(insertAt, 0, newPt)
  return next
}
