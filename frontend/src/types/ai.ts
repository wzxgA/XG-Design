/** AI 对话消息 */
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  designSuggestion?: DesignSuggestion
  createdAt: string
  status: 'sending' | 'streaming' | 'done' | 'error'
}

/** AI 生成的设计建议 */
export interface DesignSuggestion {
  documentJson: string
  description: string
  parsedLayers: import('./design').LayerNode[]
}

/** 对话会话 */
export interface ChatSession {
  id: string
  title: string
  documentId: string | null
  messageCount: number
  lastMessageAt: string
  createdAt: string
}

/** SSE 流式事件 */
export interface ChatStreamEvent {
  type: 'text' | 'design' | 'done' | 'error'
  content: string
  sessionId: string
  messageId: string
}

/** 对话请求 */
export interface ChatRequest {
  sessionId?: string
  message: string
  documentId?: string
  documentTitle?: string
  currentDocument?: string
  selectedLayerId?: string
}
