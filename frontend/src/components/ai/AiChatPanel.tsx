import { useEffect, useState } from 'react'
import { useAiStore, aiActions } from '../../state/ai-store'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from './ChatInput'
import { SessionSidebar } from './SessionSidebar'

interface Props {
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
}

export function AiChatPanel({ state, dispatch, readOnly }: Props) {
  const { panelOpen, messages, isStreaming, sessions, currentSessionId } = useAiStore()
  const [input, setInput] = useState('')
  const [includeContext, setIncludeContext] = useState(true)
  const [showSessions, setShowSessions] = useState(false)

  // 面板首次打开时加载会话列表
  useEffect(() => {
    if (panelOpen && sessions.length === 0) {
      aiActions.loadSessions(state.document.id)
    }
  }, [panelOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    if (!input.trim() || isStreaming || readOnly) return
    aiActions.sendMessage({
      message: input,
      documentId: state.document.id,
      documentTitle: state.document.name,
      currentDocument: includeContext ? JSON.stringify(state.document) : undefined,
      selectedLayerId: state.selectedIds[0],
    })
    setInput('')
  }

  const handleApply = (layers: LayerNode[]) => {
    dispatch({ type: 'APPLY_DESIGN', layers })
  }

  const handleStop = () => {
    aiActions.abortStream()
  }

  if (!panelOpen) return null

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <h2 className="ai-title">AI 设计助手</h2>
        <div className="ai-header-actions">
          <button className="ai-header-btn" onClick={() => setShowSessions(v => !v)} title="会话列表">☰</button>
          <button className="ai-header-btn" onClick={aiActions.closePanel} title="关闭">×</button>
        </div>
      </div>

      {showSessions && (
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelect={(id) => { aiActions.selectSession(id); setShowSessions(false) }}
          onDelete={aiActions.deleteSession}
          onCreate={() => { aiActions.createSession(state.document.id); setShowSessions(false) }}
        />
      )}

      <ChatMessageList messages={messages} isStreaming={isStreaming} onApply={handleApply} />

      <div className="ai-footer">
        {isStreaming && (
          <button className="ai-stop-btn" onClick={handleStop}>停止生成</button>
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isStreaming || readOnly}
          includeContext={includeContext}
          onToggleContext={setIncludeContext}
        />
        {readOnly && <div className="ai-readonly-hint">只读模式下 AI 功能不可用</div>}
      </div>
    </div>
  )
}
