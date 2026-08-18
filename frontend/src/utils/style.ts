import type { LayerStyle } from '../types/design'

/**
 * 图层样式工具：统一生成 CSS 背景 / SVG 渐变 / 特效 class。
 */

/** 由 LayerStyle 生成 CSS background 字符串（线性多色 / 径向），无渐变返回 undefined */
export function backgroundOf(style: LayerStyle): string | undefined {
  const g = style.fillGradient
  if (!g) return undefined
  const stops = gradientStopsCss(g)
  if (g.type === 'radial') {
    return `radial-gradient(circle, ${stops})`
  }
  return `linear-gradient(${g.angle ?? 0}deg, ${stops})`
}

/** 渐变 stops 的 CSS 片段：多色 stops（缺省 position 均分）> from/to 双色 */
function gradientStopsCss(g: NonNullable<LayerStyle['fillGradient']>): string {
  const stops = g.stops
  if (stops && stops.length >= 2) {
    const parts = stops.map((s) => {
      if (s.position !== undefined) return `${s.color} ${s.position}%`
      return s.color
    })
    // CSS 多色渐变按 stops 顺序自动均分（未给 position 时）
    return parts.join(', ')
  }
  return `${g.from}, ${g.to}`
}

/**
 * 由 LayerStyle 生成统一 CSS background（画布/导出用）。
 * 优先级：渐变 fillGradient → backgroundColor → fill；与缩略图/导出三端保持一致。
 */
export function backgroundCss(style: LayerStyle): string | undefined {
  const g = backgroundOf(style)
  if (g) return g
  if (style.backgroundColor) return style.backgroundColor
  if (style.fill) return style.fill
  return undefined
}

/** 生成 SVG 渐变（缩略图用），返回 defs 片段与 url 引用；无渐变返回 null */
export function svgGradientOf(style: LayerStyle, id: string): { defs: string; url: string } | null {
  const g = style.fillGradient
  if (!g) return null
  const stops = g.stops && g.stops.length >= 2 ? g.stops : null
  const n = stops ? stops.length : 2
  const stopXml = stops
    ? stops
        .map((s, i) => `<stop offset="${s.position ?? Math.round((i / (n - 1)) * 100)}%" stop-color="${s.color}"/>`)
        .join('')
    : `<stop offset="0%" stop-color="${g.from}"/><stop offset="100%" stop-color="${g.to}"/>`
  const defs = g.type === 'radial'
    ? `<radialGradient id="${id}" cx="50%" cy="50%" r="70%">${stopXml}</radialGradient>`
    : `<linearGradient id="${id}" x1="${lx1(g)}" y1="${ly1(g)}" x2="${lx2(g)}" y2="${ly2(g)}">${stopXml}</linearGradient>`
  return { defs, url: `url(#${id})` }
}

/**
 * 线性渐变端点换算：与 CSS linear-gradient(angle deg, ...) 语义对齐。
 * CSS 角度从 12 点方向顺时针计，渐变线方向向量为 (sinθ, -cosθ)：
 * 0°=下→上、90°=左→右、180°=上→下、270°=右→左（颜色从起点流向终点）。
 * SVG 用 (x1,y1)→(x2,y2) 表示（左上角原点、y 向下）。端点映射为渐变线两端的单位坐标。
 */
function gradientVector(g: NonNullable<LayerStyle['fillGradient']>): { dx: number; dy: number } {
  const rad = ((g.angle ?? 0) * Math.PI) / 180
  return { dx: Math.sin(rad), dy: -Math.cos(rad) }
}
function lx1(g: NonNullable<LayerStyle['fillGradient']>): number { return 0.5 - gradientVector(g).dx / 2 }
function ly1(g: NonNullable<LayerStyle['fillGradient']>): number { return 0.5 - gradientVector(g).dy / 2 }
function lx2(g: NonNullable<LayerStyle['fillGradient']>): number { return 0.5 + gradientVector(g).dx / 2 }
function ly2(g: NonNullable<LayerStyle['fillGradient']>): number { return 0.5 + gradientVector(g).dy / 2 }

/** 由 effects 生成特效 CSS class 列表（仅 playEffects 时播放动画；画布编辑态静态不附加） */
export function effectClasses(style: LayerStyle, playEffects: boolean): string {
  if (!playEffects || !style.effects) return ''
  const e = style.effects
  const classes: string[] = []
  if (e.flow) classes.push('effect-flow')
  if (e.shimmer) classes.push('effect-shimmer')
  if (e.glow) classes.push('effect-glow')
  return classes.join(' ')
}
