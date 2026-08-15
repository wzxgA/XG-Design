import type { LayerNode } from '../types/design'

/** 默认色板（CO-2） */
export const DEFAULT_CHART_COLORS = ['#4e8ff4', '#3bc78c', '#f4b400', '#ea4335', '#9c27b0', '#26a69a', '#ff7043', '#78909c']

interface ChartOpts {
  w: number
  h: number
  type: NonNullable<LayerNode['chartType']>
  series: number[][]
  colors: string[]
  labels: string[]
  showValue: boolean
  showLegend: boolean
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * 生成图表内联 SVG（画布与导出共用，保证一致）。
 * 旧文档（无 chartType）按 bar + 默认色板渲染。
 */
export function renderChartSvg(node: LayerNode): string {
  const series = node.chartSeries && node.chartSeries.length > 0
    ? node.chartSeries
    : (node.chartBars && node.chartBars.length > 0 ? [node.chartBars] : [])
  if (series.length === 0) return ''
  const opts: ChartOpts = {
    w: Math.max(node.width, 10),
    h: Math.max(node.height, 10),
    type: node.chartType ?? 'bar',
    series,
    colors: node.chartColors && node.chartColors.length > 0 ? node.chartColors : DEFAULT_CHART_COLORS,
    labels: node.chartLabels ?? [],
    showValue: !!node.chartShowValue,
    showLegend: !!node.chartShowLegend,
  }
  const parts: string[] = []
  switch (opts.type) {
    case 'pie':
    case 'donut':
      parts.push(renderPie(opts))
      break
    case 'line':
    case 'area':
      parts.push(renderLine(opts))
      break
    default:
      parts.push(renderBar(opts))
      break
  }
  const legend = opts.showLegend ? renderLegend(opts) : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.w}" height="${opts.h}" viewBox="0 0 ${opts.w} ${opts.h}" style="display:block">${parts.join('')}${legend}</svg>`
}

/** 布局：图例占顶部 */
function layout(opts: ChartOpts) {
  const legendH = opts.showLegend ? 14 : 0
  return { top: legendH, bottom: opts.h, legendH }
}

function renderBar(opts: ChartOpts): string {
  const { top, bottom } = layout(opts)
  const dataCount = Math.max(...opts.series.map((s) => s.length))
  const max = Math.max(...opts.series.flat(), 1)
  const groupW = opts.w / dataCount
  const seriesCount = opts.series.length
  const barW = Math.max(Math.min((groupW / seriesCount) * 0.8, 28), 1)
  const parts: string[] = []
  opts.series.forEach((series, s) => {
    const seriesColor = opts.colors[s % opts.colors.length]
    series.forEach((v, i) => {
      // 单系列：逐柱独立配色（colors[i]）；多系列：按系列取色
      const color = opts.series.length === 1 ? opts.colors[i % opts.colors.length] : seriesColor
      const h = (v / max) * (bottom - top)
      const x = i * groupW + (groupW - barW * seriesCount) / 2 + s * barW
      const y = bottom - h
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="1.5"/>`)
      if (opts.showValue && h >= 3) {
        parts.push(`<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 2).toFixed(1)}" font-size="8" fill="#8a969b" text-anchor="middle">${Math.round(v)}</text>`)
      }
    })
  })
  return parts.join('')
}

function renderLine(opts: ChartOpts): string {
  const { top, bottom } = layout(opts)
  const dataCount = Math.max(...opts.series.map((s) => s.length))
  const max = Math.max(...opts.series.flat(), 1)
  const parts: string[] = []
  const xOf = (i: number) => dataCount <= 1 ? opts.w / 2 : (i / (dataCount - 1)) * opts.w
  opts.series.forEach((series, s) => {
    const color = opts.colors[s % opts.colors.length]
    const pts = series.map((v, i) => `${xOf(i).toFixed(1)},${(bottom - (v / max) * (bottom - top)).toFixed(1)}`)
    if (opts.type === 'area') {
      const area = `<polygon points="0,${bottom.toFixed(1)} ${pts.join(' ')} ${opts.w},${bottom.toFixed(1)}" fill="${color}" opacity="0.15"/>`
      parts.push(area)
    }
    parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`)
    series.forEach((v, i) => {
      parts.push(`<circle cx="${xOf(i).toFixed(1)}" cy="${(bottom - (v / max) * (bottom - top)).toFixed(1)}" r="2.5" fill="#fff" stroke="${color}" stroke-width="1.5"/>`)
      if (opts.showValue) {
        parts.push(`<text x="${xOf(i).toFixed(1)}" y="${(bottom - (v / max) * (bottom - top) - 5).toFixed(1)}" font-size="8" fill="#8a969b" text-anchor="middle">${Math.round(v)}</text>`)
      }
    })
  })
  return parts.join('')
}

function renderPie(opts: ChartOpts): string {
  const { top, bottom } = layout(opts)
  const data = opts.series[0]
  const total = data.reduce((a, b) => a + b, 0)
  if (total <= 0) return ''
  const cx = opts.w / 2
  const cy = (top + bottom) / 2
  const r = Math.max((Math.min(opts.w, bottom - top) / 2) - 4, 2)
  const parts: string[] = []
  if (opts.type === 'donut') {
    // 环形：stroke-dasharray 分段
    const ringR = r * 0.8
    const sw = r * 0.55
    const C = 2 * Math.PI * ringR
    let offset = 0
    data.forEach((v, i) => {
      const seg = (v / total) * C
      const color = opts.colors[i % opts.colors.length]
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${Math.max(seg - 1.5, 0.5)} ${C - Math.max(seg - 1.5, 0.5)}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`)
      offset += seg
    })
  } else {
    let start = -90
    data.forEach((v, i) => {
      const angle = (v / total) * 360
      const a1 = (start * Math.PI) / 180
      const a2 = ((start + angle) * Math.PI) / 180
      const x1 = cx + r * Math.cos(a1)
      const y1 = cy + r * Math.sin(a1)
      const x2 = cx + r * Math.cos(a2)
      const y2 = cy + r * Math.sin(a2)
      const large = angle > 180 ? 1 : 0
      const color = opts.colors[i % opts.colors.length]
      parts.push(`<path d="M ${cx},${cy} L ${x1.toFixed(1)},${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${color}"/>`)
      start += angle
    })
    // 数值标注：扇形外
    if (opts.showValue) {
      let start2 = -90
      data.forEach((v, i) => {
        const angle = (v / total) * 360
        const mid = ((start2 + angle / 2) * Math.PI) / 180
        const lx = cx + (r + 8) * Math.cos(mid)
        const ly = cy + (r + 8) * Math.sin(mid)
        parts.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="8" fill="#8a969b" text-anchor="middle">${Math.round((v / total) * 100)}%</text>`)
        start2 += angle
      })
    }
  }
  return parts.join('')
}

function renderLegend(opts: ChartOpts): string {
  const parts: string[] = []
  let x = 4
  const n = opts.series.length
  for (let i = 0; i < n; i++) {
    const color = opts.colors[i % opts.colors.length]
    const label = (opts.labels && opts.labels[i]) || `系列${i + 1}`
    parts.push(`<rect x="${x}" y="3" width="8" height="8" rx="2" fill="${color}"/>`)
    parts.push(`<text x="${x + 11}" y="${10}" font-size="8" fill="#8a969b">${esc(label.length > 8 ? label.slice(0, 8) + '…' : label)}</text>`)
    x += 11 + Math.min(label.length, 8) * 8 + 10
  }
  return parts.join('')
}
