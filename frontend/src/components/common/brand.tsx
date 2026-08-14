// 图标与西瓜品牌组件（CSS/字符绘制）

export type IconName =
  | 'cursor' | 'frame' | 'rect' | 'pen' | 'text' | 'comment' | 'grid'
  | 'search' | 'bell' | 'play' | 'eye' | 'lock' | 'chevron' | 'plus' | 'minus'
  | 'fit' | 'external' | 'layers' | 'components' | 'chart' | 'table'
  | 'settings' | 'folder' | 'spark' | 'copy' | 'link'

const icons: Record<IconName, string> = {
  cursor: '↖', frame: '□', rect: '▱', pen: '⌁', text: 'T', comment: '◌', grid: '⊞',
  search: '⌕', bell: '♧', play: '▶', eye: '◉', lock: '▣', chevron: '⌄',
  plus: '+', minus: '−', fit: '⛶', external: '↗', layers: '◫', components: '◇',
  chart: '▥', table: '▤', settings: '⚙', folder: '▰', spark: '✦', copy: '⧉', link: '⛓',
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
