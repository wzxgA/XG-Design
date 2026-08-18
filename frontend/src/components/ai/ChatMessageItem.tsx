import ReactMarkdown from 'react-markdown'
import type { AiProtoLink, ChatMessage, EditOperation } from '../../types/ai'
import type { LayerNode } from '../../types/design'
import { DesignPreviewCard } from './DesignPreviewCard'
import { EditPreviewCard } from './EditPreviewCard'

interface Props {
  message: ChatMessage
  onApply?: (layers: LayerNode[], links?: AiProtoLink[]) => void
  onApplyEdit?: (operations: EditOperation[]) => void
}

export function ChatMessageItem({ message, onApply, onApplyEdit }: Props) {
  const isUser = message.role === 'user'

  const contentRenderer = (
    <div className="ai-msg-text">
      <ReactMarkdown>{message.content || ''}</ReactMarkdown>
    </div>
  )

  return (
    <div className={`ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-ai'}`}>
      <div className="ai-msg-avatar">
        {isUser ? '你' : '✦'}
      </div>
      <div className="ai-msg-bubble">
        {message.content && contentRenderer}
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
        {message.editSuggestion && Array.isArray(message.editSuggestion.parsedOperations) && (
          <EditPreviewCard
            operations={message.editSuggestion.parsedOperations}
            description={message.editSuggestion.description}
            onApply={onApplyEdit}
          />
        )}
      </div>
    </div>
  )
}
