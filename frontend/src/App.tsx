import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LayerNode } from './types/design'
import { useEditorStore, type EditorDispatch, type EditorAction, type ToolType } from './state/editor-store'
import { TopToolbar } from './components/toolbar/TopToolbar'
import { LayersPanel } from './components/layers/LayersPanel'
import { CanvasArea } from './components/canvas/CanvasArea'
import { InspectorPanel } from './components/inspector/InspectorPanel'
import { PreviewOverlay } from './components/canvas/PreviewOverlay'
import { ResizeHandle } from './components/layout/ResizeHandle'
import { AiChatPanel } from './components/ai/AiChatPanel'
import { PANEL_MIN_LEFT, PANEL_MAX_LEFT, PANEL_MIN_RIGHT, PANEL_MAX_RIGHT } from './constants/limits'
import { ProjectsPage } from './components/projects/ProjectsPage'
import { ShareModal } from './components/share/ShareModal'
import { AuthPage } from './components/auth/AuthPage'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { isAuthenticated, clearAuth, getCurrentUser, fetchMe } from './services/auth'
import type { UserDto } from './services/auth'
import { Watermelon } from './components/common/brand'

type Route =
  | { name: 'login'; redirectTo?: string }
  | { name: 'projects' }
  | { name: 'editor'; projectId?: string; share?: { token: string; permission: 'view' | 'edit' } }

/** 解析当前 hash 路由：/#/login / #/projects / #/editor / #/doc/:id / #/share/:token */
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
  // #/ 与 #/projects 均进入项目列表首页（登录后默认落地页）
  if (hash === '' || hash === '#' || hash === '#/' || /^#\/projects/.test(hash)) {
    return { name: 'projects' }
  }
  return { name: 'editor' }
}

/** 在文档全部页面中查找图层（跨页面） */
function findLayerInDoc(doc: { pages: { children: LayerNode[] }[] }, id: string): LayerNode | null {
  for (const page of doc.pages) {
    const found = findLayerInTree(page.children, id)
    if (found) return found
  }
  return null
}

function findLayerInTree(nodes: LayerNode[], id: string): LayerNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findLayerInTree(node.children, id)
    if (found) return found
  }
  return null
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
  'GROUP_LAYERS',
  'UNGROUP_LAYERS',
  'REORDER_LAYER',
  'RENAME_PAGE',
  'DELETE_PAGE',
  'DUPLICATE_PAGE',
  'ADD_COMMENT_REPLY',
  'DELETE_COMMENT_REPLY',
  'CLEAR_HISTORY',
  'UNDO',
  'REDO',
  'APPLY_DESIGN',
  'APPLY_EDIT',
])

export default function App() {
  const [route, setRoute] = useState(() => readRoute())
  const [user, setUser] = useState<UserDto | null>(() => getCurrentUser())

  // 挂载时用 token 向后端校验并刷新用户信息（失败自动登出）
  useEffect(() => {
    let alive = true
    fetchMe().then((u) => {
      if (alive) setUser(u)
    })
    return () => { alive = false }
  }, [])

  // 监听 hash 变化，驱动路由重渲染（替代全页 reload，避免闪烁）
  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // 路由守卫：项目列表页 / 编辑器页需登录；登录页自身与分享链接页匿名可访问。
  // 重定向目标由 effect 内 readRoute() 解析的路由构造（r），杜绝把 login 的 redirect 参数带进去造成嵌套死循环。
  useEffect(() => {
    const r = readRoute()
    if (r.name === 'login') return
    const requiresLogin = r.name === 'projects' || (r.name === 'editor' && !r.share)
    if (requiresLogin && !isAuthenticated()) {
      const target = r.name === 'projects' ? '/projects' : `/${r.name}${r.projectId ? '/' + r.projectId : ''}`
      window.location.hash = `#/login?redirect=${encodeURIComponent(target)}`
    }
  }, [route.name])

  // 已登录时访问登录页 → 跳转回项目列表首页（或原目标页）
  useEffect(() => {
    if (route.name === 'login' && route.redirectTo && isAuthenticated()) {
      window.location.hash = route.redirectTo.startsWith('/') ? `#${route.redirectTo}` : '#/projects'
    }
  }, [route.name])

  if (route.name === 'login') {
    return <AuthPage redirectTo={route.redirectTo} onUserChange={setUser} />
  }

  if (route.name === 'projects') {
    return <ProjectsPage userName={user?.displayName} userEmail={user?.email} onUserChange={setUser} />
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
  const [shareOpen, setShareOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  // 可拖拽侧栏：null 表示未手动调整（走 CSS 默认/媒体查询自适应）；手动拖拽后写入内联 CSS 变量
  const [leftW, setLeftW] = useState<number | null>(null)
  const [rightW, setRightW] = useState<number | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [wsW, setWsW] = useState<number | null>(null)

  // 自适应：监听 workspace 宽度，ResizeHandle 据此 clamp 已拖拽的宽度
  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWsW(el.clientWidth))
    ro.observe(el)
    setWsW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

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
    if (shareOpen) { setShareOpen(false); return }
    guardedDispatch({ type: 'SELECT_LAYERS', ids: [] })
    if (state.activeTool !== 'select') guardedDispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
  }, [guardedDispatch, state.activeTool, previewing, shareOpen])

  const onGroup = useCallback(() => {
    if (state.selectedIds.length >= 2) guardedDispatch({ type: 'GROUP_LAYERS', ids: state.selectedIds })
  }, [guardedDispatch, state.selectedIds])
  const onUngroup = useCallback(() => {
    const g = state.selectedIds
      .map((id) => findLayerInDoc(state.document, id))
      .find((n) => n && n.type === 'group')
    if (g) guardedDispatch({ type: 'UNGROUP_LAYERS', id: g.id })
  }, [guardedDispatch, state.selectedIds])
  const onReorder = useCallback((direction: 'forward' | 'backward') => {
    const id = state.selectedIds[0]
    if (id) guardedDispatch({ type: 'REORDER_LAYER', id, direction })
  }, [guardedDispatch, state.selectedIds])
  const onZoomIn = useCallback(() => guardedDispatch({ type: 'SET_ZOOM', zoom: state.zoom + 10 }), [guardedDispatch, state.zoom])
  const onZoomOut = useCallback(() => guardedDispatch({ type: 'SET_ZOOM', zoom: state.zoom - 10 }), [guardedDispatch, state.zoom])
  const onZoomFit = useCallback(() => guardedDispatch({ type: 'SET_ZOOM', zoom: 100 }), [guardedDispatch])
  const onZoom100 = useCallback(() => guardedDispatch({ type: 'SET_ZOOM', zoom: 100 }), [guardedDispatch])
  const searchFocusRef = useRef<(() => void) | null>(null)
  const onSearch = useCallback(() => {
    guardedDispatch({ type: 'SET_LEFT_PANEL_TAB', tab: 'layers' })
    searchFocusRef.current?.()
  }, [guardedDispatch])

  useKeyboardShortcuts({
    onToolChange, onDelete, onDuplicate, onUndo, onRedo, onEscape,
    readOnly, onGroup, onUngroup, onReorder, onZoomIn, onZoomOut, onZoomFit, onZoom100, onSearch,
  })

  const doLogout = useCallback(() => {
    clearAuth()
    onUserChange(null)
    window.location.hash = '#/login'
  }, [onUserChange])

  const onLogout = useCallback(() => {
    setLogoutConfirmOpen(true)
  }, [])

  const goHome = useCallback(() => {
    window.location.hash = '#/projects'
  }, [])

  const logoutButton = useMemo(() => (
    <button className="logout-button" onClick={onLogout} title="退出登录">退出</button>
  ), [onLogout])

  return (
    <div className="app-shell">
      <TopToolbar
        state={state}
        dispatch={guardedDispatch}
        onRenameDocument={(name) => guardedDispatch({ type: 'RENAME_DOCUMENT', name })}
        onHome={readOnly ? undefined : goHome}
        onPreview={() => setPreviewing(true)}
        onShare={() => setShareOpen(true)}
        onUndo={onUndo}
        onRedo={onRedo}
        saveStatus={saveStatus}
        readOnly={readOnly}
        userName={user?.displayName}
        userEmail={user?.email}
        logoutNode={logoutButton}
      />
      <div
        className="workspace"
        ref={workspaceRef}
        style={{ '--left-w': leftW ? `${leftW}px` : undefined, '--right-w': rightW ? `${rightW}px` : undefined } as React.CSSProperties}
      >
        <LayersPanel state={state} dispatch={guardedDispatch} readOnly={readOnly} onSearchFocusReady={(fn) => { searchFocusRef.current = fn }} />
        <ResizeHandle side="left" value={leftW} onChange={setLeftW} min={PANEL_MIN_LEFT} max={PANEL_MAX_LEFT} limit={wsW ? wsW * 0.35 : null} />
        <CanvasArea state={state} dispatch={guardedDispatch} readOnly={readOnly} />
        <ResizeHandle side="right" value={rightW} onChange={setRightW} min={PANEL_MIN_RIGHT} max={PANEL_MAX_RIGHT} limit={wsW ? wsW * 0.4 : null} />
        <InspectorPanel state={state} dispatch={guardedDispatch} readOnly={readOnly} />
        <AiChatPanel state={state} dispatch={guardedDispatch} readOnly={readOnly} />
      </div>
      {previewing && <PreviewOverlay state={state} onClose={() => setPreviewing(false)} />}
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
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="退出登录"
        message="确定要退出当前账号吗？未保存的更改可能丢失。"
        confirmText="退出登录"
        cancelText="取消"
        danger
        onConfirm={() => {
          setLogoutConfirmOpen(false)
          doLogout()
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  )
}
