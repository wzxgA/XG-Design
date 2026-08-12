import type { LayerNode } from '../types/design'

let counter = 0
export function layerId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

/** 新建一个默认图层（用于"新建图层"菜单） */
export function createLayer(kind: 'rectangle' | 'text' | 'frame' | 'group', x = 0, y = 0): LayerNode {
  const id = layerId(kind)
  switch (kind) {
    case 'rectangle':
      return { id, type: 'rectangle', name: '矩形', x, y, width: 120, height: 80, rotation: 0, visible: true, locked: false, style: { opacity: 1, fill: '#e5ebef', cornerRadius: 6, stroke: '#b9c4c9', strokeWidth: 1 }, children: [] }
    case 'text':
      return { id, type: 'text', name: '文本', x, y, width: 120, height: 28, rotation: 0, visible: true, locked: false, content: '文本', style: { opacity: 1, color: '#5c6b72', fontSize: 16, fontWeight: 500 }, children: [] }
    case 'frame':
      return { id, type: 'frame', name: '画板', x, y, width: 320, height: 240, rotation: 0, visible: true, locked: false, expanded: true, style: { opacity: 1, fill: '#ffffff', stroke: '#b9c4c9', strokeWidth: 1 }, children: [] }
    case 'group':
    default:
      return { id, type: 'group', name: '分组', x, y, width: 200, height: 120, rotation: 0, visible: true, locked: false, expanded: true, style: { opacity: 1 }, children: [] }
  }
}
