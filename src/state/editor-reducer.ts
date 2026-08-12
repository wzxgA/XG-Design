import type { EditorAction, EditorState, LayerNode, DesignDocument, LayerStyle } from '../types/design'

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

// ---- Reducer ----

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
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
      return { ...state, document: { ...state.document, name: action.name, updatedAt: Date.now() } }

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
      return { ...state, document: { ...doc, updatedAt: Date.now() } }
    }

    case 'DELETE_LAYERS': {
      const ids = new Set(action.ids)
      const pageId = state.document.activePageId
      const doc = cloneDocument(state.document)
      const page = doc.pages.find((p) => p.id === pageId)
      if (!page) return state
      page.children = deleteIds(page.children, ids)
      const remainingSelected = state.selectedIds.filter((id) => !ids.has(id))
      return { ...state, document: { ...doc, updatedAt: Date.now() }, selectedIds: remainingSelected }
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
      return { ...state, document: { ...doc, updatedAt: Date.now() }, selectedIds: clones.map((c) => c.id) }
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
      return { ...state, document: { ...doc, updatedAt: Date.now() } }
    }

    case 'TOGGLE_LAYER_VISIBILITY': {
      const ids = new Set(action.ids)
      const doc = mapLayers(state.document, ids, (node) => ({ ...node, visible: !node.visible }))
      return { ...state, document: { ...doc, updatedAt: Date.now() } }
    }

    case 'TOGGLE_LAYER_LOCK': {
      const ids = new Set(action.ids)
      const doc = mapLayers(state.document, ids, (node) => ({ ...node, locked: !node.locked }))
      return { ...state, document: { ...doc, updatedAt: Date.now() } }
    }

    case 'TOGGLE_LAYER_EXPANDED': {
      const doc = mapAllLayers(state.document, (node) =>
        node.id === action.id ? { ...node, expanded: !node.expanded } : node,
      )
      return { ...state, document: { ...doc, updatedAt: Date.now() } }
    }

    case 'UNDO':
    case 'REDO':
      return state

    default:
      return state
  }
}
