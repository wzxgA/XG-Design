import { useRef } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { resizeRect, type ResizeHandle, type Rect } from '../../utils/geometry'

interface Props {
  node: LayerNode
  zoom: number
  dispatch: EditorDispatch
  readOnly?: boolean
}

const HANDLES: { name: ResizeHandle; cls: string }[] = [
  { name: 'nw', cls: 'h-tl' },
  { name: 'n', cls: 'h-tm' },
  { name: 'ne', cls: 'h-tr' },
  { name: 'w', cls: 'h-ml' },
  { name: 'e', cls: 'h-mr' },
  { name: 'sw', cls: 'h-bl' },
  { name: 's', cls: 'h-bm' },
  { name: 'se', cls: 'h-br' },
]

const CORNER: ResizeHandle[] = ['nw', 'ne', 'sw', 'se']

export function SelectionBox({ node, zoom, dispatch, readOnly = false }: Props) {
  const startRef = useRef<{ rect: Rect; pointerX: number; pointerY: number; corner: boolean } | null>(null)
  const rotateRef = useRef<{ centerX: number; centerY: number; startAngle: number; startRotation: number } | null>(null)

  // 只读模式：不渲染缩放手柄，仅显示选中框
  if (readOnly) {
    return (
      <div
        className="selection-box readonly"
        style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    )
  }

  const beginResize = (handle: ResizeHandle) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (node.locked) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = {
      rect: { x: node.x, y: node.y, width: node.width, height: node.height },
      pointerX: e.clientX,
      pointerY: e.clientY,
      corner: CORNER.includes(handle),
    }
  }

  const onMove = (handle: ResizeHandle) => (e: React.PointerEvent) => {
    const start = startRef.current
    if (!start) return
    const scale = zoom / 100
    let dx = (e.clientX - start.pointerX) / scale
    let dy = (e.clientY - start.pointerY) / scale
    // Shift 等比缩放：对角手柄按下时按原始宽高比约束
    if (e.shiftKey && start.corner) {
      const ratio = start.rect.width / start.rect.height || 1
      // 以位移较大方向为准，等比推导另一方向
      const primary = Math.abs(dx) > Math.abs(dy) ? dx : dy
      dx = primary
      dy = primary / ratio
    }
    const next = resizeRect(handle, start.rect, dx, dy)
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: next })
  }

  const endResize = () => {
    startRef.current = null
  }

  // 旋转手柄：拖拽计算相对中心的角度变化（用 DOM rect 定位真实中心）
  const getCenter = (e: React.PointerEvent): { cx: number; cy: number } => {
    const box = (e.currentTarget as HTMLElement).closest('.selection-box') as HTMLElement | null
    if (!box) return { cx: e.clientX, cy: e.clientY }
    const rect = box.getBoundingClientRect()
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
  }

  const beginRotate = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (node.locked) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { cx, cy } = getCenter(e)
    rotateRef.current = {
      centerX: cx,
      centerY: cy,
      startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
      startRotation: node.rotation ?? 0,
    }
  }

  const onRotateMove = (e: React.PointerEvent) => {
    const r = rotateRef.current
    if (!r) return
    const angle = Math.atan2(e.clientY - r.centerY, e.clientX - r.centerX)
    let deg = r.startRotation + ((angle - r.startAngle) * 180) / Math.PI
    // 量化到 15° 以内
    deg = Math.round(deg / 15) * 15
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { rotation: deg } })
  }

  const endRotate = () => {
    rotateRef.current = null
  }

  return (
    <div
      className="selection-box"
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 旋转手柄 */}
      <div
        className="rotate-handle"
        onPointerDown={beginRotate}
        onPointerMove={onRotateMove}
        onPointerUp={endRotate}
        onPointerCancel={endRotate}
      />
      {HANDLES.map((h) => (
        <div
          key={h.name}
          className={`handle ${h.cls}`}
          data-handle={h.name}
          onPointerDown={beginResize(h.name)}
          onPointerMove={onMove(h.name)}
          onPointerUp={endResize}
          onPointerCancel={endResize}
        />
      ))}
    </div>
  )
}
