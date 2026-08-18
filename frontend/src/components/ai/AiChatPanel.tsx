import { useEffect, useState } from 'react'
import { useAiStore, aiActions } from '../../state/ai-store'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import type { AiProtoLink, EditOperation } from '../../types/ai'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from './ChatInput'
import { SessionSidebar } from './SessionSidebar'

/** 修改类关键词：检测到时自动勾选"附带当前画布上下文" */
const EDIT_KEYWORDS = ['改', '修改', '调整', '删除', '替换', '换成', '变成', '变成']

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

  // 输入含修改关键词时自动勾选上下文（用户可手动取消）
  const handleInputChange = (v: string) => {
    setInput(v)
    if (EDIT_KEYWORDS.some((k) => v.includes(k))) {
      setIncludeContext(true)
    }
  }

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

  const handleApply = (layers: LayerNode[], links?: AiProtoLink[]) => {
    dispatch({ type: 'APPLY_DESIGN', layers, links })
  }

  const handleApplyEdit = (operations: EditOperation[]) => {
    dispatch({ type: 'APPLY_EDIT', operations })
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

      <ChatMessageList messages={messages} isStreaming={isStreaming} onApply={handleApply} onApplyEdit={handleApplyEdit} />

      <div className="ai-footer">
        {isStreaming && (
          <button className="ai-stop-btn" onClick={handleStop}>停止生成</button>
        )}
        <ChatInput
          value={input}
          onChange={handleInputChange}
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
