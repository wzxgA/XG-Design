import { useRef, useState } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { Icon } from '../common/brand'
import { isComponentNode } from '../../utils/layers'
import { renderComponentChildren } from '../../fixtures/component-library'
import { renderChartSvg } from '../../utils/chart'
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
export function CanvasObject({ node, state, dispatch, drawing = false, readOnly = false, passive = false }: Props) {
  const startRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)
  const movedRef = useRef(false)
  const demo = usePreviewDemo()
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

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    opacity: node.style.opacity ?? 1,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    cursor: node.locked ? 'default' : 'pointer',
    pointerEvents: passive ? 'none' : undefined,
  }

  const onPointerDown = (e: React.PointerEvent) => {
    // 绘制/钢笔模式：不拦截，让事件冒泡到画板空白处理（绘制工具需要覆盖在对象上）
    if (drawing) return
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
    startRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: node.x, y: node.y }
    movedRef.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
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
    startRef.current = null
  }

  const base: React.DOMAttributes<HTMLDivElement> = passive ? {} : {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }

  // 组件节点可能不带落盘 children（如 AI 生成的 children: []），isComponentNode 命中即进入组件渲染分支
  if (node.children.length > 0 || isComponent) {
    // 预览交互模式（demo.enabled）：命中注册表的组件叠加 DOM 覆盖控件
    const spec = demo.enabled && isComponent ? INTERACTIVE_COMPONENTS[node.component ?? ''] : undefined
    // 开关视觉由覆盖 props 驱动：预览态内存值 > 节点 componentProps（未交互时保持默认）
    const toggleValue = spec?.kind === 'toggle'
      ? (node.id in demo.values ? !!demo.values[node.id] : !!node.componentProps?.on)
      : undefined
    const overrides = spec?.kind === 'toggle' ? { on: toggleValue } : undefined
    // 组件优先用 componentProps + 模板 render 实时计算子节点（fallback 到落盘的 node.children）
    const children = isComponent ? (renderComponentChildren(node, demoState, overrides) ?? node.children) : node.children
    const dimmed = isComponent && (demoState ?? node.componentState ?? 'default') === 'disabled'
    // CO-6：容器插槽内容（componentSlots 引用的子节点）叠加渲染进组件内
    const slotIds = new Set(Object.values(node.componentSlots ?? {}).flat())
    const slotChildren = isComponent ? node.children.filter((c) => slotIds.has(c.id)) : []
    return (
      <div
        className={`canvas-group ${outline}`}
        style={dimmed ? { ...style, opacity: (Number(style.opacity ?? 1)) * 0.55 } : style}
        data-component-id={isComponent ? node.id : undefined}
        {...base}
      >
        {children.map((child) => <CanvasObject key={child.id} node={child} state={state} dispatch={dispatch} drawing={drawing} readOnly={readOnly} passive={passive || isComponent} />)}
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
          className={`canvas-rect ${outline}`}
          style={{
            ...style,
            background: node.style.fillGradient
              ? `linear-gradient(${node.style.fillGradient.angle ?? 0}deg, ${node.style.fillGradient.from}, ${node.style.fillGradient.to})`
              : (node.style.fill ?? RECT_FILL),
            borderRadius: node.style.cornerRadius ?? 0,
            border: node.style.stroke ? `${node.style.strokeWidth ?? 1}px solid ${node.style.stroke}` : undefined,
            boxShadow: node.style.shadow,
          }}
          {...base}
        />
      )

    case 'path':
      return <CanvasPath node={node} style={style} outline={outline} base={base} />

    case 'text':
      return <CanvasText node={node} style={style} outline={outline} base={base} state={state} dispatch={dispatch} readOnly={readOnly} />

    case 'comment':
      // 预览模式由 CommentPins 接管，避免重复
      if (drawing) return null
      return <CanvasComment node={node} style={style} outline={outline} base={base} state={state} dispatch={dispatch} readOnly={readOnly} />

    case 'chart': {
      const svg = renderChartSvg(node)
      return (
        <div className={`canvas-chart ${outline}`} style={style} {...base}>
          {svg ? (
            <div className="canvas-chart-svg" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span className="canvas-chart-empty">↗</span>
          )}
        </div>
      )
    }

    case 'image':
      return <CanvasImage node={node} style={style} outline={outline} base={base} />


    default:
      return null
  }
}

function CanvasPath({ node, style, outline, base }: {
  node: LayerNode
  style: React.CSSProperties
  outline: string
  base: React.DOMAttributes<HTMLDivElement>
}) {
  const pts = node.points ?? []
  if (pts.length === 0) return null
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <div className={`canvas-path ${outline}`} style={style} {...base}>
      <svg width={node.width} height={node.height} viewBox={`0 0 ${node.width} ${node.height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <polyline
          points={poly}
          fill="none"
          stroke={node.style.stroke ?? BLUE}
          strokeWidth={node.style.strokeWidth ?? 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function CanvasImage({ node, style, outline, base }: {
  node: LayerNode
  style: React.CSSProperties
  outline: string
  base: React.DOMAttributes<HTMLDivElement>
}) {
  // 未设置图片时显示灰色占位（背景色取自 style.fill）
  const src = node.imageUrl
  return (
    <div
      className={`canvas-image ${outline}`}
      style={{
        ...style,
        background: src ? undefined : (node.style.fill ?? IMAGE_PLACEHOLDER),
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
  base: React.DOMAttributes<HTMLDivElement>
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
}

function CanvasText({ node, style, outline, base, state, dispatch, readOnly = false }: TextProps) {
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
  base: React.DOMAttributes<HTMLDivElement>
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
}

function CanvasComment({ node, style, outline, base, state, dispatch, readOnly = false }: CommentProps) {
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
    <div className={`canvas-comment ${outline}`} style={style} {...base}>
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
