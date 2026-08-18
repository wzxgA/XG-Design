import { useRef, useState } from 'react'
import type { LayerNode, PathPoint } from '../../types/design'
import { pathToSvgD, computePathBounds, insertPointNear } from '../../utils/path'
import { BLUE } from '../../constants/colors'

interface Props {
  node: LayerNode
  scale: number
  onCommit: (points: PathPoint[], closed: boolean) => void
  onCancel: () => void
}

type Drag = { kind: 'anchor' | 'handleIn' | 'handleOut'; idx: number; alt: boolean }

/** 锚点/贝塞尔手柄编辑叠加层：编辑路径的锚点与曲线，提交时一次性写回 */
export function PathEditor({ node, scale, onCommit, onCancel }: Props) {
  const [points, setPoints] = useState<PathPoint[]>(() => (node.points ?? []).map((p) => ({ ...p })))
  const [closed, setClosed] = useState(!!node.pathClosed)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const toLocal = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
  }

  const update = (updater: (pts: PathPoint[]) => PathPoint[]) => setPoints((pts) => updater(pts))

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    const { x, y } = toLocal(e.clientX, e.clientY)
    const d = drag
    if (d.kind === 'anchor') {
      update((pts) => {
        const next = pts.map((p, i) => (i === d.idx ? { ...p, x, y } : p))
        return next
      })
    } else {
      update((pts) => {
        const next = pts.map((p, i) => {
          if (i !== d.idx) return p
          if (d.kind === 'handleOut') {
            const hx = x - p.x
            const hy = y - p.y
            return d.alt
              ? { ...p, handleOut: { x: hx, y: hy } }
              : { ...p, handleOut: { x: hx, y: hy }, handleIn: { x: -hx, y: -hy } }
          }
          const hx = x - p.x
          const hy = y - p.y
          return d.alt
            ? { ...p, handleIn: { x: hx, y: hy } }
            : { ...p, handleIn: { x: hx, y: hy }, handleOut: { x: -hx, y: -hy } }
        })
        return next
      })
    }
  }

  const endDrag = () => setDrag(null)

  const startAnchor = (e: React.PointerEvent, i: number) => {
    e.stopPropagation()
    setSelected(i)
    setDrag({ kind: 'anchor', idx: i, alt: false })
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const startHandle = (e: React.PointerEvent, i: number, kind: 'handleIn' | 'handleOut') => {
    e.stopPropagation()
    setSelected(i)
    setDrag({ kind, idx: i, alt: e.altKey })
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const deleteSelected = () => {
    if (selected == null) return
    const min = closed ? 3 : 2
    if (points.length <= min) return
    setPoints((pts) => pts.filter((_, i) => i !== selected))
    setSelected(null)
  }

  const insertPoint = (e: React.MouseEvent) => {
    const { x, y } = toLocal(e.clientX, e.clientY)
    const next = insertPointNear(points, closed, x, y)
    setPoints(next)
    // 选中新增锚点（插在最近线段终点之后）
    setSelected(next.length - 1)
  }

  const commit = () => {
    onCommit(points, closed)
  }

  const b = computePathBounds(points)
  const d = pathToSvgD(points, closed)
  const stroke = node.style.stroke ?? BLUE

  return (
    <div
      className="path-editor"
      style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
        if (e.key === 'Enter') commit()
        if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      }}
      tabIndex={0}
    >
      <svg
        ref={svgRef}
        width={node.width}
        height={node.height}
        viewBox={`0 0 ${node.width} ${node.height}`}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => { e.stopPropagation(); insertPoint(e) }}
      >
        {/* 背景路径（含未落盘的当前编辑结果） */}
        <path d={d} fill={node.style.fill ?? 'none'} stroke={stroke} strokeWidth={node.style.strokeWidth ?? 2} strokeLinejoin="round" strokeLinecap="round" />
        {/* 手柄线 + 端点 */}
        {points.map((p, i) => (
          <g key={i}>
            {p.handleOut && (
              <>
                <line x1={p.x} y1={p.y} x2={p.x + p.handleOut.x} y2={p.y + p.handleOut.y} stroke="#888" strokeWidth={1 / scale} strokeDasharray="3 2" />
                <circle cx={p.x + p.handleOut.x} cy={p.y + p.handleOut.y} r={3 / scale} fill="#fff" stroke={BLUE} strokeWidth={1.5 / scale}
                  onPointerDown={(e) => startHandle(e, i, 'handleOut')} style={{ cursor: 'pointer' }} />
              </>
            )}
            {p.handleIn && (
              <>
                <line x1={p.x} y1={p.y} x2={p.x + p.handleIn.x} y2={p.y + p.handleIn.y} stroke="#888" strokeWidth={1 / scale} strokeDasharray="3 2" />
                <circle cx={p.x + p.handleIn.x} cy={p.y + p.handleIn.y} r={3 / scale} fill="#fff" stroke={BLUE} strokeWidth={1.5 / scale}
                  onPointerDown={(e) => startHandle(e, i, 'handleIn')} style={{ cursor: 'pointer' }} />
              </>
            )}
            <rect
              x={p.x - 3 / scale}
              y={p.y - 3 / scale}
              width={6 / scale}
              height={6 / scale}
              fill={selected === i ? BLUE : '#fff'}
              stroke={BLUE}
              strokeWidth={1.5 / scale}
              onPointerDown={(e) => startAnchor(e, i)}
              style={{ cursor: 'move' }}
            />
          </g>
        ))}
        {/* 包围盒示意 */}
        <rect x={b.minX} y={b.minY} width={Math.max(0, b.maxX - b.minX)} height={Math.max(0, b.maxY - b.minY)} fill="none" stroke="#9dbff4" strokeWidth={1 / scale} strokeDasharray="4 3" pointerEvents="none" />
      </svg>

      <div className="path-editor-toolbar">
        <button className="path-editor-btn" onClick={() => setClosed((v) => !v)}>{closed ? '断开' : '闭合'}</button>
        <button className="path-editor-btn" onClick={deleteSelected} disabled={selected == null || points.length <= (closed ? 3 : 2)}>删锚点</button>
        <span className="path-editor-hint">{points.length} 点 · Alt 拖手柄断开 · 双击路径加锚点 · Esc 取消</span>
        <button className="path-editor-btn" onClick={onCancel}>取消</button>
        <button className="path-editor-btn primary" onClick={commit}>完成</button>
      </div>
    </div>
  )
}
