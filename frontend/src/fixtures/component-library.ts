import type { ChartType, ComponentPropDef, ComponentState, LayerNode } from '../types/design'
import { layerId } from '../utils/layers'
import { DEFAULT_CHART_COLORS } from '../utils/chart'
import { loadCustomComponents } from '../utils/customComponents'
import { BLUE, WHITE, LIGHT_BG, MUTED, LIGHT_MUTED, INK, IMAGE_PLACEHOLDER } from '../constants/colors'

export interface ComponentTemplate {
  name: string
  /** 用于渲染缩略的简名 */
  short: string
  /** 组件作用描述（鼠标悬停组件磁贴时展示） */
  description: string
  /** 组件分类（组件 tab 筛选） */
  category?: string
  /** 搜索关键词 */
  keywords?: string[]
  /** 可配置属性 schema（检视面板按此自动生成表单） */
  props?: ComponentPropDef[]
  /** 主题预设：一键批量覆盖 props */
  themes?: { name: string; props: Record<string, unknown> }[]
  /** 交互状态预设：渲染时按 componentState 覆盖 props（default 优先） */
  states?: { name: ComponentState; props: Record<string, unknown> }[]
  /** 缩放约束（CO-6）：最小尺寸 / 等比锁定 */
  resize?: { minWidth?: number; minHeight?: number; lockRatio?: boolean }
  /** 容器插槽声明（CO-6）：组件内可嵌入外部内容 */
  slots?: { key: string; label: string; accepts?: LayerNode['type'][] }[]
  /** 按 props 实时计算子节点（替代固定 build 落盘）；返回 group 节点，渲染取其 children */
  render?: (props: Record<string, unknown>) => LayerNode
  /** 插入到画布：返回完整图层树（group 包裹） */
  build: (x: number, y: number) => LayerNode
}

function group(w: number, h: number, name: string, children: LayerNode[]): LayerNode {
  return {
    id: layerId('group'), type: 'group', name, x: 0, y: 0, width: w, height: h,
    rotation: 0, visible: true, locked: false, expanded: true, style: { opacity: 1 }, children,
    component: name,
  }
}

function rect(x: number, y: number, w: number, h: number, style: LayerNode['style'] = {}): LayerNode {
  return {
    id: layerId('rect'), type: 'rectangle', name: '组件背景', x, y, width: w, height: h,
    rotation: 0, visible: true, locked: false, style: { opacity: 1, fill: WHITE, ...style }, children: [],
  }
}

function text(x: number, y: number, w: number, content: string, style: LayerNode['style'] = {}): LayerNode {
  return {
    id: layerId('text'), type: 'text', name: '组件文字', x, y, width: w, height: 20,
    rotation: 0, visible: true, locked: false, content, style: { opacity: 1, color: MUTED, fontSize: 12, fontWeight: 500, ...style }, children: [],
  }
}

function image(x: number, y: number, w: number, h: number): LayerNode {
  return {
    id: layerId('image'), type: 'image', name: '图片', x, y, width: w, height: h,
    rotation: 0, visible: true, locked: false, style: { opacity: 1, fill: IMAGE_PLACEHOLDER }, children: [],
  }
}

function chartNode(x: number, y: number, w: number, h: number, bars: number[], extra: Partial<LayerNode> = {}): LayerNode {
  return {
    id: layerId('chart'), type: 'chart', name: '图表', x, y, width: w, height: h,
    rotation: 0, visible: true, locked: false, chartBars: bars, style: { opacity: 1 }, children: [], ...extra,
  }
}

/** 逗号/空格分隔字符串 → number[]（bars 控件 / 旧字符串兜底） */
function parseBars(v: unknown): number[] {
  if (Array.isArray(v)) return v.map((x) => Number(x) || 0)
  return String(v ?? '')
    .split(/[,\s]+/).filter(Boolean).map((s) => Number(s) || 0)
}

/** 逗号/空格分隔字符串 → string[]（colors 控件） */
function parseColors(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((c) => String(c))
  return String(v ?? '')
    .split(/[,\s]+/).filter(Boolean).map((s) => String(s))
}

/** 逗号分隔字符串 → string[]（labels） */
function parseLabels(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((c) => String(c))
  return String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

/** 图表模板工厂：白底 + 图表节点；schema 化（CO-1）后支持类型/配色/数据/开关全量个性化 */
function chartTemplate(name: string, short: string, description: string, type: ChartType, bars: number[], h = 160): ComponentTemplate {
  return {
    name, short, description, category: '图表',
    keywords: ['chart', '数据', '可视化'],
    resize: { minWidth: 120, minHeight: 80, lockRatio: false },
    props: [
      {
        key: 'chartType', label: '图表类型', type: 'select',
        options: [
          { label: '柱状图', value: 'bar' },
          { label: '折线图', value: 'line' },
          { label: '面积图', value: 'area' },
          { label: '饼图', value: 'pie' },
          { label: '环形图', value: 'donut' },
        ],
        default: type,
      },
      { key: 'chartBars', label: '数据', type: 'bars', default: bars },
      { key: 'chartColors', label: '配色', type: 'colors', default: [...DEFAULT_CHART_COLORS] },
      { key: 'chartLabels', label: '分类标签', type: 'text', default: '' },
      { key: 'chartShowValue', label: '显示数值', type: 'boolean', default: false },
      { key: 'chartShowLegend', label: '显示图例', type: 'boolean', default: true },
      { key: 'width', label: '宽度', type: 'number', min: 120, max: 640, default: 260 },
      { key: 'height', label: '高度', type: 'number', min: 80, max: 400, default: h },
    ],
    render: (p) => {
      const w = Number(p.width ?? 260)
      const hh = Number(p.height ?? h)
      return group(w, hh, name, [
        rect(0, 0, w, hh, { fill: WHITE, cornerRadius: 8, stroke: '#e8edef', strokeWidth: 1 }),
        chartNode(12, 12, w - 24, hh - 24, parseBars(p.chartBars), {
          chartType: (p.chartType ?? type) as ChartType,
          chartColors: parseColors(p.chartColors),
          chartLabels: parseLabels(p.chartLabels),
          chartShowValue: Boolean(p.chartShowValue),
          chartShowLegend: Boolean(p.chartShowLegend),
        }),
      ])
    },
    build: (x, y) => {
      const g = group(260, h, name, [
        rect(0, 0, 260, h, { fill: WHITE, cornerRadius: 8, stroke: '#e8edef', strokeWidth: 1 }),
        chartNode(12, 12, 236, h - 24, bars, { chartType: type, chartColors: [...DEFAULT_CHART_COLORS], chartShowLegend: true }),
      ])
      g.x = x; g.y = y
      return g
    },
  }
}

/** 从模板声明中提取默认 props */
export function defaultProps(tpl: ComponentTemplate): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const p of tpl.props ?? []) {
    if (p.default !== undefined) out[p.key] = p.default
  }
  return out
}

/**
 * 按组件节点的 componentProps 实时计算渲染子节点列表。
 * 模板有 render 时返回 render 结果（group）的 children；否则返回 null（调用方回退 node.children）。
 * @param overrideState 预览演示态临时覆盖 componentState（画布编辑态传 undefined 用节点自带状态）
 * @param overrides 预览交互态覆盖 props（如开关的 on），优先级最高（内存值不落盘）
 */
export function renderComponentChildren(node: LayerNode, overrideState?: string, overrides?: Record<string, unknown>): LayerNode[] | null {
  if (!node.component) return null
  const tpl = COMPONENT_TEMPLATES.find((t) => t.name === node.component)
  if (!tpl?.render) return null
  let props = { ...defaultProps(tpl), ...(node.componentProps ?? {}) }
  // 状态覆盖（CO-4）：显式状态 > default；状态 props 覆盖后合并，并注入 __state 供 render 内部判断
  const stateName = overrideState ?? node.componentState ?? 'default'
  const st = tpl.states?.find((s) => s.name === stateName)
  if (st) props = { ...props, ...st.props }
  props = { ...props, ...(overrides ?? {}) }
  props = { ...props, __state: stateName }
  const rendered = tpl.render(props)
  return rendered.children
}

/** 合并 props 并同步到节点（width/height 等尺寸类 props 同步到节点本体） */
export function resolveComponentProps(tpl: ComponentTemplate, props: Record<string, unknown>): Record<string, unknown> {
  return { ...defaultProps(tpl), ...props }
}

/** 内置基础组件库模板（点击/拖拽插入画布） */
export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    name: '按钮',
    short: '按钮',
    description: '可点击的交互按钮，常用于表单提交或触发操作',
    category: '基础',
    keywords: ['button', '提交', '确认'],
    props: [
      { key: 'text', label: '文案', type: 'text', default: '按钮' },
      { key: 'bg', label: '背景色', type: 'color', default: BLUE },
      { key: 'bgGradient', label: '渐变背景', type: 'gradient' },
      { key: 'color', label: '文字色', type: 'color', default: WHITE },
      { key: 'borderColor', label: '边框色', type: 'color', default: '' },
      { key: 'radius', label: '圆角', type: 'slider', min: 0, max: 24, default: 6 },
      { key: 'width', label: '宽度', type: 'number', min: 40, max: 400, default: 140 },
    ],
    themes: [
      { name: '主色', props: { bg: BLUE, color: WHITE, borderColor: '' } },
      { name: '次要', props: { bg: '#f4f6f7', color: INK, borderColor: '' } },
      { name: '成功', props: { bg: '#3bc78c', color: WHITE, borderColor: '' } },
      { name: '危险', props: { bg: '#ea4335', color: WHITE, borderColor: '' } },
      { name: '幽灵', props: { bg: WHITE, color: BLUE, borderColor: BLUE } },
    ],
    states: [
      { name: 'hover', props: { bg: '#3d7de0' } },
      { name: 'pressed', props: { bg: '#3570c4' } },
      { name: 'disabled', props: { bg: '#c9d4d8', color: WHITE } },
      { name: 'loading', props: { bg: BLUE } },
      { name: 'error', props: { borderColor: '#e5484d' } },
    ],
    render: (p) => {
      const g = p.bgGradient as { enabled?: boolean; from?: string; to?: string; angle?: number } | undefined
      const loading = p.__state === 'loading'
      return group(Number(p.width), 40, '按钮', [
        rect(0, 0, Number(p.width), 40, {
          fill: String(p.bg ?? ''),
          fillGradient: g?.enabled ? { from: g.from ?? WHITE, to: g.to ?? BLUE, angle: g.angle ?? 0 } : undefined,
          cornerRadius: Number(p.radius ?? 0),
          stroke: p.borderColor ? String(p.borderColor) : undefined,
          strokeWidth: p.borderColor ? 1 : undefined,
        }),
        text(0, 10, Number(p.width), loading ? `⟳ ${String(p.text ?? '按钮')}` : String(p.text ?? '按钮'), { color: String(p.color ?? WHITE), fontWeight: 600, textAlign: 'center' }),
      ])
    },
    build: (x, y) => {
      const g = group(140, 40, '按钮', [
        rect(0, 0, 140, 40, { fill: BLUE, cornerRadius: 6 }),
        text(0, 10, 140, '按钮', { color: WHITE, fontWeight: 600, textAlign: 'center' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '输入框',
    short: '输入',
    description: '供用户输入文本的表单区域，可绑定表单校验',
    category: '表单',
    keywords: ['input', 'text', '搜索'],
    props: [
      { key: 'placeholder', label: '占位文字', type: 'text', default: '请输入内容…' },
      { key: 'bg', label: '背景色', type: 'color', default: WHITE },
      { key: 'borderColor', label: '边框色', type: 'color', default: '#c9d4d8' },
      { key: 'color', label: '文字色', type: 'color', default: '#a8b1b5' },
      { key: 'width', label: '宽度', type: 'number', min: 80, max: 480, default: 240 },
    ],
    states: [
      { name: 'disabled', props: { bg: '#f1f3f4', borderColor: '#e2e7ea', color: '#c0c8cc' } },
      { name: 'error', props: { borderColor: '#e5484d' } },
    ],
    render: (p) => group(Number(p.width), 36, '输入框', [
      rect(0, 0, Number(p.width), 36, { fill: String(p.bg), stroke: String(p.borderColor), strokeWidth: 1, cornerRadius: 6 }),
      text(12, 8, Number(p.width) - 24, String(p.placeholder), { color: String(p.color) }),
    ]),
    build: (x, y) => {
      const g = group(240, 36, '输入框', [
        rect(0, 0, 240, 36, { fill: WHITE, stroke: '#c9d4d8', strokeWidth: 1, cornerRadius: 6 }),
        text(12, 8, 200, '请输入内容…', { color: '#a8b1b5' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '图片',
    short: '图片',
    description: '展示图片内容的容器，可上传本地图片或粘贴图片地址',
    category: '基础',
    keywords: ['image', 'photo', '照片'],
    build: (x, y) => {
      const n = image(0, 0, 200, 140)
      n.x = x; n.y = y
      return n
    },
  },
  {
    name: '导航栏',
    short: '导航',
    description: '页面顶部导航区，用于品牌 Logo 与功能菜单入口',
    category: '导航',
    keywords: ['navbar', 'header', '菜单'],
    props: [
      { key: 'logoText', label: 'Logo 文案', type: 'text', default: 'Logo' },
      { key: 'menuText', label: '菜单文案', type: 'text', default: '菜单一 菜单二' },
      { key: 'bg', label: '背景色', type: 'color', default: WHITE },
      { key: 'logoColor', label: 'Logo 色', type: 'color', default: INK },
      { key: 'menuColor', label: '菜单色', type: 'color', default: '#8a969b' },
      { key: 'height', label: '高度', type: 'number', min: 32, max: 80, default: 48 },
    ],
    themes: [
      { name: '浅色', props: { bg: WHITE, logoColor: INK, menuColor: '#8a969b' } },
      { name: '深色', props: { bg: '#263238', logoColor: WHITE, menuColor: '#b0bec5' } },
    ],
    render: (p) => group(320, Number(p.height), '导航栏', [
      rect(0, 0, 320, Number(p.height), { fill: String(p.bg) }),
      text(16, (Number(p.height) - 20) / 2, 100, String(p.logoText), { fontWeight: 700, color: String(p.logoColor ?? INK) }),
      text(220, (Number(p.height) - 16) / 2, 84, String(p.menuText), { fontSize: 10, color: String(p.menuColor ?? '#8a969b') }),
    ]),
    build: (x, y) => {
      const g = group(320, 48, '导航栏', [
        rect(0, 0, 320, 48, { fill: WHITE, stroke: '#e3e8ea', strokeWidth: 1 }),
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
    description: '内容展示容器，适合将标题、图片与描述组合在一起',
    category: '展示',
    keywords: ['card', '容器'],
    resize: { minWidth: 160, minHeight: 100, lockRatio: false },
    props: [
      { key: 'title', label: '标题', type: 'text', default: '卡片标题' },
      { key: 'desc', label: '描述', type: 'text', default: '卡片描述文字' },
      { key: 'imgHeight', label: '图片高度', type: 'slider', min: 40, max: 200, default: 90 },
      { key: 'bg', label: '背景色', type: 'color', default: WHITE },
      { key: 'color', label: '标题色', type: 'color', default: INK },
      { key: 'descColor', label: '描述色', type: 'color', default: LIGHT_MUTED },
    ],
    themes: [
      { name: '浅色', props: { bg: WHITE, color: INK, descColor: LIGHT_MUTED } },
      { name: '深色', props: { bg: '#2c3940', color: '#f5f7f8', descColor: '#aab4ba' } },
    ],
    render: (p) => {
      const imgH = Number(p.imgHeight ?? 90)
      return group(240, 160, '卡片', [
        rect(0, 0, 240, 160, { fill: String(p.bg ?? WHITE), cornerRadius: 10, stroke: '#e8edef', strokeWidth: 1, shadow: '0 3px 10px rgba(39,60,70,0.04)' }),
        rect(12, 12, 216, imgH, { fill: IMAGE_PLACEHOLDER, cornerRadius: 6 }),
        text(12, 20 + imgH, 200, String(p.title ?? '卡片标题'), { fontSize: 13, fontWeight: 600, color: String(p.color ?? INK) }),
        text(12, 42 + imgH, 200, String(p.desc ?? '卡片描述文字'), { fontSize: 10, color: String(p.descColor ?? LIGHT_MUTED) }),
      ])
    },
    build: (x, y) => {
      const g = group(240, 160, '卡片', [
        rect(0, 0, 240, 160, { fill: WHITE, cornerRadius: 10, stroke: '#e8edef', strokeWidth: 1, shadow: '0 3px 10px rgba(39,60,70,0.04)' }),
        rect(12, 12, 216, 90, { fill: IMAGE_PLACEHOLDER, cornerRadius: 6 }),
        text(12, 116, 200, '卡片标题', { fontSize: 13, color: INK, fontWeight: 600 }),
        text(12, 136, 200, '卡片描述文字', { fontSize: 10, color: LIGHT_MUTED }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '标签',
    short: '标签',
    description: '短文本标识，用于状态、分类或关键词展示',
    category: '基础',
    keywords: ['tag', 'badge', '状态'],
    props: [
      { key: 'text', label: '文案', type: 'text', default: '标签' },
      { key: 'bg', label: '背景色', type: 'color', default: '#e8f2ff' },
      { key: 'color', label: '文字色', type: 'color', default: BLUE },
      { key: 'radius', label: '圆角', type: 'slider', min: 0, max: 24, default: 12 },
      { key: 'width', label: '宽度', type: 'number', min: 40, max: 240, default: 72 },
    ],
    themes: [
      { name: '蓝', props: { bg: '#e8f2ff', color: BLUE } },
      { name: '绿', props: { bg: '#e6f9f1', color: '#2ea06b' } },
      { name: '橙', props: { bg: '#fff4e5', color: '#e8830c' } },
      { name: '红', props: { bg: '#fdeeee', color: '#e5484d' } },
      { name: '灰', props: { bg: '#f1f3f4', color: '#56636a' } },
    ],
    render: (p) => group(Number(p.width), 24, '标签', [
      rect(0, 0, Number(p.width), 24, { fill: String(p.bg), cornerRadius: Number(p.radius) }),
      text(0, 6, Number(p.width), String(p.text), { color: String(p.color), fontWeight: 600, fontSize: 10, textAlign: 'center' }),
    ]),
    build: (x, y) => {
      const g = group(72, 24, '标签', [
        rect(0, 0, 72, 24, { fill: '#e8f2ff', cornerRadius: 12 }),
        text(0, 6, 72, '标签', { color: BLUE, fontWeight: 600, fontSize: 10, textAlign: 'center' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '分割线',
    short: '分割',
    description: '水平分隔线，用于划分页面中的内容区块',
    category: '基础',
    keywords: ['divider', 'line'],
    props: [
      { key: 'lineColor', label: '线条颜色', type: 'color', default: '#e3e8ea' },
      { key: 'thickness', label: '粗细', type: 'slider', min: 1, max: 6, default: 1 },
      { key: 'width', label: '宽度', type: 'number', min: 40, max: 600, default: 240 },
    ],
    render: (p) => group(Number(p.width), 1, '分割线', [
      rect(0, 0, Number(p.width), Number(p.thickness), { fill: String(p.lineColor) }),
    ]),
    build: (x, y) => {
      const g = group(240, 1, '分割线', [
        rect(0, 0, 240, 1, { fill: '#e3e8ea' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  chartTemplate('柱状图', '柱状', '以柱状高度对比数据大小，适合展示分类数值', 'bar', [40, 70, 55, 88, 62, 78]),
  chartTemplate('折线图', '折线', '以折线走势展示数据变化趋势，适合时间序列', 'line', [40, 70, 55, 88, 62, 78]),
  chartTemplate('饼图', '饼图', '以扇形占比展示数据构成，适合占比类数据', 'pie', [35, 25, 20, 20]),
  chartTemplate('环形图', '环形', '饼图的环状变体，中心可放置强调信息', 'donut', [35, 25, 20, 20]),
  {
    name: '头像',
    short: '头像',
    description: '用户头像占位，显示昵称首字或自定义图片',
    category: '基础',
    keywords: ['avatar', '用户', 'person'],
    props: [
      { key: 'avatarText', label: '文案', type: 'text', default: '张' },
      { key: 'bg', label: '背景色', type: 'color', default: BLUE },
      { key: 'color', label: '文字色', type: 'color', default: WHITE },
      { key: 'size', label: '尺寸', type: 'number', min: 16, max: 96, default: 40 },
    ],
    render: (p) => {
      const size = Number(p.size ?? 40)
      return group(size, size, '头像', [
        rect(0, 0, size, size, { fill: String(p.bg), cornerRadius: size / 2 }),
        text(0, (size - 20) / 2, size, String(p.avatarText ?? '张'), { color: String(p.color), fontSize: Math.max(10, size / 2.2), fontWeight: 600, textAlign: 'center' }),
      ])
    },
    build: (x, y) => {
      const g = group(40, 40, '头像', [
        rect(0, 0, 40, 40, { fill: BLUE, cornerRadius: 20 }),
        text(0, 10, 40, '张', { color: WHITE, fontSize: 18, fontWeight: 600, textAlign: 'center' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '进度条',
    short: '进度',
    description: '展示任务完成进度，支持百分比与配色调节',
    category: '基础',
    keywords: ['progress', '加载', 'loading'],
    props: [
      { key: 'percent', label: '百分比', type: 'slider', min: 0, max: 100, default: 65 },
      { key: 'color', label: '进度色', type: 'color', default: BLUE },
      { key: 'bg', label: '轨道色', type: 'color', default: LIGHT_BG },
      { key: 'width', label: '宽度', type: 'number', min: 80, max: 480, default: 200 },
    ],
    render: (p) => group(Number(p.width), 8, '进度条', [
      rect(0, 0, Number(p.width), 8, { fill: String(p.bg), cornerRadius: 4 }),
      rect(0, 0, Number(p.width) * Number(p.percent ?? 0) / 100, 8, { fill: String(p.color), cornerRadius: 4 }),
    ]),
    build: (x, y) => {
      const g = group(200, 8, '进度条', [
        rect(0, 0, 200, 8, { fill: LIGHT_BG, cornerRadius: 4 }),
        rect(0, 0, 130, 8, { fill: BLUE, cornerRadius: 4 }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  {
    name: '开关',
    short: '开关',
    description: '布尔状态切换控件，开/关两种状态',
    category: '表单',
    keywords: ['switch', 'toggle', '开关'],
    props: [
      { key: 'on', label: '默认打开', type: 'boolean', default: true },
      { key: 'color', label: '开启色', type: 'color', default: BLUE },
      { key: 'width', label: '宽度', type: 'number', min: 24, max: 80, default: 44 },
    ],
    render: (p) => {
      const w = Number(p.width ?? 44)
      const on = !!p.on
      const trackH = Math.max(14, w / 2.2)
      const knob = Math.max(12, trackH - 6)
      return group(w, trackH, '开关', [
        rect(0, 0, w, trackH, { fill: on ? String(p.color) : '#d5dde1', cornerRadius: trackH / 2 }),
        rect(on ? w - knob - 3 : 3, (trackH - knob) / 2, knob, knob, { fill: WHITE, cornerRadius: knob / 2, shadow: '0 1px 3px rgba(20,35,42,.25)' }),
      ])
    },
    build: (x, y) => {
      const g = group(44, 20, '开关', [
        rect(0, 0, 44, 20, { fill: BLUE, cornerRadius: 10 }),
        rect(27, 3, 14, 14, { fill: WHITE, cornerRadius: 7, shadow: '0 1px 3px rgba(20,35,42,.25)' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
  simpleTemplate('徽标', '徽标', '角标或计数标识，突出提示数量', '反馈',
    (x, y) => {
      const g = group(22, 22, '徽标', [
        rect(0, 0, 22, 22, { fill: '#ea4335', cornerRadius: 11 }),
        text(0, 5, 22, '3', { color: WHITE, fontSize: 11, fontWeight: 700, textAlign: 'center' }),
      ])
      g.x = x; g.y = y
      return g
    }),
  simpleTemplate('搜索框', '搜索', '带放大镜图标的搜索输入区域', '表单',
    (x, y) => {
      const g = group(220, 32, '搜索框', [
        rect(0, 0, 220, 32, { fill: '#f4f6f7', cornerRadius: 16, stroke: '#e3e8ea', strokeWidth: 1 }),
        text(12, 8, 190, '搜索…', { color: '#a8b1b5', fontSize: 11 }),
      ])
      g.x = x; g.y = y
      return g
    }),
  simpleTemplate('下拉选择', '下拉', '点击展开选项列表的选择控件', '表单',
    (x, y) => {
      const g = group(180, 36, '下拉选择', [
        rect(0, 0, 180, 36, { fill: WHITE, cornerRadius: 6, stroke: '#c9d4d8', strokeWidth: 1 }),
        text(12, 10, 140, '请选择…', { color: '#8a969b', fontSize: 11 }),
        text(162, 10, 12, '⌄', { color: '#8a969b', fontSize: 12, textAlign: 'center' }),
      ])
      g.x = x; g.y = y
      return g
    }),
  simpleTemplate('单选组', '单选', '一组互斥选项，仅能选择其一', '表单',
    (x, y) => {
      const g = group(160, 78, '单选组', [
        rect(0, 0, 14, 14, { fill: WHITE, cornerRadius: 7, stroke: BLUE, strokeWidth: 2 }),
        rect(3.5, 3.5, 7, 7, { fill: BLUE, cornerRadius: 3.5 }),
        text(22, 3, 120, '选项一', { fontSize: 11, color: '#445159' }),
        rect(0, 28, 14, 14, { fill: WHITE, cornerRadius: 7, stroke: '#c9d4d8', strokeWidth: 2 }),
        text(22, 31, 120, '选项二', { fontSize: 11, color: '#56636a' }),
        rect(0, 56, 14, 14, { fill: WHITE, cornerRadius: 7, stroke: '#c9d4d8', strokeWidth: 2 }),
        text(22, 59, 120, '选项三', { fontSize: 11, color: '#56636a' }),
      ])
      g.x = x; g.y = y
      return g
    }),
  simpleTemplate('面包屑', '面包屑', '层级路径导航，展示当前位置', '导航',
    (x, y) => {
      const g = group(240, 20, '面包屑', [
        text(0, 3, 200, '首页 / 分类 / 当前页', { fontSize: 11, color: '#56636a' }),
      ])
      g.x = x; g.y = y
      return g
    }),
  simpleTemplate('分页', '分页', '多页内容翻页导航控件', '导航',
    (x, y) => {
      const g = group(138, 26, '分页', [
        rect(0, 0, 22, 26, { fill: WHITE, cornerRadius: 5, stroke: '#e3e8ea', strokeWidth: 1 }),
        text(0, 7, 22, '‹', { textAlign: 'center', color: '#56636a', fontSize: 11 }),
        rect(26, 0, 26, 26, { fill: BLUE, cornerRadius: 5 }),
        text(26, 7, 26, '1', { textAlign: 'center', color: WHITE, fontSize: 11, fontWeight: 600 }),
        rect(56, 0, 26, 26, { fill: WHITE, cornerRadius: 5, stroke: '#e3e8ea', strokeWidth: 1 }),
        text(56, 7, 26, '2', { textAlign: 'center', color: '#56636a', fontSize: 11 }),
        rect(86, 0, 26, 26, { fill: WHITE, cornerRadius: 5, stroke: '#e3e8ea', strokeWidth: 1 }),
        text(86, 7, 26, '3', { textAlign: 'center', color: '#56636a', fontSize: 11 }),
        rect(116, 0, 22, 26, { fill: WHITE, cornerRadius: 5, stroke: '#e3e8ea', strokeWidth: 1 }),
        text(116, 7, 22, '›', { textAlign: 'center', color: '#56636a', fontSize: 11 }),
      ])
      g.x = x; g.y = y
      return g
    }),
  simpleTemplate('弹窗', '弹窗', '模态对话框，用于确认或展示信息', '反馈',
    (x, y) => {
      const g = group(280, 150, '弹窗', [
        rect(0, 0, 280, 150, { fill: WHITE, cornerRadius: 10, shadow: '0 12px 32px rgba(39,60,70,.16)' }),
        rect(0, 0, 280, 4, { fill: BLUE }),
        text(20, 20, 240, '弹窗标题', { fontSize: 14, fontWeight: 700, color: INK }),
        text(20, 46, 240, '这是弹窗的描述文案，用于说明操作意图。', { fontSize: 11, color: '#8a969b' }),
        rect(150, 110, 52, 28, { fill: LIGHT_BG, cornerRadius: 6 }),
        text(150, 118, 52, '取消', { fontSize: 11, color: '#56636a', textAlign: 'center' }),
        rect(208, 110, 52, 28, { fill: BLUE, cornerRadius: 6 }),
        text(208, 118, 52, '确定', { fontSize: 11, color: WHITE, textAlign: 'center' }),
      ])
      g.x = x; g.y = y
      return g
    }),
  simpleTemplate('工具提示', '提示', '悬停展示的说明气泡', '反馈',
    (x, y) => {
      const g = group(120, 36, '工具提示', [
        rect(0, 0, 120, 30, { fill: '#2b3a42', cornerRadius: 6 }),
        text(0, 8, 120, '提示文案', { fontSize: 10, color: WHITE, textAlign: 'center' }),
        text(56, 24, 10, '▼', { fontSize: 9, color: '#2b3a42' }),
      ])
      g.x = x; g.y = y
      return g
    }),
  {
    name: '列表项',
    short: '列表',
    description: '单行内容展示，支持按行数重复（数据绑定雏形），常见于列表或表格',
    category: '展示',
    keywords: ['list', '列表', '表格', 'row'],
    resize: { minWidth: 160, minHeight: 40, lockRatio: false },
    props: [
      { key: 'title', label: '标题', type: 'text', default: '列表项标题' },
      { key: 'desc', label: '描述', type: 'text', default: '列表项描述' },
      { key: 'rows', label: '行数', type: 'number', min: 1, max: 8, default: 3 },
      { key: 'width', label: '宽度', type: 'number', min: 160, max: 480, default: 320 },
    ],
    render: (p) => {
      const rows = Math.max(1, Math.min(8, Number(p.rows ?? 3)))
      const w = Number(p.width ?? 320)
      const h = rows * 44
      const children: LayerNode[] = [rect(0, 0, w, h, { fill: WHITE, stroke: LIGHT_BG, strokeWidth: 1 })]
      for (let i = 0; i < rows; i++) {
        const y = i * 44
        children.push(rect(10, y + 8, 28, 28, { fill: '#e8f2ff', cornerRadius: 6 }))
        children.push(text(10, y + 16, 28, '图', { fontSize: 10, color: BLUE, textAlign: 'center' }))
        children.push(text(46, y + 8, 200, String(p.title), { fontSize: 12, fontWeight: 600, color: INK }))
        children.push(text(46, y + 25, 200, String(p.desc), { fontSize: 10, color: LIGHT_MUTED }))
        children.push(text(w - 28, y + 15, 20, '›', { fontSize: 14, color: '#c0c8cc', textAlign: 'center' }))
      }
      return group(w, h, '列表项', children)
    },
    build: (x, y) => {
      const g = group(320, 44, '列表项', [
        rect(0, 0, 320, 44, { fill: WHITE, stroke: LIGHT_BG, strokeWidth: 1 }),
        rect(10, 8, 28, 28, { fill: '#e8f2ff', cornerRadius: 6 }),
        text(10, 16, 28, '图', { fontSize: 10, color: BLUE, textAlign: 'center' }),
        text(46, 8, 200, '列表项标题', { fontSize: 12, fontWeight: 600, color: INK }),
        text(46, 25, 200, '列表项描述', { fontSize: 10, color: LIGHT_MUTED }),
        text(292, 15, 20, '›', { fontSize: 14, color: '#c0c8cc', textAlign: 'center' }),
      ])
      g.x = x; g.y = y
      return g
    },
  },
]

/** 无 schema 的简单模板工厂（检视面板走旧 bgRect/textNodes 兼容逻辑） */
function simpleTemplate(name: string, short: string, description: string, category: string, buildFn: (x: number, y: number) => LayerNode): ComponentTemplate {
  return { name, short, description, category, build: buildFn }
}

export function buildComponent(name: string, x: number, y: number): LayerNode {
  const tpl = COMPONENT_TEMPLATES.find((t) => t.name === name)
    ?? loadCustomComponents().find((t) => t.name === name)
  if (tpl) {
    const g = tpl.build(x, y)
    // 有 schema 的模板：插入时写入默认 props（render 渲染时读取）
    if (tpl.props && tpl.props.length > 0) g.componentProps = defaultProps(tpl)
    return g
  }
  // 兜底：通用 group
  const g = group(200, 120, name, [
    rect(0, 0, 200, 120, { fill: WHITE, stroke: '#c9d4d8', strokeWidth: 1, cornerRadius: 8 }),
    text(10, 10, 180, name, { fontSize: 12, fontWeight: 600 }),
  ])
  g.x = x; g.y = y
  return g
}
