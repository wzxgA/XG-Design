// 统一设计文档与编辑器状态类型定义

export type ToolType = 'select' | 'frame' | 'rectangle' | 'pen' | 'text' | 'comment' | 'components'

export type LayerType = 'frame' | 'group' | 'rectangle' | 'text' | 'chart' | 'comment' | 'path' | 'image'

export type InspectorTab = 'design' | 'prototype' | 'inspect'

export type LeftPanelTab = 'layers' | 'components'

export type Transition =
  | 'instant'        // 立即切换（无动画）
  | 'dissolve'       // 兼容旧数据，等价 fade
  | 'slide'          // 兼容旧数据，等价 push direction=left
  | 'fade'           // 整体淡入淡出
  | 'moveIn'         // 新页/浮层从指定方向滑入
  | 'moveOut'        // 当前页向指定方向滑出
  | 'push'           // 新页推入，旧页被推走（同时）
  | 'smart'          // Smart Animate：同名同结构图层属性插值
  | 'overlay'        // 浮层弹出（modal/popover/dropdown）

export type Easing =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'spring' | 'customBezier'

export type Direction = 'left' | 'right' | 'top' | 'bottom' | 'none'

export type OverflowBehavior =
  | 'hidden'              // 内容超出 frame 裁剪（默认，等价当前行为）
  | 'visible'             // 不裁剪
  | 'verticalScroll'      // 纵向滚动
  | 'horizontalScroll'    // 横向滚动
  | 'bothScroll'          // 双向滚动

export interface OverlayConfig {
  /** 浮层在 viewport 内的对齐方式 */
  position:
    | 'manual'           // 用 offsetX/Y 相对源 frame 左上角
    | 'center'
    | 'topLeft' | 'topCenter' | 'topRight'
    | 'bottomLeft' | 'bottomCenter' | 'bottomRight'
  /** position=manual 时相对源 frame 左上角的偏移 px */
  offsetX?: number
  offsetY?: number
  /** 模态背景色（如 rgba(0,0,0,0.45)）；缺省透明 */
  backdrop?: string
  /** 点击背景关闭 */
  closeOnBackdrop?: boolean
  /** 按 ESC 关闭 */
  closeOnEsc?: boolean
  /** 关闭动画类型（缺省与 transition 反向：overlay→fade） */
  closeTransition?: Transition
  /** 关闭时长（缺省=duration） */
  closeDuration?: number
}

export interface LayerStyle {
  fill?: string
  /** 渐变背景：线性（from/to 或 stops 多色 + 角度）/ 径向（type=radial），优先于 fill */
  fillGradient?: {
    from: string
    to: string
    angle?: number
    /** linear=线性（默认，0=上→下，90=左→右）；radial=径向 */
    type?: 'linear' | 'radial'
    /** 多色渐变 stops；缺省/不足 2 个时回退 from/to 双色 */
    stops?: { color: string; position?: number }[]
  }
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
  /** 流光特效（仅预览模式播放，画布编辑态静态） */
  effects?: {
    /** 渐变流光：背景渐变缓慢流动 */
    flow?: { speed?: number }
    /** 扫光：高光条周期扫过 */
    shimmer?: { color?: string; speed?: number }
    /** 发光脉冲：box-shadow 呼吸 */
    glow?: { color?: string; speed?: number }
  }
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

/** 变体属性定义：一个"维"（对应 Figma variant property），含若干可选值 */
export interface VariantPropDef {
  key: string          // 如 'type' | 'size'
  label: string
  values: string[]     // 可选项，如 ['primary','secondary','outline']
  default?: string
}

/** 组件集内一个具体变体：属性键→选中值 + 相对基准的 props 覆盖 */
export interface VariantDef {
  /** 稳定唯一名（供实例记录选中组合），如 'primary/large' */
  id: string
  name: string          // 展示名，可中文
  props: Record<string, string>      // 属性键→选中值，如 { type:'primary', size:'large' }
  /** 该变体相对基准的 props 覆盖（合并进 componentProps） */
  overrides?: Record<string, unknown>
}

/** 路径锚点：handleIn/handleOut 为相对锚点的贝塞尔控制点（undefined = 直线段） */
export interface PathPoint {
  x: number
  y: number
  /** 进入本锚点时的控制点（相对锚点偏移，可负） */
  handleIn?: { x: number; y: number }
  /** 离开本锚点时的控制点（相对锚点偏移，可负） */
  handleOut?: { x: number; y: number }
}

/** 主组件联动信息：实例引用主组件名 + 当前实例化计数（纯展示，为可视化主组件编辑铺地） */
export interface InstanceOfInfo {
  /** 主组件（模板）名 */
  componentName: string
  /** 该主组件当前被实例化的数量 */
  instanceCount: number
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
  /** 钢笔路径锚点（相对图层左上角的画布坐标）；含贝塞尔手柄信息 */
  points?: PathPoint[]
  /** 路径是否闭合（首尾相连），默认 false（开放路径） */
  pathClosed?: boolean
  /** 评论节点回复列表 */
  replies?: CommentReply[]
  /** 组件标记：该 group 为一体化组件（背景/文字作为整体编辑，子节点不单独选中） */
  component?: string
  /** 组件属性值（key = ComponentPropDef.key），模板 render 据此实时计算子节点 */
  componentProps?: Record<string, unknown>
  /** 组件交互状态（画布编辑态显式设置；预览演示态由 demo 模式临时覆盖） */
  componentState?: ComponentState
  /** 变体选中组合：{ 属性键: 值 }（实例记录，供下拉回显；对应组件集 VariantDef.props 子集） */
  variantSelection?: Record<string, string>
  /** 实例级覆盖：用户在画布上对该实例的手动调整（不写回主组件，优先级最高） */
  instanceOverrides?: Record<string, unknown>
  /** 主组件联动信息：实例引用主组件名 + 实例计数（纯展示，为可视化主组件编辑铺地） */
  instanceOf?: InstanceOfInfo
  /** 容器插槽绑定：slot key → 子节点 id 列表（插槽内容渲染进组件内占位区） */
  componentSlots?: Record<string, string[]>
  /** Auto Layout 布局（仅 frame/group 有意义）；存在时子节点坐标由布局引擎重排 */
  autoLayout?: AutoLayout
  /** 子项：autoLayout 父内沿主轴填充剩余空间（FILL），默认 false（FIXED 保持自身宽/高） */
  layoutGrow?: boolean
  /** frame 滚动溢出行为；仅 frame 类型有效；缺省 hidden */
  overflow?: import('./design').OverflowBehavior
  style: LayerStyle
  children: LayerNode[]
}

/** Auto Layout 布局配置（数据层重排：布局结果写回子节点 x/y 与父尺寸） */
export interface AutoLayout {
  direction: 'horizontal' | 'vertical'
  /** 子项间距（px） */
  gap: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  /** 交叉轴对齐：stretch=子项在交叉轴拉伸填满父内容区 */
  align: 'start' | 'center' | 'end' | 'stretch'
  /** 主轴分布：space-between/around 时子项间距被空白分配覆盖 */
  justify: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
  /** 主轴方向固定尺寸（false=hug 自适应内容，默认） */
  mainFixed?: boolean
}

export interface PageNode {
  id: string
  name: string
  children: LayerNode[]
  /** 进入页面后自动触发的跳转（进入此 page 即开始计时；用户交互取消计时） */
  autoNavigateLink?: {
    targetPageId: string
    targetFrameId?: string
    delay: number
    transition: Transition
    duration?: number
    easing?: Easing
    direction?: Direction
  }
}

export interface PrototypeLink {
  id: string
  sourceLayerId: string
  targetPageId: string
  trigger: 'click' | 'hover' | 'afterDelay' | 'mouseDown' | 'keyDown'
  transition: Transition
  /** 目标页内的具体 frame（缺省取该页第一个 frame） */
  targetFrameId?: string
  /** 动画时长 ms（缺省按 transition 类型：instant=0 / fade=300 / moveIn/push=400 / smart=500 / overlay=240） */
  duration?: number
  /** 缓动函数，缺省 easeInOut */
  easing?: Easing
  /** easing=customBezier 时的控制点 [x1, y1, x2, y2] */
  easingBezier?: [number, number, number, number]
  /** moveIn/moveOut/push/slide 的方向；none=无方向（按 transition 默认） */
  direction?: Direction
  /** trigger=afterDelay 时延后多少 ms 触发 */
  delay?: number
  /** trigger=keyDown 时存键码（如 'Escape' / 'Enter' / 'ArrowRight'） */
  key?: string
  /** transition=overlay 时的浮层配置 */
  overlay?: OverlayConfig
  /** 是否保留导航历史（默认 true；overlay 关闭后通常不入历史） */
  keepHistory?: boolean
}

export interface DesignDocument {
  id: string
  name: string
  pages: PageNode[]
  activePageId: string
  prototypeLinks: PrototypeLink[]
  /** 主组件级默认值覆盖：组件名 → { 属性键: 值 }，作为模板 default 之上的"主组件"层（随文档持久化） */
  masterOverrides?: Record<string, Record<string, unknown>>
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
  /** 主组件编辑模式：当前正在编辑的主组件名 + 本次未提交草稿（UI 态，不入文档/历史；提交才写 masterOverrides） */
  masterEdit?: { componentName: string; draft?: Record<string, unknown> }
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
  | { type: 'REORDER_TO_INDEX'; id: string; targetIndex: number }
  | { type: 'RENAME_PAGE'; pageId: string; name: string }
  | { type: 'DELETE_PAGE'; pageId: string }
  | { type: 'DUPLICATE_PAGE'; pageId: string }
  | { type: 'ADD_COMMENT_REPLY'; commentId: string; reply: CommentReply }
  | { type: 'DELETE_COMMENT_REPLY'; commentId: string; replyId: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_MASTER_OVERRIDE'; componentName: string; key: string; value: unknown }
  | { type: 'RESET_MASTER_OVERRIDE'; componentName: string; key: string }
  | { type: 'SET_MASTER_EDIT_DRAFT'; componentName: string; key: string; value?: unknown }
  | { type: 'SET_MASTER_EDIT_DRAFT_ALL'; componentName: string; draft: Record<string, unknown> }
  | { type: 'ENTER_MASTER_EDIT'; componentName: string }
  | { type: 'COMMIT_MASTER_EDIT'; componentName: string }
  | { type: 'EXIT_MASTER_EDIT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'APPLY_DESIGN'; layers: LayerNode[]; links?: import('../types/ai').AiProtoLink[] }
  | { type: 'APPLY_EDIT'; operations: import('../types/ai').EditOperation[] }
  | { type: 'APPLY_BOOLEAN'; ids: string[]; mode: 'union' | 'subtract' | 'intersect' | 'exclude' }
