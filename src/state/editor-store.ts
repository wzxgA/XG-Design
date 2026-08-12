import { useReducer, useEffect, useState, useCallback } from 'react'
import type { DesignDocument, EditorState, EditorAction, ToolType } from '../types/design'
import type { SaveStatus } from '../types/project'
import { editorReducer } from './editor-reducer'
import { starterDocument } from '../fixtures/starter-document'
import { localRepository } from '../services/documentRepository'

export type { EditorState, EditorAction, ToolType }
export type EditorDispatch = (action: EditorAction) => void

const SAVE_DEBOUNCE = 500

// 兼容旧版单文档持久化 key
const STORAGE_KEY = 'xgdesign:editor:v1'

function initDocument(): DesignDocument {
  return JSON.parse(JSON.stringify(starterDocument)) as DesignDocument
}

interface LegacyPersistedState {
  version: number
  document: DesignDocument
  zoom: number
  pan: { x: number; y: number }
  selectedIds: string[]
  leftPanelTab: EditorState['leftPanelTab']
  inspectorTab: EditorState['inspectorTab']
  activePageId: string
}

function loadLegacy(): Partial<EditorState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as LegacyPersistedState
    if (data.version !== 1 || !data.document) return null
    if (!data.document.prototypeLinks) data.document.prototypeLinks = []
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

/** 加载当前项目文档：优先 URL 指定的项目，其次最近项目，再回退 legacy/初始 */
function loadDocument(projectId?: string): { doc: DesignDocument; fromProject: boolean } {
  if (projectId) {
    const doc = localRepository.getDocument(projectId)
    if (doc) return { doc, fromProject: true }
  }
  const recent = localRepository.listDocuments()[0]
  if (recent) {
    const doc = localRepository.getDocument(recent.id)
    if (doc) return { doc, fromProject: true }
  }
  const legacy = loadLegacy()
  if (legacy?.document) return { doc: legacy.document, fromProject: false }
  return { doc: initDocument(), fromProject: false }
}

export function createInitialState(projectId?: string): EditorState {
  const { doc, fromProject } = loadDocument(projectId)
  return {
    document: doc,
    selectedIds: fromProject ? [] : ['grp-data-cards'],
    activeTool: 'select',
    zoom: 100,
    pan: { x: 0, y: 0 },
    leftPanelTab: 'layers',
    inspectorTab: 'design',
    history: { past: [], future: [] },
  }
}

export function useEditorStore(projectId?: string) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () => createInitialState(projectId))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dirty, setDirty] = useState(false)

  // 文档变更 → 标记未保存 + 防抖保存
  useEffect(() => {
    setDirty(true)
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      try {
        const projects = localRepository.listDocuments()
        if (projects.some((p) => p.id === state.document.id)) {
          localRepository.updateDocument(state.document.id, state.document)
          setSaveStatus('saved')
        } else {
          // 未纳入项目列表的文档（如初始/legacy），暂存到 legacy key，保持旧行为
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, document: state.document, zoom: state.zoom, pan: state.pan, selectedIds: state.selectedIds, leftPanelTab: state.leftPanelTab, inspectorTab: state.inspectorTab, activePageId: state.document.activePageId }))
            setSaveStatus('saved')
          } catch {
            setSaveStatus('error')
          }
        }
        setDirty(false)
      } catch {
        setSaveStatus('error')
      }
    }, SAVE_DEBOUNCE)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.document])

  const createAndOpen = useCallback((name?: string) => {
    const meta = localRepository.createDocument(name)
    // 打开新项目：通过 URL 变化 + 重置状态实现
    window.location.hash = `#/doc/${meta.id}`
    window.location.reload()
    return meta
  }, [])

  return { state, dispatch, saveStatus, dirty }
}
