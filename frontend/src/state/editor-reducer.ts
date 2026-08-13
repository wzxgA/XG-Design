import type { EditorAction, EditorState, LayerNode, DesignDocument, LayerStyle, HistoryState } from '../types/design'

export const ZOOM_MIN = 25
export const ZOOM_MAX = 200
export const HISTORY_LIMIT = 50

// ---- 图层树遍历辅助 ----

function findLayerById(root: LayerNode[], id: string): LayerNode | null {
  for (const node of root) {
    if (node.id === id) return node
    const found = findLayerById(node.children, id)
    if (found) return found
  }
  return null
}

function cloneDocument(doc: DesignDocument): DesignDocument {
  return JSON.parse(JSON.stringify(doc)) as DesignDocument
}

// 对文档中所有匹配 id 的节点应用 updater，返回新文档
function mapLayers(doc: DesignDocument, ids: Set<string>, updater: (node: LayerNode) => LayerNode): DesignDocument {
  const walk = (children: LayerNode[]): LayerNode[] =>
    children.map((node) => {
      const updated = ids.has(node.id) ? updater(node) : node
      const newChildren = walk(updated.children)
      if (newChildren === updated.children && updated === node) return node
      return { ...updated, children: newChildren }
    })
  return { ...doc, pages: doc.pages.map((p) => ({ ...p, children: walk(p.children) })) }
}

function mapAllLayers(doc: DesignDocument, updater: (node: LayerNode) => LayerNode): DesignDocument {
  const walk = (children: LayerNode[]): LayerNode[] => children.map((node) => ({ ...updater(node), children: walk(node.children) }))
  return { ...doc, pages: doc.pages.map((p) => ({ ...p, children: walk(p.children) })) }
}

function findParentAndIndex(root: LayerNode[], id: string): { parent: LayerNode[]; index: number } | null {
  for (let i = 0; i < root.length; i++) {
    if (root[i].id === id) return { parent: root, index: i }
    const nested = findParentAndIndex(root[i].children, id)
    if (nested) return nested
  }
  return null
}

function deleteIds(root: LayerNode[], ids: Set<string>): LayerNode[] {
  const result: LayerNode[] = []
  for (const node of root) {
    if (ids.has(node.id)) continue
    result.push({ ...node, children: deleteIds(node.children, ids) })
  }
  return result
}

// ---- 历史记录辅助 ----

/** 在文档变更前记录快照：将当前文档压入 past，清空 future */
function withHistory(state: EditorState, nextDoc: DesignDocument, extra: Partial<EditorState> = {}): EditorState {
  const past = [...state.history.past, cloneDocument(state.document)].slice(-HISTORY_LIMIT)
  return {
    ...state,
    ...extra,
    document: { ...nextDoc, updatedAt: Date.now() },
    history: { past, future: [] },
  }
}

function emptyHistory(): HistoryState {
  return { past: [], future: [] }
}

// ---- Reducer ----

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'LOAD_DOCUMENT':
      return {
        ...state,
        document: action.doc,
        selectedIds: action.selectInitial ? ['grp-data-cards'] : [],
        history: emptyHistory(),
      }

    case 'SELECT_LAYERS':
      return { ...state, selectedIds: action.ids }

    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.tool }

    case 'SET_INSPECTOR_TAB':
      return { ...state, inspectorTab: action.tab }

    case 'SET_LEFT_PANEL_TAB':
      return { ...state, leftPanelTab: action.tab }

    case 'SET_ZOOM':
      return { ...state, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, action.zoom)) }

    case 'SET_PAN':
      return { ...state, pan: action.pan }

    case 'RENAME_DOCUMENT':
      return withHistory(state, { ...state.document, name: action.name })

    case 'SET_ACTIVE_PAGE': {
      const page = state.document.pages.find((p) => p.id === action.pageId)
      if (!page) return state
      return {
        ...state,
        document: { ...state.document, activePageId: action.pageId },
        selectedIds: [],
      }
    }

    case 'CREATE_PAGE': {
      const doc = cloneDocument(state.document)
      const pageId = `page-${Date.now().toString(36)}`
      doc.pages.push({ id: pageId, name: action.name, children: [] })
      doc.activePageId = pageId
      return withHistory(state, doc, { selectedIds: [] })
    }

    case 'CREATE_LAYER': {
      const page = state.document.pages.find((p) => p.id === action.pageId)
      if (!page) return state
      const doc = cloneDocument(state.document)
      const targetPage = doc.pages.find((p) => p.id === action.pageId)!
      const newLayer = { ...action.layer }
      if (action.parentId == null) {
        targetPage.children = [...targetPage.children, newLayer]
      } else {
        const parent = findLayerById(targetPage.children, action.parentId)
        if (!parent) return state
        parent.children = [...parent.children, newLayer]
      }
      return withHistory(state, doc)
    }

    case 'DELETE_LAYERS': {
      const ids = new Set(action.ids)
      const pageId = state.document.activePageId
      const doc = cloneDocument(state.document)
      const page = doc.pages.find((p) => p.id === pageId)
      if (!page) return state
      page.children = deleteIds(page.children, ids)
      const remainingSelected = state.selectedIds.filter((id) => !ids.has(id))
      return withHistory(state, doc, { selectedIds: remainingSelected })
    }

    case 'DUPLICATE_LAYERS': {
      const pageId = state.document.activePageId
      const doc = cloneDocument(state.document)
      const page = doc.pages.find((p) => p.id === pageId)
      if (!page) return state
      const clones: LayerNode[] = []
      let offset = 0
      for (const id of action.ids) {
        const original = findLayerById(page.children, id)
        if (!original) continue
        const clone = JSON.parse(JSON.stringify(original)) as LayerNode
        clone.id = `dup-${Date.now()}-${offset}`
        clone.x += 16
        clone.y += 16
        clone.name = `${original.name} 副本`
        clones.push(clone)
        offset += 1
      }
      page.children = [...page.children, ...clones]
      return withHistory(state, doc, { selectedIds: clones.map((c) => c.id) })
    }

    case 'UPDATE_LAYER_PROPERTIES': {
      const ids = new Set(action.ids)
      const { patch } = action
      const doc = mapLayers(state.document, ids, (node) => {
        const stylePatch = patch.style ? patch.style : undefined
        const next: LayerNode = { ...node, ...(patch as Omit<Partial<LayerNode>, 'style'>), children: node.children }
        if (stylePatch) {
          next.style = { ...node.style, ...(stylePatch as Partial<LayerStyle>) }
        }
        return next
      })
      return withHistory(state, doc)
    }

    case 'TOGGLE_LAYER_VISIBILITY': {
      const ids = new Set(action.ids)
      const doc = mapLayers(state.document, ids, (node) => ({ ...node, visible: !node.visible }))
      return withHistory(state, doc)
    }

    case 'TOGGLE_LAYER_LOCK': {
      const ids = new Set(action.ids)
      const doc = mapLayers(state.document, ids, (node) => ({ ...node, locked: !node.locked }))
      return withHistory(state, doc)
    }

    case 'TOGGLE_LAYER_EXPANDED': {
      const doc = mapAllLayers(state.document, (node) =>
        node.id === action.id ? { ...node, expanded: !node.expanded } : node,
      )
      return withHistory(state, doc)
    }

    case 'RENAME_LAYER': {
      const name = action.name.trim() || action.name
      const doc = mapAllLayers(state.document, (node) =>
        node.id === action.id ? { ...node, name } : node,
      )
      return withHistory(state, doc)
    }

    case 'BEGIN_MOVE': {
      // 拖拽开始时记录一次快照，供整次移动撤销；随后 MOVE_LAYERS 不再写历史
      return withHistory(state, state.document)
    }

    case 'MOVE_LAYERS': {
      const ids = new Set(action.ids)
      const doc = mapLayers(state.document, ids, (node) => ({
        ...node,
        x: node.x + action.dx,
        y: node.y + action.dy,
      }))
      // 拖拽中间帧不记历史（快照已在 BEGIN_MOVE 时记录）
      return { ...state, document: { ...doc, updatedAt: Date.now() } }
    }

    case 'ADD_PROTOTYPE_LINK': {
      const links = [...state.document.prototypeLinks, action.link]
      return withHistory(state, { ...state.document, prototypeLinks: links })
    }

    case 'REMOVE_PROTOTYPE_LINK': {
      const links = state.document.prototypeLinks.filter((l) => l.id !== action.id)
      return withHistory(state, { ...state.document, prototypeLinks: links })
    }

    case 'UNDO': {
      const past = state.history.past
      if (past.length === 0) return state
      const previous = past[past.length - 1]
      return {
        ...state,
        document: previous,
        history: {
          past: past.slice(0, -1),
          future: [cloneDocument(state.document), ...state.history.future],
        },
      }
    }

    case 'REDO': {
      const future = state.history.future
      if (future.length === 0) return state
      const next = future[0]
      return {
        ...state,
        document: next,
        history: {
          past: [...state.history.past, cloneDocument(state.document)],
          future: future.slice(1),
        },
      }
    }

    default:
      return state
  }
}

export { emptyHistory }
