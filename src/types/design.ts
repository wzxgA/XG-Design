// 统一设计文档与编辑器状态类型定义

export type ToolType = 'select' | 'frame' | 'rectangle' | 'pen' | 'text' | 'comment' | 'components'

export type LayerType = 'frame' | 'group' | 'rectangle' | 'text' | 'chart' | 'comment'

export type InspectorTab = 'design' | 'prototype' | 'inspect'

export type LeftPanelTab = 'layers' | 'components'

export interface LayerStyle {
  fill?: string
  opacity?: number
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number
  shadow?: string
  fontSize?: number
  fontWeight?: number
  color?: string
}

export interface LayerNode {
  id: string
  type: LayerType
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  visible: boolean
  locked: boolean
  expanded?: boolean
  /** 文本节点内容 */
  content?: string
  /** 图表节点数据：柱状高度百分比数组或迷你趋势 */
  chartBars?: number[]
  style: LayerStyle
  children: LayerNode[]
}

export interface PageNode {
  id: string
  name: string
  children: LayerNode[]
}

export interface PrototypeLink {
  id: string
  sourceLayerId: string
  targetPageId: string
  trigger: 'click' | 'hover'
  transition: 'instant' | 'dissolve' | 'slide'
}

export interface DesignDocument {
  id: string
  name: string
  pages: PageNode[]
  activePageId: string
  prototypeLinks: PrototypeLink[]
  updatedAt: number
}

export interface HistoryState {
  past: DesignDocument[]
  future: DesignDocument[]
}

export interface EditorState {
  document: DesignDocument
  selectedIds: string[]
  activeTool: ToolType
  zoom: number
  pan: { x: number; y: number }
  leftPanelTab: LeftPanelTab
  inspectorTab: InspectorTab
  history: HistoryState
}

export type EditorAction =
  | { type: 'SELECT_LAYERS'; ids: string[] }
  | { type: 'SET_ACTIVE_TOOL'; tool: ToolType }
  | { type: 'SET_INSPECTOR_TAB'; tab: InspectorTab }
  | { type: 'SET_LEFT_PANEL_TAB'; tab: LeftPanelTab }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; pan: { x: number; y: number } }
  | { type: 'RENAME_DOCUMENT'; name: string }
  | { type: 'SET_ACTIVE_PAGE'; pageId: string }
  | { type: 'CREATE_PAGE'; name: string }
  | { type: 'CREATE_LAYER'; pageId: string; parentId: string | null; layer: LayerNode }
  | { type: 'DELETE_LAYERS'; ids: string[] }
  | { type: 'DUPLICATE_LAYERS'; ids: string[] }
  | { type: 'UPDATE_LAYER_PROPERTIES'; ids: string[]; patch: Partial<LayerNode> & { style?: Partial<LayerStyle> } }
  | { type: 'TOGGLE_LAYER_VISIBILITY'; ids: string[] }
  | { type: 'TOGGLE_LAYER_LOCK'; ids: string[] }
  | { type: 'TOGGLE_LAYER_EXPANDED'; id: string }
  | { type: 'RENAME_LAYER'; id: string; name: string }
  | { type: 'BEGIN_MOVE'; ids: string[] }
  | { type: 'MOVE_LAYERS'; ids: string[]; dx: number; dy: number }
  | { type: 'ADD_PROTOTYPE_LINK'; link: PrototypeLink }
  | { type: 'REMOVE_PROTOTYPE_LINK'; id: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
