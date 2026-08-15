import { useState } from 'react'
import type { ChatMessage } from '../../types/ai'
import type { LayerNode } from '../../types/design'
import { DesignPreviewCard } from './DesignPreviewCard'

interface Props {
  message: ChatMessage
  onApply?: (layers: LayerNode[]) => void
}

export function ChatMessageItem({ message, onApply }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-ai'}`}>
      <div className="ai-msg-avatar">
        {isUser ? '你' : '✦'}
      </div>
      <div className="ai-msg-bubble">
        {message.content && (
          <div className="ai-msg-text">{message.content}</div>
        )}
        {!message.content && message.status === 'streaming' && (
          <div className="ai-typing">
            <span /><span /><span />
          </div>
        )}
        {message.status === 'error' && (
          <div className="ai-msg-error">请求失败</div>
        )}
        {message.designSuggestion && Array.isArray(message.designSuggestion.parsedLayers) && (
          <DesignPreviewCard suggestion={message.designSuggestion} onApply={onApply} />
        )}
      </div>
    </div>
  )
}
