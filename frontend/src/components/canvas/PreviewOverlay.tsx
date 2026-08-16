import { useState } from 'react'
import type { EditorState } from '../../state/editor-store'
import type { LayerNode, PrototypeLink } from '../../types/design'
import { CanvasObject } from './CanvasObject'
import { PreviewDemoContext } from './preview-demo'
import { Icon } from '../common/brand'

interface Props {
  state: EditorState
  onClose: () => void
}

function findLink(state: EditorState, layerId: string): PrototypeLink | undefined {
  return state.document.prototypeLinks.find((l) => l.sourceLayerId === layerId)
}

/** 递归渲染所有带原型连接节点的热点（按累积偏移定位） */
function HotspotLayer({ node, offsetX, offsetY, state, onNavigate }: {
  node: LayerNode
  offsetX: number
  offsetY: number
  state: EditorState
  onNavigate: (link: PrototypeLink) => void
}) {
  const absX = offsetX + node.x
  const absY = offsetY + node.y
  const link = findLink(state, node.id)

  return (
    <>
      {link && (
        <div
          className="hotspot"
          style={{ position: 'absolute', left: absX, top: absY, width: node.width, height: node.height }}
          title={`跳转到 ${state.document.pages.find((p) => p.id === link.targetPageId)?.name ?? ''}`}
          onClick={(e) => { e.stopPropagation(); onNavigate(link) }}
        />
      )}
      {node.children.map((child) => (
        <HotspotLayer key={child.id} node={child} offsetX={absX} offsetY={absY} state={state} onNavigate={onNavigate} />
      ))}
    </>
  )
}

/** 递归渲染所有评论 pin（按累积偏移定位），悬停显示只读气泡 */
function CommentPins({ node, offsetX, offsetY }: { node: LayerNode; offsetX: number; offsetY: number }) {
  const absX = offsetX + node.x
  const absY = offsetY + node.y
  const isComment = node.type === 'comment'
  const [hover, setHover] = useState(false)
  return (
    <>
      {isComment && (
        <div
          className="preview-comment-pin"
          style={{ left: absX, top: absY, width: node.width, height: node.height }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <span className="comment-pin">💬</span>
          {hover && (
            <div className="comment-bubble read-only">
              <div className="comment-bubble-head"><strong>评论</strong></div>
              <div className="comment-read-text">{node.content || '(空评论)'}</div>
              {(node.replies ?? []).length > 0 && (
                <div className="comment-replies">
                  {(node.replies ?? []).map((r) => (
                    <div className="comment-reply" key={r.id}>
                      <span className="comment-reply-author">{r.author}</span>
                      <span className="comment-reply-text">{r.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {node.children.map((child) => (
        <CommentPins key={child.id} node={child} offsetX={absX} offsetY={absY} />
      ))}
    </>
  )
}

/** 递归渲染组件状态徽标（演示模式下显示当前 hover/pressed 状态） */
function StateBadges({ node, offsetX, offsetY, hoveredId, pressedId }: {
  node: LayerNode
  offsetX: number
  offsetY: number
  hoveredId: string | null
  pressedId: string | null
}) {
  const absX = offsetX + node.x
  const absY = offsetY + node.y
  const state = pressedId === node.id ? 'pressed' : hoveredId === node.id ? 'hover' : null
  return (
    <>
      {node.component && state && (
        <div
          className="preview-state-badge"
          style={{ left: absX, top: absY, width: node.width, height: node.height }}
        >
          <span>{state}</span>
        </div>
      )}
      {node.children.map((child) => (
        <StateBadges key={child.id} node={child} offsetX={absX} offsetY={absY} hoveredId={hoveredId} pressedId={pressedId} />
      ))}
    </>
  )
}

/** 只读预览层：支持原型连接跳转与返回；一页多画板平铺渲染；支持组件状态演示 */
export function PreviewOverlay({ state, onClose }: Props) {
  const [pageId, setPageId] = useState(state.document.activePageId)
  const [history, setHistory] = useState<string[]>([])
  const [demo, setDemo] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pressedId, setPressedId] = useState<string | null>(null)
  // 预览交互值（内存态，退出预览即丢弃，不写回文档）
  const [values, setValues] = useState<Record<string, unknown>>({})
  const onValue = (id: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [id]: value }))

  const page = state.document.pages.find((p) => p.id === pageId)!
  const frames = page.children.filter((n) => n.type === 'frame') as LayerNode[]

  const navigate = (link: PrototypeLink) => {
    setHistory((h) => [...h, pageId])
    setPageId(link.targetPageId)
  }

  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setPageId(prev)
      return h.slice(0, -1)
    })
  }

  const noop = () => {}

  // 平铺布局：按 frame 坐标排布，横向流式（gap 48px）
  let cursorX = 0
  const placed = frames.map((frame) => {
    const item = { frame, left: cursorX }
    cursorX += frame.width + 48
    return item
  })

  // 演示模式：悬停/按下组件时定位到最近组件节点
  const componentIdFrom = (e: React.MouseEvent) => {
    if (!demo) return null
    const el = (e.target as HTMLElement).closest('[data-component-id]')
    return el ? el.getAttribute('data-component-id') : null
  }

  return (
    <div className="preview-overlay">
      <div className="preview-toolbar">
        <div className="preview-nav">
          <button className="preview-back" onClick={goBack} disabled={history.length === 0} title="返回上一页"><Icon name="chevron" /></button>
          <span className="preview-title">{frames.length > 0 ? frames[0].name : page.name}</span>
        </div>
        <div className="preview-actions">
          <button
            className={`preview-demo-btn ${demo ? 'active' : ''}`}
            onClick={() => { setDemo((d) => !d); setHoveredId(null); setPressedId(null) }}
            title={demo ? '退出交互演示' : '开启交互演示：输入框可输入、开关可切换、按钮可点击'}
          >
            <Icon name="cursor" /> 交互演示
          </button>
          <button className="preview-close" onClick={onClose}><Icon name="external" /> 退出预览</button>
        </div>
      </div>
      <PreviewDemoContext.Provider value={{ enabled: demo, hoveredId, pressedId, values, onValue, playEffects: true }}>
        <div
          className="preview-stage"
          onMouseOver={(e) => { const id = componentIdFrom(e); if (id !== null) setHoveredId(id) }}
          onMouseDown={(e) => { const id = componentIdFrom(e); if (id !== null) setPressedId(id) }}
          onMouseUp={() => { if (demo) setPressedId(null) }}
          onMouseLeave={() => { if (demo) { setHoveredId(null); setPressedId(null) } }}
        >
          {frames.length > 0 ? (
            <div className="preview-boards" style={{ width: cursorX - 48 }}>
              {placed.map(({ frame, left }) => (
                <div key={frame.id} className="preview-board" style={{ left, width: frame.width, height: frame.height }}>
                  <CanvasObject node={{ ...frame, x: 0, y: 0 }} state={{ ...state, selectedIds: [], activeTool: 'select' }} dispatch={noop} drawing readOnly />
                  {demo && (
                    <StateBadges node={frame} offsetX={0} offsetY={0} hoveredId={hoveredId} pressedId={pressedId} />
                  )}
                  {frame.children.map((child) => (
                    <HotspotLayer key={child.id} node={child} offsetX={0} offsetY={0} state={state} onNavigate={navigate} />
                  ))}
                  <CommentPins node={frame} offsetX={0} offsetY={0} />
                </div>
              ))}
            </div>
          ) : (
            <div className="preview-empty">空画板</div>
          )}
        </div>
      </PreviewDemoContext.Provider>
    </div>
  )
}
