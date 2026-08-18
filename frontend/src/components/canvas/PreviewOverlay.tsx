import { useState, useEffect, useRef, useCallback } from 'react'
import type { EditorState } from '../../state/editor-store'
import type { LayerNode, PrototypeLink, Direction, Transition, Easing } from '../../types/design'
import { CanvasObject } from './CanvasObject'
import { PreviewDemoContext } from './preview-demo'
import { Icon } from '../common/brand'
import { runDirectionalAnimation, cancelAllAnimations, getDefaultDuration } from '../../utils/proto-animate'

interface Props {
  state: EditorState
  onClose: () => void
}

function findLink(state: EditorState, layerId: string): PrototypeLink | undefined {
  return state.document.prototypeLinks.find((l) => l.sourceLayerId === layerId)
}

/** 找到 sourceLayerId 所在的顶层 frame */
function resolveSourceFrame(nodes: LayerNode[], sourceLayerId: string): LayerNode | null {
  for (const n of nodes) {
    if (n.type === 'frame') {
      if (n.id === sourceLayerId) return n
      if (findInTree(n, sourceLayerId)) return n
    }
    const found = resolveSourceFrame(n.children, sourceLayerId)
    if (found) return found
  }
  return null
}

function findInTree(node: LayerNode, id: string): boolean {
  if (node.id === id) return true
  return node.children.some((c) => findInTree(c, id))
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
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(link)
          }}
        />
      )}
      {node.children.map((child) => (
        <HotspotLayer key={child.id} node={child} offsetX={absX} offsetY={absY} state={state} onNavigate={onNavigate} />
      ))}
    </>
  )
}

/** 递归渲染所有评论 pin */
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

/** 递归渲染组件状态徽标 */
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

/** 渲染单个 frame 的内容（内部使用 CanvasObject + overlay 内含 HotspotLayer + CommentPins + StateBadges） */
function FrameRenderer({ frame, state, onNavigate, demo, hoveredId, pressedId }: {
  frame: LayerNode
  state: EditorState
  onNavigate: (link: PrototypeLink) => void
  demo: boolean
  hoveredId: string | null
  pressedId: string | null
}) {
  const frameLink = findLink(state, frame.id)
  return (
    <CanvasObject
      node={{ ...frame, x: 0, y: 0 }}
      state={{ ...state, selectedIds: [], activeTool: 'select' }}
      dispatch={noop}
      drawing
      readOnly
      overlay={
        <>
          {demo && (
            <StateBadges node={frame} offsetX={0} offsetY={0} hoveredId={hoveredId} pressedId={pressedId} />
          )}
          {/* frame 自身的热点 */}
          {frameLink && (
            <div
              className="hotspot"
              style={{ position: 'absolute', left: 0, top: 0, width: frame.width, height: frame.height }}
              title={`跳转到 ${state.document.pages.find((p) => p.id === frameLink.targetPageId)?.name ?? ''}`}
              onClick={(e) => { e.stopPropagation(); onNavigate(frameLink) }}
            />
          )}
          {frame.children.map((child) => (
            <HotspotLayer key={child.id} node={child} offsetX={0} offsetY={0} state={state} onNavigate={onNavigate} />
          ))}
          <CommentPins node={frame} offsetX={0} offsetY={0} />
        </>
      }
    />
  )
}

const noop = () => {}

/** 只读预览层：支持 Flow 视图（平铺）和 Device 视图（单 frame 视口）+ 原型动画 */
export function PreviewOverlay({ state, onClose }: Props) {
  const [pageId, setPageId] = useState(state.document.activePageId)
  const [history, setHistory] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'flow' | 'device'>('device')
  const demo = true
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pressedId, setPressedId] = useState<string | null>(null)
  // 预览交互值（内存态，退出预览即丢弃）
  const [values, setValues] = useState<Record<string, unknown>>({})
  const onValue = (id: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [id]: value }))
  // 动画过渡层：源/目标 frame 副本
  const [transitioning, setTransitioning] = useState(false)
  const srcFrameRef = useRef<HTMLDivElement>(null)
  const dstFrameRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  // 过渡中的源/目标 frame 数据（用于渲染过渡层）
  const [transitionData, setTransitionData] = useState<{
    srcFrame: LayerNode
    dstFrame: LayerNode
    link: PrototypeLink
    viewport: { width: number; height: number }
  } | null>(null)

  const page = state.document.pages.find((p) => p.id === pageId)!
  const frames = page.children.filter((n) => n.type === 'frame') as LayerNode[]

  // After Delay 计时器
  const afterDelayTimer = useRef<number | null>(null)
  const afterDelayCancelled = useRef(false)

  // 取消 afterDelay 计时
  const cancelAfterDelay = useCallback(() => {
    afterDelayCancelled.current = true
    if (afterDelayTimer.current !== null) {
      clearTimeout(afterDelayTimer.current)
      afterDelayTimer.current = null
    }
  }, [])

  // 页面级 afterDelay 链接
  const pageAutoLink = page.autoNavigateLink

  // 进入页面时启动 afterDelay 计时
  useEffect(() => {
    // 首先检查当前页是否有热点 afterDelay 链接
    const afterDelayLinks = frames
      .flatMap((f) => collectAfterDelayLinks(f, state))
    // 页面级 autoNavigateLink
    if (pageAutoLink) {
      afterDelayLinks.push({
        sourceLayerId: '',
        targetPageId: pageAutoLink.targetPageId,
        targetFrameId: pageAutoLink.targetFrameId,
        transition: pageAutoLink.transition,
        duration: pageAutoLink.duration,
        easing: pageAutoLink.easing,
        direction: pageAutoLink.direction,
        delay: pageAutoLink.delay,
      })
    }

    if (afterDelayLinks.length === 0) return

    // 取最小的 delay 执行
    const minDelay = Math.min(...afterDelayLinks.map((l) => l.delay ?? 2000))
    const target = afterDelayLinks.find((l) => (l.delay ?? 2000) === minDelay)
    if (!target) return

    afterDelayCancelled.current = false
    afterDelayTimer.current = window.setTimeout(() => {
      if (afterDelayCancelled.current) return
      // 构建一个伪 link 执行导航
      const pseudoLink: PrototypeLink = {
        id: 'auto-nav',
        sourceLayerId: target.sourceLayerId ?? '',
        targetPageId: target.targetPageId,
        trigger: 'afterDelay',
        transition: target.transition as Transition,
        duration: target.duration,
        easing: target.easing as Easing,
        direction: target.direction as Direction,
        delay: target.delay,
      }
      navigateTo(pseudoLink, true)
    }, minDelay)

    return () => {
      afterDelayCancelled.current = true
      if (afterDelayTimer.current !== null) {
        clearTimeout(afterDelayTimer.current)
      }
    }
  }, [pageId]) // eslint-disable-line react-hooks/exhaustive-deps

  const collectAfterDelayLinks = (node: LayerNode, s: EditorState): Array<{
    sourceLayerId: string
    targetPageId: string
    targetFrameId?: string
    transition: Transition
    duration?: number
    easing?: Easing
    direction?: Direction
    delay?: number
  }> => {
    const links: Array<{
      sourceLayerId: string
      targetPageId: string
      targetFrameId?: string
      transition: Transition
      duration?: number
      easing?: Easing
      direction?: Direction
      delay?: number
    }> = []
    const link = s.document.prototypeLinks.find((l) => l.sourceLayerId === node.id)
    if (link && link.trigger === 'afterDelay' && link.delay) {
      links.push({
        sourceLayerId: link.sourceLayerId,
        targetPageId: link.targetPageId,
        targetFrameId: link.targetFrameId,
        transition: link.transition,
        duration: link.duration,
        easing: link.easing,
        direction: link.direction,
        delay: link.delay,
      })
    }
    for (const child of node.children) {
      links.push(...collectAfterDelayLinks(child, s))
    }
    return links
  }

  // 用户交互取消 afterDelay
  const onUserInteraction = useCallback(() => {
    cancelAfterDelay()
  }, [cancelAfterDelay])

  // 监听用户交互取消 afterDelay
  useEffect(() => {
    window.addEventListener('pointerdown', onUserInteraction, { capture: true })
    window.addEventListener('wheel', onUserInteraction, { capture: true })
    window.addEventListener('keydown', onUserInteraction, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', onUserInteraction, { capture: true })
      window.removeEventListener('wheel', onUserInteraction, { capture: true })
      window.removeEventListener('keydown', onUserInteraction, { capture: true })
    }
  }, [onUserInteraction])

  const navigateTo = async (link: PrototypeLink, skipHistory?: boolean) => {
    const targetPage = state.document.pages.find((p) => p.id === link.targetPageId)
    if (!targetPage) return

    // 在 Device 模式下，解析源 frame 和目标 frame 做动画
    const useAnimation = viewMode === 'device' && link.transition !== 'instant'

    if (useAnimation) {
      const srcFrame = resolveSourceFrame(page.children, link.sourceLayerId)
      const dstFrame = targetPage.children.find((n) => n.type === 'frame') ?? targetPage.children[0] as LayerNode | undefined
      if (srcFrame && dstFrame && viewportRef.current) {
        const vp = { width: dstFrame.width, height: dstFrame.height }
        setTransitionData({
          srcFrame: { ...srcFrame, x: 0, y: 0 },
          dstFrame: { ...dstFrame, x: 0, y: 0 },
          link,
          viewport: vp,
        })
        setTransitioning(true)

        // 等待 DOM 渲染过渡层
        await new Promise((r) => requestAnimationFrame(r))
        await new Promise((r) => requestAnimationFrame(r))

        if (srcFrameRef.current && dstFrameRef.current) {
          cancelAllAnimations(srcFrameRef.current)
          cancelAllAnimations(dstFrameRef.current)

          // 运行动画
          const duration = link.duration ?? getDefaultDuration(link.transition)
          await runDirectionalAnimation(
            srcFrameRef.current,
            dstFrameRef.current,
            vp,
            {
              transition: link.transition,
              direction: link.direction,
              duration,
              easing: link.easing,
              easingBezier: link.easingBezier,
            }
          )
        }
      }
    }

    // 提交导航
    if (!skipHistory) {
      setHistory((h) => [...h, pageId])
    }
    setPageId(link.targetPageId)
    setTransitioning(false)
    setTransitionData(null)
  }

  const navigate = (link: PrototypeLink) => {
    navigateTo(link, false)
  }

  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setPageId(prev)
      return h.slice(0, -1)
    })
  }

  // 演示模式：悬停/按下组件时定位到最近组件节点
  const componentIdFrom = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-component-id]')
    return el ? el.getAttribute('data-component-id') : null
  }

  const renderStage = () => {
    if (viewMode === 'flow') {
      if (frames.length === 0) return <div className="preview-empty">空画板</div>
      let cursorX = 0
      const placed = frames.map((frame) => {
        const item = { frame, left: cursorX }
        cursorX += frame.width + 48
        return item
      })
      return (
        <div className="preview-boards" style={{ width: cursorX - 48 }}>
          {placed.map(({ frame, left }) => (
            <div key={frame.id} className="preview-board" style={{ left, width: frame.width, height: frame.height }}>
              <FrameRenderer frame={frame} state={state} onNavigate={navigate} demo={demo} hoveredId={hoveredId} pressedId={pressedId} />
            </div>
          ))}
        </div>
      )
    }
    // Device 视图
    if (frames.length === 0) return <div className="preview-empty">空画板</div>
    if (transitioning && transitionData) {
      return (
        <div className="device-viewport" ref={viewportRef}>
          <div className="device-transition-layer">
            <div className="device-frame device-frame-source" ref={srcFrameRef}>
              <FrameRenderer frame={transitionData.srcFrame} state={state} onNavigate={navigate} demo={false} hoveredId={null} pressedId={null} />
            </div>
            <div className="device-frame device-frame-dest" ref={dstFrameRef}>
              <FrameRenderer frame={transitionData.dstFrame} state={state} onNavigate={navigate} demo={false} hoveredId={null} pressedId={null} />
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="device-viewport" ref={viewportRef}>
        <div className="device-frame device-frame-active">
          <FrameRenderer frame={frames[0]} state={state} onNavigate={navigate} demo={demo} hoveredId={hoveredId} pressedId={pressedId} />
        </div>
      </div>
    )
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
            className={`preview-mode-btn ${viewMode === 'flow' ? 'active' : ''}`}
            onClick={() => setViewMode('flow')}
            title="Flow 视图：平铺当前页所有 frame，适合全局概览。热点跳转直接切换，无过渡动画。"
          >
            Flow
          </button>
          <button
            className={`preview-mode-btn ${viewMode === 'device' ? 'active' : ''}`}
            onClick={() => setViewMode('device')}
            title="Device 视图：单 frame 视口，模拟真机体验。支持 push / moveIn / fade 等过渡动画、overflow 滚动、延时跳转、按键交互。"
          >
            Device
          </button>
          <button className="preview-close" onClick={onClose}><Icon name="external" /> 退出预览</button>
        </div>
      </div>
      <PreviewDemoContext.Provider value={{ enabled: demo, hoveredId, pressedId, values, onValue, playEffects: true }}>
        <div
          className="preview-stage"
          onMouseOver={(e) => { const id = componentIdFrom(e); if (id !== null) setHoveredId(id) }}
          onMouseDown={(e) => { const id = componentIdFrom(e); if (id !== null) setPressedId(id) }}
          onMouseUp={() => setPressedId(null)}
          onMouseLeave={() => { setHoveredId(null); setPressedId(null) }}
        >
          {renderStage()}
          </div>
      </PreviewDemoContext.Provider>
    </div>
  )
}