/** AI 对话消息 */
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  designSuggestion?: DesignSuggestion
  editSuggestion?: EditSuggestion
  createdAt: string
  status: 'sending' | 'streaming' | 'done' | 'error'
}

/** AI 生成的设计建议 */
export interface DesignSuggestion {
  documentJson: string
  description: string
  parsedLayers: import('./design').LayerNode[]
}

/** AI 修改操作（editDesign 工具产生） */
export type EditOperation =
  | { op: 'update'; id: string; patch: Partial<import('./design').LayerNode> & { style?: Partial<import('./design').LayerStyle> } }
  | { op: 'delete'; id: string }
  | { op: 'replace'; id: string; node: import('./design').LayerNode }

/** AI 修改操作建议 */
export interface EditSuggestion {
  operationsJson: string
  description: string
  parsedOperations: EditOperation[]
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
  type: 'text' | 'design' | 'edit' | 'done' | 'error'
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
