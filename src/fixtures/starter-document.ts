import type { DesignDocument, LayerNode, PageNode } from '../types/design'

let counter = 0
function uid(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

function frame(id: string, name: string, children: LayerNode[], expanded = true): LayerNode {
  return { id, type: 'frame', name, x: 0, y: 0, width: 1440, height: 900, rotation: 0, visible: true, locked: false, expanded, style: { opacity: 1, fill: '#ffffff' }, children }
}

function group(id: string, name: string, x: number, y: number, width: number, height: number, children: LayerNode[] = [], expanded = true): LayerNode {
  return { id, type: 'group', name, x, y, width, height, rotation: 0, visible: true, locked: false, expanded, style: { opacity: 1 }, children }
}

function rect(id: string, name: string, x: number, y: number, width: number, height: number, style: LayerNode['style'] = {}): LayerNode {
  return { id, type: 'rectangle', name, x, y, width, height, rotation: 0, visible: true, locked: false, style: { opacity: 1, fill: '#e5ebef', ...style }, children: [] }
}

function text(id: string, name: string, x: number, y: number, width: number, height: number, content: string, style: LayerNode['style'] = {}): LayerNode {
  return { id, type: 'text', name, x, y, width, height, rotation: 0, visible: true, locked: false, content, style: { opacity: 1, color: '#5c6b72', fontSize: 14, fontWeight: 600, ...style }, children: [] }
}

function chart(id: string, name: string, x: number, y: number, width: number, height: number, chartBars: number[] = []): LayerNode {
  return { id, type: 'chart', name, x, y, width, height, rotation: 0, visible: true, locked: false, chartBars, style: { opacity: 1 }, children: [] }
}

// ---- 单个统计卡片数据 ----
function statCard(id: string, label: string, value: string, delta: string, trend: number[]) {
  return group(id, label, 0, 0, 274, 168, [
    rect(`${id}-bg`, '卡片背景', 0, 0, 274, 168, { fill: '#ffffff', cornerRadius: 8, shadow: '0 3px 10px rgba(39,60,70,0.025)', stroke: '#e8edef', strokeWidth: 1 }),
    text(`${id}-title`, '指标标题', 16, 16, 120, 14, label, { fontSize: 10, color: '#97a3a8', fontWeight: 500 }),
    text(`${id}-value`, '指标数值', 16, 36, 200, 30, value, { fontSize: 24, color: '#35434a', fontWeight: 700 }),
    text(`${id}-delta`, '环比', 16, 78, 120, 12, `↗ ${delta}`, { fontSize: 10, color: '#3bc78c', fontWeight: 500 }),
    chart(`${id}-trend`, '趋势图表', 16, 100, 200, 40, trend),
  ])
}

// ---- 数据卡片组（当前默认选中）----
const dashboardCardGroup = group('grp-data-cards', '数据卡片组', 280, 160, 1136, 168, [
  statCard('card-1', '总项目', '24', '+12.5%', [30, 45, 40, 60, 55, 75, 90]),
  statCard('card-2', '进行中', '08', '+4.2%', [50, 60, 45, 70, 65, 55, 70]),
  statCard('card-3', '团队成员', '36', '+8.1%', [40, 35, 50, 45, 60, 50, 65]),
  statCard('card-4', '本月产出', '128', '+18.4%', [25, 40, 55, 45, 70, 80, 95]),
])

// 图表卡片（左侧大图：柱状图）
const activityCard = group('grp-activity', '项目活跃度', 0, 0, 640, 206, [
  rect('rect-activity-bg', '图表背景', 0, 0, 640, 206, { fill: '#ffffff', cornerRadius: 8, stroke: '#e8edef', strokeWidth: 1 }),
  text('txt-activity-title', '图表标题', 16, 14, 160, 14, '项目活跃度', { fontSize: 12, color: '#58666d', fontWeight: 700 }),
  text('txt-activity-period', '周期', 440, 15, 180, 12, '最近 7 天 ⌄', { fontSize: 10, color: '#9da8ac', fontWeight: 400 }),
  chart('chart-activity', '活跃度柱状图', 16, 44, 608, 148, [54, 72, 48, 88, 62, 78, 65]),
])

// 最近项目列表卡片（右侧）
const recentCard = group('grp-recent', '最近项目', 652, 0, 432, 206, [
  rect('rect-recent-bg', '列表背景', 0, 0, 432, 206, { fill: '#ffffff', cornerRadius: 8, stroke: '#e8edef', strokeWidth: 1 }),
  text('txt-recent-title', '列表标题', 16, 14, 120, 14, '最近项目', { fontSize: 12, color: '#58666d', fontWeight: 700 }),
  text('txt-recent-more', '查看全部', 320, 15, 96, 12, '查看全部 ↗', { fontSize: 10, color: '#9da8ac', fontWeight: 400 }),
  group('grp-recent-rows', '列表行', 16, 40, 400, 152, [
    ...['品牌视觉升级', '移动端体验优化', '营销活动落地页', '设计系统 2.0'].map((name, i) =>
      group(`recent-row-${i}`, name, 0, i * 38, 400, 36, [
        rect(`recent-row-icon-${i}`, '图标', 0, 4, 28, 28, { fill: ['#ffc778', '#8eb3f0', '#f39492', '#70c9a8'][i], cornerRadius: 6 }),
        text(`recent-row-name-${i}`, '项目名', 38, 0, 200, 14, name, { fontSize: 11, color: '#59666c', fontWeight: 500 }),
        text(`recent-row-time-${i}`, '时间', 38, 18, 200, 11, `更新于 ${i + 1} 小时前`, { fontSize: 9, color: '#adb6b9', fontWeight: 400 }),
        rect(`recent-row-status-${i}`, '状态', 330, 4, 64, 20, { fill: ['#e4f7ee', '#fff2d9', '#e8f1ff', '#e4f7ee'][i], cornerRadius: 10 }),
        text(`recent-row-status-txt-${i}`, '状态文本', 338, 6, 48, 12, ['进行中', '审核中', '已完成', '进行中'][i], { fontSize: 9, color: ['#4d9c80', '#b08345', '#698cba', '#4d9c80'][i], fontWeight: 600 }),
      ]),
    ),
  ]),
])

// 主内容区
const mainContent = group('grp-main', '主内容区', 232, 64, 1208, 836, [
  text('txt-page-title', '页面标题', 24, 20, 320, 26, '欢迎回来，Alex ✦', { fontSize: 22, color: '#364249', fontWeight: 700 }),
  rect('rect-new-project', '新建项目按钮', 1000, 16, 168, 30, { fill: '#4e8ff4', cornerRadius: 6, shadow: '0 4px 7px rgba(78,143,244,0.16)' }),
  text('txt-new-project', '按钮文本', 1036, 22, 100, 16, '+ 新建项目', { fontSize: 11, color: '#ffffff', fontWeight: 600 }),
  dashboardCardGroup,
  group('grp-content-row', '内容行', 0, 352, 1136, 240, [activityCard, recentCard]),
])

const dashboardPage = frame('frame-dashboard', '仪表盘', [
  group('grp-topnav', '顶部导航栏', 0, 0, 1440, 64, [
    rect('rect-logo-block', 'Logo 占位', 24, 20, 32, 24, { fill: '#ff6172', cornerRadius: 6 }),
    text('txt-app-title', '应用标题', 66, 24, 120, 16, '工作台', { fontSize: 12, color: '#364249', fontWeight: 700 }),
    rect('rect-nav-search', '搜索框', 1040, 17, 240, 30, { fill: '#f1f4f5', cornerRadius: 6, stroke: '#e5eaec', strokeWidth: 1 }),
    text('txt-nav-search', '搜索提示', 1052, 24, 200, 14, '⌕ 搜索项目、成员或文件', { fontSize: 10, color: '#aab4b8', fontWeight: 400 }),
    text('txt-nav-avatar', '头像', 1340, 18, 28, 28, 'A', { fontSize: 11, color: '#ffffff', fontWeight: 700 }),
  ]),
  group('grp-sidebar', '侧边菜单', 0, 64, 232, 836, [
    text('txt-side-title', '侧边标题', 24, 20, 120, 14, '工作台', { fontSize: 11, color: '#96a1a5', fontWeight: 700 }),
    ...['仪表盘', '项目管理', '团队成员', '数据分析', '资源中心'].map((item, i) =>
      group(`side-item-${i}`, item, 16, 44 + i * 34, 200, 28, [
        rect(`side-item-bg-${i}`, '菜单背景', 0, 0, 200, 28, { fill: i === 0 ? '#eaf3ff' : '#f4f7f8', cornerRadius: 6 }),
        text(`side-item-txt-${i}`, '菜单文字', 12, 7, 176, 14, item, { fontSize: 11, color: i === 0 ? '#4e8ff4' : '#8a969b', fontWeight: i === 0 ? 700 : 500 }),
      ]),
    ),
    text('txt-side-bottom', '底部设置', 24, 780, 160, 14, '⚙ 系统设置', { fontSize: 11, color: '#9aa5a9', fontWeight: 400 }),
  ]),
  mainContent,
  group('grp-table', '数据表格', 280, 640, 1136, 220, [
    rect('rect-table', '表格区域', 0, 0, 1136, 220, { fill: '#ffffff', cornerRadius: 8, stroke: '#e8edef', strokeWidth: 1 }),
    text('txt-table-title', '表格标题', 16, 14, 160, 14, '数据明细', { fontSize: 12, color: '#58666d', fontWeight: 700 }),
  ]),
])

const projectsPage = frame('frame-projects', '项目管理页', [])
const settingsPage = frame('frame-settings', '系统设置页', [])

const pages: PageNode[] = [
  { id: 'page-workbench', name: 'PC 端工作台', children: [dashboardPage, projectsPage, settingsPage] },
]

export const starterDocument: DesignDocument = {
  id: uid('doc'),
  name: '未命名设计稿',
  pages,
  activePageId: 'page-workbench',
  updatedAt: Date.now(),
}
