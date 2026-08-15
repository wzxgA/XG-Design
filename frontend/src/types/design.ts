// 统一设计文档与编辑器状态类型定义

export type ToolType = 'select' | 'frame' | 'rectangle' | 'pen' | 'text' | 'comment' | 'components'

export type LayerType = 'frame' | 'group' | 'rectangle' | 'text' | 'chart' | 'comment' | 'path' | 'image'

export type InspectorTab = 'design' | 'prototype' | 'inspect'

export type LeftPanelTab = 'layers' | 'components'

export interface LayerStyle {
  fill?: string
  /** 线性渐变背景：from/to 双色 + 角度（0=上→下，90=左→右），优先于 fill */
  fillGradient?: { from: string; to: string; angle?: number }
  opacity?: number
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number
  shadow?: string
  fontSize?: number
  fontWeight?: number
  /** 文本水平对齐 */
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  /** 文本节点字体色（优先于 color） */
  fontColor?: string
  /** 画板背景色（优先于 fill） */
  backgroundColor?: string
  /** 图片填充方式 */
  objectFit?: 'contain' | 'cover'
}

export interface CommentReply {
  id: string
  author: string
  content: string
  createdAt: number
}

/** 图表类型（CO-2） */
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut'

/** 组件交互状态（CO-4） */
export type ComponentState = 'default' | 'hover' | 'pressed' | 'disabled' | 'loading' | 'error'

/** 组件属性控件类型（schema 驱动检视面板表单） */
export type ComponentPropType =
  | 'color' | 'text' | 'textarea' | 'number' | 'slider'
  | 'boolean' | 'select' | 'image' | 'spacing' | 'gradient'
  | 'bars' | 'colors'

/** 组件属性定义（schema 条目） */
export interface ComponentPropDef {
  key: string
  label: string
  type: ComponentPropType
  default?: unknown
  options?: { label: string; value: string }[]   // select 用
  min?: number; max?: number; step?: number       // number / slider 用
  group?: string                                   // 面板分组标题，缺省归入「组件」
  /** 条件显示：values[dependsOn.key] ∈ equals 时该控件才渲染（如饼图不显示坐标轴开关） */
  dependsOn?: { key: string; equals: string[] }
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
  /** 图片节点图片地址（dataURL 或 URL） */
  imageUrl?: string
  /** 图表节点数据：柱状高度百分比数组或迷你趋势 */
  chartBars?: number[]
  /** 图表类型（缺省 bar） */
  chartType?: ChartType
  /** 系列/柱配色，缺省用默认色板 */
  chartColors?: string[]
  /** 分类标签（坐标轴 / 图例 / 数据标注） */
  chartLabels?: string[]
  /** 柱顶 / 数据点旁显示数值 */
  chartShowValue?: boolean
  /** 显示图例 */
  chartShowLegend?: boolean
  /** 显示 X 轴标签 + 水平网格线 */
  chartShowAxis?: boolean
  /** 多系列数据；bar 单系列回退 chartBars */
  chartSeries?: number[][]
  /** 钢笔路径锚点（相对图层左上角的画布坐标） */
  points?: { x: number; y: number }[]
  /** 评论节点回复列表 */
  replies?: CommentReply[]
  /** 组件标记：该 group 为一体化组件（背景/文字作为整体编辑，子节点不单独选中） */
  component?: string
  /** 组件属性值（key = ComponentPropDef.key），模板 render 据此实时计算子节点 */
  componentProps?: Record<string, unknown>
  /** 组件交互状态（画布编辑态显式设置；预览演示态由 demo 模式临时覆盖） */
  componentState?: ComponentState
  /** 容器插槽绑定：slot key → 子节点 id 列表（插槽内容渲染进组件内占位区） */
  componentSlots?: Record<string, string[]>
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
  | { type: 'LOAD_DOCUMENT'; doc: DesignDocument; selectInitial?: boolean }
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
  | { type: 'GROUP_LAYERS'; ids: string[] }
  | { type: 'UNGROUP_LAYERS'; id: string }
  | { type: 'REORDER_LAYER'; id: string; direction: 'forward' | 'backward' }
  | { type: 'RENAME_PAGE'; pageId: string; name: string }
  | { type: 'DELETE_PAGE'; pageId: string }
  | { type: 'DUPLICATE_PAGE'; pageId: string }
  | { type: 'ADD_COMMENT_REPLY'; commentId: string; reply: CommentReply }
  | { type: 'DELETE_COMMENT_REPLY'; commentId: string; replyId: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
