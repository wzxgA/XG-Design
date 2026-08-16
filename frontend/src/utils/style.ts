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
    : `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stopXml}</linearGradient>`
  return { defs, url: `url(#${id})` }
}

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
