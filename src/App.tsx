import { useCallback } from 'react'
import { useEditorStore, type ToolType } from './state/editor-store'
import { TopToolbar } from './components/toolbar/TopToolbar'
import { LayersPanel } from './components/layers/LayersPanel'
import { CanvasArea } from './components/canvas/CanvasArea'
import { InspectorPanel } from './components/inspector/InspectorPanel'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  const [state, dispatch] = useEditorStore()

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
    dispatch({ type: 'SELECT_LAYERS', ids: [] })
    if (state.activeTool !== 'select') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' })
  }, [dispatch, state.activeTool])

  useKeyboardShortcuts({ onToolChange, onDelete, onDuplicate, onUndo, onRedo, onEscape })

  return (
    <div className="app-shell">
      <TopToolbar
        state={state}
        dispatch={dispatch}
        onRenameDocument={(name) => dispatch({ type: 'RENAME_DOCUMENT', name })}
      />
      <div className="workspace">
        <LayersPanel state={state} dispatch={dispatch} />
        <CanvasArea state={state} dispatch={dispatch} />
        <InspectorPanel state={state} dispatch={dispatch} />
      </div>
    </div>
  )
}
