import type { LayerNode } from '../../types/design'
import { isComponentNode } from '../../utils/layers'
import { svgGradientOf } from '../../utils/style'
import { renderComponentChildren } from '../../fixtures/component-library'

interface Props {
  layers: LayerNode[]
  width?: number
  height?: number
}

interface Bounds {
  minX: number; minY: number; maxX: number; maxY: number
}

/** 用 SVG 渲染图层数组为缩略图预览 */
export function DesignThumbnail({ layers, width = 300, height = 150 }: Props) {
  // 展平所有图层为绝对坐标
  const safeLayers = Array.isArray(layers) ? layers : []
  const flat = flatten(safeLayers)
  if (flat.length === 0) {
    return <div className="ai-thumb-empty" style={{ width, height }}>空设计</div>
  }

  const bounds = calcBounds(flat)
  const w = Math.max(1, bounds.maxX - bounds.minX)
  const h = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(width / w, height / h) * 0.9
  const offsetX = (width - w * scale) / 2 - bounds.minX * scale
  const offsetY = (height - h * scale) / 2 - bounds.minY * scale

  return (
    <svg width={width} height={height} className="ai-design-thumbnail">
      <defs>
        {flat.map((node, i) => {
          const g = svgGradientOf(node.style, `xg-thumb-g-${i}`)
          return g ? <g key={i} dangerouslySetInnerHTML={{ __html: g.defs }} /> : null
        })}
      </defs>
      {flat.map((node, i) => renderNode(node, scale, offsetX, offsetY, i))}
    </svg>
  )
}

/** 顶层多个 frame（AI 多界面）时按 frame 拆分为多页（每页一个界面），否则单组 */
export function splitFrames(layers: LayerNode[]): LayerNode[][] {
  if (layers.length >= 2 && layers.every((n) => n.type === 'frame')) {
    return layers.map((f) => [f])
  }
  return [layers]
}

interface FlatLayer extends LayerNode {
  absX: number
  absY: number
}

function flatten(layers: LayerNode[], ox = 0, oy = 0): FlatLayer[] {
  const result: FlatLayer[] = []
  for (const n of layers) {
    const comp = isComponentNode(n)
    // 组件节点自身不绘制（视觉由模板 render 子节点承担），与画布/导出保持一致；
    // 否则组件节点自带的 style.fill 会画成一个背景矩形，导致缩略图与画布不一致
    if (!comp) {
      result.push({ ...n, absX: ox + n.x, absY: oy + n.y })
    }
    // AI 生成的 JSON 可能省略 children 字段，递归时兜底为 []
    // 组件节点展开实时子节点（renderComponentChildren 返回 null 时回退落盘 children）
    const children = comp ? (renderComponentChildren(n) ?? n.children ?? []) : (n.children ?? [])
    result.push(...flatten(children, ox + n.x, oy + n.y))
  }
  return result
}

function calcBounds(flat: FlatLayer[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of flat) {
    minX = Math.min(minX, n.absX)
    minY = Math.min(minY, n.absY)
    maxX = Math.max(maxX, n.absX + n.width)
    maxY = Math.max(maxY, n.absY + n.height)
  }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  return { minX, minY, maxX, maxY }
}

function renderNode(node: FlatLayer, scale: number, offsetX: number, offsetY: number, idx = 0): React.ReactNode {
  const x = node.absX * scale + offsetX
  const y = node.absY * scale + offsetY
  const w = node.width * scale
  const h = node.height * scale
  const gradient = svgGradientOf(node.style, `xg-thumb-g-${idx}`)
  // 填充优先级与画布/导出统一：渐变 → backgroundColor → fill
  const fill = gradient?.url ?? node.style?.backgroundColor ?? node.style?.fill ?? 'transparent'
  const radius = node.style?.cornerRadius ? node.style.cornerRadius * scale : 0

  if (node.type === 'text') {
    const fontSize = Math.max(6, (node.style?.fontSize ?? 14) * scale)
    return (
      <text
        key={node.id}
        x={x + 2}
        y={y + fontSize}
        fill={node.style?.fontColor ?? node.style?.color ?? '#333'}
        fontSize={fontSize}
        fontWeight={node.style?.fontWeight ?? 400}
      >
        {(node.content ?? '').slice(0, 30)}
      </text>
    )
  }

  return (
    <rect
      key={node.id}
      x={x}
      y={y}
      width={w}
      height={h}
      fill={fill}
      rx={radius}
      ry={radius}
      stroke={node.style?.stroke ?? 'none'}
      strokeWidth={node.style?.strokeWidth ? node.style.strokeWidth * scale : 0}
      opacity={node.style?.opacity ?? 1}
    />
  )
}
