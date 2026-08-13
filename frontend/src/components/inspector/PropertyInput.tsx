import { useEffect, useState } from 'react'

interface Props {
  label: string
  value: number
  min?: number
  disabled?: boolean
  onChange: (value: number) => void
  onCommit?: () => void
}

/**
 * 数字属性输入框：本地编辑，失焦或 Enter 提交，
 * 非法值回退最近合法值，支持最小尺寸约束。
 */
export function PropertyInput({ label, value, min, disabled = false, onChange, onCommit }: Props) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = () => {
    if (disabled) return
    const parsed = Number(text)
    if (!Number.isFinite(parsed)) {
      setText(String(value))
      return
    }
    let next = parsed
    if (min !== undefined) next = Math.max(min, next)
    onChange(next)
    setText(String(next))
    onCommit?.()
  }

  return (
    <div className="property-row">
      <label>{label}</label>
      <input
        className="property-input"
        type="number"
        value={text}
        min={min}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur() }
          if (e.key === 'Escape') { setText(String(value)) }
        }}
      />
    </div>
  )
}
