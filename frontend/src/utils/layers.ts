import type { LayerNode } from '../types/design'

let counter = 0
export function layerId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

/**
 * 判断节点是否为一体化组件。
 * 优先看 component 标记；旧数据（含 HMR 期间未迁移的内存数据）没有标记时，
 * 以结构兜底：group 且含名为「组件背景」的子节点即视为组件。
 */
export function isComponentNode(node: LayerNode): boolean {
  return node.type === 'group' && (!!node.component || node.children.some((c) => c.name === '组件背景'))
}

/** 在 frame 内按 id 查找节点，返回 { node, path }；path 为从 frame 到 node 的祖先链（不含 node 自身） */
export function findNodeWithPath(root: LayerNode, id: string): { node: LayerNode; path: LayerNode[] } | null {
  const walk = (children: LayerNode[], path: LayerNode[]): { node: LayerNode; path: LayerNode[] } | null => {
    for (const n of children) {
      if (n.id === id) return { node: n, path }
      const found = walk(n.children, [...path, n])
      if (found) return found
    }
    return null
  }
  return walk(root.children, [])
}

/** 节点相对 frame 的绝对坐标（累加全部 group 祖先的 x/y，忽略 rotation） */
export function getNodeAbs(root: LayerNode, id: string): { x: number; y: number } | null {
  const ctx = findNodeWithPath(root, id)
  if (!ctx) return null
  let x = 0
  let y = 0
  for (const anc of ctx.path) {
    x += anc.x
    y += anc.y
  }
  return { x: ctx.node.x + x, y: ctx.node.y + y }
}

/** 查找节点所在父容器与同级节点，返回父容器内所有节点共用的绝对偏移（祖先累积值） */
export function getSiblingsAbs(
  root: LayerNode,
  id: string,
): { parent: LayerNode[]; node: LayerNode; nodeAbs: { x: number; y: number } } | null {
  const ctx = findNodeWithPath(root, id)
  if (!ctx) return null
  let ox = 0
  let oy = 0
  for (const anc of ctx.path) {
    ox += anc.x
    oy += anc.y
  }
  const parent = ctx.path.length > 0 ? ctx.path[ctx.path.length - 1].children : root.children
  return { parent, node: ctx.node, nodeAbs: { x: ox, y: oy } }
}

/** 新建一个默认图层（用于"新建图层"菜单） */
export function createLayer(kind: 'rectangle' | 'text' | 'frame' | 'group' | 'chart' | 'path' | 'image', x = 0, y = 0): LayerNode {
  const id = layerId(kind)
  switch (kind) {
    case 'rectangle':
      return { id, type: 'rectangle', name: '矩形', x, y, width: 120, height: 80, rotation: 0, visible: true, locked: false, style: { opacity: 1, fill: '#e5ebef', cornerRadius: 6, stroke: '#b9c4c9', strokeWidth: 1 }, children: [] }
    case 'text':
      return { id, type: 'text', name: '文本', x, y, width: 120, height: 28, rotation: 0, visible: true, locked: false, content: '文本', style: { opacity: 1, color: '#5c6b72', fontSize: 16, fontWeight: 500 }, children: [] }
    case 'frame':
      return { id, type: 'frame', name: '画板', x, y, width: 320, height: 240, rotation: 0, visible: true, locked: false, expanded: true, style: { opacity: 1, fill: '#ffffff', stroke: '#b9c4c9', strokeWidth: 1 }, children: [] }
    case 'chart':
      return { id, type: 'chart', name: '图表', x, y, width: 240, height: 160, rotation: 0, visible: true, locked: false, chartBars: [40, 70, 55, 88, 62], style: { opacity: 1 }, children: [] }
    case 'path':
      return { id, type: 'path', name: '路径', x, y, width: 120, height: 80, rotation: 0, visible: true, locked: false, points: [], style: { opacity: 1, stroke: '#4e8ff4', strokeWidth: 2 }, children: [] }
    case 'image':
      return { id, type: 'image', name: '图片', x, y, width: 200, height: 140, rotation: 0, visible: true, locked: false, style: { opacity: 1, fill: '#eef2f4' }, children: [] }
    case 'group':
    default:
      return { id, type: 'group', name: '分组', x, y, width: 200, height: 120, rotation: 0, visible: true, locked: false, expanded: true, style: { opacity: 1 }, children: [] }
  }
}
