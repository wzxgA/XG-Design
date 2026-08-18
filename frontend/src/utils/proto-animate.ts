/**
 * 高保真原型方向动画 / 缓动解析工具。
 * 负责 directional animations (moveIn / moveOut / push / fade) 的 WAAPI 执行。
 * Smart Animate 在后续阶段实现。
 */

import type { Transition, Direction, Easing } from '../types/design'

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
