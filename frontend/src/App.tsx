import { useCallback, useState } from 'react'
import { useEditorStore, type ToolType } from './state/editor-store'
import { TopToolbar } from './components/toolbar/TopToolbar'
import { LayersPanel } from './components/layers/LayersPanel'
import { CanvasArea } from './components/canvas/CanvasArea'
import { InspectorPanel } from './components/inspector/InspectorPanel'
import { PreviewOverlay } from './components/canvas/PreviewOverlay'
import { ProjectsModal } from './components/projects/ProjectsModal'
import { ShareModal } from './components/share/ShareModal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function readProjectId(): string | undefined {
  const m = window.location.hash.match(/#\/doc\/([^/]+)/)
  return m ? m[1] : undefined
}

export default function App() {
  const projectId = readProjectId()
  const { state, dispatch, saveStatus, loading, conflict, resolveConflict } = useEditorStore(projectId)
  const [previewing, setPreviewing] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const onToolChange = useCallback((tool: ToolType) => dispatch({ type: 'SET_ACTIVE_TOOL', tool }), [dispatch])
  const onDelete = useCallback(() => {
    if (state.selectedIds.length > 0) dispatch({ type: 'DELETE_LAYERS', ids: state.selectedIds })
  }, [dispatch, state.selectedIds])
  const onDuplicate = useCallback(() => {
    if (state.selectedIds.length > 0) dispatch({ type: 'DUPLICATE_LAYERS', ids: state.selectedIds })
  }, [dispatch, state.selectedIds])
  const onUndo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch])
  const onRedo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch])
  const onEscape = useCallback(() => {
    if (previewing) { setPreviewing(false); return }
    if (projectsOpen) { setProjectsOpen(false); return }
    if (shareOpen) { setShareOpen(false); return }
    dispatch({ type: 'SELECT_LAYERS', ids: [] })
    if (state.activeTool !== 'select') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
  }, [dispatch, state.activeTool, previewing, projectsOpen, shareOpen])

  useKeyboardShortcuts({ onToolChange, onDelete, onDuplicate, onUndo, onRedo, onEscape })

  return (
    <div className="app-shell">
      <TopToolbar
        state={state}
        dispatch={dispatch}
        onRenameDocument={(name) => dispatch({ type: 'RENAME_DOCUMENT', name })}
        onPreview={() => setPreviewing(true)}
        onOpenProjects={() => setProjectsOpen(true)}
        onShare={() => setShareOpen(true)}
        saveStatus={saveStatus}
      />
      <div className="workspace">
        <LayersPanel state={state} dispatch={dispatch} />
        <CanvasArea state={state} dispatch={dispatch} />
        <InspectorPanel state={state} dispatch={dispatch} />
      </div>
      {previewing && <PreviewOverlay state={state} onClose={() => setPreviewing(false)} />}
      {projectsOpen && <ProjectsModal onClose={() => setProjectsOpen(false)} />}
      {shareOpen && <ShareModal projectId={state.document.id} onClose={() => setShareOpen(false)} />}
      {loading && (
        <div className="editor-loading">
          <div className="editor-loading-spinner" />
          <span>正在加载文档…</span>
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
