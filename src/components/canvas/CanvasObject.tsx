import { useRef, useState } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'

interface Props {
  node: LayerNode
  state: EditorState
  dispatch: EditorDispatch
  drawing?: boolean
}

function findBoard(state: EditorState): LayerNode | undefined {
  const page = state.document.pages.find((p) => p.id === state.document.activePageId)
  return page?.children.find((n) => n.type === 'frame')
}

/**
 * 数据驱动的画布对象渲染器。
 * 将 LayerNode 树按绝对坐标渲染为 HTML，隐藏节点不渲染，选中节点显示边框。
 * 支持拖拽移动对象（锁定节点不可移动）。
 */
export function CanvasObject({ node, state, dispatch, drawing = false }: Props) {
  const startRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)
  const movedRef = useRef(false)

  if (!node.visible) return null

  const selected = state.selectedIds.includes(node.id)
  const useSelectionBox = selected && node.children.length === 0 && !node.locked
  const outline = selected && !useSelectionBox ? 'canvas-selected' : ''
  const scale = state.zoom / 100

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    opacity: node.style.opacity ?? 1,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    cursor: node.locked ? 'default' : 'move',
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (drawing) return
    dispatch({ type: 'SELECT_LAYERS', ids: [node.id] })
    if (node.locked) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    startRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: node.x, y: node.y }
    movedRef.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current
    if (!start) return
    let dx = (e.clientX - start.pointerX) / scale
    let dy = (e.clientY - start.pointerY) / scale
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) movedRef.current = true
    // 基础吸附：吸附到画板边缘与中线
    const targetX = start.x + dx
    const targetY = start.y + dy
    const board = findBoard(state)
    if (board && !node.locked) {
      const SNAP = 6
      const frameW = board.width
      const frameH = board.height
      // 垂直对齐线：左、中、右
      const alignsX = [board.x, board.x + frameW / 2 - node.width / 2, board.x + frameW - node.width]
      for (const a of alignsX) {
        if (Math.abs(targetX - a) < SNAP) { dx += a - targetX; break }
      }
      // 水平对齐线：上、中、下
      const alignsY = [board.y, board.y + frameH / 2 - node.height / 2, board.y + frameH - node.height]
      for (const a of alignsY) {
        if (Math.abs(targetY - a) < SNAP) { dy += a - targetY; break }
      }
    }
    dispatch({ type: 'MOVE_LAYERS', ids: [node.id], dx: dx - (node.x - start.x), dy: dy - (node.y - start.y) })
  }

  const onPointerUp = () => {
    startRef.current = null
  }

  const base = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }

  if (node.children.length > 0) {
    return (
      <div className={`canvas-group ${outline}`} style={style} {...base}>
        {node.children.map((child) => <CanvasObject key={child.id} node={child} state={state} dispatch={dispatch} drawing={drawing} />)}
      </div>
    )
  }

  switch (node.type) {
    case 'rectangle':
      return (
        <div
          className={`canvas-rect ${outline}`}
          style={{
            ...style,
            background: node.style.fill ?? '#e5ebef',
            borderRadius: node.style.cornerRadius ?? 0,
            border: node.style.stroke ? `1px solid ${node.style.stroke}` : undefined,
            boxShadow: node.style.shadow,
          }}
          {...base}
        />
      )

    case 'text':
      return <CanvasText node={node} style={style} outline={outline} base={base} state={state} dispatch={dispatch} />

    case 'comment':
      return (
        <div className={`canvas-comment ${selected ? 'canvas-selected' : ''}`} style={style} {...base}>
          <span className="comment-pin">{selected ? '💬' : '●'}</span>
        </div>
      )

    case 'chart': {
      const bars = node.chartBars ?? []
      const max = Math.max(...bars, 1)
      return (
        <div className={`canvas-chart ${outline}`} style={style} {...base}>
          {bars.length > 0 ? (
            <div className="canvas-bars">
              {bars.map((h, i) => <i key={i} style={{ height: `${(h / max) * 100}%` }} />)}
            </div>
          ) : (
            <span className="canvas-chart-empty">↗</span>
          )}
        </div>
      )
    }

    default:
      return null
  }
}

interface TextProps {
  node: LayerNode
  style: React.CSSProperties
  outline: string
  base: Record<string, (e: any) => void>
  state: EditorState
  dispatch: EditorDispatch
}

function CanvasText({ node, style, outline, base, state, dispatch }: TextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.content ?? '')
  const inputRef = useRef<HTMLDivElement>(null)

  if (editing) {
    return (
      <div className={`canvas-text ${outline}`} style={style}>
        <div
          ref={inputRef}
          className="text-edit-input"
          contentEditable
          suppressContentEditableWarning
          onBlur={() => {
            dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { content: draft, name: draft || '文本' } })
            setEditing(false)
          }}
          onInput={(e) => setDraft((e.target as HTMLElement).textContent ?? '')}
        >
          {node.content ?? node.name}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`canvas-text ${outline}`}
      style={{
        ...style,
        color: node.style.color ?? '#5c6b72',
        fontSize: node.style.fontSize ?? 14,
        fontWeight: node.style.fontWeight ?? 400,
        lineHeight: '1.2',
      }}
      {...base}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (!node.locked) {
          setDraft(node.content ?? node.name)
          setEditing(true)
        }
      }}
    >
      {node.content ?? node.name}
    </div>
  )
}
