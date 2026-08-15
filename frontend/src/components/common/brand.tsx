// 图标与西瓜品牌组件（CSS/字符绘制）

import type { ReactNode } from 'react'

export type IconName =
  | 'cursor' | 'frame' | 'rect' | 'pen' | 'text' | 'comment' | 'grid'
  | 'search' | 'bell' | 'play' | 'eye' | 'lock' | 'chevron' | 'plus' | 'minus'
  | 'fit' | 'external' | 'layers' | 'components' | 'chart' | 'table'
  | 'settings' | 'folder' | 'spark' | 'copy' | 'link' | 'image'

const icons: Record<IconName, string> = {
  cursor: '↖', frame: '□', rect: '▱', pen: '⌁', text: 'T', comment: '◌', grid: '⊞',
  search: '⌕', bell: '♧', play: '▶', eye: '◉', lock: '▣', chevron: '⌄',
  plus: '+', minus: '−', fit: '⛶', external: '↗', layers: '◫', components: '◇',
  chart: '▥', table: '▤',   settings: '⚙', folder: '▰', spark: '✦', copy: '⧉', link: '⛓', image: '▧',
}

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <span className={`icon ${className}`} aria-hidden="true">{icons[name]}</span>
}

/** 睁眼图标（图层可见） */
export function EyeOpen({ className = '' }: { className?: string }) {
  return (
    <svg className={`eye-svg ${className}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** 闭眼图标（图层隐藏） */
export function EyeClosed({ className = '' }: { className?: string }) {
  return (
    <svg className={`eye-svg ${className}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.73 5.08A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

/** 上锁图标（图层锁定） */
export function LockClosed({ className = '' }: { className?: string }) {
  return (
    <svg className={`lock-svg ${className}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

/** 开锁图标（图层未锁定） */
export function LockOpen({ className = '' }: { className?: string }) {
  return (
    <svg className={`lock-svg ${className}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.8-1.4" />
      <path d="M18 7v4" />
    </svg>
  )
}

export function Watermelon({ className = '' }: { className?: string }) {
  return <span className={`watermelon ${className}`} aria-hidden="true"><i /><b /><em /><small /></span>
}

/** 组件库磁贴图标：与组件模板一一对应的 SVG 线性图标 */
const componentGlyphs: Record<string, ReactNode> = {
  按钮: (<><rect x="3" y="8" width="18" height="9" rx="4.5" /><line x1="9" y1="12.5" x2="15" y2="12.5" /></>),
  输入框: (<><rect x="3" y="8" width="18" height="9" rx="2" /><line x1="7" y1="10.5" x2="7" y2="14.5" /></>),
  图片: (<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="M21 15.5 16 10.5 6 19" /></>),
  导航栏: (<><rect x="3" y="8" width="18" height="8" rx="2" /><line x1="6.5" y1="12" x2="8.5" y2="12" /><line x1="11" y1="12" x2="13" y2="12" /><line x1="15.5" y1="12" x2="17.5" y2="12" /></>),
  卡片: (<><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="7.5" y1="16" x2="13" y2="16" /></>),
  标签: (<><path d="M3 3h8l10 10-8 8L3 11V3z" /><circle cx="7.5" cy="7.5" r="1.5" /></>),
  分割线: (<><line x1="4" y1="12" x2="20" y2="12" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="17" x2="16" y2="17" /></>),
  柱状图: (<><line x1="5" y1="20" x2="5" y2="12" /><line x1="10" y1="20" x2="10" y2="6" /><line x1="15" y1="20" x2="15" y2="14" /><line x1="20" y1="20" x2="20" y2="9" /></>),
}

export function ComponentGlyph({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg className={`component-glyph ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {componentGlyphs[name] ?? <rect x="4" y="4" width="16" height="16" rx="2" />}
    </svg>
  )
}
