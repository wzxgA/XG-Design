import { useEffect, useRef, useState } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { Icon, Watermelon } from '../common/brand'
import { CanvasObject } from './CanvasObject'
import { SelectionBox } from './SelectionBox'
import { createLayer, findNodeWithPath, getNodeAbs, getSiblingsAbs } from '../../utils/layers'
import { buildComponent } from '../../fixtures/component-library'
import { ZOOM_MIN, ZOOM_MAX } from '../../state/editor-reducer'
import { BLUE } from '../../constants/colors'

interface Props {
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
}

export interface FramePreset {
  label: string
  width: number
  height: number
}

export const FRAME_PRESETS: FramePreset[] = [
  { label: '桌面 1440×900', width: 1440, height: 900 },
  { label: '桌面 1280×800', width: 1280, height: 800 },
  { label: '桌面 1024×768', width: 1024, height: 768 },
  { label: '移动 375×812', width: 375, height: 812 },
  { label: '移动 390×844', width: 390, height: 844 },
  { label: 'Web 1920×1080', width: 1920, height: 1080 },
]

const FRAME_GAP = 80

/** 收集 frame 内全部叶子节点 */
function collectLeaves(node: LayerNode, out: LayerNode[] = []): LayerNode[] {
  if (node.children.length === 0) {
    out.push(node)
  } else {
    node.children.forEach((c) => collectLeaves(c, out))
  }
  return out
}

export function CanvasArea({ state, dispatch, readOnly = false }: Props) {
  const { zoom, pan } = state
  const activePage = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const frames = activePage.children.filter((n) => n.type === 'frame')
  const scale = zoom / 100
  const selectedId = state.selectedIds[0]

  const mainRef = useRef<HTMLElement>(null)
  const frameRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // ---- 交互状态 ----
  const drawRef = useRef<{ startX: number; startY: number; frameId: string } | null>(null)
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number; frameId: string } | null>(null)
  const marqueeRef = useRef<{ startX: number; startY: number; frameId: string; shift: boolean; rect: { x: number; y: number; w: number; h: number } | null } | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number; frameId: string } | null>(null)
  const penRef = useRef<{ frameId: string; points: { x: number; y: number }[] } | null>(null)
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[]>([])
  const [penPreview, setPenPreview] = useState<{ x: number; y: number } | null>(null)
  const frameDragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number; frameId: string; moved: boolean } | null>(null)
  const panDragRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null)
  // 平移中：画布光标显示 grabbing（覆盖组件 pointer 手型）
  const [panning, setPanning] = useState(false)
  const spaceDownRef = useRef(false)
  const [framePreset, setFramePreset] = useState<FramePreset | null>(null)
  const [altDown, setAltDown] = useState(false)

  const isDrawTool = !readOnly && (state.activeTool === 'frame' || state.activeTool === 'rectangle')
  const isClickTool = !readOnly && (state.activeTool === 'text' || state.activeTool === 'comment')
  const isPenTool = !readOnly && state.activeTool === 'pen'

  // 平铺布局：frame 按自身坐标排布
  const contentW = Math.max(frames.reduce((max, f) => Math.max(max, f.x + f.width), 0), 760)
  const contentH = Math.max(frames.reduce((max, f) => Math.max(max, f.y + f.height), 0), 490)

  // 选中节点定位 + 相对 frame 的绝对偏移（供 SelectionBox / 多选包围框 / 坐标栏）
  const selectedCtx = selectedId
    ? frames
        .map((f) => {
          const ctx = findNodeWithPath(f, selectedId)
          return ctx ? { frame: f, ctx } : null
        })
        .find(Boolean) ?? null
    : null
  const selectedNode = selectedCtx?.ctx.node ?? undefined
  const selectedFrameId = selectedCtx?.frame.id
  // group 祖先 x/y 累加值，渲染叠加层时加到节点相对坐标上
  const selectedOffset = selectedCtx
    ? selectedCtx.ctx.path.reduce((s, n) => ({ x: s.x + n.x, y: s.y + n.y }), { x: 0, y: 0 })
    : { x: 0, y: 0 }

  // ---- 坐标转换：client → frame 局部坐标 ----
  const toFrameCoord = (frameId: string, clientX: number, clientY: number) => {
    const el = frameRefs.current[frameId]
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
  }

  // Alt 按住查看间距
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        // 阻止浏览器激活菜单栏（Firefox/IE 等），仅在非输入区生效
        if (!isEditableTarget(e.target)) e.preventDefault()
        setAltDown(true)
      }
    }
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltDown(false) }
    const blur = () => setAltDown(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // 钢笔模式：Enter 提交 / Esc 取消
  useEffect(() => {
    if (!isPenTool) return
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.key === 'Enter') commitPen()
      if (e.key === 'Escape') cancelPen()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isPenTool, penPoints])

  // 工具切换（离开钢笔/绘制工具）时清理绘制状态
  useEffect(() => {
    if (!isPenTool) {
      penRef.current = null
      setPenPoints([])
      setPenPreview(null)
    }
  }, [isPenTool, state.activeTool])

  useEffect(() => {
    if (!isDrawTool) {
      drawRef.current = null
      setDrawRect(null)
      marqueeRef.current = null
      setMarquee(null)
      frameDragRef.current = null
      document.body.style.userSelect = ''
    }
  }, [isDrawTool])

  // ---- 空格平移 ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditableTarget(e.target)) {
        spaceDownRef.current = true
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // 滚轮缩放 / 平移
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.1 : 0.9
        dispatch({ type: 'SET_ZOOM', zoom: Math.round(zoom * factor) })
      } else {
        dispatch({ type: 'SET_PAN', pan: { x: pan.x - e.deltaX, y: pan.y - e.deltaY } })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, pan, dispatch])

  const fitCanvas = () => {
    const el = mainRef.current
    if (!el) return
    const availW = el.clientWidth - 160
    const availH = el.clientHeight - 160
    const fit = Math.min(availW / contentW, availH / contentH, 1) * 100
    dispatch({ type: 'SET_ZOOM', zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(fit))) })
    dispatch({ type: 'SET_PAN', pan: { x: 0, y: 0 } })
  }

  // ---- 创建 ----
  const createFrame = (x: number, y: number, w: number, h: number) => {
    const preset = framePreset
    const layer = createLayer('frame', x, y)
    layer.width = preset ? preset.width : Math.max(20, w)
    layer.height = preset ? preset.height : Math.max(20, h)
    dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: null, layer })
    dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
    dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
    setFramePreset(null)
  }

  const createChildLayer = (kind: 'rectangle' | 'text' | 'comment', frameId: string, x: number, y: number) => {
    const layer = createLayer(kind === 'comment' ? 'rectangle' : kind, Math.max(0, x), Math.max(0, y))
    if (kind === 'comment') {
      layer.type = 'comment'
      layer.name = '评论'
      layer.width = 24
      layer.height = 24
      layer.content = ''
    }
    dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: frameId, layer })
    dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
    if (kind !== 'comment') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
  }

  // ---- 钢笔 ----
  const addPenPoint = (frameId: string, x: number, y: number) => {
    const pen = penRef.current ?? { frameId, points: [] }
    penRef.current = { frameId, points: [...pen.points, { x, y }] }
    setPenPoints(penRef.current.points)
  }

  const commitPen = () => {
    const pen = penRef.current
    if (!pen) return
    const { frameId, points } = pen
    if (points.length >= 2) {
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const layer = createLayer('rectangle', minX, minY)
      layer.type = 'path'
      layer.name = '路径'
      layer.width = Math.max(1, Math.max(...xs) - minX)
      layer.height = Math.max(1, Math.max(...ys) - minY)
      layer.style = { opacity: 1, stroke: BLUE, strokeWidth: 2 }
      layer.points = points.map((p) => ({ x: p.x - minX, y: p.y - minY }))
      dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: frameId, layer })
      dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
    }
    penRef.current = null
    setPenPoints([])
    setPenPreview(null)
    dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
  }

  const cancelPen = () => {
    penRef.current = null
    setPenPoints([])
    setPenPreview(null)
  }

  // ---- frame 空白处事件（select：移动画板 / Shift：框选）----
  const onFramePointerDown = (e: React.PointerEvent, frameId: string) => {
    if (readOnly) return
    // 中键：不移动画板/不框选/不绘制，冒泡到画布容器触发平移（与"中键=平移画布"一致）
    if (e.button === 1) return
    const tool = state.activeTool
    const { x, y } = toFrameCoord(frameId, e.clientX, e.clientY)
    const frame = frames.find((f) => f.id === frameId)!

    if (tool === 'text') { createChildLayer('text', frameId, x, y); return }
    if (tool === 'comment') { createChildLayer('comment', frameId, x, y); return }
    if (tool === 'pen') {
      if (penRef.current && penRef.current.frameId !== frameId) return
      addPenPoint(frameId, x, y)
      return
    }
    if (tool === 'select') {
      dispatch({ type: 'SELECT_LAYERS', ids: [frame.id] })
      if (e.shiftKey) {
        // Shift + 拖拽空白：框选 frame 内对象
        marqueeRef.current = { startX: x, startY: y, frameId, shift: true, rect: { x, y, w: 0, h: 0 } }
        setMarquee({ x, y, w: 0, h: 0, frameId })
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } else {
        // 普通拖拽：移动画板
        frameDragRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: frame.x, y: frame.y, frameId, moved: false }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }
      return
    }
    if (isDrawTool) {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      drawRef.current = { startX: x, startY: y, frameId }
      setDrawRect({ x, y, w: 0, h: 0, frameId })
    }
  }

  const onFramePointerMove = (e: React.PointerEvent) => {
    if (drawRef.current) {
      const { startX, startY, frameId } = drawRef.current
      const { x, y } = toFrameCoord(frameId, e.clientX, e.clientY)
      setDrawRect({ x: Math.min(startX, x), y: Math.min(startY, y), w: Math.abs(x - startX), h: Math.abs(y - startY), frameId })
      return
    }
    if (marqueeRef.current) {
      const { startX, startY, frameId } = marqueeRef.current
      const { x, y } = toFrameCoord(frameId, e.clientX, e.clientY)
      const rect = { x: Math.min(startX, x), y: Math.min(startY, y), w: Math.abs(x - startX), h: Math.abs(y - startY) }
      marqueeRef.current.rect = rect
      setMarquee({ ...rect, frameId })
      return
    }
    if (frameDragRef.current) {
      const d = frameDragRef.current
      const frame = frames.find((f) => f.id === d.frameId)
      if (!frame) return
      const dx = (e.clientX - d.pointerX) / scale
      const dy = (e.clientY - d.pointerY) / scale
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        // 首次产生位移时记录一次快照，供整次移动撤销
        if (!d.moved) {
          d.moved = true
          dispatch({ type: 'BEGIN_MOVE', ids: [frame.id] })
        }
        dispatch({ type: 'MOVE_LAYERS', ids: [frame.id], dx: dx - (frame.x - d.x), dy: dy - (frame.y - d.y) })
      }
      return
    }
    if (penRef.current && isPenTool) {
      const { frameId } = penRef.current
      const { x, y } = toFrameCoord(frameId, e.clientX, e.clientY)
      setPenPreview({ x, y })
    }
  }

  const onFramePointerUp = () => {
    if (drawRef.current) {
      const { startX, startY, frameId } = drawRef.current
      const w = drawRect?.w ?? 0
      const h = drawRect?.h ?? 0
      drawRef.current = null
      setDrawRect(null)
      if (state.activeTool === 'frame') {
        createFrame(Math.min(startX, startX + w), Math.min(startY, startY + h), w, h)
      } else {
        const layer = createLayer('rectangle', Math.min(startX, startX + w), Math.min(startY, startY + h))
        layer.width = Math.max(1, w)
        layer.height = Math.max(1, h)
        dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: frameId, layer })
        dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
      }
      return
    }
    if (marqueeRef.current) {
      const m = marqueeRef.current
      const frame = frames.find((f) => f.id === m.frameId)
      const rect = m.rect
      if (frame && rect && rect.w > 2 && rect.h > 2) {
        // 叶子节点坐标为相对父级坐标，统一换算为 frame 绝对坐标后与框选矩形比较
        const hits = collectLeaves(frame).filter((leaf) => {
          const abs = getNodeAbs(frame, leaf.id)
          if (!abs) return false
          return (
            abs.x < rect.x + rect.w &&
            abs.x + leaf.width > rect.x &&
            abs.y < rect.y + rect.h &&
            abs.y + leaf.height > rect.y
          )
        })
        if (hits.length > 0) {
          const all = hits.map((n) => n.id)
          dispatch({ type: 'SELECT_LAYERS', ids: all })
        }
      }
      marqueeRef.current = null
      setMarquee(null)
      document.body.style.userSelect = ''
    }
    frameDragRef.current = null
  }

  // ---- 画布空白处：平移 ----
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    const isMiddle = e.button === 1
    if (!isMiddle && e.button !== 0) return
    if (readOnly) return
    if (spaceDownRef.current || isMiddle) {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      panDragRef.current = { pointerX: e.clientX, pointerY: e.clientY, panX: pan.x, panY: pan.y }
      setPanning(true)
      return
    }
    // Shift + 空白点击：不打断已有选择（空白处仅普通点击才清空）
    if (e.target === e.currentTarget && !e.shiftKey) dispatch({ type: 'SELECT_LAYERS', ids: [] })
  }

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const d = panDragRef.current
    if (!d) return
    dispatch({ type: 'SET_PAN', pan: { x: d.panX + (e.clientX - d.pointerX), y: d.panY + (e.clientY - d.pointerY) } })
  }

  const onCanvasPointerUp = () => {
    panDragRef.current = null
    setPanning(false)
  }

  // ---- 多选包围框（同 frame 内，用绝对坐标求并集）----
  const multiNode = (() => {
    if (state.selectedIds.length <= 1 || !selectedFrameId) return null
    const frame = frames.find((f) => f.id === selectedFrameId)
    if (!frame) return null
    const rects = state.selectedIds
      .map((id) => {
        const ctx = findNodeWithPath(frame, id)
        if (!ctx) return null
        const ox = ctx.path.reduce((s, n) => s + n.x, 0)
        const oy = ctx.path.reduce((s, n) => s + n.y, 0)
        return { x: ctx.node.x + ox, y: ctx.node.y + oy, width: ctx.node.width, height: ctx.node.height }
      })
      .filter((r): r is { x: number; y: number; width: number; height: number } => !!r)
    if (rects.length < 2) return null
    const minX = Math.min(...rects.map((n) => n.x))
    const minY = Math.min(...rects.map((n) => n.y))
    const maxX = Math.max(...rects.map((n) => n.x + n.width))
    const maxY = Math.max(...rects.map((n) => n.y + n.height))
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  })()

  // ---- Alt 间距标注（选中节点与同级节点的水平/垂直间距，坐标统一换算为 frame 绝对坐标）----
  const spacingGuides = (() => {
    if (!altDown || !selectedNode || !selectedFrameId) return []
    const frame = frames.find((f) => f.id === selectedFrameId)
    if (!frame) return []
    const ctx = getSiblingsAbs(frame, selectedNode.id)
    if (!ctx) return []
    const { parent, node, nodeAbs } = ctx
    const ox = nodeAbs.x
    const oy = nodeAbs.y
    const guides: { x: number; y: number; w: number; h: number; label: string; axis: 'h' | 'v' }[] = []
    // 水平间距：左邻右界 / 右邻左界（gap 差值两坐标共享偏移可抵消，绘制位置需加 ox/oy）
    const leftNeighbor = parent
      .filter((n) => n.id !== node.id && n.x + n.width <= node.x)
      .sort((a, b) => b.x + b.width - (a.x + a.width))[0]
    if (leftNeighbor) {
      const gap = node.x - (leftNeighbor.x + leftNeighbor.width)
      const y = node.y + node.height / 2 + oy
      guides.push({ x: leftNeighbor.x + leftNeighbor.width + ox, y, w: gap, h: 1, label: `${Math.round(gap)}px`, axis: 'h' })
    }
    const rightNeighbor = parent
      .filter((n) => n.id !== node.id && n.x >= node.x + node.width)
      .sort((a, b) => a.x - b.x)[0]
    if (rightNeighbor) {
      const gap = rightNeighbor.x - (node.x + node.width)
      const y = node.y + node.height / 2 + oy
      guides.push({ x: node.x + node.width + ox, y, w: gap, h: 1, label: `${Math.round(gap)}px`, axis: 'h' })
    }
    // 垂直间距
    const topNeighbor = parent
      .filter((n) => n.id !== node.id && n.y + n.height <= node.y)
      .sort((a, b) => b.y + b.height - (a.y + a.height))[0]
    if (topNeighbor) {
      const gap = node.y - (topNeighbor.y + topNeighbor.height)
      const x = node.x + node.width / 2 + ox
      guides.push({ x, y: topNeighbor.y + topNeighbor.height + oy, w: 1, h: gap, label: `${Math.round(gap)}px`, axis: 'v' })
    }
    const bottomNeighbor = parent
      .filter((n) => n.id !== node.id && n.y >= node.y + node.height)
      .sort((a, b) => a.y - b.y)[0]
    if (bottomNeighbor) {
      const gap = bottomNeighbor.y - (node.y + node.height)
      const x = node.x + node.width / 2 + ox
      guides.push({ x, y: node.y + node.height + oy, w: 1, h: gap, label: `${Math.round(gap)}px`, axis: 'v' })
    }
    return guides
  })()

  // ---- 组件拖拽插入 ----
  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (readOnly) return
    const templateId = e.dataTransfer.getData('application/xg-component')
    if (!templateId) return
    const frame = frames[0]
    if (!frame) return
    const el = frameRefs.current[frame.id]
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: frame.id, layer: buildComponentLayer(templateId, x, y) })
  }

  return (
    <main
      ref={mainRef}
      className={`canvas-area${panning ? ' is-panning' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget && !e.shiftKey) dispatch({ type: 'SELECT_LAYERS', ids: [] }) }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onPointerCancel={onCanvasPointerUp}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onCanvasDrop}
      // 禁用浏览器中键 auto-scroll，中键统一用于画布平移
      onMouseDown={(e) => { if (e.button === 1) e.preventDefault() }}
      onAuxClick={(e) => { if (e.button === 1) e.preventDefault() }}
    >
      <div className="canvas-badge"><span className="canvas-dot" /> {state.document.name} <span>·</span> {activePage.name}</div>
      <div className="canvas-watermelon"><Watermelon /></div>

      <div
        className="artboard-wrap"
        style={{ width: contentW, height: contentH, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})` }}
      >
        {frames.map((frame) => (
          <div
            key={frame.id}
            ref={(el) => { frameRefs.current[frame.id] = el }}
            className={`frame-slot ${state.selectedIds.includes(frame.id) ? 'frame-selected' : ''}`}
            style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
          >
            <div className="artboard-label">
              {frame.name} <span>— {frame.width} × {frame.height}</span>
            </div>
            <div
              className={`selection-frame ${isDrawTool || isClickTool || isPenTool ? 'drawing' : ''}`}
              style={{ background: frame.style.backgroundColor ?? frame.style.fill ?? '#ffffff' }}
              onPointerDown={(e) => onFramePointerDown(e, frame.id)}
              onPointerMove={onFramePointerMove}
              onPointerUp={onFramePointerUp}
              onPointerCancel={onFramePointerUp}
              onDoubleClick={(e) => { if (isPenTool) { e.stopPropagation(); commitPen() } }}
            >
              {frame.children.map((child) => (
                <CanvasObject key={child.id} node={child} state={state} dispatch={dispatch} drawing={isDrawTool || isClickTool || isPenTool} readOnly={readOnly} />
              ))}
              {selectedFrameId === frame.id && selectedNode && !selectedNode.locked && selectedNode.type !== 'frame' && (
                <SelectionBox
                  node={selectedNode}
                  zoom={zoom}
                  dispatch={dispatch}
                  readOnly={readOnly}
                  offsetX={selectedOffset.x}
                  offsetY={selectedOffset.y}
                />
              )}
              {selectedFrameId === frame.id && multiNode && (
                <div className="multi-selection" style={{ left: multiNode.x, top: multiNode.y, width: multiNode.width, height: multiNode.height }} />
              )}
              {spacingGuides.map((g, i) => (
                <div
                  key={i}
                  className="spacing-guide"
                  style={g.axis === 'h' ? { left: g.x, top: g.y, width: g.w, height: g.h } : { left: g.x, top: g.y, width: g.w, height: g.h }}
                >
                  <span className="spacing-label" style={g.axis === 'h' ? { left: g.w / 2 } : { top: g.h / 2 }}>{g.label}</span>
                </div>
              ))}
              {drawRect && drawRect.frameId === frame.id && (
                <div className="draw-preview" style={{ left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h }} />
              )}
              {marquee && marquee.frameId === frame.id && (
                <div className="marquee-rect" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
              )}
              {penPoints.length > 0 && penRef.current?.frameId === frame.id && (
                <svg className="pen-layer" width={frame.width} height={frame.height} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
                  {penPoints.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={3} fill={BLUE} />
                      {i > 0 && <line x1={penPoints[i - 1].x} y1={penPoints[i - 1].y} x2={p.x} y2={p.y} stroke={BLUE} strokeWidth={1.5} />}
                    </g>
                  ))}
                  {penPreview && penPoints.length > 0 && (
                    <line x1={penPoints[penPoints.length - 1].x} y1={penPoints[penPoints.length - 1].y} x2={penPreview.x} y2={penPreview.y} stroke={BLUE} strokeWidth={1.5} strokeDasharray="4 3" />
                  )}
                </svg>
              )}
            </div>
          </div>
        ))}

        {isPenTool && (
          <div className="pen-toolbar" onClick={(e) => e.stopPropagation()}>
            <span>{penPoints.length} 个锚点</span>
            <button onClick={commitPen} disabled={penPoints.length < 2}>完成</button>
            <button onClick={cancelPen}>取消</button>
          </div>
        )}

        {isDrawTool && state.activeTool === 'frame' && (
          <div className="frame-preset-bar" onClick={(e) => e.stopPropagation()}>
            <span>画板尺寸</span>
            <select value={framePreset?.label ?? ''} onChange={(e) => setFramePreset(FRAME_PRESETS.find((p) => p.label === e.target.value) ?? null)}>
              <option value="">拖拽自定义</option>
              {FRAME_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="canvas-controls" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: zoom - 10 })}><Icon name="minus" /></button>
        <span>{zoom}%</span>
        <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: zoom + 10 })}><Icon name="plus" /></button>
        <button onClick={fitCanvas} title="适应画布"><Icon name="fit" /></button>
      </div>

      <div className="canvas-coordinates">
        {selectedNode ? `X ${selectedNode.x + selectedOffset.x}　Y ${selectedNode.y + selectedOffset.y}` : `选中 ${selectedId ?? '无'}`}
      </div>
    </main>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** 拖拽落点插入组件：复用组件库模板（带 component 标记），并以落点为中心 */
function buildComponentLayer(templateId: string, x: number, y: number): LayerNode {
  const node = buildComponent(templateId, 0, 0)
  node.x = Math.max(0, x - node.width / 2)
  node.y = Math.max(0, y - node.height / 2)
  return node
}
