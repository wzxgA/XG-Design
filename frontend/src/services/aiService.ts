import { api } from './http'
import type { ChatMessage, ChatSession, ChatStreamEvent, ChatRequest, DesignSuggestion } from '../types/ai'
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
  parseDesignSuggestion(json: string, description?: string): DesignSuggestion {
    const parsed = JSON.parse(json) as LayerNode[]
    // 防御：后端可能返回 null / 非数组，此时不生成设计建议
    if (!Array.isArray(parsed)) {
      throw new Error('设计数据格式错误')
    }
    // 规范化：补齐 AI 生成 JSON 中可能缺失的 children / style 等字段，避免渲染崩溃
    const normalized = parsed.map(normalizeLayer)
    return {
      documentJson: json,
      description: description ?? 'AI 生成的设计',
      parsedLayers: normalized,
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
