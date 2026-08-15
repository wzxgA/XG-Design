import type { ChatSession } from '../../types/ai'

interface Props {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}

export function SessionSidebar({ sessions, currentSessionId, onSelect, onDelete, onCreate }: Props) {
  return (
    <div className="ai-sessions">
      <div className="ai-sessions-header">
        <span className="ai-sessions-title">会话</span>
        <button className="ai-new-session" onClick={onCreate} title="新建会话">+</button>
      </div>
      <div className="ai-session-list">
        {sessions.length === 0 && (
          <div className="ai-session-empty">暂无会话</div>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            className={`ai-session-item ${s.id === currentSessionId ? 'active' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <span className="ai-session-name">{s.title}</span>
            <button
              className="ai-session-del"
              onClick={e => { e.stopPropagation(); onDelete(s.id) }}
              title="删除"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
