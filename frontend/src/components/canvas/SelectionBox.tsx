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

export function SelectionBox({ node, zoom, dispatch, readOnly = false }: Props) {
  const startRef = useRef<{ rect: Rect; pointerX: number; pointerY: number } | null>(null)

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
    }
  }

  const onMove = (handle: ResizeHandle) => (e: React.PointerEvent) => {
    const start = startRef.current
    if (!start) return
    const scale = zoom / 100
    const dx = (e.clientX - start.pointerX) / scale
    const dy = (e.clientY - start.pointerY) / scale
    const next = resizeRect(handle, start.rect, dx, dy)
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: next })
  }

  const endResize = () => {
    startRef.current = null
  }

  return (
    <div
      className="selection-box"
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={(e) => e.stopPropagation()}
    >
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
