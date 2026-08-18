/**
 * 高保真原型方向动画 / 缓动解析工具。
 * 负责 directional animations (moveIn / moveOut / push / fade) 的 WAAPI 执行。
 * Smart Animate 在后续阶段实现。
 */

import type { Transition, Direction, Easing, LayerNode } from '../types/design'
import { backgroundCss } from './style'

export const DIR_VECTOR: Record<Direction, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  none: { x: 0, y: 0 },
}

/**
 * Resolve easing to CSS cubic-bezier string for WAAPI.
 * spring uses simplified cubic-bezier to avoid introducing physics engine.
 */
export function resolveEasing(
  easing: Easing | undefined,
  bezier?: [number, number, number, number]
): string {
  switch (easing) {
    case 'linear':
      return 'linear'
    case 'easeIn':
      return 'cubic-bezier(0.4, 0, 1, 1)'
    case 'easeOut':
      return 'cubic-bezier(0, 0, 0.2, 1)'
    case 'easeInOut':
    case undefined:
      return 'cubic-bezier(0.4, 0, 0.2, 1)'
    case 'spring':
      // Simplified spring-like curve, no physics engine needed
      return 'cubic-bezier(0.5, 1.5, 0.5, 1)'
    case 'customBezier':
      return bezier ? `cubic-bezier(${bezier.join(',')})` : 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
}

/**
 * Get default duration for given transition type in milliseconds.
 */
export function getDefaultDuration(transition: Transition): number {
  switch (transition) {
    case 'instant':
      return 0
    case 'fade':
    case 'dissolve':
      return 300
    case 'moveIn':
    case 'moveOut':
    case 'push':
    case 'slide':
      return 400
    case 'smart':
      return 500
    case 'overlay':
      return 240
  }
}

interface DirectionalOptions {
  transition: Transition
  direction?: Direction
  duration?: number
  easing?: Easing
  easingBezier?: [number, number, number, number]
}

/**
 * Run directional transition animation using WAAPI.
 * @param sourceFrameEl - Source frame DOM element (current visible)
 * @param destFrameEl - Destination frame DOM element (target to go)
 * @param viewport - Viewport dimensions for directional offsets
 * @param opts - Transition options from PrototypeLink
 * @returns Promise that resolves when animation finishes
 */
export async function runDirectionalAnimation(
  sourceFrameEl: HTMLElement,
  destFrameEl: HTMLElement,
  viewport: { width: number; height: number },
  opts: DirectionalOptions
): Promise<void> {
  const { transition, direction, duration, easing, easingBezier } = opts
  const dir = DIR_VECTOR[direction ?? (transition === 'slide' ? 'left' : 'left')]
  const actualDuration = duration ?? getDefaultDuration(transition)
  const cssEasing = resolveEasing(easing, easingBezier)

  if (actualDuration === 0) {
    // instant: no animation
    return Promise.resolve()
  }

  const animations: Animation[] = []

  if (transition === 'moveIn' || transition === 'fade' || transition === 'dissolve') {
    // Only destination animates, source fades out static
    const startX = dir.x * viewport.width
    const startY = dir.y * viewport.height

    if (transition === 'fade' || transition === 'dissolve') {
      // Just cross-fade
      animations.push(
        destFrameEl.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: actualDuration, easing: cssEasing, fill: 'forwards' }
        )
      )
      animations.push(
        sourceFrameEl.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: actualDuration, easing: cssEasing, fill: 'forwards' }
        )
      )
    } else {
      // moveIn: destination slides in from direction, source fades out
      animations.push(
        destFrameEl.animate(
          [
            { transform: `translate(${startX}px, ${startY}px)`, opacity: 0 },
            { transform: 'translate(0, 0)', opacity: 1 },
          ],
          { duration: actualDuration, easing: cssEasing, fill: 'forwards' }
        )
      )
      animations.push(
        sourceFrameEl.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: actualDuration, easing: cssEasing, fill: 'forwards' }
        )
      )
    }
  } else if (transition === 'moveOut') {
    // Only source slides out in direction, destination fades in
    const endX = dir.x * viewport.width
    const endY = dir.y * viewport.height
    animations.push(
      sourceFrameEl.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: `translate(${endX}px, ${endY}px)` },
        ],
        { duration: actualDuration, easing: cssEasing, fill: 'forwards' }
      )
    )
    animations.push(
      destFrameEl.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: actualDuration, easing: cssEasing, fill: 'forwards' }
      )
    )
  } else if (transition === 'push' || transition === 'slide') {
    // Both animate: source pushed out opposite direction, destination pushed in from direction
    // slide is compatible alias for push with direction left by default
    const dirPush = transition === 'slide' ? DIR_VECTOR.left : dir
    const offsetX = dirPush.x * viewport.width
    const offsetY = dirPush.y * viewport.height

    animations.push(
      sourceFrameEl.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: `translate(${-offsetX}px, ${-offsetY}px)` },
        ],
        { duration: actualDuration, easing: cssEasing, fill: 'forwards' }
      )
    )
    animations.push(
      destFrameEl.animate(
        [
          { transform: `translate(${offsetX}px, ${offsetY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: actualDuration, easing: cssEasing, fill: 'forwards' }
      )
    )
  }

  // Wait for all animations to finish
  try {
    await Promise.all(animations.map((a) => a.finished))
  } catch {
    // If animation is cancelled (user navigated again), just resolve
  }
}

/**
 * Cancel all running animations on given elements.
 * Call this before starting new navigation to avoid overlapping.
 */
export function cancelAnimations(el: HTMLElement): void {
  const animations = el.getAnimations()
  animations.forEach((a) => a.cancel())
}

/**
 * Recursively cancel all animations on all child elements.
 */
export function cancelAllAnimations(root: HTMLElement): void {
  cancelAnimations(root)
  root.querySelectorAll('*').forEach((el) => cancelAnimations(el as HTMLElement))
}

/** —— Smart Animate —— */

/** 可见叶子节点的绝对矩形（画布坐标，相对 frame 原点） */
interface LeafRect {
  x: number
  y: number
  width: number
  height: number
  node: LayerNode
}

/**
 * 收集 frame 内所有"可见叶节点"（深度优先，跳过 component 内部子层）。
 * 返回 Map<name, LeafRect>，同 frame 内重名取靠后者。
 */
export function collectLeaves(node: LayerNode | LayerNode[], offsetX = 0, offsetY = 0, out = new Map<string, LeafRect>()): Map<string, LeafRect> {
  const list = Array.isArray(node) ? node : [node]
  for (const n of list) {
    if (n.visible === false) continue
    const x = offsetX + n.x
    const y = offsetY + n.y
    // component 视为整体叶子（内部子层不参与 Smart 逐层匹配）
    const isComponentLeaf = !!n.component
    // 普通容器（group/frame）递归；component 内部子层跳过
    if (!isComponentLeaf && n.children && n.children.length > 0) {
      collectLeaves(n.children, x, y, out)
      // 容器自身若带样式也可作为匹配键（整层插值），MVP 仅处理叶子，跳过容器本身
      if (n.type === 'frame') out.set(n.name, { x, y, width: n.width, height: n.height, node: n })
    } else {
      out.set(n.name, { x, y, width: n.width, height: n.height, node: n })
    }
  }
  return out
}

/** 从已渲染 DOM 收集带 data-layer-name 的元素 → Map<name, HTMLElement>（同 name 取靠后者） */
export function collectLeafEls(root: HTMLElement): Map<string, HTMLElement> {
  const out = new Map<string, HTMLElement>()
  root.querySelectorAll<HTMLElement>('[data-layer-name]').forEach((el) => {
    const name = el.getAttribute('data-layer-name')
    if (name) out.set(name, el)
  })
  return out
}

/** 提取可插值的视觉样式（CSS 可动画属性） */
interface VisualProps {
  backgroundColor?: string
  borderRadius?: number | string
  opacity?: number
  color?: string
}

function visualProps(node: LayerNode): VisualProps {
  const s = node.style ?? {}
  const p: VisualProps = {}
  const bg = backgroundCss(s)
  if (bg) p.backgroundColor = bg
  if (s.cornerRadius !== undefined && s.cornerRadius !== null) p.borderRadius = s.cornerRadius
  if (s.opacity !== undefined) p.opacity = s.opacity
  if (s.fontColor) p.color = s.fontColor
  else if (s.color) p.color = s.color
  return p
}

interface SmartOptions {
  duration: number
  easing: string
}

/**
 * Smart Animate 整帧过渡。
 * 对源/目标 frame 的同名叶子做位置 + 尺寸 + 颜色 + 圆角 + 不透明度插值。
 * 无匹配 → 源 fadeOut / 目标 fadeIn。
 */
export async function smartAnimateFrame(
  srcFrame: LayerNode,
  dstFrame: LayerNode,
  srcFrameEl: HTMLElement,
  dstFrameEl: HTMLElement,
  opts: SmartOptions
): Promise<void> {
  const { duration, easing } = opts
  const srcLeaves = collectLeaves(srcFrame)
  const dstLeaves = collectLeaves(dstFrame)
  const srcEls = collectLeafEls(srcFrameEl)
  const dstEls = collectLeafEls(dstFrameEl)

  // 只对同时存在于两 map 的 name 做插值
  const matchedNames = new Set([...srcLeaves.keys()].filter((n) => dstLeaves.has(n)))
  const animations: Animation[] = []

  // 目标 frame 每个叶子：有匹配 → 从源位置/样式插值到目标原位/样式；无匹配 → fadeIn
  dstEls.forEach((el, name) => {
    const srcData = srcLeaves.get(name)
    const dstData = dstLeaves.get(name)
    if (srcData && dstData && matchedNames.has(name)) {
      // 目标元素当前在目标 frame 的位置（相对 frame）
      const dstRect = { x: dstData.x, y: dstData.y, width: dstData.width, height: dstData.height }
      const dx = srcData.x - dstRect.x
      const dy = srcData.y - dstRect.y
      const sx = dstRect.width > 0 ? srcData.width / dstRect.width : 1
      const sy = dstRect.height > 0 ? srcData.height / dstRect.height : 1
      const startProps = visualProps(srcData.node)
      const endProps = visualProps(dstData.node)
      animations.push(
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, ...propwise(startProps) },
            { transform: 'translate(0,0) scale(1,1)', ...propwise(endProps) },
          ] as Keyframe[],
          { duration, easing, fill: 'forwards' }
        )
      )
    } else {
      // 目标独有 → fadeIn
      animations.push(
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing, fill: 'forwards' })
      )
    }
  })

  // 源 frame 独有叶子 → fadeOut
  srcEls.forEach((el, name) => {
    if (!matchedNames.has(name)) {
      animations.push(
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing, fill: 'forwards' })
      )
    }
  })

  try {
    await Promise.all(animations.map((a) => a.finished))
  } catch {
    // 导航中断（再次导航 / 退出预览）时忽略
  }
}

/** 将 VisualProps 序列化为中断安全的纯对象（去掉 undefined） */
function propwise(p: VisualProps): Record<string, string | number> {
  const o: Record<string, string | number> = {}
  if (p.backgroundColor) o.backgroundColor = p.backgroundColor
  if (p.borderRadius !== undefined) o.borderRadius = p.borderRadius
  if (p.opacity !== undefined) o.opacity = p.opacity
  if (p.color) o.color = p.color
  return o
}
