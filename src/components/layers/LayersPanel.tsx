import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { Icon, EyeOpen, EyeClosed, LockClosed, LockOpen, type IconName } from '../common/brand'

const typeIcon: Record<LayerNode['type'], IconName> = {
  frame: 'frame', group: 'layers', rectangle: 'rect',
  text: 'text', chart: 'chart', comment: 'comment',
}

interface Props {
  state: EditorState
  dispatch: EditorDispatch
}

function LayerTreeItem({ node, depth, dispatch, selectedIds }: {
  node: LayerNode
  depth: number
  dispatch: EditorDispatch
  selectedIds: string[]
}) {
  const selected = selectedIds.includes(node.id)
  const hasChildren = node.children.length > 0

  return (
    <>
      <div
        className={`layer-row ${selected ? 'selected' : ''}`}
        style={{ paddingLeft: `${14 + depth * 18}px` }}
        onClick={() => dispatch({ type: 'SELECT_LAYERS', ids: [node.id] })}
      >
        <span
          className="row-chevron"
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_EXPANDED', id: node.id }) }}
        >
          {hasChildren ? (node.expanded ? '⌄' : '›') : ''}
        </span>
        <Icon name={typeIcon[node.type]} className={`${node.type === 'text' ? 'text-icon' : ''} ${!node.visible ? 'is-hidden' : ''}`} />
        <span className={`layer-label ${!node.visible ? 'is-hidden' : ''}`}>{node.name}</span>
        <span
          className={`row-visibility ${node.visible ? '' : 'is-hidden'}`}
          title={node.visible ? '隐藏图层' : '显示图层'}
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', ids: [node.id] }) }}
        >
          {node.visible ? <EyeOpen /> : <EyeClosed />}
        </span>
        <span
          className={`row-lock ${node.locked ? 'is-locked' : ''}`}
          title={node.locked ? '解锁图层' : '锁定图层'}
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_LOCK', ids: [node.id] }) }}
        >
          {node.locked ? <LockClosed /> : <LockOpen />}
        </span>
      </div>
      {hasChildren && node.expanded && node.children.map((child) => (
        <LayerTreeItem key={child.id} node={child} depth={depth + 1} dispatch={dispatch} selectedIds={selectedIds} />
      ))}
    </>
  )
}

export function LayersPanel({ state, dispatch }: Props) {
  const activePage = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const tab = state.leftPanelTab

  return (
    <aside className="layers-panel panel">
      <div className="panel-tabs">
        <button className={tab === 'layers' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_LEFT_PANEL_TAB', tab: 'layers' })}><Icon name="layers" /> 图层</button>
        <button className={tab === 'components' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_LEFT_PANEL_TAB', tab: 'components' })}><Icon name="components" /> 组件</button>
      </div>
      <div className="search-field"><Icon name="search" /><span>搜索图层</span><kbd>⌘ F</kbd></div>
      <div className="layers-heading"><span>页面</span><button><Icon name="plus" /></button></div>
      <div className="page-row"><Icon name="chevron" /><Icon name="folder" className="folder-icon" /><span>{activePage.name}</span><span className="page-menu">•••</span></div>
      <div className="layers-heading tree-heading"><span>图层</span><span className="tree-actions"><EyeOpen /> <LockClosed /></span></div>
      <div className="layer-tree">
        {activePage.children.map((node) => (
          <LayerTreeItem key={node.id} node={node} depth={0} dispatch={dispatch} selectedIds={state.selectedIds} />
        ))}
      </div>
      <div className="layers-footer"><span><Icon name="plus" /> 新建图层</span><span>⌘⌥G</span></div>
    </aside>
  )
}
