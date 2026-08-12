import { useState, useRef, useEffect } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { Icon, EyeOpen, EyeClosed, LockClosed, LockOpen, type IconName } from '../common/brand'
import { createLayer } from '../../utils/layers'

const typeIcon: Record<LayerNode['type'], IconName> = {
  frame: 'frame', group: 'layers', rectangle: 'rect',
  text: 'text', chart: 'chart', comment: 'comment',
}

interface Props {
  state: EditorState
  dispatch: EditorDispatch
}

interface ContextMenuState {
  id: string
  x: number
  y: number
}

function LayerTreeItem({ node, depth, dispatch, selectedIds, onContextMenu, onRenameRequest, renamingId, draft, onDraftChange, onCommitRename }: {
  node: LayerNode
  depth: number
  dispatch: EditorDispatch
  selectedIds: string[]
  onContextMenu: (e: React.MouseEvent, id: string) => void
  onRenameRequest: (id: string) => void
  renamingId: string | null
  draft: string
  onDraftChange: (v: string) => void
  onCommitRename: () => void
}) {
  const selected = selectedIds.includes(node.id)
  const hasChildren = node.children.length > 0
  const isRenaming = renamingId === node.id

  return (
    <>
      <div
        className={`layer-row ${selected ? 'selected' : ''}`}
        style={{ paddingLeft: `${14 + depth * 18}px` }}
        onClick={() => dispatch({ type: 'SELECT_LAYERS', ids: [node.id] })}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        onDoubleClick={() => onRenameRequest(node.id)}
      >
        <span
          className="row-chevron"
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_EXPANDED', id: node.id }) }}
        >
          {hasChildren ? (node.expanded ? '⌄' : '›') : ''}
        </span>
        <Icon name={typeIcon[node.type]} className={`${node.type === 'text' ? 'text-icon' : ''} ${!node.visible ? 'is-hidden' : ''}`} />
        {isRenaming ? (
          <input
            className="layer-rename-input"
            autoFocus
            value={draft}
            onChange={(e) => { e.stopPropagation(); onDraftChange(e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename()
              if (e.key === 'Escape') { e.stopPropagation(); onDraftChange(node.name); onCommitRename() }
            }}
          />
        ) : (
          <span className={`layer-label ${!node.visible ? 'is-hidden' : ''}`}>{node.name}</span>
        )}
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
        <LayerTreeItem key={child.id} node={child} depth={depth + 1} dispatch={dispatch} selectedIds={selectedIds} onContextMenu={onContextMenu} onRenameRequest={onRenameRequest} renamingId={renamingId} draft={draft} onDraftChange={onDraftChange} onCommitRename={onCommitRename} />
      ))}
    </>
  )
}

export function LayersPanel({ state, dispatch }: Props) {
  const activePage = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const tab = state.leftPanelTab
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newLayerMenuOpen, setNewLayerMenuOpen] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  const openRename = (id: string) => {
    const target = findLayer(activePage.children, id)
    if (!target) return
    setRenamingId(id)
    setDraft(target.name)
    setMenu(null)
  }

  const commitRename = () => {
    if (renamingId && draft.trim()) {
      dispatch({ type: 'RENAME_LAYER', id: renamingId, name: draft.trim() })
    }
    setRenamingId(null)
  }

  const openMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch({ type: 'SELECT_LAYERS', ids: [id] })
    const rect = panelRef.current?.getBoundingClientRect()
    setMenu({ id, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) })
  }

  const createNew = (kind: 'rectangle' | 'text' | 'frame' | 'group') => {
    const layer = createLayer(kind, 60, 60)
    dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: null, layer })
    dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
    setNewLayerMenuOpen(false)
  }

  const createPage = () => {
    dispatch({ type: 'CREATE_PAGE', name: `页面 ${state.document.pages.length + 1}` })
  }

  return (
    <aside className="layers-panel panel" ref={panelRef}>
      <div className="panel-tabs">
        <button className={tab === 'layers' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_LEFT_PANEL_TAB', tab: 'layers' })}><Icon name="layers" /> 图层</button>
        <button className={tab === 'components' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_LEFT_PANEL_TAB', tab: 'components' })}><Icon name="components" /> 组件</button>
      </div>
      <div className="search-field"><Icon name="search" /><span>搜索图层</span><kbd>⌘ F</kbd></div>
      <div className="layers-heading"><span>页面</span><button onClick={createPage} title="新建页面"><Icon name="plus" /></button></div>
      <div className="page-list">
        {state.document.pages.map((p) => (
          <div
            key={p.id}
            className={`page-row ${p.id === state.document.activePageId ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_PAGE', pageId: p.id })}
            title="点击切换页面"
          >
            <Icon name="chevron" className={p.id === state.document.activePageId ? '' : 'chevron-collapsed'} />
            <Icon name="folder" className="folder-icon" />
            <span>{p.name}</span>
            <span className="page-menu">•••</span>
          </div>
        ))}
      </div>
      <div className="layers-heading tree-heading"><span>图层</span><span className="tree-actions"><EyeOpen /> <LockClosed /></span></div>
      <div className="layer-tree">
        {activePage.children.map((node) => (
          <LayerTreeItem
            key={node.id}
            node={node}
            depth={0}
            dispatch={dispatch}
            selectedIds={state.selectedIds}
            onContextMenu={openMenu}
            onRenameRequest={openRename}
            renamingId={renamingId}
            draft={draft}
            onDraftChange={setDraft}
            onCommitRename={commitRename}
          />
        ))}
      </div>
      <div className="layers-footer">
        <span className="new-layer-trigger" onClick={() => setNewLayerMenuOpen((v) => !v)}>
          <Icon name="plus" /> 新建图层
        </span>
        <span>⌘⌥G</span>
      </div>

      {/* 新建图层菜单 */}
      {newLayerMenuOpen && (
        <div className="layer-popover popover-new-layer">
          {(['rectangle', 'text', 'frame', 'group'] as const).map((kind) => (
            <button key={kind} onClick={() => createNew(kind)}>{kindName(kind)}</button>
          ))}
        </div>
      )}

      {/* 右键菜单 */}
      {menu && (
        <div className="layer-popover popover-menu" style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => openRename(menu.id)}>重命名</button>
          <button onClick={() => { dispatch({ type: 'DUPLICATE_LAYERS', ids: [menu.id] }); setMenu(null) }}>复制</button>
          <button className="danger" onClick={() => { dispatch({ type: 'DELETE_LAYERS', ids: [menu.id] }); setMenu(null) }}>删除</button>
        </div>
      )}

    </aside>
  )
}

function findLayer(root: LayerNode[], id: string): LayerNode | null {
  for (const node of root) {
    if (node.id === id) return node
    const found = findLayer(node.children, id)
    if (found) return found
  }
  return null
}

function kindName(kind: LayerNode['type']): string {
  switch (kind) {
    case 'rectangle': return '矩形'
    case 'text': return '文本'
    case 'frame': return '画板'
    case 'group': return '分组'
    default: return kind
  }
}
