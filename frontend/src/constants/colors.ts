/**
 * 全局共享颜色常量（对应 styles.css 的 :root 品牌变量）
 * - 与 CSS 变量保持同步：--ink/--muted/--line/--panel/--blue/--green/--red
 * - TS 侧（style 对象/画布渲染）无法使用 var()，统一从这里取值
 */

/** 品牌蓝 */
export const BLUE = '#4e8ff4'
/** 品牌绿 */
export const GREEN = '#3bc78c'
/** 品牌红（危险色） */
export const RED = '#ea4335'
/** 正文墨色 */
export const INK = '#1c252c'
/** 次级文字 */
export const MUTED = '#5c6b72'
/** 更浅的次级文字 */
export const LIGHT_MUTED = '#9aa5aa'
/** 分割线/描边 */
export const LINE = '#e2e7e9'
/** 浅底（画板白除外） */
export const LIGHT_BG = '#eef1f2'
/** 卡片/面板浅底 */
export const PANEL_BG = '#fbfcfc'
/** 画板背景白 */
export const WHITE = '#ffffff'
/** 矩形默认填充（浅灰蓝） */
export const RECT_FILL = '#e5ebef'
/** 边框灰 */
export const BORDER = '#b9c4c9'
/** 图片占位浅底 */
export const IMAGE_PLACEHOLDER = '#eef2f4'
/** 图表默认色板 */
export const CHART_COLORS = ['#4e8ff4', '#3bc78c', '#ffb020', '#9a6ee8', '#f06595', '#20c4c9']
/** 选中高亮 */
export const SELECTION = '#4e8ff4'

/** 头像色板（TopToolbar / ShareModal 共享，勿重复定义） */
export const AVATAR_COLORS = ['#f1a46d', '#8ba4dc', '#70c69b', '#e07b9c', '#a78bdc', '#6dc5d6']

/** 根据任意字符串 seed 稳定取头像颜色 */
export function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
