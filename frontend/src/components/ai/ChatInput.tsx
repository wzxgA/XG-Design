interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  includeContext: boolean
  onToggleContext: (v: boolean) => void
}

export function ChatInput({ value, onChange, onSend, disabled, includeContext, onToggleContext }: Props) {
  return (
    <div className="ai-input-area">
      <div className="ai-input-row">
        <textarea
          className="ai-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder="描述你想要的设计…"
          rows={2}
          disabled={disabled}
        />
        <button
          className="ai-send-btn"
          onClick={onSend}
          disabled={disabled || !value.trim()}
        >
          {disabled ? '⏹' : '↑'}
        </button>
      </div>
      <label className="ai-context-toggle">
        <input
          type="checkbox"
          checked={includeContext}
          onChange={e => onToggleContext(e.target.checked)}
        />
        <span>附带当前画布上下文</span>
      </label>
    </div>
  )
}
