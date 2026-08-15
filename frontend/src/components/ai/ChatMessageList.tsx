import { useEffect, useRef } from 'react'
import type { ChatMessage, EditOperation } from '../../types/ai'
import type { LayerNode } from '../../types/design'
import { ChatMessageItem } from './ChatMessageItem'

interface Props {
  messages: ChatMessage[]
  isStreaming: boolean
  onApply?: (layers: LayerNode[]) => void
  onApplyEdit?: (operations: EditOperation[]) => void
}

export function ChatMessageList({ messages, isStreaming, onApply, onApplyEdit }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="ai-empty">
        <div className="ai-empty-icon">✦</div>
        <p>向 AI 描述你想要的设计，例如：</p>
        <ul>
          <li>「帮我设计一个登录页面」</li>
          <li>「生成一个仪表盘布局」</li>
          <li>「设计一个用户卡片组件」</li>
        </ul>
      </div>
    )
  }

  return (
    <div className="ai-msg-list">
      {messages.map(msg => (
        <ChatMessageItem key={msg.id} message={msg} onApply={onApply} onApplyEdit={onApplyEdit} />
      ))}
      <div ref={endRef} />
    </div>
  )
}
