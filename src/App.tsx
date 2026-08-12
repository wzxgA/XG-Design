import { useEditorStore } from './state/editor-store'
import { TopToolbar } from './components/toolbar/TopToolbar'
import { LayersPanel } from './components/layers/LayersPanel'
import { CanvasArea } from './components/canvas/CanvasArea'
import { InspectorPanel } from './components/inspector/InspectorPanel'

export default function App() {
  const [state, dispatch] = useEditorStore()

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
