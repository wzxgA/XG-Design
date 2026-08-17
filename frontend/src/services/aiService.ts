import { api } from './http'
import type { ChatMessage, ChatSession, ChatStreamEvent, ChatRequest, DesignSuggestion, EditOperation, EditSuggestion, AiProtoLink } from '../types/ai'
import type { LayerNode } from '../types/design'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export const aiService = {
  // --- 普通 REST API ---
  async listSessions(documentId?: string): Promise<ChatSession[]> {
    const params = documentId ? `?documentId=${documentId}` : ''
    return api.get<ChatSession[]>(`/api/ai/sessions${params}`)
  },

  async createSession(documentId?: string): Promise<ChatSession> {
    const params = documentId ? `?documentId=${documentId}` : ''
    return api.post<ChatSession>(`/api/ai/sessions${params}`)
  },

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    return api.get<ChatMessage[]>(`/api/ai/sessions/${sessionId}/messages`)
  },

  async deleteSession(sessionId: string): Promise<void> {
    await api.del(`/api/ai/sessions/${sessionId}`)
  },

  async updateTitle(sessionId: string, title: string): Promise<ChatSession> {
    return api.put<ChatSession>(`/api/ai/sessions/${sessionId}/title`, { title })
  },

  // --- SSE 流式对话 ---
  _abortController: null as AbortController | null,

  async chatStream(
    request: ChatRequest,
    onEvent: (event: ChatStreamEvent) => void
  ): Promise<void> {
    this._abortController = new AbortController()

    const token = localStorage.getItem('xgdesign:auth-token:v1') ?? ''

    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(request),
      signal: this._abortController.signal,
    })

    if (!response.ok) throw new Error(`AI 请求失败 (${response.status})`)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const json = line.slice(5).trim()
          if (json) {
            try {
              const event = JSON.parse(json) as ChatStreamEvent
              onEvent(event)
            } catch { /* skip malformed */ }
          }
        }
      }
    }
  },

  abortChat(): void {
    this._abortController?.abort()
    this._abortController = null
  },

  // --- 工具方法 ---
  parseDesignSuggestion(json: string, description?: string, linksJson?: string): DesignSuggestion {
    const parsed = JSON.parse(json) as LayerNode[]
    // 防御：后端可能返回 null / 非数组，此时不生成设计建议
    if (!Array.isArray(parsed)) {
      throw new Error('设计数据格式错误')
    }
    // 规范化：补齐 AI 生成 JSON 中可能缺失的 children / style 等字段，避免渲染崩溃
    const normalized = parsed.map(normalizeLayer)
    const links = this.parseLinks(linksJson)
    return {
      documentJson: json,
      description: description ?? 'AI 生成的设计',
      parsedLayers: normalized,
      links,
    }
  },

  /** 解析后端回传的跳转声明 JSON（非法/缺失时回退空数组） */
  parseLinks(linksJson?: string): AiProtoLink[] {
    if (!linksJson || !linksJson.trim()) return []
    try {
      const arr = JSON.parse(linksJson) as AiProtoLink[]
      if (!Array.isArray(arr)) return []
      return arr.filter((l) => l && l.sourceLayerId && l.targetFrameId)
    } catch {
      return []
    }
  },

  parseEditOperations(json: string, description?: string): EditSuggestion {
    const parsed = JSON.parse(json) as EditOperation[]
    if (!Array.isArray(parsed)) {
      throw new Error('修改操作数据格式错误')
    }
    // 校验每条操作；replace 的 node 递归规范化
    const validated = parsed.map((op) => {
      if (!op || typeof op !== 'object') throw new Error('修改操作格式错误')
      if (op.op === 'update') {
        if (!op.id) throw new Error('update 操作缺少 id')
        return op
      } else if (op.op === 'delete') {
        if (!op.id) throw new Error('delete 操作缺少 id')
        return op
      } else if (op.op === 'replace') {
        if (!op.id) throw new Error('replace 操作缺少 id')
        if (!op.node || !op.node.type) throw new Error('replace 操作缺少 node')
        return { ...op, node: normalizeLayer(op.node) }
      }
      throw new Error('未知操作类型: ' + (op as { op?: string }).op)
    })
    return {
      operationsJson: json,
      description: description ?? 'AI 修改建议',
      parsedOperations: validated,
    }
  },
}

/** 递归补齐 AI 生成图层缺失的字段（children/style/基础属性） */
function normalizeLayer(layer: LayerNode): LayerNode {
  return {
    ...layer,
    rotation: layer.rotation ?? 0,
    visible: layer.visible ?? true,
    locked: layer.locked ?? false,
    style: layer.style ?? {},
    children: Array.isArray(layer.children) ? layer.children.map(normalizeLayer) : [],
  }
}
