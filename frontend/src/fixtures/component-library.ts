import type { LayerNode } from '../types/design'
import { layerId } from '../utils/layers'

export interface ComponentTemplate {
  name: string
  /** 用于渲染缩略的简名 */
  short: string
  /** 插入到画布：返回完整图层树（group 包裹） */
  build: (x: number, y: number) => LayerNode
}

function group(w: number, h: number, name: string, children: LayerNode[]): LayerNode {
  return {
    id: layerId('group'), type: 'group', name, x: 0, y: 0, width: w, height: h,
    rotation: 0, visible: true, locked: false, expanded: true, style: { opacity: 1 }, children,
  }
}

function rect(x: number, y: number, w: number, h: number, style: LayerNode['style'] = {}): LayerNode {
  return {
    id: layerId('rect'), type: 'rectangle', name: '组件背景', x, y, width: w, height: h,
    rotation: 0, visible: true, locked: false, style: { opacity: 1, fill: '#ffffff', ...style }, children: [],
  }
}

function text(x: number, y: number, w: number, content: string, style: LayerNode['style'] = {}): LayerNode {
  return {
    id: layerId('text'), type: 'text', name: '组件文字', x, y, width: w, height: 20,
    rotation: 0, visible: true, locked: false, content, style: { opacity: 1, color: '#5c6b72', fontSize: 12, fontWeight: 500, ...style }, children: [],
  }
}

/** 内置基础组件库模板（点击/拖拽插入画布） */
export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    name: '按钮',
    short: '按钮',
    build: (x, y) => {
      const g = group(140, 40, '按钮', [
        rect(0, 0, 140, 40, { fill: '#4e8ff4', cornerRadius: 6 }),
        text(0, 10, 140, '按钮', { color: '#ffffff', fontWeight: 600 }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '输入框',
    short: '输入',
    build: (x, y) => {
      const g = group(240, 36, '输入框', [
        rect(0, 0, 240, 36, { fill: '#ffffff', stroke: '#c9d4d8', strokeWidth: 1, cornerRadius: 6 }),
        text(12, 8, 200, '请输入内容…', { color: '#a8b1b5' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '图片占位',
    short: '图片',
    build: (x, y) => {
      const g = group(200, 140, '图片占位', [
        rect(0, 0, 200, 140, { fill: '#eef2f4', cornerRadius: 8, stroke: '#d8e0e3', strokeWidth: 1 }),
        text(0, 60, 200, '图片', { color: '#a0abb0', fontSize: 18 }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '导航栏',
    short: '导航',
    build: (x, y) => {
      const g = group(320, 48, '导航栏', [
        rect(0, 0, 320, 48, { fill: '#ffffff', stroke: '#e3e8ea', strokeWidth: 1 }),
        text(16, 14, 100, 'Logo', { fontWeight: 700 }),
        text(220, 16, 84, '菜单一 菜单二', { fontSize: 10, color: '#8a969b' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '卡片',
    short: '卡片',
    build: (x, y) => {
      const g = group(240, 160, '卡片', [
        rect(0, 0, 240, 160, { fill: '#ffffff', cornerRadius: 10, stroke: '#e8edef', strokeWidth: 1, shadow: '0 3px 10px rgba(39,60,70,0.04)' }),
        rect(12, 12, 216, 90, { fill: '#eef2f4', cornerRadius: 6 }),
        text(12, 116, 200, '卡片标题', { fontSize: 13, color: '#364249', fontWeight: 600 }),
        text(12, 136, 200, '卡片描述文字', { fontSize: 10, color: '#9aa5aa' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '标签',
    short: '标签',
    build: (x, y) => {
      const g = group(72, 24, '标签', [
        rect(0, 0, 72, 24, { fill: '#e8f2ff', cornerRadius: 12 }),
        text(0, 6, 72, '标签', { color: '#4e8ff4', fontWeight: 600, fontSize: 10 }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '分割线',
    short: '分割',
    build: (x, y) => {
      const g = group(240, 1, '分割线', [
        rect(0, 0, 240, 1, { fill: '#e3e8ea' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '柱状图',
    short: '图表',
    build: (x, y) => {
      const bars = [40, 70, 55, 88, 62, 78]
      const g = group(260, 160, '柱状图', [
        rect(0, 0, 260, 160, { fill: '#ffffff', cornerRadius: 8, stroke: '#e8edef', strokeWidth: 1 }),
        {
          id: layerId('chart'), type: 'chart', name: '图表', x: 12, y: 12, width: 236, height: 136,
          rotation: 0, visible: true, locked: false, chartBars: bars, style: { opacity: 1 }, children: [],
        },
      ])
      g.x = x; g.y = y
      return g
    },
  },
]

export function buildComponent(name: string, x: number, y: number): LayerNode {
  const tpl = COMPONENT_TEMPLATES.find((t) => t.name === name)
  if (tpl) return tpl.build(x, y)
  // 兜底：通用 group
  const g = group(200, 120, name, [
    rect(0, 0, 200, 120, { fill: '#ffffff', stroke: '#c9d4d8', strokeWidth: 1, cornerRadius: 8 }),
    text(10, 10, 180, name, { fontSize: 12, fontWeight: 600 }),
  ])
  g.x = x; g.y = y
  return g
}
