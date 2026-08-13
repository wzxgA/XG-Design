import { useReducer, useEffect, useState, useCallback, useRef } from 'react'
import type { DesignDocument, EditorState, EditorAction, ToolType } from '../types/design'
import type { SaveStatus } from '../types/project'
import { editorReducer } from './editor-reducer'
import { starterDocument } from '../fixtures/starter-document'
import { repository, isConflictError } from '../services'
import type { DocumentRepository } from '../services'

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
    const isLegacyLayout =
      data.document.pages.length === 1 &&
      data.document.pages[0].children.filter((n) => n.type === 'frame').length > 1
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

/** 解析初始文档：优先 URL 项目 → 最近项目 → legacy（本地）→ 初始模板 */
async function loadInitial(
  repo: DocumentRepository,
  projectId?: string,
): Promise<{ doc: DesignDocument; fromProject: boolean }> {
  if (projectId) {
    try {
      const doc = await repo.getDocument(projectId)
      if (doc) return { doc, fromProject: true }
    } catch {
      // id 非法或文档不存在（如本地旧文档 id 非 UUID）→ 继续兜底
    }
  }
  const recent = (await repo.listDocuments())[0]
  if (recent) {
    const doc = await repo.getDocument(recent.id)
    if (doc) return { doc, fromProject: true }
  }
  if (repo.kind === 'local') {
    const legacy = loadLegacy()
    if (legacy?.document) return { doc: legacy.document, fromProject: false }
  }
  // 远程模式：兜底创建真实后端项目（获得 UUID），避免用本地非 UUID id 触发保存 500
  if (repo.kind === 'remote') {
    const meta = await repo.createDocument()
    const doc = await repo.getDocument(meta.id)
    if (doc) return { doc, fromProject: true }
  }
  return { doc: initDocument(), fromProject: false }
}

function blankState(): EditorState {
  return {
    document: initDocument(),
    selectedIds: ['grp-data-cards'],
    activeTool: 'select',
    zoom: 100,
    pan: { x: 0, y: 0 },
    leftPanelTab: 'layers',
    inspectorTab: 'design',
    history: { past: [], future: [] },
  }
}

interface ShareSession {
  token: string
  permission: 'view' | 'edit'
}

export function useEditorStore(projectId?: string, share?: ShareSession) {
  const [state, dispatch] = useReducer(editorReducer, undefined, blankState)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [conflict, setConflict] = useState(false)
  const [loadError, setLoadError] = useState('')
  // 分享链接的实际权限（由后端返回决定只读或可编辑）
  const [permission, setPermission] = useState<'view' | 'edit'>(share?.permission ?? 'edit')
  const loadedRef = useRef(false)
  const skipSaveRef = useRef(0)
  const sharedVersionRef = useRef(1)
  const stateRef = useRef(state)
  stateRef.current = state
  // 只读：非分享页默认可编辑；分享页由后端返回的权限决定
  const readOnly = !!share && permission === 'view'

  // 初始加载（异步）：成功后整文档载入，不触发“变更即保存”
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    setPermission(share?.permission ?? 'edit')
    loadedRef.current = false
    const load = share
      ? repository.openShared(share.token).then((r) => {
          setPermission(r.permission)
          sharedVersionRef.current = r.version
          return { doc: r.doc, fromProject: false }
        })
      : loadInitial(repository, projectId)

    load
      .then(({ doc, fromProject }) => {
        if (cancelled) return
        skipSaveRef.current += 1
        dispatch({ type: 'LOAD_DOCUMENT', doc, selectInitial: !fromProject && !share })
        loadedRef.current = true
        setLoading(false)
        setSaveStatus('saved')
        setDirty(false)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : '加载文档失败')
        loadedRef.current = true
        setLoading(false)
        setSaveStatus('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, share?.token, share?.permission])

  // 文档变更 → 防抖保存（409 时进入冲突态）；只读模式下跳过保存
  useEffect(() => {
    if (!loadedRef.current) return
    if (readOnly) return
    if (skipSaveRef.current > 0) {
      skipSaveRef.current -= 1
      return
    }
    setDirty(true)
    setSaveStatus('saving')
    const timer = window.setTimeout(async () => {
      try {
        const doc = state.document
        if (share) {
          // 通过分享链接保存（携带乐观锁版本号）
          const version = await repository.saveShared(share.token, doc, sharedVersionRef.current)
          sharedVersionRef.current = version
        } else if (repository.kind === 'local') {
          const projects = await repository.listDocuments()
          if (projects.some((p) => p.id === doc.id)) {
            await repository.updateDocument(doc.id, doc)
          } else {
            // 未纳入项目列表的文档（如初始/legacy），暂存到 legacy key，保持旧行为
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                version: 1,
                document: doc,
                zoom: state.zoom,
                pan: state.pan,
                selectedIds: state.selectedIds,
                leftPanelTab: state.leftPanelTab,
                inspectorTab: state.inspectorTab,
                activePageId: doc.activePageId,
              }),
            )
          }
        } else {
          await repository.updateDocument(doc.id, doc)
        }
        setSaveStatus('saved')
        setDirty(false)
      } catch (e) {
        console.error('[editor] 保存失败', e)
        setSaveStatus('error')
        if (isConflictError(e)) setConflict(true)
      }
    }, SAVE_DEBOUNCE)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.document])

  const createAndOpen = useCallback(async (name?: string) => {
    const meta = await repository.createDocument(name)
    window.location.hash = `#/doc/${meta.id}`
    window.location.reload()
    return meta
  }, [])

  /** 409 冲突处理：reload=加载服务器最新版；copy=用当前内容另存为新文件 */
  const resolveConflict = useCallback((action: 'reload' | 'copy') => {
    setConflict(false)
    const doc = stateRef.current.document
    if (action === 'reload') {
      repository
        .getDocument(doc.id)
        .then((latest) => {
          if (!latest) return
          skipSaveRef.current += 1
          dispatch({ type: 'LOAD_DOCUMENT', doc: latest, selectInitial: false })
          setSaveStatus('saved')
          setDirty(false)
        })
        .catch(() => {
          setSaveStatus('error')
        })
    } else {
      repository
        .createDocument(doc.name, doc)
        .then((meta) => {
          window.location.hash = `#/doc/${meta.id}`
          window.location.reload()
        })
        .catch(() => {
          setSaveStatus('error')
        })
    }
  }, [])

  return { state, dispatch, saveStatus, dirty, loading, conflict, loadError, readOnly, createAndOpen, resolveConflict }
}
