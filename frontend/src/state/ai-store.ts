import { useSyncExternalStore } from 'react'
import { aiService } from '../services/aiService'
import type { ChatMessage, ChatSession, ChatStreamEvent } from '../types/ai'

// ===== 类型定义 =====

interface AiState {
  sessions: ChatSession[]
  currentSessionId: string | null
  messages: ChatMessage[]
  isStreaming: boolean
  panelOpen: boolean
  error: string | null
  _streamingMessageId: string | null
}

// ===== 模块级 Store（不依赖 zustand，使用 useSyncExternalStore）=====

let state: AiState = {
  sessions: [],
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  panelOpen: false,
  error: null,
  _streamingMessageId: null,
}

const listeners = new Set<() => void>()

function setState(partial: Partial<AiState>) {
  state = { ...state, ...partial }
  listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getState() {
  return state
}

// ===== Actions =====

export const aiActions = {
  openPanel: () => setState({ panelOpen: true }),
  closePanel: () => setState({ panelOpen: false }),
  togglePanel: () => setState({ panelOpen: !state.panelOpen }),

  loadSessions: async (documentId?: string) => {
    try {
      const sessions = await aiService.listSessions(documentId)
      setState({ sessions })
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : '加载会话失败' })
    }
  },

  createSession: async (documentId?: string) => {
    try {
      const session = await aiService.createSession(documentId)
      setState({
        sessions: [session, ...state.sessions],
        currentSessionId: session.id,
        messages: [],
      })
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : '创建会话失败' })
    }
  },

  selectSession: async (sessionId: string) => {
    setState({ currentSessionId: sessionId, messages: [] })
    try {
      const messages = await aiService.getMessages(sessionId)
      setState({ messages })
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : '加载消息失败' })
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await aiService.deleteSession(sessionId)
      setState({
        sessions: state.sessions.filter(x => x.id !== sessionId),
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        messages: state.currentSessionId === sessionId ? [] : state.messages,
      })
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : '删除会话失败' })
    }
  },

  sendMessage: async (params: {
    message: string
    documentId?: string
    documentTitle?: string
    currentDocument?: string
    selectedLayerId?: string
  }) => {
    const { message, ...context } = params

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: state.currentSessionId ?? '',
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
      status: 'done',
    }

    const aiMsgId = crypto.randomUUID()
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      sessionId: state.currentSessionId ?? '',
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    }

    setState({
      messages: [...state.messages, userMsg, aiMsg],
      isStreaming: true,
      error: null,
      _streamingMessageId: aiMsgId,
    })

    try {
      await aiService.chatStream(
        {
          sessionId: state.currentSessionId ?? undefined,
          message,
          ...context,
        },
        (event) => onStreamEvent(event, aiMsgId)
      )
    } catch (err) {
      setState({
        messages: state.messages.map(m =>
          m.id === aiMsgId ? { ...m, status: 'error' } : m
        ),
        error: err instanceof Error ? err.message : 'AI 请求失败',
      })
    } finally {
      setState({
        isStreaming: false,
        _streamingMessageId: null,
        messages: state.messages.map(m =>
          m.id === aiMsgId ? { ...m, status: 'done' } : m
        ),
      })
    }
  },

  abortStream: () => {
    aiService.abortChat()
    setState({ isStreaming: false, _streamingMessageId: null })
  },
}

// ===== 流式事件处理 =====

function onStreamEvent(event: ChatStreamEvent, streamingId: string) {
  if (event.type === 'text') {
    setState({
      messages: state.messages.map(m =>
        m.id === streamingId
          ? { ...m, content: m.content + event.content }
          : m
      ),
    })
  } else if (event.type === 'design') {
    try {
      const suggestion = aiService.parseDesignSuggestion(event.content, undefined, event.linksJson)
      setState({
        messages: state.messages.map(m =>
          m.id === streamingId
            ? { ...m, designSuggestion: suggestion }
            : m
        ),
      })
    } catch { /* skip invalid design JSON */ }
  } else if (event.type === 'edit') {
    try {
      const suggestion = aiService.parseEditOperations(event.content)
      setState({
        messages: state.messages.map(m =>
          m.id === streamingId
            ? { ...m, editSuggestion: suggestion }
            : m
        ),
      })
    } catch { /* skip invalid edit operations JSON */ }
  } else if (event.type === 'done') {
    if (event.sessionId && !state.currentSessionId) {
      setState({ currentSessionId: event.sessionId })
    }
  } else if (event.type === 'error') {
    setState({
      messages: state.messages.map(m =>
        m.id === streamingId
          ? { ...m, status: 'error', content: m.content || event.content }
          : m
      ),
      error: event.content,
    })
  }
}

// ===== React Hook =====

export function useAiStore(): AiState {
  return useSyncExternalStore(subscribe, getState, getState)
}
