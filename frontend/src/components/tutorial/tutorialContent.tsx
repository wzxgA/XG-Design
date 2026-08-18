import type { ComponentState, LayerNode } from '../../types/design'
import { buildComponent } from '../../fixtures/component-library'
import { BLUE, GREEN, INK, MUTED, WHITE, LIGHT_BG, LIGHT_MUTED } from '../../constants/colors'

// ============================== 数据模型 ==============================

/** 演示脚本指令：由 DemoPlayer 顺序执行（await 完成后走下一步） */
export type DemoStep =
  | { type: 'wait'; ms: number }                                        // 停顿
  | { type: 'show'; ids: string[]; ms?: number }                        // 淡入显示
  | { type: 'highlight'; ids: string[]; hold?: number }                 // 高亮描边（自动消失）
  | { type: 'move'; id: string; x: number; y: number; ms?: number }     // 位置插值
  | { type: 'style'; id: string; patch: Record<string, unknown>; ms?: number } // 属性插值（颜色/圆角/透明…）
  | { type: 'text'; id: string; content: string; ms?: number }          // 文字内容切换
  | { type: 'state'; id: string; state: ComponentState; hold?: number } // 组件交互态切换
  | { type: 'propsCycle'; id: string; presets: Record<string, unknown>[]; hold?: number } // 组件 props 轮播
  | { type: 'grow'; id: string; to: number; ms?: number }               // 组件内填充条宽度插值（进度条）
  | { type: 'chartGrow'; id: string; ms?: number }                      // 图表柱逐根生长
  | { type: 'transition'; from: string; to: string; mode: 'push' | 'moveIn' | 'fade' | 'overlay' | 'smart'; ms?: number } // 转场演示
  | { type: 'scroll'; id: string; dy: number; ms?: number }             // frame 内滚动
  | { type: 'loop' }                                                    // 回到开头循环播放

export type TutorialGroup = 'basic' | 'library' | 'advanced'

export interface TutorialEntry {
  id: string
  group: TutorialGroup
  kind: 'feature' | 'component' | 'custom'
  title: string
  summary: string
  points?: string[]
  demo: {
    scene: () => LayerNode[]
    script: DemoStep[]
    width?: number
    height?: number
  }
}

// ============================== 场景节点工厂 ==============================

function frameNode(id: string, w: number, h: number, name: string, children: LayerNode[], style: Record<string, unknown> = {}): LayerNode {
  return {
    id, type: 'frame', name, x: 0, y: 0, width: w, height: h,
    rotation: 0, visible: true, locked: false, expanded: true,
    style: { opacity: 1, backgroundColor: WHITE, ...style }, children,
  }
}

function rectNode(id: string, x: number, y: number, w: number, h: number, name: string, style: Record<string, unknown> = {}): LayerNode {
  return {
    id, type: 'rectangle', name, x, y, width: w, height: h,
    rotation: 0, visible: true, locked: false,
    style: { opacity: 1, fill: '#e5ebef', ...style }, children: [],
  }
}

function textNode(id: string, x: number, y: number, w: number, content: string, name: string, style: Record<string, unknown> = {}): LayerNode {
  return {
    id, type: 'text', name, x, y, width: w, height: 20,
    rotation: 0, visible: true, locked: false, content,
    style: { opacity: 1, color: MUTED, fontSize: 14, ...style }, children: [],
  }
}

/** 从组件库真实构建一个组件实例（id 覆盖为可寻址的稳定 id） */
function compNode(id: string, tplName: string, x: number, y: number): LayerNode {
  const g = buildComponent(tplName, x, y)
  g.id = id
  // 教程演示用：去掉变体选择，让 props 覆盖（propsCycle）直接作用于组件视觉，变体由脚本模拟
  delete g.variantSelection
  return g
}

/** 用一个内置组件构建一个演示 frame（组件居中，frame 四周留白） */
function compFrame(id: string, tplName: string, w: number, h: number): { frame: LayerNode; compId: string } {
  const compId = `c-${id}`
  const comp = compNode(compId, tplName, 0, 0)
  comp.x = Math.round((w - comp.width) / 2)
  comp.y = Math.round((h - comp.height) / 2)
  return {
    frame: frameNode(id, w, h, tplName, [comp], { backgroundColor: '#f5f7f8' }),
    compId,
  }
}

// ============================== 功能教程（feature） ==============================

/** F1 画布与工具：画笔/形状依次出现 → 布尔合并 → 分组 */
const f1Scene = (): LayerNode[] => {
  const frame = frameNode('f1-a', 340, 250, '画布', [
    rectNode('s1', 24, 24, 64, 64, '矩形', { fill: '#4e8ff4', cornerRadius: 4 }),
    rectNode('s2', 100, 24, 64, 64, '椭圆', { fill: '#3bc78c', cornerRadius: 32 }),
    rectNode('s3', 176, 50, 76, 4, '连线', { fill: '#f4b400', cornerRadius: 2 }),
    rectNode('b1', 24, 132, 76, 76, '形状A', { fill: '#4e8ff4', cornerRadius: 10 }),
    rectNode('b2', 64, 152, 76, 76, '形状B', { fill: '#3bc78c', cornerRadius: 10 }),
    rectNode('g1', 216, 132, 48, 48, '元素一', { fill: '#9a6ee8', cornerRadius: 6 }),
    rectNode('g2', 268, 160, 48, 48, '元素二', { fill: '#f06595', cornerRadius: 6 }),
  ])
  return [frame]
}

const f1Script: DemoStep[] = [
  { type: 'wait', ms: 600 },
  { type: 'show', ids: ['s1'] }, { type: 'wait', ms: 260 },
  { type: 'show', ids: ['s2'] }, { type: 'wait', ms: 260 },
  { type: 'show', ids: ['s3'] }, { type: 'wait', ms: 420 },
  { type: 'highlight', ids: ['b1', 'b2'], hold: 700 },
  { type: 'wait', ms: 200 },
  { type: 'style', id: 'b2', patch: { fill: '#6f63d9' }, ms: 450 },
  { type: 'wait', ms: 400 },
  { type: 'highlight', ids: ['g1', 'g2'], hold: 700 },
  { type: 'move', id: 'g1', x: 232, y: 148, ms: 420 },
  { type: 'move', id: 'g2', x: 284, y: 148, ms: 420 },
  { type: 'wait', ms: 700 },
  { type: 'loop' },
]

/** F2 图层与页面：元素依次淡入+高亮 → 隐藏/显示 → 新建页面淡入 */
const f2Scene = (): LayerNode[] => {
  const pageA = frameNode('f2-a', 320, 240, '页面一', [
    rectNode('l1', 24, 24, 272, 56, '导航栏', { fill: '#eef3fb', cornerRadius: 8 }),
    rectNode('l2', 24, 96, 272, 84, '内容块', { fill: '#f2f7f4', cornerRadius: 8 }),
    rectNode('l3', 24, 196, 120, 28, '按钮', { fill: BLUE, cornerRadius: 6 }),
    textNode('l3-text', 24, 202, 120, '完成', '按钮文字', { color: WHITE, fontSize: 11, textAlign: 'center' }),
  ])
  const pageB = frameNode('f2-b', 320, 240, '页面二', [
    rectNode('n1', 24, 24, 272, 180, '新页面内容', { fill: '#fdf3e3', cornerRadius: 12 }),
    textNode('n1-text', 24, 104, 272, '新页面已创建', '新页面文字', { color: '#c58a2d', fontSize: 16, fontWeight: 700, textAlign: 'center' }),
  ])
  return [pageA, pageB]
}

const f2Script: DemoStep[] = [
  { type: 'wait', ms: 600 },
  { type: 'show', ids: ['l1'] }, { type: 'highlight', ids: ['l1'], hold: 550 },
  { type: 'show', ids: ['l2'] }, { type: 'highlight', ids: ['l2'], hold: 550 },
  { type: 'show', ids: ['l3', 'l3-text'] }, { type: 'highlight', ids: ['l3'], hold: 550 },
  { type: 'wait', ms: 400 },
  { type: 'style', id: 'l2', patch: { opacity: 0.18 }, ms: 350 },   // 隐藏图层
  { type: 'wait', ms: 500 },
  { type: 'style', id: 'l2', patch: { opacity: 1 }, ms: 350 },     // 重新显示
  { type: 'wait', ms: 500 },
  { type: 'transition', from: 'f2-a', to: 'f2-b', mode: 'fade', ms: 420 }, // 新建页面切换
  { type: 'wait', ms: 1000 },
  { type: 'transition', from: 'f2-b', to: 'f2-a', mode: 'fade', ms: 420 },
  { type: 'wait', ms: 700 },
  { type: 'loop' },
]

/** F3 样式与属性：卡片逐项插值（填充色→圆角→阴影→透明度），每项高亮标签 */
const f3Scene = (): LayerNode[] => {
  const frame = frameNode('f3-a', 340, 250, '画布', [
    rectNode('card', 52, 32, 220, 130, '卡片', {
      fill: '#eef3fb', cornerRadius: 10, shadow: '0 2px 8px rgba(39,60,70,0.08)',
    }),
    rectNode('chip', 56, 192, 14, 14, '圆点', { fill: BLUE, cornerRadius: 7 }),
    textNode('cap', 80, 192, 220, '填充色', '属性标签', { fontSize: 12, fontWeight: 600, color: MUTED }),
  ])
  return [frame]
}

const f3Script: DemoStep[] = [
  { type: 'wait', ms: 600 },
  { type: 'show', ids: ['card'] },
  { type: 'show', ids: ['chip', 'cap'] },
  { type: 'wait', ms: 400 },
  { type: 'highlight', ids: ['chip', 'cap'], hold: 600 },
  { type: 'text', id: 'cap', content: '填充色', ms: 120 },
  { type: 'style', id: 'card', patch: { fill: '#4e8ff4' }, ms: 520 },
  { type: 'wait', ms: 300 },
  { type: 'text', id: 'cap', content: '圆角', ms: 120 },
  { type: 'style', id: 'card', patch: { cornerRadius: 26 }, ms: 520 },
  { type: 'wait', ms: 300 },
  { type: 'text', id: 'cap', content: '阴影', ms: 120 },
  { type: 'style', id: 'card', patch: { shadow: '0 12px 30px rgba(39,60,70,0.28)' }, ms: 520 },
  { type: 'wait', ms: 300 },
  { type: 'text', id: 'cap', content: '透明度', ms: 120 },
  { type: 'style', id: 'card', patch: { opacity: 0.5 }, ms: 520 },
  { type: 'wait', ms: 600 },
  { type: 'loop' },
]

/** F4 组件库与主组件：按钮实例淡入 → 进入编辑主组件（标签高亮）→ 改色 → 全部实例同步 */
const f4Scene = (): LayerNode[] => {
  const frame = frameNode('f4-a', 340, 250, '画布', [
    textNode('f4-cap', 24, 18, 220, '进入「编辑主组件」', '提示', { fontSize: 12, fontWeight: 600, color: MUTED }),
    compNode('f4-b1', '按钮', 24, 54),
    compNode('f4-b2', '按钮', 24, 110),
    compNode('f4-b3', '按钮', 24, 166),
  ])
  return [frame]
}

const f4Script: DemoStep[] = [
  { type: 'wait', ms: 600 },
  { type: 'show', ids: ['f4-cap'] },
  { type: 'show', ids: ['f4-b1', 'f4-b2', 'f4-b3'] },
  { type: 'wait', ms: 400 },
  { type: 'highlight', ids: ['f4-cap'], hold: 700 },
  { type: 'highlight', ids: ['f4-b1', 'f4-b2', 'f4-b3'], hold: 700 },
  { type: 'propsCycle', id: 'f4-b1', presets: [{ bg: GREEN }], hold: 320 },
  { type: 'propsCycle', id: 'f4-b2', presets: [{ bg: GREEN }], hold: 320 },
  { type: 'propsCycle', id: 'f4-b3', presets: [{ bg: GREEN }], hold: 800 },
  { type: 'wait', ms: 500 },
  { type: 'loop' },
]

/** F5 实例与变体：交互态循环（默认→悬停→按下→禁用）+ 变体配色切换 */
const f5Scene = (): LayerNode[] => {
  const frame = frameNode('f5-a', 340, 240, '画布', [
    textNode('f5-cap', 24, 18, 220, '交互状态', '状态标签', { fontSize: 12, fontWeight: 600, color: MUTED }),
    compNode('f5-btn', '按钮', 100, 84),
    textNode('f5-cap2', 24, 180, 220, '变体配色', '变体标签', { fontSize: 12, fontWeight: 600, color: MUTED }),
  ])
  return [frame]
}

const f5Script: DemoStep[] = [
  { type: 'wait', ms: 600 },
  { type: 'show', ids: ['f5-cap', 'f5-cap2'] },
  { type: 'show', ids: ['f5-btn'] },
  { type: 'wait', ms: 400 },
  { type: 'highlight', ids: ['f5-btn'], hold: 600 },
  { type: 'state', id: 'f5-btn', state: 'default', hold: 650 },
  { type: 'state', id: 'f5-btn', state: 'hover', hold: 650 },
  { type: 'state', id: 'f5-btn', state: 'pressed', hold: 650 },
  { type: 'state', id: 'f5-btn', state: 'disabled', hold: 850 },
  { type: 'wait', ms: 250 },
  { type: 'state', id: 'f5-btn', state: 'default', hold: 350 },
  { type: 'highlight', ids: ['f5-cap2'], hold: 550 },
  { type: 'propsCycle', id: 'f5-btn', presets: [{ bg: GREEN }, { bg: '#f4b400' }], hold: 800 },
  { type: 'wait', ms: 450 },
  { type: 'loop' },
]

/** F6 自动布局：容器内元素 方向切换/间距变化/增删重排 动画 */
const f6Scene = (): LayerNode[] => {
  const frame = frameNode('f6-a', 320, 220, '画布', [
    rectNode('ctn', 20, 24, 250, 152, '自动布局容器', { fill: '#eef3fb', cornerRadius: 8 }),
    rectNode('h1', 36, 56, 40, 40, '元素一', { fill: BLUE, cornerRadius: 6 }),
    rectNode('h2', 100, 56, 40, 40, '元素二', { fill: GREEN, cornerRadius: 6 }),
    rectNode('h3', 164, 56, 40, 40, '元素三', { fill: '#f4b400', cornerRadius: 6 }),
  ])
  return [frame]
}

const f6Script: DemoStep[] = [
  { type: 'wait', ms: 600 },
  { type: 'show', ids: ['ctn', 'h1', 'h2', 'h3'] },
  { type: 'wait', ms: 400 },
  { type: 'highlight', ids: ['ctn'], hold: 600 },
  // 方向切换：横 → 竖
  { type: 'move', id: 'h1', x: 36, y: 64, ms: 420 },
  { type: 'move', id: 'h2', x: 36, y: 106, ms: 420 },
  { type: 'move', id: 'h3', x: 36, y: 148, ms: 420 },
  { type: 'wait', ms: 520 },
  // 竖 → 横
  { type: 'move', id: 'h1', x: 36, y: 56, ms: 420 },
  { type: 'move', id: 'h2', x: 100, y: 56, ms: 420 },
  { type: 'move', id: 'h3', x: 164, y: 56, ms: 420 },
  { type: 'wait', ms: 420 },
  // 间距变化：拉开
  { type: 'move', id: 'h2', x: 114, y: 56, ms: 420 },
  { type: 'move', id: 'h3', x: 192, y: 56, ms: 420 },
  { type: 'wait', ms: 520 },
  // 恢复间距
  { type: 'move', id: 'h2', x: 100, y: 56, ms: 420 },
  { type: 'move', id: 'h3', x: 164, y: 56, ms: 420 },
  { type: 'wait', ms: 420 },
  // 删除元素二 → 元素三前移补位（自动重排）
  { type: 'style', id: 'h2', patch: { opacity: 0 }, ms: 350 },
  { type: 'move', id: 'h3', x: 100, y: 56, ms: 450 },
  { type: 'wait', ms: 700 },
  { type: 'loop' },
]

/** F7 智能动画：A/B 两帧同层名元素位置/尺寸/颜色/圆角自动插值循环 */
const f7Scene = (): LayerNode[] => {
  const cardA = frameNode('f-a', 320, 240, '首页', [
    rectNode('a-hero', 20, 20, 280, 120, '主卡', { fill: '#eef3fb', cornerRadius: 12 }),
    textNode('a-title', 40, 46, 240, '智能动画演示', '标题', { fontSize: 17, fontWeight: 700, color: INK }),
    rectNode('a-btn', 40, 158, 120, 40, '按钮', { fill: BLUE, cornerRadius: 8 }),
    textNode('a-btn-text', 40, 168, 120, '点击查看', '按钮文字', { color: WHITE, fontSize: 12, textAlign: 'center' }),
    rectNode('a-line', 40, 96, 180, 8, '装饰条', { fill: '#4e8ff4', cornerRadius: 4, opacity: 0.5 }),
  ])
  const cardB = frameNode('f-b', 320, 240, '详情', [
    rectNode('b-hero', 60, 24, 200, 180, '主卡', { fill: '#e9f7f1', cornerRadius: 20 }),
    textNode('b-title', 84, 40, 160, '位置与尺寸变化', '标题', { fontSize: 14, fontWeight: 700, color: GREEN }),
    rectNode('b-btn', 110, 168, 100, 48, '按钮', { fill: GREEN, cornerRadius: 24 }),
    textNode('b-btn-text', 110, 182, 100, '点击查看', '按钮文字', { color: WHITE, fontSize: 12, textAlign: 'center' }),
    rectNode('b-line', 84, 72, 160, 14, '装饰条', { fill: GREEN, cornerRadius: 7, opacity: 0.9 }),
  ])
  return [cardA, cardB]
}

const f7Script: DemoStep[] = [
  { type: 'wait', ms: 700 },
  { type: 'highlight', ids: ['a-hero', 'a-title', 'a-btn'] },
  { type: 'wait', ms: 600 },
  { type: 'transition', from: 'f-a', to: 'f-b', mode: 'smart', ms: 1000 },
  { type: 'wait', ms: 1200 },
  { type: 'transition', from: 'f-b', to: 'f-a', mode: 'smart', ms: 1000 },
  { type: 'wait', ms: 1000 },
  { type: 'loop' },
]

/** F8 原型跳转：热点点击 → push/moveIn/fade 转场自动播放 */
const f8Scene = (): LayerNode[] => {
  const home = frameNode('f8-a', 320, 240, '首页', [
    rectNode('h-nav', 0, 0, 320, 48, '导航', { fill: '#ffffff' }),
    textNode('h-logo', 16, 14, 100, 'Logo', '品牌', { fontSize: 15, fontWeight: 700, color: INK }),
    rectNode('h-card', 20, 80, 280, 90, '卡片', { fill: '#eef3fb', cornerRadius: 12 }),
    textNode('h-card-text', 40, 112, 240, '点击下方按钮跳转', '卡片文字', { color: MUTED }),
    rectNode('h-btn', 90, 190, 140, 40, '跳转按钮', { fill: BLUE, cornerRadius: 8 }),
    textNode('h-btn-text', 90, 200, 140, '进入详情 →', '跳转文字', { color: WHITE, fontSize: 12, textAlign: 'center' }),
  ])
  const detail = frameNode('f8-b', 320, 240, '详情', [
    rectNode('d-bar', 0, 0, 320, 6, '顶条', { fill: BLUE }),
    textNode('d-title', 24, 40, 260, '详情页面', '详情标题', { fontSize: 20, fontWeight: 700, color: INK }),
    rectNode('d-img', 24, 80, 272, 90, '配图', { fill: '#eef3fb', cornerRadius: 12 }),
    textNode('d-text', 24, 186, 272, '这里展示完整的内容与信息', '详情文字', { color: MUTED, fontSize: 12 }),
    rectNode('d-back', 24, 210, 90, 28, '返回', { fill: '#f4f6f7', cornerRadius: 6 }),
    textNode('d-back-text', 24, 218, 90, '‹ 返回', '返回文字', { color: MUTED, fontSize: 11, textAlign: 'center' }),
  ])
  return [home, detail]
}

const f8Script: DemoStep[] = [
  { type: 'wait', ms: 800 },
  { type: 'highlight', ids: ['h-btn', 'h-btn-text'], hold: 800 },
  { type: 'wait', ms: 400 },
  { type: 'transition', from: 'f8-a', to: 'f8-b', mode: 'push', ms: 550 },
  { type: 'wait', ms: 1200 },
  { type: 'transition', from: 'f8-b', to: 'f8-a', mode: 'moveIn', ms: 550 },
  { type: 'wait', ms: 1200 },
  { type: 'transition', from: 'f8-a', to: 'f8-b', mode: 'fade', ms: 450 },
  { type: 'wait', ms: 1000 },
  { type: 'loop' },
]

/** F9 浮层 Overlay：浮层自动弹出 → 遮罩 → 关闭，循环 */
const f9Scene = (): LayerNode[] => {
  const base = frameNode('f9-a', 320, 240, '主界面', [
    textNode('m-title', 24, 24, 200, '浮层演示', '标题', { fontSize: 18, fontWeight: 700, color: INK }),
    rectNode('m-card', 24, 68, 272, 120, '卡片', { fill: '#eef3fb', cornerRadius: 12 }),
    textNode('m-card-text', 44, 110, 240, '点击按钮弹出浮层菜单', '卡片文字', { color: MUTED, fontSize: 12 }),
    rectNode('m-btn', 110, 210, 100, 32, '菜单按钮', { fill: BLUE, cornerRadius: 6 }),
    textNode('m-btn-text', 110, 218, 100, '打开浮层', '菜单文字', { color: WHITE, fontSize: 11, textAlign: 'center' }),
  ])
  const overlay = frameNode('f9-b', 220, 120, '浮层', [
    rectNode('o-head', 0, 0, 220, 34, '浮层头部', { fill: BLUE, cornerRadius: 12 }),
    textNode('o-head-text', 0, 9, 220, '浮层菜单', '头部文字', { color: WHITE, fontSize: 12, fontWeight: 600, textAlign: 'center' }),
    rectNode('o-i1', 16, 48, 188, 20, '选项一', { fill: '#f4f6f7', cornerRadius: 6 }),
    textNode('o-i1-text', 28, 52, 160, '选项一', '选项一文字', { color: INK, fontSize: 11 }),
    rectNode('o-i2', 16, 74, 188, 20, '选项二', { fill: '#f4f6f7', cornerRadius: 6 }),
    textNode('o-i2-text', 28, 78, 160, '选项二', '选项二文字', { color: INK, fontSize: 11 }),
    rectNode('o-i3', 16, 100, 188, 20, '选项三', { fill: '#f4f6f7', cornerRadius: 6 }),
    textNode('o-i3-text', 28, 104, 160, '选项三', '选项三文字', { color: INK, fontSize: 11 }),
  ])
  overlay.style.shadow = '0 12px 32px rgba(39,60,70,.18)'
  return [base, overlay]
}

const f9Script: DemoStep[] = [
  { type: 'wait', ms: 800 },
  { type: 'highlight', ids: ['m-btn', 'm-btn-text'], hold: 700 },
  { type: 'wait', ms: 400 },
  { type: 'transition', from: 'f9-a', to: 'f9-b', mode: 'overlay', ms: 320 },
  { type: 'wait', ms: 1600 },
  { type: 'transition', from: 'f9-b', to: 'f9-a', mode: 'overlay', ms: 240 },
  { type: 'wait', ms: 900 },
  { type: 'loop' },
]

/** F10 设备预览：手机 frame 内长内容自动滚动 + Flow 多 frame 平铺淡入 */
const f10Scene = (): LayerNode[] => {
  const phone = frameNode('f10-phone', 200, 300, '手机预览', [
    rectNode('p-nav', 0, 0, 200, 40, '导航', { fill: '#ffffff', cornerRadius: 16 }),
    textNode('p-logo', 12, 12, 120, '设备预览', '品牌', { fontSize: 13, fontWeight: 700, color: INK }),
    rectNode('p-b1', 12, 56, 176, 70, '内容块一', { fill: '#eef3fb', cornerRadius: 8 }),
    rectNode('p-b2', 12, 138, 176, 70, '内容块二', { fill: '#f2f7f4', cornerRadius: 8 }),
    rectNode('p-b3', 12, 220, 176, 70, '内容块三', { fill: '#fdf3e3', cornerRadius: 8 }),
    rectNode('p-b4', 12, 302, 176, 70, '内容块四', { fill: '#f0ecfa', cornerRadius: 8 }),
    rectNode('p-b5', 12, 384, 176, 70, '内容块五', { fill: '#fdeee9', cornerRadius: 8 }),
  ], { cornerRadius: 16, stroke: '#dbe2e5', strokeWidth: 1 })
  phone.overflow = 'verticalScroll'
  const flow = frameNode('f10-flow', 340, 220, 'Flow 视图', [
    rectNode('w1', 20, 20, 92, 168, '缩略一', { fill: '#eef3fb', cornerRadius: 8 }),
    rectNode('w2', 124, 20, 92, 168, '缩略二', { fill: '#f2f7f4', cornerRadius: 8 }),
    rectNode('w3', 228, 20, 92, 168, '缩略三', { fill: '#fdf3e3', cornerRadius: 8 }),
    textNode('w-cap', 20, 196, 300, 'Flow 多帧平铺', '说明', { fontSize: 11, color: MUTED, textAlign: 'center' }),
  ])
  return [phone, flow]
}

const f10Script: DemoStep[] = [
  { type: 'wait', ms: 700 },
  { type: 'show', ids: ['p-b1', 'p-b2', 'p-b3'] },
  { type: 'wait', ms: 400 },
  { type: 'highlight', ids: ['p-nav', 'p-logo'], hold: 600 },
  { type: 'scroll', id: 'f10-phone', dy: 220, ms: 1100 },
  { type: 'wait', ms: 600 },
  { type: 'transition', from: 'f10-phone', to: 'f10-flow', mode: 'fade', ms: 450 },
  { type: 'show', ids: ['w1', 'w2', 'w3', 'w-cap'] },
  { type: 'wait', ms: 1100 },
  { type: 'transition', from: 'f10-flow', to: 'f10-phone', mode: 'fade', ms: 450 },
  { type: 'wait', ms: 500 },
  { type: 'loop' },
]

/** F11 AI 助手：空白画布 → 组件逐块淡入拼出页面（模拟生成）→ 编辑变色 → 任务清单勾选 */
const f11Scene = (): LayerNode[] => {
  const frame = frameNode('f11-a', 340, 260, 'AI 生成页面', [
    // 以下节点初始隐藏（opacity 0），由脚本依次 show 揭示（模拟 AI 逐块生成）
    rectNode('i-nav', 20, 20, 300, 40, '导航', { fill: '#ffffff', cornerRadius: 6, stroke: '#e3e8ea', strokeWidth: 1, opacity: 0 }),
    textNode('i-logo', 32, 30, 100, 'Logo', '品牌', { fontWeight: 700, color: INK, opacity: 0 }),
    rectNode('i-hero', 20, 76, 300, 72, '主视觉', { fill: '#eef3fb', cornerRadius: 10, opacity: 0 }),
    textNode('i-hero-text', 36, 108, 260, 'AI 为你生成的页面', '主视觉文字', { color: MUTED, fontSize: 12, opacity: 0 }),
    rectNode('i-btn', 120, 164, 100, 32, '按钮', { fill: BLUE, cornerRadius: 6, opacity: 0 }),
    textNode('i-btn-text', 120, 172, 100, '立即开始', '按钮文字', { color: WHITE, fontSize: 11, textAlign: 'center', opacity: 0 }),
    rectNode('i-card', 20, 212, 300, 32, '任务卡片', { fill: '#f4f6f7', cornerRadius: 6, opacity: 0 }),
    rectNode('i-c1', 32, 222, 12, 12, '任务一勾选', { fill: '#c9d4d8', cornerRadius: 6, opacity: 0 }),
    textNode('i-c1-text', 52, 220, 200, '生成设计', '任务一', { fontSize: 11, color: MUTED, opacity: 0 }),
    rectNode('i-c2', 32, 222, 12, 12, '任务二勾选', { fill: '#c9d4d8', cornerRadius: 6, opacity: 0 }),
    textNode('i-c2-text', 52, 220, 200, '整理图层', '任务二', { fontSize: 11, color: MUTED, opacity: 0 }),
  ])
  return [frame]
}

const f11Script: DemoStep[] = [
  { type: 'wait', ms: 700 },
  { type: 'show', ids: ['i-nav', 'i-logo'] },
  { type: 'show', ids: ['i-hero', 'i-hero-text'] },
  { type: 'show', ids: ['i-btn', 'i-btn-text'] },
  { type: 'wait', ms: 500 },
  // AI 编辑：主视觉变色 + 按钮移位
  { type: 'style', id: 'i-hero', patch: { fill: '#e7f6f1' }, ms: 500 },
  { type: 'move', id: 'i-btn', x: 150, y: 164, ms: 450 },
  { type: 'wait', ms: 500 },
  // 任务清单：逐项勾选
  { type: 'show', ids: ['i-card', 'i-c1', 'i-c1-text', 'i-c2', 'i-c2-text'] },
  { type: 'style', id: 'i-c1', patch: { fill: GREEN }, ms: 300 },
  { type: 'wait', ms: 400 },
  { type: 'style', id: 'i-c2', patch: { fill: GREEN }, ms: 300 },
  { type: 'wait', ms: 800 },
  { type: 'loop' },
]

/** F12 文件与协作：项目卡片新建→归档→恢复；分享开关/评论气泡 */
const f12Scene = (): LayerNode[] => {
  const frame = frameNode('f12-a', 340, 250, '项目列表', [
    rectNode('c1', 24, 24, 292, 52, '项目卡一', { fill: '#ffffff', cornerRadius: 8, stroke: '#e3e8ea', strokeWidth: 1, shadow: '0 2px 8px rgba(39,60,70,.05)' }),
    textNode('c1-t', 40, 40, 200, '电商首页设计', '项目一标题', { fontSize: 13, fontWeight: 600, color: INK }),
    rectNode('c2', 24, 88, 292, 52, '项目卡二', { fill: '#ffffff', cornerRadius: 8, stroke: '#e3e8ea', strokeWidth: 1, shadow: '0 2px 8px rgba(39,60,70,.05)' }),
    textNode('c2-t', 40, 104, 200, '移动端组件库', '项目二标题', { fontSize: 13, fontWeight: 600, color: INK }),
    textNode('s-cap', 24, 170, 200, '分享开关', '分享标签', { fontSize: 12, fontWeight: 600, color: MUTED }),
    rectNode('s-tr', 150, 164, 44, 20, '分享轨道', { fill: '#d5dde1', cornerRadius: 10 }),
    rectNode('s-knob', 153, 167, 14, 14, '分享滑块', { fill: WHITE, cornerRadius: 7, shadow: '0 1px 3px rgba(20,35,42,.25)' }),
    rectNode('bub', 24, 206, 220, 30, '评论气泡', { fill: '#e8f2ff', cornerRadius: 8, opacity: 0 }),
    textNode('bub-t', 36, 213, 200, '已分享给 3 位协作者', '评论文字', { color: BLUE, fontSize: 11, opacity: 0 }),
  ])
  return [frame]
}

const f12Script: DemoStep[] = [
  { type: 'wait', ms: 600 },
  { type: 'show', ids: ['c1', 'c1-t', 'c2', 'c2-t'] },
  { type: 'wait', ms: 400 },
  { type: 'highlight', ids: ['c1'], hold: 600 },
  { type: 'move', id: 'c1', x: 24, y: 156, ms: 450 },   // 归档：下移
  { type: 'style', id: 'c1', patch: { opacity: 0.55 }, ms: 400 },
  { type: 'wait', ms: 500 },
  { type: 'move', id: 'c1', x: 24, y: 24, ms: 450 },    // 恢复：回原位
  { type: 'style', id: 'c1', patch: { opacity: 1 }, ms: 400 },
  { type: 'wait', ms: 450 },
  { type: 'show', ids: ['s-cap', 's-tr', 's-knob'] },
  { type: 'style', id: 's-tr', patch: { fill: BLUE }, ms: 350 },   // 分享开关打开
  { type: 'move', id: 's-knob', x: 177, y: 167, ms: 320 },
  { type: 'wait', ms: 350 },
  { type: 'show', ids: ['bub', 'bub-t'] },
  { type: 'wait', ms: 900 },
  { type: 'loop' },
]

// ============================== 组件教程（component） ==============================

interface CompDemo {
  id: string
  tplName: string
  title: string
  summary: string
  points?: string[]
  frameW: number
  frameH: number
  script: DemoStep[]
  stageW?: number
  stageH?: number
}

/** 由组件模板 + 脚本生成一篇组件教程（scene 引用模板 build，保证与组件库同步） */
function componentTutorial(d: CompDemo): TutorialEntry {
  const { frame, compId } = compFrame(d.id, d.tplName, d.frameW, d.frameH)
  const cid = compId
  // 脚本中的组件寻址 id 占位符 __cid__ 替换为真实 compId（ids：show/highlight；id：state/propsCycle/grow/chartGrow/move）
  const script: DemoStep[] = d.script.map((s) => {
    if (s.type === 'show' || s.type === 'highlight') {
      return { ...s, ids: s.ids.map((x) => (x === '__cid__' ? cid : x)) } as DemoStep
    }
    const maybe = s as { id?: string }
    if (maybe.id === '__cid__') {
      return { ...s, id: cid } as DemoStep
    }
    return s
  })
  return {
    id: d.id,
    group: 'library',
    kind: 'component',
    title: d.title,
    summary: d.summary,
    points: d.points,
    demo: {
      scene: () => [frame],
      script,
      width: d.stageW ?? d.frameW + 90,
      height: d.stageH ?? d.frameH + 90,
    },
  }
}

const COMPONENT_DEMOS: CompDemo[] = [
  {
    id: 'comp-button',
    tplName: '按钮',
    title: '按钮',
    summary: '可点击的交互按钮，常用于表单提交或触发操作；支持主题与交互状态。',
    points: ['文案 / 背景色 / 圆角 / 尺寸可调', '内置 悬停 / 按下 / 禁用 状态', '支持主题预设与变体'],
    frameW: 220, frameH: 120,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'state', id: '__cid__', state: 'default', hold: 650 },
      { type: 'state', id: '__cid__', state: 'hover', hold: 650 },
      { type: 'state', id: '__cid__', state: 'pressed', hold: 650 },
      { type: 'state', id: '__cid__', state: 'disabled', hold: 850 },
      { type: 'wait', ms: 250 },
      { type: 'state', id: '__cid__', state: 'default', hold: 300 },
      { type: 'propsCycle', id: '__cid__', presets: [{ text: '确认' }, { text: '提交', bg: GREEN }, { text: '按钮' }], hold: 800 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-input',
    tplName: '输入框',
    title: '输入框',
    summary: '供用户输入文本的表单区域，可绑定表单校验，支持占位文字。',
    points: ['占位文字 / 背景 / 边框色可调', '聚焦时边框高亮', '支持禁用 / 错误状态'],
    frameW: 300, frameH: 120,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [{ placeholder: '请输入内容…' }, { placeholder: '正在输入…', borderColor: BLUE }, { placeholder: '请输入内容…', borderColor: '#c9d4d8' }], hold: 850 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-image',
    tplName: '图片',
    title: '图片',
    summary: '展示图片内容的容器，可上传本地图片或粘贴图片地址。',
    points: ['点击选择本地图片上传', '支持粘贴图片地址', '可调节宽高与圆角'],
    frameW: 280, frameH: 220,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 700 },
      { type: 'move', id: '__cid__', x: 46, y: 60, ms: 480 },
      { type: 'wait', ms: 400 },
      { type: 'move', id: '__cid__', x: 40, y: 40, ms: 480 },
      { type: 'wait', ms: 600 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-navbar',
    tplName: '导航栏',
    title: '导航栏',
    summary: '页面顶部导航区，用于品牌 Logo 与功能菜单入口。',
    points: ['Logo 文案 / 菜单文案可改', '支持浅色 / 深色主题一键切换', '高度可调'],
    frameW: 360, frameH: 120,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { menuText: '首页 分类 我的' },
        { bg: '#263238', logoColor: '#ffffff', menuColor: '#b0bec5', menuText: '首页 分类 我的' },
        { bg: '#ffffff', logoColor: INK, menuColor: '#8a969b' },
      ], hold: 900 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-card',
    tplName: '卡片',
    title: '卡片',
    summary: '内容展示容器，适合将标题、图片与描述组合在一起。',
    points: ['标题 / 描述 / 图片高度可调', '支持浅色 / 深色主题', '背景与文字色可改'],
    frameW: 320, frameH: 240,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { title: '卡片标题', desc: '卡片描述文字', imgHeight: 90 },
        { title: '新品上架', desc: '点击查看详情', imgHeight: 110 },
        { title: '卡片标题', desc: '卡片描述文字', imgHeight: 90 },
      ], hold: 900 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-tag',
    tplName: '标签',
    title: '标签',
    summary: '短文本标识，用于状态、分类或关键词展示。',
    points: ['文案 / 背景色 / 文字色可调', '内置 蓝 / 绿 / 橙 / 红 / 灰 主题', '圆角可调'],
    frameW: 200, frameH: 100,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { text: '默认', bg: '#e8f2ff', color: BLUE },
        { text: '成功', bg: '#e6f9f1', color: '#2ea06b' },
        { text: '危险', bg: '#fdeeee', color: '#e5484d' },
        { text: '默认', bg: '#e8f2ff', color: BLUE },
      ], hold: 800 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-divider',
    tplName: '分割线',
    title: '分割线',
    summary: '水平分隔线，用于划分页面中的内容区块。',
    points: ['线条颜色可调', '粗细可调', '宽度可调'],
    frameW: 300, frameH: 90,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { thickness: 1 },
        { thickness: 3, lineColor: BLUE },
        { thickness: 1, lineColor: '#e3e8ea' },
      ], hold: 800 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-avatar',
    tplName: '头像',
    title: '头像',
    summary: '用户头像占位，显示昵称首字或自定义图片。',
    points: ['文案 / 背景色可调', '尺寸可调', '圆形显示'],
    frameW: 200, frameH: 120,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { avatarText: '张', bg: BLUE },
        { avatarText: '王', bg: GREEN, size: 52 },
        { avatarText: '李', bg: '#9a6ee8', size: 40 },
      ], hold: 850 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-progress',
    tplName: '进度条',
    title: '进度条',
    summary: '展示任务完成进度，支持百分比与配色调节。',
    points: ['百分比 0–100 可调', '进度色 / 轨道色可改', '宽度可调'],
    frameW: 280, frameH: 100,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [{ percent: 0, color: BLUE }, { percent: 0, color: GREEN }], hold: 350 },
      { type: 'grow', id: '__cid__', to: 200, ms: 1200 },
      { type: 'wait', ms: 700 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-switch',
    tplName: '开关',
    title: '开关',
    summary: '布尔状态切换控件，开 / 关两种状态。',
    points: ['默认开 / 关可设', '开启色可调', '宽度可调'],
    frameW: 200, frameH: 90,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { on: true }, { on: false }, { on: true }, { on: false }, { on: true },
      ], hold: 750 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-search',
    tplName: '搜索框',
    title: '搜索框',
    summary: '带圆角与放大镜图标的搜索输入区域，可输入关键词。',
    points: ['占位文字可改', '背景 / 边框色可调', '圆角与宽度可调'],
    frameW: 300, frameH: 110,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { placeholder: '搜索…' },
        { placeholder: '搜索组件或设计资源…', borderColor: BLUE },
        { placeholder: '搜索…', borderColor: '#e3e8ea' },
      ], hold: 850 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-list',
    tplName: '列表项',
    title: '列表项',
    summary: '单行内容展示，支持按行数重复，常见于列表或表格。',
    points: ['标题 / 描述可改', '行数 1–8 可调', '宽度可调'],
    frameW: 380, frameH: 200,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { rows: 2, title: '列表项标题', desc: '列表项描述' },
        { rows: 3, title: '设置项', desc: '点击进入设置' },
        { rows: 2, title: '列表项标题', desc: '列表项描述' },
      ], hold: 900 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-chart-bar',
    tplName: '柱状图',
    title: '柱状图',
    summary: '以柱状高度对比数据大小，适合展示分类数值。',
    points: ['数据类型 / 数据值可改', '配色可调', '可显示数值与图例'],
    frameW: 320, frameH: 230,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'chartGrow', id: '__cid__', ms: 900 },
      { type: 'wait', ms: 500 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { chartBars: [60, 40, 85, 70, 50, 90], chartColors: [BLUE, GREEN, '#f4b400', '#9a6ee8'] },
        { chartBars: [30, 65, 45, 80, 55, 70] },
        { chartBars: [40, 70, 55, 88, 62, 78] },
      ], hold: 850 },
      { type: 'wait', ms: 400 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-chart-line',
    tplName: '折线图',
    title: '折线图',
    summary: '以折线走势展示数据变化趋势，适合时间序列。',
    points: ['数据值可改', '配色可调', '可显示图例'],
    frameW: 320, frameH: 230,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { chartBars: [40, 70, 55, 88, 62, 78] },
        { chartBars: [70, 45, 85, 60, 40, 95], chartColors: ['#9a6ee8', BLUE] },
        { chartBars: [40, 70, 55, 88, 62, 78] },
      ], hold: 900 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-chart-pie',
    tplName: '饼图',
    title: '饼图',
    summary: '以扇形占比展示数据构成，适合占比类数据。',
    points: ['数据占比可改', '配色可调', '可显示图例'],
    frameW: 320, frameH: 230,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { chartBars: [35, 25, 20, 20] },
        { chartBars: [25, 35, 15, 25], chartColors: [GREEN, '#f4b400', BLUE, '#9a6ee8'] },
        { chartBars: [35, 25, 20, 20] },
      ], hold: 900 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
  {
    id: 'comp-chart-donut',
    tplName: '环形图',
    title: '环形图',
    summary: '饼图的环状变体，中心可放置强调信息。',
    points: ['数据占比可改', '配色可调', '环形中心可放信息'],
    frameW: 320, frameH: 230,
    script: [
      { type: 'wait', ms: 500 },
      { type: 'show', ids: ['__cid__'] },
      { type: 'highlight', ids: ['__cid__'], hold: 550 },
      { type: 'propsCycle', id: '__cid__', presets: [
        { chartBars: [35, 25, 20, 20] },
        { chartBars: [20, 30, 30, 20], chartColors: ['#f4b400', BLUE, GREEN, '#9a6ee8'] },
        { chartBars: [35, 25, 20, 20] },
      ], hold: 900 },
      { type: 'wait', ms: 500 },
      { type: 'loop' },
    ],
  },
]

// ============================== 自定义组件说明（custom） ==============================

const customScene = (): LayerNode[] => {
  const frame = frameNode('cst-a', 340, 250, '画布', [
    textNode('g-cap', 20, 20, 240, '选中分组', '步骤一', { fontSize: 12, fontWeight: 600, color: MUTED }),
    rectNode('g-bg', 20, 48, 180, 90, '分组', { fill: '#ffffff', cornerRadius: 10, stroke: '#e3e8ea', strokeWidth: 1, shadow: '0 2px 8px rgba(39,60,70,.05)' }),
    rectNode('g-av', 36, 66, 44, 44, '头像', { fill: '#e8f2ff', cornerRadius: 22 }),
    textNode('g-av-t', 36, 80, 44, '张', '头像字', { color: BLUE, fontSize: 16, fontWeight: 700, textAlign: 'center' }),
    rectNode('g-nm', 92, 70, 96, 12, '名称条', { fill: '#dfe6ea', cornerRadius: 6 }),
    rectNode('g-ds', 92, 92, 72, 10, '描述条', { fill: '#e8edef', cornerRadius: 5 }),
    textNode('t-cap', 20, 168, 240, '我的组件', '步骤二', { fontSize: 12, fontWeight: 600, color: MUTED }),
    rectNode('tile', 20, 192, 84, 40, '我的组件磁贴', { fill: '#eef3fb', cornerRadius: 8, opacity: 0 }),
    textNode('tile-t', 20, 204, 84, '我的卡片', '磁贴字', { color: BLUE, fontSize: 11, textAlign: 'center', opacity: 0 }),
    rectNode('tile2', 120, 192, 84, 40, '复用实例', { fill: '#f2f7f4', cornerRadius: 8, opacity: 0 }),
    textNode('tile2-t', 120, 204, 84, '拖入复用', '复用字', { color: GREEN, fontSize: 11, textAlign: 'center', opacity: 0 }),
  ])
  return [frame]
}

const customScript: DemoStep[] = [
  { type: 'wait', ms: 600 },
  { type: 'show', ids: ['g-cap', 'g-bg', 'g-av', 'g-av-t', 'g-nm', 'g-ds'] },
  { type: 'highlight', ids: ['g-bg'], hold: 700 },
  { type: 'text', id: 'g-cap', content: '选中分组 → 保存为组件', ms: 200 },
  { type: 'wait', ms: 400 },
  { type: 'show', ids: ['t-cap', 'tile', 'tile-t'] },
  { type: 'highlight', ids: ['tile'], hold: 700 },
  { type: 'wait', ms: 300 },
  { type: 'show', ids: ['tile2', 'tile2-t'] },
  { type: 'highlight', ids: ['tile2'], hold: 800 },
  { type: 'wait', ms: 600 },
  { type: 'loop' },
]

// ============================== 教程目录 ==============================

export const TUTORIAL_GROUPS: { id: TutorialGroup; label: string }[] = [
  { id: 'basic', label: '基础操作' },
  { id: 'library', label: '组件库' },
  { id: 'advanced', label: '高级能力' },
]

export const TUTORIALS: TutorialEntry[] = [
  // —— 基础操作 ——
  {
    id: 'f1-canvas-tools',
    group: 'basic', kind: 'feature',
    title: '画布与工具',
    summary: '选择 / 绘制 / 缩放 / 布尔 / 分组：常用画布工具让元素快速成形。',
    points: ['矩形、椭圆、连线等基本形状', '布尔运算合并 / 相减重叠形状', '多选分组整体移动'],
    demo: { scene: f1Scene, script: f1Script, width: 400, height: 310 },
  },
  {
    id: 'f2-layers-pages',
    group: 'basic', kind: 'feature',
    title: '图层与页面',
    summary: '图层树管理元素层级，页面组织多张画板，可自由隐藏 / 显示。',
    points: ['图层按顺序堆叠，高亮对应元素', '隐藏 / 显示快速聚焦内容', '新建页面并在页面间切换'],
    demo: { scene: f2Scene, script: f2Script, width: 380, height: 300 },
  },
  {
    id: 'f3-style-props',
    group: 'basic', kind: 'feature',
    title: '样式与属性',
    summary: '在检视面板调整外观：填充、圆角、阴影、透明度逐项实时生效。',
    points: ['填充色 / 渐变一键切换', '圆角、阴影、透明度插值变化', '修改即时预览不打断设计'],
    demo: { scene: f3Scene, script: f3Script, width: 400, height: 310 },
  },
  {
    id: 'f12-file-collab',
    group: 'basic', kind: 'feature',
    title: '文件与协作',
    summary: '新建 / 归档 / 恢复项目，一键分享并邀请协作者。',
    points: ['项目卡片可归档与恢复', '分享开关控制可见范围', '评论气泡同步协作动态'],
    demo: { scene: f12Scene, script: f12Script, width: 400, height: 310 },
  },
  // —— 组件库 ——
  {
    id: 'custom-component',
    group: 'library', kind: 'custom',
    title: '保存为自定义组件',
    summary: '把选中的分组一键保存为组件，出现在「我的组件」中可反复拖入复用。',
    points: ['选中分组 → 保存为组件', '「我的组件」中随时取用', '自定义组件可被 AI 助手调用'],
    demo: { scene: customScene, script: customScript, width: 400, height: 310 },
  },
  {
    id: 'f4-master-components',
    group: 'library', kind: 'feature',
    title: '组件库与主组件',
    summary: '从左侧组件库拖入组件；编辑主组件后，所有实例同步更新。',
    points: ['组件库内置常用基础组件', '进入「编辑主组件」修改', '一次修改批量同步到所有实例'],
    demo: { scene: f4Scene, script: f4Script, width: 400, height: 310 },
  },
  {
    id: 'f5-instance-variants',
    group: 'library', kind: 'feature',
    title: '实例与变体',
    summary: '实例可单独覆盖属性；组件集通过变体切换不同外观组合。',
    points: ['交互状态：默认 / 悬停 / 按下 / 禁用', '实例覆盖只影响当前实例', '变体下拉切换配色组合'],
    demo: { scene: f5Scene, script: f5Script, width: 400, height: 300 },
  },
  ...COMPONENT_DEMOS.map(componentTutorial),
  // —— 高级能力 ——
  {
    id: 'f6-auto-layout',
    group: 'advanced', kind: 'feature',
    title: '自动布局',
    summary: '容器内元素按方向 / 间距自动重排，增删元素自动补位。',
    points: ['方向切换：横排 ↔ 竖排', '间距可调自动铺开', '增删元素自动重排'],
    demo: { scene: f6Scene, script: f6Script, width: 380, height: 280 },
  },
  {
    id: 'f7-smart-animate',
    group: 'advanced', kind: 'feature',
    title: '智能动画',
    summary: '同名同结构图层的属性自动插值过渡，帧间位置 / 尺寸 / 颜色 / 圆角平滑变化。',
    points: ['创建两帧并保持图层同名同结构', '选择「智能动画」转场', '属性差异自动生成过渡动画'],
    demo: { scene: f7Scene, script: f7Script, width: 380, height: 300 },
  },
  {
    id: 'f8-prototype',
    group: 'advanced', kind: 'feature',
    title: '原型跳转',
    summary: '给元素添加跳转链接，点击热区即可播放 push / moveIn / fade 转场。',
    points: ['选中元素 → 原型面板添加链接', '支持 push / moveIn / fade / 智能动画', '点击热区自动播放转场'],
    demo: { scene: f8Scene, script: f8Script, width: 380, height: 300 },
  },
  {
    id: 'f9-overlay',
    group: 'advanced', kind: 'feature',
    title: '浮层 Overlay',
    summary: '浮层在原页面之上弹出，带遮罩背景，支持点击遮罩或 ESC 关闭。',
    points: ['浮层不替换页面，叠加显示', '支持居中 / 手动定位与半透明遮罩', '点击遮罩或按 ESC 关闭'],
    demo: { scene: f9Scene, script: f9Script, width: 380, height: 300 },
  },
  {
    id: 'f10-device-preview',
    group: 'advanced', kind: 'feature',
    title: '设备预览',
    summary: '以设备尺寸预览页面，frame 内可滚动浏览长内容；Flow 视图平铺多帧。',
    points: ['手机 frame 内自动滚动浏览', 'Flow 视图多帧平铺对比', '设备 / Flow 视图一键切换'],
    demo: { scene: f10Scene, script: f10Script, width: 400, height: 360 },
  },
  {
    id: 'f11-ai-assistant',
    group: 'advanced', kind: 'feature',
    title: 'AI 助手',
    summary: '用一句话生成设计稿：AI 逐块生成页面，也能继续编辑与整理任务清单。',
    points: ['自然语言生成页面', '对生成结果继续编辑', '自动整理任务清单并勾选'],
    demo: { scene: f11Scene, script: f11Script, width: 400, height: 320 },
  },
]
