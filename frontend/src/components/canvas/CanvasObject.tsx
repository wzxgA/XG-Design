import { useEffect, useRef, useState } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { AutoLayout, LayerNode, PathPoint } from '../../types/design'
import { Icon } from '../common/brand'
import { isComponentNode } from '../../utils/layers'
import { renderComponentChildren } from '../../fixtures/component-library'
import { renderChartSvg } from '../../utils/chart'
import { backgroundCss, effectClasses } from '../../utils/style'
import { pathToSvgD, computePathBounds } from '../../utils/path'
import { PathEditor } from './PathEditor'
import { usePreviewDemo } from './preview-demo'
import { INTERACTIVE_COMPONENTS } from './preview-interactions'
import { InteractiveControl } from './InteractiveControl'
import { RECT_FILL, BLUE, IMAGE_PLACEHOLDER, MUTED } from '../../constants/colors'

interface Props {
  node: LayerNode
  state: EditorState
  dispatch: EditorDispatch
  drawing?: boolean
  /** 只读模式：禁用文本双击编辑、评论编辑（预览 / 分享只读场景） */
  readOnly?: boolean
  /** 被动模式：不响应指针事件（组件子节点，交互由组件整体接管） */
  passive?: boolean
  /** Auto Layout 父布局信息：子节点在父内拖拽改为调整顺序 */
  layoutParent?: { al: AutoLayout; siblings: LayerNode[] }
}

function findBoard(state: EditorState): LayerNode | undefined {
  const page = state.document.pages.find((p) => p.id === state.document.activePageId)
  return page?.children.find((n) => n.type === 'frame')
}

/**
 * 数据驱动的画布对象渲染器。
 * 将 LayerNode 树按绝对坐标渲染为 HTML，隐藏节点不渲染，选中节点显示边框。
 * 支持拖拽移动对象（锁定节点不可移动）、Shift 多选、多选整体拖拽。
 */
export function CanvasObject({ node, state, dispatch, drawing = false, readOnly = false, passive = false, layoutParent }: Props) {
  const startRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)
  const movedRef = useRef(false)
  /** Auto Layout 拖拽重排状态：记录起点与当前落点索引（指针相对父坐标） */
  const reorderRef = useRef<{ pointerX: number; pointerY: number; originX: number; originY: number; targetIndex: number | null } | null>(null)
  /** 拖拽视觉跟随偏移（仅本地渲染，不写数据） */
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  /** 路径编辑态：双击 path 图层进入锚点/手柄编辑 */
  const [pathEditing, setPathEditing] = useState(false)
  const demo = usePreviewDemo()
  // 取消选中时自动退出路径编辑态
  useEffect(() => {
    if (!state.selectedIds.includes(node.id)) setPathEditing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedIds, node.id])
  // 预览演示态（CO-4）：临时覆盖组件交互状态；disabled 视觉变淡
  const demoState = demo.enabled && isComponentNode(node)
    ? (demo.pressedId === node.id ? 'pressed' : demo.hoveredId === node.id ? 'hover' : 'default')
    : undefined

  if (!node.visible) return null

  const selected = state.selectedIds.includes(node.id)
  const multiSelected = selected && state.selectedIds.length > 1
  const useSelectionBox = selected && node.children.length === 0 && !node.locked && !multiSelected
  const outline = selected && !useSelectionBox ? 'canvas-selected' : ''
  const scale = state.zoom / 100
  // 选择工具下 hover 图层统一显示手型，避免出现形似十字的四向移动箭头；锁定节点显示默认箭头
  const isComponent = isComponentNode(node)
  // 流光特效：仅预览模式播放动画（画布编辑态静态）
  const fx = effectClasses(node.style, demo.playEffects)

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    opacity: node.style.opacity ?? 1,
    transform: [
      node.rotation ? `rotate(${node.rotation}deg)` : '',
      dragOffset ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` : '',
    ].join(' ').trim() || undefined,
    cursor: node.locked ? 'default' : 'pointer',
    pointerEvents: passive ? 'none' : undefined,
  }

  const onPointerDown = (e: React.PointerEvent) => {
    // 绘制/钢笔模式：不拦截，让事件冒泡到画板空白处理（绘制工具需要覆盖在对象上）
    if (drawing) return
    // 中键：不选中不移动，冒泡到画布容器触发平移（与"中键=平移画布"惯例一致）
    if (e.button === 1) return
    e.stopPropagation()
    if (node.locked) {
      dispatch({ type: 'SELECT_LAYERS', ids: [node.id] })
      return
    }
    // Shift 点击：增删选择；否则单选
    const targetIds = e.shiftKey
      ? state.selectedIds.includes(node.id)
        ? state.selectedIds.filter((id) => id !== node.id)
        : [...state.selectedIds, node.id]
      : [node.id]
    dispatch({ type: 'SELECT_LAYERS', ids: targetIds })
    if (targetIds.length === 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    // Auto Layout 父内：拖拽改为调整顺序（不移动坐标）
    if (layoutParent) {
      reorderRef.current = { pointerX: e.clientX, pointerY: e.clientY, originX: node.x, originY: node.y, targetIndex: null }
      setDragOffset({ dx: 0, dy: 0 })
      return
    }
    startRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: node.x, y: node.y }
    movedRef.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const r = reorderRef.current
    if (r && layoutParent) {
      const dx = (e.clientX - r.pointerX) / scale
      const dy = (e.clientY - r.pointerY) / scale
      setDragOffset({ dx, dy })
      const isH = layoutParent.al.direction === 'horizontal'
      const mainPos = isH ? r.originX + dx : r.originY + dy
      r.targetIndex = computeReorderIndex(layoutParent.al, layoutParent.siblings, node.id, mainPos)
      return
    }
    const start = startRef.current
    if (!start) return
    let dx = (e.clientX - start.pointerX) / scale
    let dy = (e.clientY - start.pointerY) / scale
    // 多选时以当前节点位移驱动整组移动（节点间相对位置保持不变）
    const ids = state.selectedIds.includes(node.id) && state.selectedIds.length > 1 ? state.selectedIds : [node.id]
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      if (!movedRef.current) dispatch({ type: 'BEGIN_MOVE', ids })
      movedRef.current = true
    }
    // 基础吸附：吸附到画板边缘与中线
    const targetX = start.x + dx
    const targetY = start.y + dy
    const board = findBoard(state)
    if (board && !node.locked) {
      const SNAP = 6
      const frameW = board.width
      const frameH = board.height
      const alignsX = [board.x, board.x + frameW / 2 - node.width / 2, board.x + frameW - node.width]
      for (const a of alignsX) {
        if (Math.abs(targetX - a) < SNAP) { dx += a - targetX; break }
      }
      const alignsY = [board.y, board.y + frameH / 2 - node.height / 2, board.y + frameH - node.height]
      for (const a of alignsY) {
        if (Math.abs(targetY - a) < SNAP) { dy += a - targetY; break }
      }
    }
    dispatch({ type: 'MOVE_LAYERS', ids, dx: dx - (node.x - start.x), dy: dy - (node.y - start.y) })
  }

  const onPointerUp = () => {
    const r = reorderRef.current
    if (r && layoutParent) {
      const selfIdx = layoutParent.siblings.findIndex((s) => s.id === node.id)
      if (r.targetIndex != null && r.targetIndex !== selfIdx) {
        dispatch({ type: 'REORDER_TO_INDEX', id: node.id, targetIndex: r.targetIndex })
      }
      reorderRef.current = null
      setDragOffset(null)
      return
    }
    startRef.current = null
  }

  const base: React.DOMAttributes<HTMLDivElement> = passive ? {} : {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }

  // 组件节点可能不带落盘 children（如 AI 生成的 children: []），isComponentNode 命中即进入组件渲染分支；
  // 空 group/frame（当色块用的容器）也按容器渲染，避免 return null 导致消失
  if (node.type === 'group' || node.type === 'frame' || node.children.length > 0 || isComponent) {
    // 非组件容器（group/frame）补画背景；组件视觉由模板 render 子节点承担，节点自身 style 不画
    const containerBg = isComponent ? undefined : backgroundCss(node.style)
    const containerStyle = containerBg ? { ...style, background: containerBg } : style
    // 预览交互模式（demo.enabled）：命中注册表的组件叠加 DOM 覆盖控件
    const spec = demo.enabled && isComponent ? INTERACTIVE_COMPONENTS[node.component ?? ''] : undefined
    // 开关视觉由覆盖 props 驱动：预览态内存值 > 节点 componentProps（未交互时保持默认）
    const toggleValue = spec?.kind === 'toggle'
      ? (node.id in demo.values ? !!demo.values[node.id] : !!node.componentProps?.on)
      : undefined
    // 输入类组件：隐藏组件内占位文字（input 覆盖层的 placeholder 承担显示）
    const overrides = spec?.kind === 'toggle' ? { on: toggleValue }
      : spec?.kind === 'text' ? { placeholder: '' }
      : undefined
    // 组件优先用 componentProps + 模板 render 实时计算子节点（fallback 到落盘的 node.children）
    const rawChildren = isComponent ? (renderComponentChildren(node, demoState, overrides) ?? node.children) : node.children
    // 交互模式下输入类组件去掉占位 text 节点，避免与输入内容重叠
    const children = spec?.kind === 'text' ? rawChildren.filter((c) => c.type !== 'text') : rawChildren
    const dimmed = isComponent && (demoState ?? node.componentState ?? 'default') === 'disabled'
    // CO-6：容器插槽内容（componentSlots 引用的子节点）叠加渲染进组件内
    const slotIds = new Set(Object.values(node.componentSlots ?? {}).flat())
    const slotChildren = isComponent ? node.children.filter((c) => slotIds.has(c.id)) : []
    return (
      <div
        className={`canvas-group ${outline} ${fx}`}
        style={dimmed ? { ...containerStyle, opacity: (Number(containerStyle.opacity ?? 1)) * 0.55 } : containerStyle}
        data-component-id={isComponent ? node.id : undefined}
        {...base}
      >
        {children.map((child) => <CanvasObject key={child.id} node={child} state={state} dispatch={dispatch} drawing={drawing} readOnly={readOnly} passive={passive || isComponent} layoutParent={node.autoLayout && !isComponent ? { al: node.autoLayout, siblings: children } : undefined} />)}
        {slotChildren.map((child) => <CanvasObject key={child.id} node={child} state={state} dispatch={dispatch} drawing={drawing} readOnly={readOnly} passive={passive || isComponent} />)}
        {spec && (
          <InteractiveControl
            spec={spec}
            node={node}
            value={demo.values[node.id]}
            onChange={(v) => demo.onValue(node.id, v)}
          />
        )}
      </div>
    )
  }

  switch (node.type) {
    case 'rectangle':
      return (
        <div
          className={`canvas-rect ${outline} ${fx}`}
          style={{
            ...style,
            background: backgroundCss(node.style) ?? RECT_FILL,
            borderRadius: node.style.cornerRadius ?? 0,
            border: node.style.stroke ? `${node.style.strokeWidth ?? 1}px solid ${node.style.stroke}` : undefined,
            boxShadow: node.style.shadow,
          }}
          {...base}
        />
      )

    case 'path':
      if (pathEditing && !drawing && !readOnly) {
        return (
          <PathEditor
            node={node}
            scale={scale}
            onCommit={(pts: PathPoint[], closed: boolean) => {
              // 以编辑后的包围盒重新归一化：保持路径视觉位置不变，尺寸贴合新边界
              const bb = computePathBounds(pts)
              const rebased = pts.map((p) => ({ ...p, x: p.x - bb.minX, y: p.y - bb.minY }))
              dispatch({
                type: 'UPDATE_LAYER_PROPERTIES',
                ids: [node.id],
                patch: {
                  points: rebased,
                  pathClosed: closed,
                  x: node.x + bb.minX,
                  y: node.y + bb.minY,
                  width: Math.max(1, bb.maxX - bb.minX),
                  height: Math.max(1, bb.maxY - bb.minY),
                },
              })
              setPathEditing(false)
            }}
            onCancel={() => setPathEditing(false)}
          />
        )
      }
      return (
        <CanvasPath
          node={node}
          style={style}
          outline={outline}
          fx={fx}
          base={base}
          onEdit={() => { if (!drawing && !readOnly && !node.locked) setPathEditing(true) }}
        />
      )

    case 'text':
      return <CanvasText node={node} style={style} outline={outline} fx={fx} base={base} state={state} dispatch={dispatch} readOnly={readOnly} />

    case 'comment':
      // 预览模式由 CommentPins 接管，避免重复
      if (drawing) return null
      return <CanvasComment node={node} style={style} outline={outline} fx={fx} base={base} state={state} dispatch={dispatch} readOnly={readOnly} />

    case 'chart': {
      const svg = renderChartSvg(node)
      return (
        <div className={`canvas-chart ${outline} ${fx}`} style={style} {...base}>
          {svg ? (
            <div className="canvas-chart-svg" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span className="canvas-chart-empty">↗</span>
          )}
        </div>
      )
    }

    case 'image':
      return <CanvasImage node={node} style={style} outline={outline} fx={fx} base={base} />


    default:
      return null
  }
}

/** Auto Layout 拖拽落点索引：按主轴方向比较 mainPos 落在哪个兄弟之前（返回插入到该索引前） */
function computeReorderIndex(al: AutoLayout, siblings: LayerNode[], selfId: string, mainPos: number): number {
  const isH = al.direction === 'horizontal'
  const selfIdx = siblings.findIndex((s) => s.id === selfId)
  let idx = siblings.length - 1
  for (let i = 0; i < siblings.length; i++) {
    if (i === selfIdx) continue
    const m = isH ? siblings[i].x + siblings[i].width / 2 : siblings[i].y + siblings[i].height / 2
    if (m > mainPos) {
      idx = i
      break
    }
  }
  return idx
}

function CanvasPath({ node, style, outline, fx, base, onEdit }: {
  node: LayerNode
  style: React.CSSProperties
  outline: string
  fx: string
  base: React.DOMAttributes<HTMLDivElement>
  onEdit?: () => void
}) {
  const pts = node.points ?? []
  if (pts.length === 0) return null
  const d = pathToSvgD(pts, node.pathClosed)
  return (
    <div
      className={`canvas-path ${outline} ${fx}`}
      style={style}
      {...base}
      onDoubleClick={(e) => { if (onEdit) { e.stopPropagation(); onEdit() } }}
    >
      <svg width={node.width} height={node.height} viewBox={`0 0 ${node.width} ${node.height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <path
          d={d}
          fill={node.style.fill ?? 'none'}
          stroke={node.style.stroke ?? BLUE}
          strokeWidth={node.style.strokeWidth ?? 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function CanvasImage({ node, style, outline, fx, base }: {
  node: LayerNode
  style: React.CSSProperties
  outline: string
  fx: string
  base: React.DOMAttributes<HTMLDivElement>
}) {
  // 未设置图片时显示灰色占位（背景色取自 style.fill）
  const src = node.imageUrl
  return (
    <div
      className={`canvas-image ${outline} ${fx}`}
      style={{
        ...style,
        background: src ? undefined : (backgroundCss(node.style) ?? IMAGE_PLACEHOLDER),
        borderRadius: node.style.cornerRadius ?? 0,
        overflow: node.style.cornerRadius ? 'hidden' : undefined,
      }}
      {...base}
    >
      {src ? (
        <img
          src={src}
          alt={node.name}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: node.style.objectFit ?? 'contain',
            display: 'block',
          }}
        />
      ) : (
        <span className="canvas-image-empty"><Icon name="image" /></span>
      )}
    </div>
  )
}

interface TextProps {
  node: LayerNode
  style: React.CSSProperties
  outline: string
  fx: string
  base: React.DOMAttributes<HTMLDivElement>
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
}

function CanvasText({ node, style, outline, fx, base, state, dispatch, readOnly = false }: TextProps) {
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
      className={`canvas-text ${outline} ${fx}`}
      style={{
        ...style,
        color: node.style.fontColor ?? node.style.color ?? MUTED,
        fontSize: node.style.fontSize ?? 14,
        fontWeight: node.style.fontWeight ?? 400,
        lineHeight: '1.2',
        textAlign: node.style.textAlign ?? 'left',
        justifyContent:
          node.style.textAlign === 'center' ? 'center'
          : node.style.textAlign === 'right' ? 'flex-end'
          : 'flex-start',
      }}
      {...base}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (!node.locked && !readOnly) {
          setDraft(node.content ?? node.name)
          setEditing(true)
        }
      }}
    >
      {node.content ?? node.name}
    </div>
  )
}

interface CommentProps {
  node: LayerNode
  style: React.CSSProperties
  outline: string
  fx: string
  base: React.DOMAttributes<HTMLDivElement>
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
}

function CanvasComment({ node, style, outline, fx, base, state, dispatch, readOnly = false }: CommentProps) {
  const [draft, setDraft] = useState(node.content ?? '')
  const [replyDraft, setReplyDraft] = useState('')
  const scale = state.zoom / 100
  const selected = state.selectedIds.includes(node.id)

  // 选中时展示气泡（只读模式仅展示内容与回复，不可编辑）
  const showBubble = selected

  const commitContent = () => {
    if (readOnly) return
    if (draft !== (node.content ?? '')) {
      dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { content: draft, name: draft || '评论' } })
    }
  }

  const addReply = () => {
    const text = replyDraft.trim()
    if (!text) return
    dispatch({
      type: 'ADD_COMMENT_REPLY',
      commentId: node.id,
      reply: { id: `r-${Date.now().toString(36)}`, author: '我', content: text, createdAt: Date.now() },
    })
    setReplyDraft('')
  }

  return (
    <div className={`canvas-comment ${outline} ${fx}`} style={style} {...base}>
      <span className="comment-pin">{selected ? '💬' : '●'}</span>
      {showBubble && (
        <div className="comment-bubble" style={{ transform: `scale(${1 / scale})` }}>
          <div className="comment-bubble-head">
            <strong>评论</strong>
            <button className="comment-close" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_LAYERS', ids: [] }) }}>✕</button>
          </div>
          {readOnly ? (
            <div className="comment-read-text">{node.content || '(空评论)'}</div>
          ) : (
            <textarea
              className="comment-edit-input"
              value={draft}
              rows={2}
              placeholder="输入评论…"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitContent}
              onPointerDown={(e) => e.stopPropagation()}
            />
          )}
          {(node.replies ?? []).length > 0 && (
            <div className="comment-replies">
              {(node.replies ?? []).map((r) => (
                <div className="comment-reply" key={r.id}>
                  <span className="comment-reply-author">{r.author}</span>
                  <span className="comment-reply-text">{r.content}</span>
                  {!readOnly && (
                    <button
                      className="comment-reply-del"
                      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_COMMENT_REPLY', commentId: node.id, replyId: r.id }) }}
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="comment-reply-input-row">
              <input
                className="comment-reply-input"
                value={replyDraft}
                placeholder="回复…"
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addReply() } }}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <button className="comment-reply-add" onClick={(e) => { e.stopPropagation(); addReply() }}>发送</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
