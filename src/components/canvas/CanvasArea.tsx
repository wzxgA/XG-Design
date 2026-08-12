import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { Icon, Watermelon } from '../common/brand'
import { CanvasObject } from './CanvasObject'

interface Props {
  state: EditorState
  dispatch: EditorDispatch
}

export function CanvasArea({ state, dispatch }: Props) {
  const { zoom } = state
  const activePage = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const selectedFrame = activePage.children.find((n) => n.type === 'frame') as LayerNode | undefined
  const selectedId = state.selectedIds[0]

  return (
    <main className="canvas-area" onClick={() => dispatch({ type: 'SELECT_LAYERS', ids: [] })}>
      <div className="canvas-badge"><span className="canvas-dot" /> {state.document.name} <span>·</span> {activePage.name}</div>
      <div className="canvas-watermelon"><Watermelon /></div>

      <div className="artboard-wrap" style={{ transform: `translate(-49%, -46%) scale(${zoom / 100})` }}>
        <div className="artboard-label">
          {selectedFrame ? selectedFrame.name : '画板'} <span>— {selectedFrame ? `${selectedFrame.width} × ${selectedFrame.height}` : '1440 × 900'}</span>
        </div>
        <div className="selection-frame" onClick={(e) => { e.stopPropagation(); if (selectedFrame) dispatch({ type: 'SELECT_LAYERS', ids: [selectedFrame.id] }) }}>
          {selectedFrame && selectedFrame.children.map((child) => (
            <CanvasObject key={child.id} node={child} state={state} dispatch={dispatch} />
          ))}
          <div className="handle h-tl" /><div className="handle h-tm" /><div className="handle h-tr" />
          <div className="handle h-ml" /><div className="handle h-mr" />
          <div className="handle h-bl" /><div className="handle h-bm" /><div className="handle h-br" />
        </div>
        <div className="smart-guide vertical"><span>24 px</span></div>
        <div className="smart-guide horizontal" />
      </div>

      <div className="ghost-artboard" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_LAYERS', ids: [] }) }}>
        <span>项目管理页</span><div />
      </div>

      <div className="canvas-controls" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: zoom - 10 })}><Icon name="minus" /></button>
        <span>{zoom}%</span>
        <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: zoom + 10 })}><Icon name="plus" /></button>
        <button><Icon name="fit" /></button>
      </div>

      <div className="canvas-coordinates">
        {selectedFrame ? `X ${selectedFrame.x}　Y ${selectedFrame.y}` : `选中 ${selectedId ?? '无'}`}
      </div>
    </main>
  )
}
