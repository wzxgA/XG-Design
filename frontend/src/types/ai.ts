/** AI 对话消息 */
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  designSuggestion?: DesignSuggestion
  editSuggestion?: EditSuggestion
  /** 任务清单（AI 先拆解需求得到的小任务列表） */
  taskPlan?: TaskItem[]
  /** 各任务的执行结果（taskId → 结果，用于打勾） */
  taskResults?: TaskResultItem[]
  createdAt: string
  status: 'sending' | 'streaming' | 'done' | 'error'
}

/** 任务清单中的单个任务（planTasks 工具产出） */
export interface TaskItem {
  taskId: string
  title: string
  description?: string
  /** 该任务使用的工具：generate（生成设计）/ edit（修改设计） */
  action?: 'generate' | 'edit' | string
}

/** 单个任务的执行结果（对应后端 TaskToolResult） */
export interface TaskResultItem {
  taskId: string
  /** 结果类型：design / edit */
  kind: 'design' | 'edit' | string
  /** 结果内容：design 为 LayerNode[] JSON；edit 为操作指令 JSON */
  content: string
  description?: string
  linksJson?: string
}

/** AI 生成的原型跳转声明（targetFrameId 在应用时映射为真实 pageId） */
export interface AiProtoLink {
  sourceLayerId: string
  targetFrameId: string
  transition: 'instant' | 'dissolve' | 'slide'
}

/** AI 生成的设计建议 */
export interface DesignSuggestion {
  documentJson: string
  description: string
  parsedLayers: import('./design').LayerNode[]
  /** 原型跳转声明（历史消息反序列化后可能缺失） */
  links?: AiProtoLink[]
}

/** AI 修改操作（editDesign 工具产生） */
export type EditOperation =
  | { op: 'update'; id: string; patch: Partial<import('./design').LayerNode> & { style?: Partial<import('./design').LayerStyle> } }
  | { op: 'delete'; id: string }
  | { op: 'replace'; id: string; node: import('./design').LayerNode }
  /** 新增子元素：parentId 为容器图层（frame/group）id 或页面 id（page-xxx）；新节点 id 由系统自动生成 */
  | { op: 'insert'; parentId: string; node: import('./design').LayerNode }

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
  type: 'text' | 'plan' | 'design' | 'edit' | 'done' | 'error'
  content: string
  sessionId: string
  messageId: string
  linksJson?: string
  /** 任务清单场景下的任务 ID；为空表示消息级结果 */
  taskId?: string
}

/** 对话请求 */
export interface ChatRequest {
  sessionId?: string
  message: string
  documentId?: string
  documentTitle?: string
  currentDocument?: string
  selectedLayerId?: string
  /** 组件库完整 schema JSON（由前端 COMPONENT_TEMPLATES 序列化），供 AI 提示词与后端 componentProps 校验 */
  componentSchema?: string
}
