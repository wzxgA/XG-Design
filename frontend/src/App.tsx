import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEditorStore, type EditorDispatch, type EditorAction, type ToolType } from './state/editor-store'
import { TopToolbar } from './components/toolbar/TopToolbar'
import { LayersPanel } from './components/layers/LayersPanel'
import { CanvasArea } from './components/canvas/CanvasArea'
import { InspectorPanel } from './components/inspector/InspectorPanel'
import { PreviewOverlay } from './components/canvas/PreviewOverlay'
import { ProjectsModal } from './components/projects/ProjectsModal'
import { ShareModal } from './components/share/ShareModal'
import { AuthPage } from './components/auth/AuthPage'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { isAuthenticated, clearAuth, getCurrentUser } from './services/auth'
import type { UserDto } from './services/auth'
import { Watermelon } from './components/common/brand'

type Route =
  | { name: 'login'; redirectTo?: string }
  | { name: 'editor'; projectId?: string; share?: { token: string; permission: 'view' | 'edit' } }

/** 解析当前 hash 路由：/#/login / #/editor / #/doc/:id / #/share/:token */
function readRoute(): Route {
  const hash = window.location.hash
  if (/^#\/login/.test(hash)) {
    const m = hash.match(/#\/login(?:[?&]redirect=([^&]+))?/)
    const redirectTo = m?.[1] ? decodeURIComponent(m[1]) : undefined
    return { name: 'login', redirectTo }
  }
  const share = hash.match(/#\/share\/([^/]+)/)
  if (share) {
    // 实际权限（view/edit）由后端 /api/shared/{token} 返回，路由仅携带 token
    return { name: 'editor', share: { token: share[1], permission: 'edit' } }
  }
  const doc = hash.match(/#\/doc\/([^/]+)/)
  if (doc) {
    return { name: 'editor', projectId: doc[1] }
  }
  return { name: 'editor' }
}

/** 只读模式下应拦截的写操作（不允许修改文档内容 / 结构 / 原型链接） */
const WRITE_ACTIONS = new Set<EditorAction['type']>([
  'RENAME_DOCUMENT',
  'CREATE_PAGE',
  'CREATE_LAYER',
  'DELETE_LAYERS',
  'DUPLICATE_LAYERS',
  'UPDATE_LAYER_PROPERTIES',
  'TOGGLE_LAYER_VISIBILITY',
  'TOGGLE_LAYER_LOCK',
  'RENAME_LAYER',
  'BEGIN_MOVE',
  'MOVE_LAYERS',
  'ADD_PROTOTYPE_LINK',
  'REMOVE_PROTOTYPE_LINK',
  'UNDO',
  'REDO',
])

export default function App() {
  const route = readRoute()
  const [user, setUser] = useState<UserDto | null>(() => getCurrentUser())

  // 路由守卫：编辑器页需登录；分享链接页匿名可访问
  const needsLogin = route.name === 'editor' && !route.share && !isAuthenticated()
  useEffect(() => {
    if (needsLogin) {
      const current = window.location.hash
      const redirect = current && current !== '#/' ? current.slice(1) : '/editor'
      window.location.hash = `#/login?redirect=${encodeURIComponent(redirect)}`
      window.location.reload()
    }
  }, [needsLogin])

  // 已登录时访问登录页 → 跳转回编辑器
  const loginRedirect = route.name === 'login' ? route.redirectTo : undefined
  useEffect(() => {
    if (loginRedirect !== undefined && isAuthenticated()) {
      window.location.hash = loginRedirect && loginRedirect.startsWith('/') ? `#${loginRedirect}` : '#/editor'
      window.location.reload()
    }
  }, [loginRedirect])

  if (route.name === 'login') {
    return <AuthPage redirectTo={route.redirectTo} />
  }

  return <Editor route={route} user={user} onUserChange={setUser} />
}

function Editor({ route, user, onUserChange }: {
  route: Extract<Route, { name: 'editor' }>
  user: UserDto | null
  onUserChange: (u: UserDto | null) => void
}) {
  const projectId = route.projectId
  const share = route.share
  const { state, dispatch, saveStatus, loading, conflict, loadError, readOnly, resolveConflict } =
    useEditorStore(projectId, share)
  const [previewing, setPreviewing] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // 只读模式：包装 dispatch，拦截写操作
  const guardedDispatch: EditorDispatch = useCallback(
    (action: EditorAction) => {
      if (readOnly && WRITE_ACTIONS.has(action.type)) return
      dispatch(action)
    },
    [readOnly, dispatch],
  )

  const onToolChange = useCallback((tool: ToolType) => guardedDispatch({ type: 'SET_ACTIVE_TOOL', tool }), [guardedDispatch])
  const onDelete = useCallback(() => {
    if (state.selectedIds.length > 0) guardedDispatch({ type: 'DELETE_LAYERS', ids: state.selectedIds })
  }, [guardedDispatch, state.selectedIds])
  const onDuplicate = useCallback(() => {
    if (state.selectedIds.length > 0) guardedDispatch({ type: 'DUPLICATE_LAYERS', ids: state.selectedIds })
  }, [guardedDispatch, state.selectedIds])
  const onUndo = useCallback(() => guardedDispatch({ type: 'UNDO' }), [guardedDispatch])
  const onRedo = useCallback(() => guardedDispatch({ type: 'REDO' }), [guardedDispatch])
  const onEscape = useCallback(() => {
    if (previewing) { setPreviewing(false); return }
    if (projectsOpen) { setProjectsOpen(false); return }
    if (shareOpen) { setShareOpen(false); return }
    guardedDispatch({ type: 'SELECT_LAYERS', ids: [] })
    if (state.activeTool !== 'select') guardedDispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
  }, [guardedDispatch, state.activeTool, previewing, projectsOpen, shareOpen])

  useKeyboardShortcuts({
    onToolChange, onDelete, onDuplicate, onUndo, onRedo, onEscape,
    readOnly,
  })

  const onLogout = useCallback(() => {
    clearAuth()
    onUserChange(null)
    window.location.hash = '#/login'
    window.location.reload()
  }, [onUserChange])

  const logoutButton = useMemo(() => (
    <button className="logout-button" onClick={onLogout} title="退出登录">退出</button>
  ), [onLogout])

  return (
    <div className="app-shell">
      <TopToolbar
        state={state}
        dispatch={guardedDispatch}
        onRenameDocument={(name) => guardedDispatch({ type: 'RENAME_DOCUMENT', name })}
        onPreview={() => setPreviewing(true)}
        onOpenProjects={() => setProjectsOpen(true)}
        onShare={() => setShareOpen(true)}
        saveStatus={saveStatus}
        readOnly={readOnly}
        userName={user?.displayName}
        userEmail={user?.email}
        logoutNode={logoutButton}
      />
      <div className="workspace">
        <LayersPanel state={state} dispatch={guardedDispatch} readOnly={readOnly} />
        <CanvasArea state={state} dispatch={guardedDispatch} readOnly={readOnly} />
        <InspectorPanel state={state} dispatch={guardedDispatch} readOnly={readOnly} />
      </div>
      {previewing && <PreviewOverlay state={state} onClose={() => setPreviewing(false)} />}
      {projectsOpen && !readOnly && <ProjectsModal onClose={() => setProjectsOpen(false)} />}
      {shareOpen && !readOnly && <ShareModal projectId={state.document.id} onClose={() => setShareOpen(false)} />}
      {loading && (
        <div className="editor-loading">
          <div className="editor-loading-spinner" />
          <span>正在加载文档…</span>
        </div>
      )}
      {!loading && loadError && (
        <div className="share-error-screen">
          <Watermelon />
          <h3>无法打开设计稿</h3>
          <p>{loadError}</p>
        </div>
      )}
      {conflict && (
        <div className="conflict-dialog-backdrop">
          <div className="conflict-dialog">
            <h3>文档已被其他窗口修改</h3>
            <p>当前编辑内容基于旧版本，继续保存会覆盖他人的修改。</p>
            <div className="conflict-dialog-actions">
              <button className="btn" onClick={() => resolveConflict('reload')}>
                加载最新版本
              </button>
              <button className="btn btn-primary" onClick={() => resolveConflict('copy')}>
                另存为新文件
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
