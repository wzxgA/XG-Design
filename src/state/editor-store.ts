import { useReducer, useEffect } from 'react'
import type { DesignDocument, EditorState, EditorAction, ToolType } from '../types/design'
import { editorReducer } from './editor-reducer'
import { starterDocument } from '../fixtures/starter-document'

export type { EditorState, EditorAction, ToolType }

const STORAGE_KEY = 'xgdesign:editor:v1'
const SAVE_DEBOUNCE = 500

// 初始化：拷贝一份初始文档，避免共享引用被 reducer 修改
function initDocument(): DesignDocument {
  return JSON.parse(JSON.stringify(starterDocument)) as DesignDocument
}

interface PersistedState {
  version: number
  document: DesignDocument
  zoom: number
  pan: { x: number; y: number }
  selectedIds: string[]
  leftPanelTab: EditorState['leftPanelTab']
  inspectorTab: EditorState['inspectorTab']
  activePageId: string
}

function loadPersisted(): Partial<EditorState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PersistedState
    if (data.version !== 1 || !data.document) return null
    // 兼容旧数据：补齐原型连接字段
    if (!data.document.prototypeLinks) data.document.prototypeLinks = []
    // 旧结构迁移：早期版本是"单页含多 frame"，与原型跳转（按页面）不兼容，
    // 检测到该旧结构时放弃缓存，回退到新 fixture（每页一个 frame）。
    const isLegacyLayout = data.document.pages.length === 1 && data.document.pages[0].children.filter((n) => n.type === 'frame').length > 1
    if (isLegacyLayout) return null
    return {
      document: data.document,
      zoom: data.zoom ?? 100,
      pan: data.pan ?? { x: 0, y: 0 },
      selectedIds: data.selectedIds ?? [],
      leftPanelTab: data.leftPanelTab ?? 'layers',
      inspectorTab: data.inspectorTab ?? 'design',
    }
  } catch {
    return null
  }
}

export function createInitialState(): EditorState {
  const persisted = loadPersisted()
  const doc = persisted?.document ?? initDocument()
  return {
    document: doc,
    selectedIds: persisted?.selectedIds ?? ['grp-data-cards'],
    activeTool: 'select',
    zoom: persisted?.zoom ?? 100,
    pan: persisted?.pan ?? { x: 0, y: 0 },
    leftPanelTab: persisted?.leftPanelTab ?? 'layers',
    inspectorTab: persisted?.inspectorTab ?? 'design',
    history: { past: [], future: [] },
  }
}

function persist(state: EditorState) {
  const payload: PersistedState = {
    version: 1,
    document: state.document,
    zoom: state.zoom,
    pan: state.pan,
    selectedIds: state.selectedIds,
    leftPanelTab: state.leftPanelTab,
    inspectorTab: state.inspectorTab,
    activePageId: state.document.activePageId,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // 存储失败静默处理，UI 层的保存状态另行提示
  }
}

export function useEditorStore() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialState)

  // 自动保存（防抖）
  useEffect(() => {
    const timer = window.setTimeout(() => persist(state), SAVE_DEBOUNCE)
    return () => window.clearTimeout(timer)
  }, [state])

  return [state, dispatch] as const
}

export type EditorDispatch = (action: EditorAction) => void
