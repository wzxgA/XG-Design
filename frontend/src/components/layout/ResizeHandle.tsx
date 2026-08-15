import { useEffect, useRef } from 'react'

interface Props {
  /** left：拖拽把手在侧栏右侧，向右拖动变大；right：把手在侧栏左侧，向左拖动变大 */
  side: 'left' | 'right'
  /** 当前宽度（null 表示未手动拖拽，走 CSS 默认/媒体查询） */
  value: number | null
  onChange: (v: number) => void
  min: number
  max: number
  /** 可用空间上限（画布区 clamp 用，传 workspace 宽度） */
  limit: number | null
}

/** 可拖拽的侧栏分隔条：指针拖拽调整侧栏宽度，并随窗口/容器变化自适应 clamp */
export function ResizeHandle({ side, value, onChange, min, max, limit }: Props) {
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startValRef = useRef(0)

  // 容器宽度变化时自适应：超过可用空间则 clamp（保持画布不被挤没）
  useEffect(() => {
    if (value === null || limit === null) return
    const capped = Math.min(Math.max(value, min), max, limit)
    if (capped !== value) onChange(capped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  const clamp = (v: number) => Math.min(Math.max(v, min), max, limit ?? Infinity)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    draggingRef.current = true
    startXRef.current = e.clientX
    startValRef.current = value ?? 0
    e.preventDefault()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return
      // 左侧栏：向右拖 = 变宽；右侧栏：向左拖 = 变宽
      const delta = side === 'left' ? ev.clientX - startXRef.current : startXRef.current - ev.clientX
      onChange(clamp(startValRef.current + delta))
    }
    const onUp = () => {
      draggingRef.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className={`resize-handle ${side}`}
      onPointerDown={onPointerDown}
      title="拖拽调整宽度"
    />
  )
}
