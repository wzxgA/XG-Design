import { useRef, useState } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { Icon, Watermelon } from '../common/brand'
import { CanvasObject } from './CanvasObject'
import { SelectionBox } from './SelectionBox'
import { createLayer } from '../../utils/layers'

interface Props {
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
}

function findLayer(root: LayerNode[], id: string): LayerNode | null {
  for (const node of root) {
    if (node.id === id) return node
    const found = findLayer(node.children, id)
    if (found) return found
  }
  return null
}

export function CanvasArea({ state, dispatch, readOnly = false }: Props) {
  const { zoom } = state
  const activePage = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const selectedFrame = activePage.children.find((n) => n.type === 'frame') as LayerNode | undefined
  const selectedId = state.selectedIds[0]
  const selectedNode = selectedFrame ? findLayer(selectedFrame.children, selectedId ?? '') : undefined
  const scale = zoom / 100

  const frameRef = useRef<HTMLDivElement>(null)
  const drawRef = useRef<{ startX: number; startY: number } | null>(null)
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const fitCanvas = () => dispatch({ type: 'SET_ZOOM', zoom: 100 })

  // 只读模式下禁止绘制/创建工具
  const isDrawTool = !readOnly && (state.activeTool === 'frame' || state.activeTool === 'rectangle')
  const isClickTool = !readOnly && (state.activeTool === 'text' || state.activeTool === 'comment')

  const toCanvasCoord = (e: React.PointerEvent) => {
    const el = frameRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
  }

  const onFramePointerDown = (e: React.PointerEvent) => {
    if (!isDrawTool && !isClickTool) return
    e.stopPropagation()
    const { x, y } = toCanvasCoord(e)

    if (isClickTool) {
      // 文本 / 评论：点击即创建
      if (!selectedFrame) return
      if (state.activeTool === 'text') {
        const layer = createLayer('text', Math.max(0, x), Math.max(0, y))
        dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: selectedFrame.id, layer })
        dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
      } else {
        const layer: LayerNode = {
          id: `comment-${Date.now().toString(36)}`, type: 'comment', name: '评论', x, y, width: 24, height: 24,
          rotation: 0, visible: true, locked: false, content: '', style: { opacity: 1 }, children: [],
        }
        dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: selectedFrame.id, layer })
        dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
      }
      return
    }

    // 拖拽创建画板/矩形
    if (!selectedFrame) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drawRef.current = { startX: x, startY: y }
    setDrawRect({ x, y, w: 0, h: 0 })
  }

  const onFramePointerMove = (e: React.PointerEvent) => {
    if (!drawRef.current) return
    const { x, y } = toCanvasCoord(e)
    const sx = drawRef.current.startX
    const sy = drawRef.current.startY
    setDrawRect({ x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) })
  }

  const onFramePointerUp = (e: React.PointerEvent) => {
    if (!drawRef.current || !selectedFrame) { drawRef.current = null; setDrawRect(null); return }
    const { x, y } = toCanvasCoord(e)
    const sx = drawRef.current.startX
    const sy = drawRef.current.startY
    const w = Math.abs(x - sx)
    const h = Math.abs(y - sy)
    if (w < 4 || h < 4) { drawRef.current = null; setDrawRect(null); return }

    const kind = state.activeTool === 'frame' ? 'frame' : 'rectangle'
    const layer = createLayer(kind, Math.min(sx, x), Math.min(sy, y))
    layer.width = w
    layer.height = h
    dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: selectedFrame.id, layer })
    dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
    dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
    drawRef.current = null
    setDrawRect(null)
  }

  return (
    <main className="canvas-area" onClick={(e) => { if (e.target === e.currentTarget) dispatch({ type: 'SELECT_LAYERS', ids: [] }) }}>
      <div className="canvas-badge"><span className="canvas-dot" /> {state.document.name} <span>·</span> {activePage.name}</div>
      <div className="canvas-watermelon"><Watermelon /></div>

      <div className="artboard-wrap" style={{ transform: `translate(-49%, -46%) scale(${scale})` }}>
        <div className="artboard-label">
          {selectedFrame ? selectedFrame.name : '画板'} <span>— {selectedFrame ? `${selectedFrame.width} × ${selectedFrame.height}` : '1440 × 900'}</span>
        </div>
        <div
          ref={frameRef}
          className={`selection-frame ${isDrawTool || isClickTool ? 'drawing' : ''}`}
          onClick={(e) => { e.stopPropagation(); if (!isDrawTool && !isClickTool && e.target === e.currentTarget && selectedFrame) dispatch({ type: 'SELECT_LAYERS', ids: [selectedFrame.id] }) }}
          onPointerDown={onFramePointerDown}
          onPointerMove={onFramePointerMove}
          onPointerUp={onFramePointerUp}
        >
          {selectedFrame && selectedFrame.children.map((child) => (
            <CanvasObject key={child.id} node={child} state={state} dispatch={dispatch} drawing={isDrawTool || isClickTool} />
          ))}
          {drawRect && (
            <div className="draw-preview" style={{ left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h }} />
          )}
          {selectedNode && !selectedNode.locked && (
            <SelectionBox node={selectedNode} zoom={zoom} dispatch={dispatch} readOnly={readOnly} />
          )}
        </div>
        <div className="smart-guide vertical"><span>24 px</span></div>
        <div className="smart-guide horizontal" />
      </div>

      <div className="ghost-artboard" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_LAYERS', ids: [] }) }}>
        <span>项目管理页</span><div />
      </div>

      <div className="canvas-controls" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: zoom - 10 })}><Icon name="minus" /></button>
        <span>{zoom}%</span>
        <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: zoom + 10 })}><Icon name="plus" /></button>
        <button onClick={fitCanvas} title="适应画布"><Icon name="fit" /></button>
      </div>

      <div className="canvas-coordinates">
        {selectedNode ? `X ${selectedNode.x}　Y ${selectedNode.y}` : `选中 ${selectedId ?? '无'}`}
      </div>
    </main>
  )
}
