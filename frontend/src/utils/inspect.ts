import type { LayerNode, DesignDocument } from '../types/design'
import { MUTED } from '../constants/colors'

/** 生成图层的 CSS 片段（递归输出子节点） */
export function toCss(node: LayerNode): string {
  const lines: string[] = []
  lines.push(`.${node.name.replace(/\s+/g, '-').toLowerCase() || 'layer'} {`)
  lines.push(`  position: absolute;`)
  lines.push(`  left: ${node.x}px;`)
  lines.push(`  top: ${node.y}px;`)
  lines.push(`  width: ${node.width}px;`)
  lines.push(`  height: ${node.height}px;`)
  if (node.style.opacity !== undefined) lines.push(`  opacity: ${node.style.opacity};`)
  if (node.style.cornerRadius) lines.push(`  border-radius: ${node.style.cornerRadius}px;`)
  if (node.type === 'rectangle' || node.type === 'frame') {
    if (node.style.fillGradient) {
      lines.push(`  background: linear-gradient(${node.style.fillGradient.angle ?? 0}deg, ${node.style.fillGradient.from}, ${node.style.fillGradient.to});`)
    } else {
      const bg = node.type === 'frame' ? (node.style.backgroundColor ?? node.style.fill) : node.style.fill
      if (bg) lines.push(`  background-color: ${bg};`)
    }
    if (node.style.stroke) lines.push(`  border: ${node.style.strokeWidth ?? 1}px solid ${node.style.stroke};`)
    if (node.style.shadow) lines.push(`  box-shadow: ${node.style.shadow};`)
  }
  if (node.type === 'text') {
    lines.push(`  color: ${node.style.fontColor ?? node.style.color ?? MUTED};`)
    lines.push(`  font-size: ${node.style.fontSize ?? 14}px;`)
    lines.push(`  font-weight: ${node.style.fontWeight ?? 400};`)
    lines.push(`  content: "${node.content ?? node.name}";`)
  }
  if (node.type === 'image') {
    if (node.imageUrl) {
      lines.push(`  background-image: url("${node.imageUrl}");`)
      lines.push(`  background-size: contain;`)
      lines.push(`  background-position: center;`)
      lines.push(`  background-repeat: no-repeat;`)
    }
    if (node.style.fill) lines.push(`  background-color: ${node.style.fill};`)
  }
  lines.push('}')
  // 递归输出子节点 CSS
  if ((node.type === 'group' || node.type === 'frame') && node.children.length > 0) {
    for (const child of node.children) {
      lines.push('')
      lines.push(toCss(child))
    }
  }
  return lines.join('\n')
}

/** 生成图层的 JSON 数据片段（包含子节点） */
export function toJson(node: LayerNode): string {
  return JSON.stringify({
    id: node.id,
    type: node.type,
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    visible: node.visible,
    locked: node.locked,
    style: node.style,
    content: node.content,
    imageUrl: node.imageUrl,
    componentProps: node.componentProps,
    chartBars: node.chartBars,
    chartType: node.chartType,
    chartColors: node.chartColors,
    chartLabels: node.chartLabels,
    chartShowValue: node.chartShowValue,
    chartShowLegend: node.chartShowLegend,
    chartShowAxis: node.chartShowAxis,
    chartSeries: node.chartSeries,
    children: node.children.length > 0 ? node.children : undefined,
  }, null, 2)
}

export type DesignIssue = 'text-overflow' | 'hidden-or-locked' | 'out-of-board' | 'empty-name' | 'low-contrast'

export interface InspectIssue {
  type: DesignIssue
  message: string
}

/** 设计检查规则：对单个图层返回问题列表 */
export function checkLayer(node: LayerNode, board: { width: number; height: number } | undefined): InspectIssue[] {
  const issues: InspectIssue[] = []

  if (node.name.trim() === '') {
    issues.push({ type: 'empty-name', message: '图层名称为空' })
  }
  if (!node.visible) {
    issues.push({ type: 'hidden-or-locked', message: '图层当前被隐藏' })
  }
  if (node.locked) {
    issues.push({ type: 'hidden-or-locked', message: '图层已被锁定' })
  }
  if (board) {
    if (node.x < 0 || node.y < 0 || node.x + node.width > board.width || node.y + node.height > board.height) {
      issues.push({ type: 'out-of-board', message: '图层超出画板边界' })
    }
  }
  // 文本内容可能超出其容器宽度
  if (node.type === 'text' && node.content && node.content.length * (node.style.fontSize ?? 14) > node.width) {
    issues.push({ type: 'text-overflow', message: '文本可能超出容器宽度' })
  }
  // 递归检查子节点（子节点坐标是相对父节点，不检查画板边界）
  for (const child of node.children) {
    issues.push(...checkLayer(child, undefined))
  }

  return issues
}
