import type { LayerNode } from '../../types/design'
import { runDirectionalAnimation, smartAnimateFrame, cancelAllAnimations, getDefaultDuration, resolveEasing } from '../../utils/proto-animate'
import type { DemoStep } from './tutorialContent'

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

export interface DemoPlayerDeps {
  /** 演示场景根容器（DemoStage 的 .demo-stage DOM） */
  stage: HTMLElement
  /** 取场景中任意节点的最新数据（propsCycle 合并 / smart animate 需要） */
  getNode: (id: string) => LayerNode | undefined
  /** 更新场景节点数据（触发 React 重渲染，propsCycle / text / state 用） */
  updateNode: (id: string, patch: Record<string, unknown>) => void
}

/** DemoStep patch 键 → 可插值 CSS 属性（其余键忽略） */
function cssKey(k: string): string | null {
  switch (k) {
    case 'fill': case 'backgroundColor': return 'background-color'
    case 'cornerRadius': return 'border-radius'
    case 'opacity': return 'opacity'
    case 'shadow': return 'box-shadow'
    case 'color': case 'fontColor': return 'color'
    case 'stroke': return 'border-color'
    case 'strokeWidth': return 'border-width'
    case 'fontSize': return 'font-size'
    case 'fontWeight': return 'font-weight'
    case 'width': return 'width'
    case 'height': return 'height'
    default: return null
  }
}

/**
 * 教程演示播放器：按脚本（DemoStep[]）自动顺序播放，支持循环 / 取消 / 重放。
 * 复用在预览 / 原型中打磨过的动画原语（WAAPI、runDirectionalAnimation、smartAnimateFrame），
 * 与编辑器渲染（CanvasObject）共用同一批 DOM，不在动画期间重复 mount。
 */
export class DemoPlayer {
  private deps: DemoPlayerDeps
  private cancelled = false
  private baseOpacities = new Map<string, number>()

  constructor(deps: DemoPlayerDeps) {
    this.deps = deps
  }

  /** 立即设置初始可见性（首个 frame 显示，其余隐藏），避免首帧堆叠闪烁 */
  prime(): void {
    const frames = this.deps.stage.querySelectorAll<HTMLElement>('[data-demo-frame]')
    frames.forEach((el, i) => {
      el.style.display = i === 0 ? 'block' : 'none'
      el.style.opacity = ''
      el.dataset.visible = i === 0 ? '1' : '0'
      el.scrollTop = 0
    })
  }

  /** 启动播放（非阻塞） */
  run(script: DemoStep[]): void {
    this.cancelled = false
    this.play(script)
  }

  private async play(script: DemoStep[]): Promise<void> {
    await this.resetState()
    let i = 0
    while (!this.cancelled) {
      if (i >= script.length) {
        i = 0
        await this.resetState()
        continue
      }
      const step = script[i]
      if (step.type === 'loop') {
        i = 0
        await this.resetState()
        continue
      }
      try {
        await this.exec(step)
      } catch {
        // 播放被取消 / 动画中断时忽略
      }
      i += 1
    }
  }

  /** 取消当前播放并复位场景 */
  stop(): void {
    this.cancelled = true
    cancelAllAnimations(this.deps.stage)
  }

  // —— 基础工具 ——

  private byId(id: string): HTMLElement | null {
    return this.deps.stage.querySelector(`[data-demo-id="${id}"]`)
  }

  private frameEl(id: string): HTMLElement | null {
    return this.deps.stage.querySelector(`[data-demo-frame="${id}"]`)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, ms))
  }

  private baseOpacity(el: HTMLElement): number {
    const id = el.getAttribute('data-demo-id')
    if (!id) return 1
    if (!this.baseOpacities.has(id)) {
      // 记录节点在数据中的初始可见性（opacity 0 = 初始隐藏，show 时揭示为 1）
      const v = el.style.opacity
      this.baseOpacities.set(id, v === '' || v == null ? 1 : (parseFloat(v) || 0))
    }
    return this.baseOpacities.get(id)!
  }

  private async anim(el: HTMLElement, kf: Keyframe[], opts: KeyframeAnimationOptions): Promise<void> {
    const a = el.animate(kf, opts)
    try {
      await a.finished
    } catch {
      // 取消时忽略
    }
  }

  private setBackdrop(on: boolean): void {
    const bd = this.deps.stage.querySelector<HTMLElement>('.demo-backdrop')
    if (!bd) return
    bd.style.opacity = on ? '1' : '0'
    bd.style.pointerEvents = on ? 'auto' : 'none'
  }

  /** 复位：恢复首帧可见、清除动画与高亮、恢复初始透明度 */
  private async resetState(): Promise<void> {
    const frames = this.deps.stage.querySelectorAll<HTMLElement>('[data-demo-frame]')
    frames.forEach((el, i) => {
      cancelAllAnimations(el)
      el.style.display = i === 0 ? 'block' : 'none'
      el.style.opacity = ''
      el.dataset.visible = i === 0 ? '1' : '0'
      el.scrollTop = 0
    })
    this.deps.stage.querySelectorAll('.demo-highlight').forEach((el) => el.classList.remove('demo-highlight'))
    this.setBackdrop(false)
    this.deps.stage.querySelectorAll<HTMLElement>('[data-demo-id]').forEach((el) => {
      const id = el.getAttribute('data-demo-id')
      if (id && this.baseOpacities.has(id)) {
        cancelAllAnimations(el)
        el.style.opacity = String(this.baseOpacities.get(id))
      }
    })
  }

  // —— 指令执行 ——

  private async exec(step: DemoStep): Promise<void> {
    switch (step.type) {
      case 'wait':
        await this.delay(step.ms)
        return
      case 'show': {
        for (const id of step.ids) {
          const el = this.byId(id)
          if (!el) continue
          const base = this.baseOpacity(el)
          const target = base > 0 ? base : 1 // 数据初始 opacity 0 的节点：show 揭示为不透明
          el.style.opacity = '0'
          await this.anim(el, [{ opacity: 0 }, { opacity: target }], { duration: step.ms ?? 420, easing: EASE, fill: 'forwards' })
        }
        return
      }
      case 'highlight': {
        const els = step.ids.map((id) => this.byId(id)).filter((e): e is HTMLElement => !!e)
        els.forEach((el) => el.classList.add('demo-highlight'))
        await this.delay(step.hold ?? 1000)
        els.forEach((el) => el.classList.remove('demo-highlight'))
        return
      }
      case 'move': {
        const el = this.byId(step.id)
        if (!el) return
        const sx = parseFloat(el.style.left) || 0
        const sy = parseFloat(el.style.top) || 0
        await this.anim(
          el,
          [{ left: `${sx}px`, top: `${sy}px` }, { left: `${step.x}px`, top: `${step.y}px` }],
          { duration: step.ms ?? 500, easing: EASE, fill: 'forwards' },
        )
        return
      }
      case 'style': {
        const el = this.byId(step.id)
        if (!el) return
        const from: Record<string, string> = {}
        const to: Record<string, string> = {}
        for (const [k, v] of Object.entries(step.patch)) {
          const ck = cssKey(k)
          if (!ck) continue
          const cur = getComputedStyle(el).getPropertyValue(ck)
          from[ck] = cur || (k === 'opacity' ? '1' : '')
          to[ck] = String(v)
        }
        await this.anim(el, [from, to], { duration: step.ms ?? 500, easing: EASE, fill: 'forwards' })
        return
      }
      case 'text':
        // 直接重渲染内容（文本节点 id 稳定，DOM 复用）
        this.deps.updateNode(step.id, { content: step.content })
        await this.delay(step.ms ?? 500)
        return
      case 'state':
        this.deps.updateNode(step.id, { componentState: step.state })
        await this.delay(step.hold ?? 900)
        return
      case 'propsCycle': {
        const node = this.deps.getNode(step.id)
        if (!node) return
        for (const preset of step.presets) {
          if (this.cancelled) return
          this.deps.updateNode(step.id, {
            componentProps: { ...(node.componentProps ?? {}), ...preset },
            ...(typeof preset.width === 'number' ? { width: preset.width } : {}),
            ...(typeof preset.height === 'number' ? { height: preset.height } : {}),
          })
          await this.delay(step.hold ?? 900)
        }
        return
      }
      case 'grow': {
        // 组件内"填充"元素：取组件节点最后一个矩形子层做宽度插值（进度条填充条）
        const el = this.byId(step.id)
        if (!el) return
        const rects = el.querySelectorAll<HTMLElement>('.canvas-rect')
        const fill = rects[rects.length - 1]
        if (!fill) return
        const cur = fill.getBoundingClientRect().width
        await this.anim(fill, [{ width: `${cur}px` }, { width: `${step.to}px` }], { duration: step.ms ?? 700, easing: EASE, fill: 'forwards' })
        return
      }
      case 'chartGrow': {
        // 柱状图逐柱生长：SVG 几何属性在 Chromium 中可经 CSS 过渡动画
        const el = this.byId(step.id)
        if (!el) return
        const svg = el.querySelector<SVGSVGElement>('.canvas-chart-svg svg')
        if (!svg) return
        const rects = [...svg.querySelectorAll<SVGRectElement>('rect')]
        if (rects.length === 0) return
        const ms = step.ms ?? 700
        rects.forEach((r) => {
          const ty = parseFloat(r.getAttribute('y') ?? '0')
          const th = parseFloat(r.getAttribute('height') ?? '0')
          r.style.transition = 'none'
          r.style.height = '0px'
          r.style.y = `${ty + th}px`
        })
        await this.delay(40)
        const done = Promise.all(rects.map((r) => {
          const ty = parseFloat(r.getAttribute('y') ?? '0')
          const th = parseFloat(r.getAttribute('height') ?? '0')
          r.style.transition = `height ${ms}ms ${EASE}, y ${ms}ms ${EASE}`
          r.style.height = `${th}px`
          r.style.y = `${ty}px`
          return new Promise<void>((res) => window.setTimeout(res, ms))
        }))
        await done
        return
      }
      case 'scroll': {
        const wrap = this.frameEl(step.id)
        if (!wrap) return
        // 实际滚动容器是 frame 内部的 .canvas-group（overflow 由 CanvasObject 按 node.overflow 设置）
        const el = wrap.querySelector<HTMLElement>('.canvas-group') ?? wrap
        await new Promise<void>((res) => {
          el.scrollTo({ top: step.dy, behavior: 'smooth' })
          window.setTimeout(res, step.ms ?? 900)
        })
        await this.delay(400)
        el.scrollTo({ top: 0, behavior: 'smooth' })
        await this.delay(step.ms ?? 700)
        return
      }
      case 'transition':
        await this.execTransition(step)
        return
      default:
        return
    }
  }

  private async execTransition(step: Extract<DemoStep, { type: 'transition' }>): Promise<void> {
    const { from, to, mode } = step
    const srcEl = this.frameEl(from)
    const dstEl = this.frameEl(to)
    if (!srcEl || !dstEl) return
    const srcData = this.deps.getNode(from)
    const dstData = this.deps.getNode(to)
    const viewport = {
      width: dstEl.clientWidth || dstData?.width || 300,
      height: dstEl.clientHeight || dstData?.height || 260,
    }
    // —— Overlay 浮层：开/关切换（dst 当前隐藏则打开，可见则关闭）——
    if (mode === 'overlay') {
      const open = dstEl.dataset.visible !== '1'
      if (!open) {
        cancelAllAnimations(dstEl)
        await this.anim(dstEl, [{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: 'translate(0,24px)' }], { duration: step.ms ?? 220, easing: EASE, fill: 'forwards' })
        dstEl.style.display = 'none'
        dstEl.dataset.visible = '0'
        this.setBackdrop(false)
      } else {
        this.setBackdrop(true)
        dstEl.style.display = 'block'
        dstEl.style.opacity = ''
        cancelAllAnimations(dstEl)
        await this.anim(dstEl, [{ opacity: 0, transform: 'translate(0,24px)' }, { opacity: 1, transform: 'translate(0,0)' }], { duration: step.ms ?? 260, easing: EASE, fill: 'forwards' })
        dstEl.dataset.visible = '1'
      }
      return
    }
    // —— 普通转场：src/dst 都可见后执行，结束后隐藏 src ——
    srcEl.style.display = 'block'
    srcEl.style.opacity = ''
    cancelAllAnimations(srcEl)
    dstEl.style.display = 'block'
    dstEl.style.opacity = ''
    cancelAllAnimations(dstEl)
    const duration = step.ms ?? getDefaultDuration(mode === 'smart' ? 'smart' : mode)
    const easing = resolveEasing('easeInOut')
    if (mode === 'smart' && srcData && dstData) {
      await smartAnimateFrame(srcData, dstData, srcEl, dstEl, { duration, easing })
    } else {
      await runDirectionalAnimation(srcEl, dstEl, viewport, { transition: mode, direction: 'left', duration, easing: 'easeInOut' })
    }
    srcEl.style.display = 'none'
    srcEl.dataset.visible = '0'
    dstEl.dataset.visible = '1'
  }
}
