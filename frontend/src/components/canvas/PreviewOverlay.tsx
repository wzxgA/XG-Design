import { useState, useEffect, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { EditorState } from '../../state/editor-store'
import type { LayerNode, PageNode, PrototypeLink, Direction, Transition, Easing, OverlayConfig } from '../../types/design'
import { CanvasObject } from './CanvasObject'
import { PreviewDemoContext } from './preview-demo'
import { Icon } from '../common/brand'
import { runDirectionalAnimation, cancelAllAnimations, getDefaultDuration, resolveEasing, smartAnimateFrame, collectLeaves } from '../../utils/proto-animate'

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

/** 按 id 在树中查找 frame（支持嵌套 frame） */
function findFrameById(nodes: LayerNode[], id: string): LayerNode | null {
  for (const n of nodes) {
    if (n.type === 'frame' && n.id === id) return n
    const found = findFrameById(n.children, id)
    if (found) return found
  }
  return null
}

/** 解析目标 frame —— 优先 link.targetFrameId，缺省取目标页第一个 frame */
function resolveTargetFrame(
  targetPage: PageNode,
  link: { targetFrameId?: string }
): LayerNode | null {
  if (link.targetFrameId) {
    const found = findFrameById(targetPage.children, link.targetFrameId)
    if (found) return found
  }
  return targetPage.children.find((n) => n.type === 'frame') ?? null
}

/** 浮层条目：记录浮层内容 frame 与配置 */
interface OverlayEntry {
  id: string
  frame: LayerNode
  config: OverlayConfig
  /** 源 frame 在视口内的坐标（用于 manual 定位的基准） */
  srcRect: { x: number; y: number; width: number; height: number }
}

/** 归一 resolveTargetFrame 结果：坐标归零 + 标记 overlay 不落文档 */
function toOverlayFrame(frame: LayerNode): LayerNode {
  return { ...frame, x: 0, y: 0 }
}

/** 浮层关场简单动画（WAAPI）：fade 或 moveOut bottom */
function instructOutAnim(el: HTMLElement, transition: Transition, duration: number): Promise<void> {
  cancelAllAnimations(el)
  const kf = transition === 'fade'
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: 'translate(0, 24px)' }]
  return el.animate(kf, { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }).finished
    .then(() => {})
    .catch(() => { /* 取消动画时忽略 */ })
}

/** 计算浮层容器定位（相对 overlay 层的左/上，坐标为叠加层内） */
function getOverlayPosition(entry: OverlayEntry): CSSProperties | undefined {
  const c = entry.config
  const fw = entry.frame.width
  const fh = entry.frame.height
  const r = entry.srcRect
  switch (c.position) {
    case 'manual':
      return { left: r.x + (c.offsetX ?? 0), top: r.y + (c.offsetY ?? 0) }
    case 'center':
      return { left: r.x + (r.width - fw) / 2, top: r.y + (r.height - fh) / 2 }
    case 'topLeft':
      return { left: r.x, top: r.y }
    case 'topCenter':
      return { left: r.x + (r.width - fw) / 2, top: r.y }
    case 'topRight':
      return { left: r.x + r.width - fw, top: r.y }
    case 'bottomLeft':
      return { left: r.x, top: r.y + r.height - fh }
    case 'bottomCenter':
      return { left: r.x + (r.width - fw) / 2, top: r.y + r.height - fh }
    case 'bottomRight':
      return { left: r.x + r.width - fw, top: r.y + r.height - fh }
    default:
      return undefined
  }
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
  const [history, setHistory] = useState<Array<{ pageId: string; frameId: string | null }>>([])
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null)
  // 浮层栈：Overlay 模式叠在当页之上，不替换 pageId
  const [overlays, setOverlays] = useState<OverlayEntry[]>([])
  const overlayIdRef = useRef(0)
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
  // 浮层 DOM 元素引用（用于入场/关场动画）
  const overlayElRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  // 过渡中的源/目标 frame 数据（用于渲染过渡层）
  const [transitionData, setTransitionData] = useState<{
    srcFrame: LayerNode
    dstFrame: LayerNode
    link: PrototypeLink
    viewport: { width: number; height: number }
  } | null>(null)

  const page = state.document.pages.find((p) => p.id === pageId)!
  const frames = page.children.filter((n) => n.type === 'frame') as LayerNode[]
  // 当前激活 frame：currentFrameId 优先，缺省/失效回退第一个
  const activeFrame = (currentFrameId
    ? findFrameById(page.children, currentFrameId) ?? frames[0]
    : frames[0]) ?? null

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
        targetFrameId: target.targetFrameId,
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
  }, [pageId, viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // 解析目标 frame —— 优先 link.targetFrameId，缺省取目标页第一个 frame
    const dstFrame = resolveTargetFrame(targetPage, link)

    // —— Overlay 模式：不替换页面，作为浮层叠在当前页之上 ——
    if (link.transition === 'overlay' && dstFrame) {
      const src = activeFrame
      overlayIdRef.current += 1
      const entry: OverlayEntry = {
        id: `overlay-${overlayIdRef.current}`,
        frame: toOverlayFrame(dstFrame),
        config: link.overlay ?? { position: 'center' },
        // 源 frame 归一后占据视口左上（0,0），作为 manual 定位基准
        srcRect: { x: 0, y: 0, width: src?.width ?? dstFrame.width, height: src?.height ?? dstFrame.height },
      }
      setOverlays((prev) => [...prev, entry])
      // 入场动画在渲染后触发（见下方 useEffect）
      return
    }

    // 在 Device 模式下，解析源 frame 和目标 frame 做动画
    const useAnimation = viewMode === 'device' && link.transition !== 'instant'

    if (useAnimation) {
      const srcFrame = resolveSourceFrame(page.children, link.sourceLayerId)
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

          const duration = link.duration ?? getDefaultDuration(link.transition)
          const easing = resolveEasing(link.easing, link.easingBezier)

          if (link.transition === 'smart') {
            // 降级护栏：参与插值的节点总数 > 50 时回退为整帧 fade
            if (collectLeaves(srcFrame).size + collectLeaves(dstFrame).size > 50) {
              await runDirectionalAnimation(
                srcFrameRef.current,
                dstFrameRef.current,
                vp,
                { transition: 'fade', direction: link.direction, duration, easing: link.easing, easingBezier: link.easingBezier }
              )
            } else {
              await smartAnimateFrame(srcFrame, dstFrame, srcFrameRef.current, dstFrameRef.current, { duration, easing })
            }
          } else {
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
    }

    // 提交导航
    if (!skipHistory) {
      setHistory((h) => [...h, { pageId, frameId: currentFrameId }])
    }
    setPageId(link.targetPageId)
    setCurrentFrameId(dstFrame ? dstFrame.id : null)
    setTransitioning(false)
    setTransitionData(null)
  }

  const navigate = (link: PrototypeLink) => {
    navigateTo(link, false)
  }

  const goBack = () => {
    // 有浮层时优先关闭浮层，不回退页面
    if (overlays.length > 0) {
      const top = overlays[overlays.length - 1]
      closeOverlay(top.id)
      return
    }
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setPageId(prev.pageId)
      setCurrentFrameId(prev.frameId)
      return h.slice(0, -1)
    })
  }

  // 关闭指定浮层（播放关场动画后移除）
  const closeOverlay = (id: string, immediate?: boolean) => {
    const entry = overlays.find((o) => o.id === id)
    if (!entry) return
    const finish = () => setOverlays((prev) => prev.filter((o) => o.id !== id))
    if (immediate) { finish(); return }
    const el = overlayElRefs.current.get(id)
    if (!el) { finish(); return }
    const transition = entry.config.closeTransition ?? 'fade'
    const duration = entry.config.closeDuration ?? getDefaultDuration('fade')
    instructOutAnim(el, transition, duration).finally(() => {
      setOverlays((prev) => prev.filter((o) => o.id !== id))
    })
  }

  // ESC 关闭最上层浮层
  useEffect(() => {
    if (overlays.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const top = overlays[overlays.length - 1]
      if (top.config.closeOnEsc) closeOverlay(top.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlays]) // eslint-disable-line react-hooks/exhaustive-deps

  // 浮层入场动画：新加入的浮层播放 moveIn bottom
  useEffect(() => {
    if (overlays.length === 0) return
    const last = overlays[overlays.length - 1]
    const posEl = overlayElRefs.current.get(last.id)?.querySelector('.overlay-frame-pos') as HTMLElement | null
    if (!posEl) return
    cancelAllAnimations(posEl)
    const duration = getDefaultDuration('overlay')
    posEl.animate(
      [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    )
  }, [overlays.length]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <FrameRenderer frame={activeFrame} state={state} onNavigate={navigate} demo={demo} hoveredId={hoveredId} pressedId={pressedId} />
        </div>
      </div>
    )
  }

  return (
    <div className="preview-overlay">
      <div className="preview-toolbar">
        <div className="preview-nav">
          <button className="preview-back" onClick={goBack} disabled={history.length === 0 && overlays.length === 0} title="返回上一页"><Icon name="chevron" /></button>
          <span className="preview-title">{activeFrame ? activeFrame.name : page.name}</span>
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
          {/* 浮层栈：叠在当页之上（仅在 Device 视图渲染） */}
          {overlays.length > 0 && viewMode === 'device' && (
            <div className="preview-overlay-layer">
              {overlays.map((entry, i) => {
                const pos = getOverlayPosition(entry)
                return (
                  <div
                    key={entry.id}
                    className="preview-overlay-entry"
                    data-overlay-index={i}
                    ref={(el) => {
                      if (el) overlayElRefs.current.set(entry.id, el)
                      else overlayElRefs.current.delete(entry.id)
                    }}
                  >
                    {entry.config.backdrop && (
                      <div
                        className="overlay-backdrop"
                        style={{ background: entry.config.backdrop }}
                        onClick={() => { if (entry.config.closeOnBackdrop) closeOverlay(entry.id) }}
                      />
                    )}
                    <div className="overlay-frame-pos" style={pos}>
                      <div className="overlay-frame" style={{ left: 0, top: 0, width: entry.frame.width, height: entry.frame.height }}>
                        <FrameRenderer frame={entry.frame} state={state} onNavigate={navigate} demo={demo} hoveredId={hoveredId} pressedId={pressedId} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
      </PreviewDemoContext.Provider>
    </div>
  )
}