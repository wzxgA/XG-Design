import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { ComponentGlyph, Icon, EyeOpen, EyeClosed, LockClosed, LockOpen, type IconName } from '../common/brand'
import { createLayer, isComponentNode } from '../../utils/layers'
import { COMPONENT_TEMPLATES, buildComponent, type ComponentTemplate } from '../../fixtures/component-library'
import { layerId } from '../../utils/layers'
import { loadCustomComponents, saveCustomComponent, removeCustomComponent, renameCustomComponent } from '../../utils/customComponents'

const typeIcon: Record<LayerNode['type'], IconName> = {
  frame: 'frame', group: 'layers', rectangle: 'rect',
  text: 'text', chart: 'chart', comment: 'comment', path: 'pen', image: 'image',
}

interface Props {
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
  /** 把搜索框聚焦函数交给上层（快捷键 ⌘F 触发） */
  onSearchFocusReady?: (fn: () => void) => void
}

interface ContextMenuState {
  id: string
  x: number
  y: number
}

function LayerTreeItem({ node, depth, dispatch, selectedIds, readOnly, onContextMenu, onRenameRequest, renamingId, draft, onDraftChange, onCommitRename }: {
  node: LayerNode
  depth: number
  dispatch: EditorDispatch
  selectedIds: string[]
  readOnly: boolean
  onContextMenu: (e: React.MouseEvent, id: string) => void
  onRenameRequest: (id: string) => void
  renamingId: string | null
  draft: string
  onDraftChange: (v: string) => void
  onCommitRename: () => void
}) {
  const selected = selectedIds.includes(node.id)
  const hasChildren = node.children.length > 0
  // 一体化组件：图层树中显示为单行，不展开子节点（含旧数据结构兜底）
  const isComponent = isComponentNode(node)
  const expandable = hasChildren && !isComponent
  const isRenaming = renamingId === node.id

  return (
    <>
      <div
        className={`layer-row ${selected ? 'selected' : ''}`}
        style={{ paddingLeft: `${14 + depth * 18}px` }}
        onClick={(e) => {
          const ids = e.shiftKey
            ? selectedIds.includes(node.id)
              ? selectedIds.filter((id) => id !== node.id)
              : [...selectedIds, node.id]
            : [node.id]
          dispatch({ type: 'SELECT_LAYERS', ids })
        }}
        onContextMenu={(e) => { if (!readOnly) onContextMenu(e, node.id) }}
        onDoubleClick={() => { if (!readOnly) onRenameRequest(node.id) }}
      >
        <span
          className="row-chevron"
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_EXPANDED', id: node.id }) }}
        >
          {expandable ? (node.expanded ? '⌄' : '›') : ''}
        </span>
        <Icon name={isComponent ? 'components' : typeIcon[node.type]} className={`${node.type === 'text' ? 'text-icon' : ''} ${!node.visible ? 'is-hidden' : ''}`} />
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
        {!readOnly && (
          <>
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
          </>
        )}
      </div>
      {expandable && node.expanded && node.children.map((child) => (
        <LayerTreeItem key={child.id} node={child} depth={depth + 1} dispatch={dispatch} selectedIds={selectedIds} readOnly={readOnly} onContextMenu={onContextMenu} onRenameRequest={onRenameRequest} renamingId={renamingId} draft={draft} onDraftChange={onDraftChange} onCommitRename={onCommitRename} />
      ))}
    </>
  )
}

/** 组件 tab：内置组件库 + 我的组件（自定义），支持分类筛选与搜索，点击/拖拽插入画布 */
function ComponentGrid({ dispatch, readOnly, activePage, state }: {
  dispatch: EditorDispatch
  readOnly: boolean
  activePage: { id: string; children: LayerNode[] }
  state: EditorState
}) {
  const frame = activePage.children.find((n) => n.type === 'frame')
  const [dragging, setDragging] = useState<string | null>(null)
  const [tip, setTip] = useState<{ tpl: ComponentTemplate; dir: 'up' | 'down'; el: HTMLElement } | null>(null)
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null)
  const [tick, setTick] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [cat, setCat] = useState('全部')
  const [query, setQuery] = useState('')
  const [customs, setCustoms] = useState<ComponentTemplate[]>(() => loadCustomComponents())

  const categories = ['全部', '基础', '表单', '导航', '反馈', '展示', '图表']

  const builtin = COMPONENT_TEMPLATES.filter((t) => {
    if (cat !== '全部' && t.category !== cat) return false
    if (query) {
      const q = query.toLowerCase()
      return t.name.toLowerCase().includes(q)
        || t.short.toLowerCase().includes(q)
        || (t.keywords ?? []).some((k) => k.toLowerCase().includes(q))
    }
    return true
  })
  const myCustoms = customs.filter((t) => {
    if (query) return t.name.toLowerCase().includes(query.toLowerCase())
    return true
  })

  const insert = (name: string) => {
    if (readOnly) return
    const c = buildComponent(name, 40, 40)
    if (!frame) {
      // 无画板：先创建默认画板再插入
      const f = createLayer('frame', 0, 0)
      f.width = 1440; f.height = 900
      dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: null, layer: f })
      dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: f.id, layer: c })
      dispatch({ type: 'SELECT_LAYERS', ids: [c.id] })
      return
    }
    dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: frame.id, layer: c })
    dispatch({ type: 'SELECT_LAYERS', ids: [c.id] })
  }

  /** 把选中的 group 保存为自定义组件 */
  const saveSelection = () => {
    const selected = state.selectedIds.map((id) => findLayer(activePage.children, id)).filter((n): n is LayerNode => !!n)
    const group = selected.find((n) => n.type === 'group')
    if (!group) {
      alert('请先在图层树中选中一个分组，再保存为组件')
      return
    }
    const name = prompt('组件名称：', `${group.name}副本`)
    if (name === null) return
    setCustoms(saveCustomComponent(group, name))
  }

  /** 悬停时记录磁贴：方向看磁贴距网格顶部空间，不足则向下弹出 */
  const showTip = (e: React.MouseEvent<HTMLButtonElement>, tpl: ComponentTemplate) => {
    const el = e.currentTarget
    const grid = gridRef.current
    const spaceAbove = grid ? el.getBoundingClientRect().top - grid.getBoundingClientRect().top : 0
    setTip({ tpl, dir: spaceAbove < 66 ? 'down' : 'up', el })
  }

  const hideTip = () => { setTip(null); setTipPos(null) }

  // tooltip 渲染到 body 顶层（fixed 定位，不受网格 overflow 裁剪）。
  // 挂载后测量实际尺寸，居中于磁贴并钳制在视口内（上下左右都不越界）。
  useLayoutEffect(() => {
    if (!tip) { setTipPos(null); return }
    const el = tooltipRef.current
    if (!el) return
    const rect = tip.el.getBoundingClientRect()
    const tw = el.offsetWidth
    const th = el.offsetHeight
    let left = rect.left + rect.width / 2 - tw / 2
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8))
    let top = tip.dir === 'up' ? rect.top - th - 8 : rect.bottom + 8
    top = Math.max(8, Math.min(top, window.innerHeight - th - 8))
    setTipPos({ left, top })
  }, [tip, tick])

  const renderTile = (tpl: ComponentTemplate, custom = false) => (
    <button
      key={`${custom ? 'c' : 'b'}-${tpl.name}`}
      className="component-tile"
      draggable={!readOnly}
      onDragStart={(e) => {
        setDragging(tpl.name)
        e.dataTransfer.setData('application/xg-component', tpl.name)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onDragEnd={() => setDragging(null)}
      onClick={() => insert(tpl.name)}
      onMouseEnter={(e) => showTip(e, tpl)}
      title={`插入「${tpl.name}」到当前画板`}
    >
      <span className={`component-tile-icon ${dragging === tpl.name ? 'dragging' : ''}`}><ComponentGlyph name={tpl.name} /></span>
      <span className="component-tile-name">{tpl.short}</span>
      {custom && !readOnly && (
        <span
          className="custom-tile-menu"
          title="重命名 / 删除"
          onClick={(e) => {
            e.stopPropagation()
            const action = prompt('输入操作：rename=重命名，delete=删除', 'rename')
            if (action === 'delete') {
              if (confirm(`删除自定义组件「${tpl.name}」？`)) setCustoms(removeCustomComponent(tpl.name))
            } else if (action === 'rename') {
              const nn = prompt('新名称：', tpl.name)
              if (nn && nn.trim()) setCustoms(renameCustomComponent(tpl.name, nn))
            }
          }}
        >•••</span>
      )}
    </button>
  )

  return (
    <div className="components-tab">
      <div className="component-filter">
        <div className="component-cats">
          {categories.map((c) => (
            <button key={c} className={`cat-chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="component-search">
          <Icon name="search" />
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索组件"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {!readOnly && (
          <button className="save-component-btn" onClick={saveSelection} title="把当前选中的分组保存为可复用组件">＋ 保存选中</button>
        )}
      </div>
      <div
        className="component-grid"
        ref={gridRef}
        onMouseLeave={hideTip}
        onScroll={() => { if (tip) setTick((t) => t + 1) }}
      >
        {builtin.map((tpl) => renderTile(tpl))}
        {builtin.length === 0 && myCustoms.length === 0 && <div className="layer-tree-empty">无匹配组件</div>}
        {myCustoms.length > 0 && (
          <>
            <div className="custom-section-title">我的组件</div>
            {myCustoms.map((tpl) => renderTile(tpl, true))}
          </>
        )}
      </div>
      {tip && createPortal(
        <div
          ref={tooltipRef}
          className={`component-tooltip ${tip.dir}`}
          style={{ left: tipPos?.left ?? 0, top: tipPos?.top ?? 0 }}
          role="tooltip"
        >
          <strong>{tip.tpl.name}</strong>
          <em>{tip.tpl.description}</em>
        </div>,
        document.body
      )}
    </div>
  )
}

export function LayersPanel({ state, dispatch, readOnly = false, onSearchFocusReady }: Props) {
  const activePage = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const tab = state.leftPanelTab
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newLayerMenuOpen, setNewLayerMenuOpen] = useState(false)
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const [pageMenuPageId, setPageMenuPageId] = useState<string | null>(null)
  const [pageRenamingId, setPageRenamingId] = useState<string | null>(null)
  const [pageDraft, setPageDraft] = useState('')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  useEffect(() => {
    if (!pageMenuOpen) return
    const close = () => { setPageMenuOpen(false); setPageMenuPageId(null) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [pageMenuOpen])

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

  const commitPageRename = () => {
    if (pageRenamingId && pageDraft.trim()) {
      dispatch({ type: 'RENAME_PAGE', pageId: pageRenamingId, name: pageDraft.trim() })
    }
    setPageRenamingId(null)
  }

  const openMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch({ type: 'SELECT_LAYERS', ids: [id] })
    const rect = panelRef.current?.getBoundingClientRect()
    setMenu({ id, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) })
  }

  /** 新建图层：放入当前选中 frame 或页内第一个 frame；无 frame 时先建 frame */
  const createNew = (kind: 'rectangle' | 'text' | 'frame' | 'group' | 'image') => {
    const selectedFrame = state.selectedIds
      .map((id) => findLayer(activePage.children, id))
      .find((n) => n && n.type === 'frame')
    const frame = selectedFrame ?? activePage.children.find((n) => n.type === 'frame')
    const layer = createLayer(kind, 60, 60)
    if (kind === 'frame') {
      // 新画板放到页面顶层
      dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: null, layer })
    } else if (frame) {
      dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: frame.id, layer })
    } else {
      // 无画板：先创建画板，再放图层进去
      const f = createLayer('frame', 0, 0)
      f.width = 1440; f.height = 900
      dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: null, layer: f })
      dispatch({ type: 'CREATE_LAYER', pageId: activePage.id, parentId: f.id, layer })
    }
    dispatch({ type: 'SELECT_LAYERS', ids: [layer.id] })
    setNewLayerMenuOpen(false)
  }

  const createPage = () => {
    dispatch({ type: 'CREATE_PAGE', name: `页面 ${state.document.pages.length + 1}` })
  }

  const focusSearch = () => {
    dispatch({ type: 'SET_LEFT_PANEL_TAB', tab: 'layers' })
    searchRef.current?.focus()
  }

  useEffect(() => {
    onSearchFocusReady?.(focusSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 搜索过滤（递归匹配名称）
  const filtered = useRef<LayerNode[]>([])
  filtered.current = search.trim()
    ? filterByName(activePage.children, search.trim())
    : activePage.children

  const collectAll = (nodes: LayerNode[]): LayerNode[] =>
    nodes.flatMap((n) => [n, ...collectAll(n.children)])

  return (
    <aside className="layers-panel panel" ref={panelRef}>
      <div className="panel-tabs">
        <button className={tab === 'layers' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_LEFT_PANEL_TAB', tab: 'layers' })}><Icon name="layers" /> 图层</button>
        <button className={tab === 'components' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_LEFT_PANEL_TAB', tab: 'components' })}><Icon name="components" /> 组件</button>
      </div>

      {tab === 'components' ? (
        <ComponentGrid dispatch={dispatch} readOnly={readOnly} activePage={activePage} state={state} />
      ) : (
        <>
          <div className="search-field">
            <Icon name="search" />
            <input
              ref={searchRef}
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索图层"
              onClick={(e) => e.stopPropagation()}
            />
            <kbd>⌘ F</kbd>
          </div>

          <div className="layers-heading"><span>页面</span>{!readOnly && <button onClick={createPage} title="新建页面"><Icon name="plus" /></button>}</div>
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
                {pageRenamingId === p.id ? (
                  <input
                    className="page-rename-input"
                    autoFocus
                    value={pageDraft}
                    onChange={(e) => setPageDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commitPageRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitPageRename()
                      if (e.key === 'Escape') setPageRenamingId(null)
                    }}
                  />
                ) : (
                  <span onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) { setPageRenamingId(p.id); setPageDraft(p.name) } }}>{p.name}</span>
                )}
                {!readOnly && (
                  <span
                    className="page-menu"
                    onClick={(e) => { e.stopPropagation(); setPageMenuPageId(p.id); setPageMenuOpen((v) => !(v && pageMenuPageId === p.id)) }}
                  >•••</span>
                )}
              </div>
            ))}
          </div>

          {pageMenuOpen && pageMenuPageId && (
            <div className="layer-popover popover-page-menu">
              <button onClick={() => {
                const page = state.document.pages.find((p) => p.id === pageMenuPageId)
                if (!page) return
                setPageMenuOpen(false)
                setPageRenamingId(page.id)
                setPageDraft(page.name)
              }}>重命名</button>
              <button onClick={() => {
                dispatch({ type: 'DUPLICATE_PAGE', pageId: pageMenuPageId })
                setPageMenuOpen(false)
              }}>复制</button>
              <button className="danger" onClick={() => {
                if (state.document.pages.length <= 1) {
                  setPageMenuOpen(false)
                  return
                }
                dispatch({ type: 'DELETE_PAGE', pageId: pageMenuPageId })
                setPageMenuOpen(false)
              }}>删除</button>
            </div>
          )}

          <div className="layers-heading tree-heading">
            <span>图层</span>
            <span className="tree-actions">
              <span className="tree-action" title={activePage.children.every((n) => !n.visible) ? '全部显示' : '全部隐藏'}
                onClick={() => {
                  if (readOnly) return
                  const all = collectAll(activePage.children)
                  const allHidden = all.length > 0 && all.every((n) => !n.visible)
                  // TOGGLE 翻转：全部隐藏 → toggle 所有当前可见的；全部显示 → toggle 所有当前隐藏的
                  const targets = allHidden ? all.filter((n) => !n.visible) : all.filter((n) => n.visible)
                  if (targets.length > 0) dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', ids: targets.map((n) => n.id) })
                }}>
                {activePage.children.every((n) => !n.visible) ? <EyeClosed /> : <EyeOpen />}
              </span>
              <span className="tree-action" title="全部锁定"
                onClick={() => {
                  if (readOnly) return
                  const all = collectAll(activePage.children)
                  const allLocked = all.length > 0 && all.every((n) => n.locked)
                  // TOGGLE 翻转：全部锁定 → toggle 所有当前未锁的；全部解锁 → toggle 所有当前已锁的
                  const targets = allLocked ? all.filter((n) => n.locked) : all.filter((n) => !n.locked)
                  if (targets.length > 0) dispatch({ type: 'TOGGLE_LAYER_LOCK', ids: targets.map((n) => n.id) })
                }}>
                <LockClosed />
              </span>
            </span>
          </div>
          <div className="layer-tree">
            {filtered.current.map((node) => (
              <LayerTreeItem
                key={node.id}
                node={node}
                depth={0}
                dispatch={dispatch}
                selectedIds={state.selectedIds}
                readOnly={readOnly}
                onContextMenu={openMenu}
                onRenameRequest={openRename}
                renamingId={renamingId}
                draft={draft}
                onDraftChange={setDraft}
                onCommitRename={commitRename}
              />
            ))}
            {filtered.current.length === 0 && <div className="layer-tree-empty">{search ? '无匹配图层' : '暂无图层'}</div>}
          </div>
        </>
      )}

      {!readOnly && (
        <div className="layers-footer">
          <span className="new-layer-trigger" onClick={() => setNewLayerMenuOpen((v) => !v)}>
            <Icon name="plus" /> 新建图层
          </span>
          <span title="⌘⌥G 分组 / ⌘⇧G 取消分组">⌘⌥G 分组</span>
        </div>
      )}

      {/* 新建图层菜单 */}
      {newLayerMenuOpen && (
        <div className="layer-popover popover-new-layer">
          {(['rectangle', 'text', 'frame', 'group', 'image'] as const).map((kind) => (
            <button key={kind} onClick={() => createNew(kind)}>{kindName(kind)}</button>
          ))}
        </div>
      )}

      {/* 右键菜单 */}
      {menu && (
        <div className="layer-popover popover-menu" style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => openRename(menu.id)}>重命名</button>
          <button onClick={() => { dispatch({ type: 'DUPLICATE_LAYERS', ids: [menu.id] }); setMenu(null) }}>复制</button>
          <button onClick={() => { dispatch({ type: 'GROUP_LAYERS', ids: state.selectedIds.includes(menu.id) ? state.selectedIds : [menu.id] }); setMenu(null) }}>编组</button>
          {findLayer(activePage.children, menu.id)?.type === 'group' && (
            <button onClick={() => { dispatch({ type: 'UNGROUP_LAYERS', id: menu.id }); setMenu(null) }}>取消编组</button>
          )}
          <button onClick={() => { dispatch({ type: 'REORDER_LAYER', id: menu.id, direction: 'backward' }); setMenu(null) }}>后移一层</button>
          <button onClick={() => { dispatch({ type: 'REORDER_LAYER', id: menu.id, direction: 'forward' }); setMenu(null) }}>前移一层</button>
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

function filterByName(root: LayerNode[], keyword: string): LayerNode[] {
  const k = keyword.toLowerCase()
  const out: LayerNode[] = []
  for (const node of root) {
    if (node.name.toLowerCase().includes(k)) {
      out.push(node)
    } else {
      const children = filterByName(node.children, k)
      if (children.length > 0) out.push({ ...node, children })
    }
  }
  return out
}

function kindName(kind: LayerNode['type']): string {
  switch (kind) {
    case 'rectangle': return '矩形'
    case 'text': return '文本'
    case 'frame': return '画板'
    case 'group': return '分组'
    case 'image': return '图片'
    default: return kind
  }
}
