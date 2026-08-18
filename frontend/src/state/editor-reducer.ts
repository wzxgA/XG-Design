import type { EditorAction, EditorState, LayerNode, DesignDocument, LayerStyle, HistoryState, PageNode } from '../types/design'
import { layerId, ensureAiParent, createLayer } from '../utils/layers'
import { applyAutoLayout } from '../utils/layout'
import { booleanPolygons } from '../utils/path-boolean'
import type { ShapePoly } from '../utils/path-boolean'

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

/** 查找节点及其相对页面顶层的绝对坐标（祖先 x/y 累加，忽略旋转） */
function findLayerAbs(root: LayerNode[], id: string, ox = 0, oy = 0): { node: LayerNode; absX: number; absY: number } | null {
  for (const n of root) {
    const absX = ox + n.x
    const absY = oy + n.y
    if (n.id === id) return { node: n, absX, absY }
    const found = findLayerAbs(n.children, id, absX, absY)
    if (found) return found
  }
  return null
}

/** 生成深拷贝节点并重新生成全部子节点 id（用于页面复制） */
function regenerateIds(node: LayerNode): LayerNode {
  return { ...node, id: layerId(node.type), children: node.children.map(regenerateIds) }
}

/** 旧文档迁移：将由「组件背景」子节点构成的 group 标记为一体化组件 */
function migrateComponents(doc: DesignDocument): DesignDocument {
  const walk = (nodes: LayerNode[]): LayerNode[] =>
    nodes.map((node) => {
      const next = { ...node, children: walk(node.children) }
      if (next.type === 'group' && !next.component && next.children.some((c) => c.name === '组件背景')) {
        next.component = next.name
      }
      return next
    })
  return { ...doc, pages: doc.pages.map((p) => ({ ...p, children: walk(p.children) })) }
}

/** Auto Layout 数据层重排：遍历所有带 autoLayout 的节点，把布局结果写回子节点坐标与父尺寸（幂等） */
function reflowDocument(doc: DesignDocument): DesignDocument {
  const walk = (nodes: LayerNode[]): LayerNode[] =>
    nodes.map((node) => {
      const next: LayerNode = { ...node, children: walk(node.children) }
      if (next.autoLayout) {
        const res = applyAutoLayout(next)
        if (res) {
          if (res.children) next.children = res.children
          if (res.width !== undefined) next.width = res.width
          if (res.height !== undefined) next.height = res.height
        }
      }
      return next
    })
  return { ...doc, pages: doc.pages.map((p) => ({ ...p, children: walk(p.children) })) }
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
        document: migrateComponents(action.doc),
        selectedIds: [],
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
      // 新页面自动附带一个默认画板（1440×900），保证新建页面可直接绘制
      const defaultFrame: LayerNode = {
        id: layerId('frame'), type: 'frame', name: '画板 1', x: 0, y: 0,
        width: 1440, height: 900, rotation: 0, visible: true, locked: false,
        expanded: true, style: { opacity: 1, fill: '#ffffff' }, children: [],
      }
      doc.pages.push({ id: pageId, name: action.name, children: [defaultFrame] })
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
      return withHistory(state, reflowDocument(doc))
    }

    case 'DELETE_LAYERS': {
      const ids = new Set(action.ids)
      const pageId = state.document.activePageId
      const doc = cloneDocument(state.document)
      const page = doc.pages.find((p) => p.id === pageId)
      if (!page) return state
      page.children = deleteIds(page.children, ids)
      const remainingSelected = state.selectedIds.filter((id) => !ids.has(id))
      return withHistory(state, reflowDocument(doc), { selectedIds: remainingSelected })
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
      return withHistory(state, reflowDocument(doc), { selectedIds: clones.map((c) => c.id) })
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
      return withHistory(state, reflowDocument(doc))
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

    case 'GROUP_LAYERS': {
      if (action.ids.length < 2) return state
      const doc = cloneDocument(state.document)
      const page = doc.pages.find((p) => p.id === state.document.activePageId)
      if (!page) return state
      const idSet = new Set(action.ids)
      const first = action.ids[0]
      const loc = findParentAndIndex(page.children, first)
      if (!loc) return state
      const { parent } = loc
      const targets = parent.filter((n) => idSet.has(n.id))
      if (targets.length < 2) return state
      const minX = Math.min(...targets.map((t) => t.x))
      const minY = Math.min(...targets.map((t) => t.y))
      const maxX = Math.max(...targets.map((t) => t.x + t.width))
      const maxY = Math.max(...targets.map((t) => t.y + t.height))
      const groupNode: LayerNode = {
        id: layerId('group'), type: 'group', name: '分组',
        x: minX, y: minY, width: maxX - minX, height: maxY - minY,
        rotation: 0, visible: true, locked: false, expanded: true,
        style: { opacity: 1 },
        children: targets.map((t) => ({ ...t, x: t.x - minX, y: t.y - minY })),
      }
      const firstTargetIdx = parent.findIndex((n) => n.id === first)
      const remaining = parent.filter((n) => !idSet.has(n.id))
      parent.splice(0, parent.length, ...remaining.slice(0, firstTargetIdx), groupNode, ...remaining.slice(firstTargetIdx))
      return withHistory(state, reflowDocument(doc), { selectedIds: [groupNode.id] })
    }

    case 'UNGROUP_LAYERS': {
      const doc = cloneDocument(state.document)
      const page = doc.pages.find((p) => p.id === state.document.activePageId)
      if (!page) return state
      const loc = findParentAndIndex(page.children, action.id)
      if (!loc) return state
      const { parent, index } = loc
      const groupNode = parent[index]
      if (!groupNode || groupNode.type !== 'group') return state
      const lifted = groupNode.children.map((c) => ({ ...c, x: c.x + groupNode.x, y: c.y + groupNode.y }))
      parent.splice(index, 1, ...lifted)
      return withHistory(state, reflowDocument(doc), { selectedIds: lifted.map((c) => c.id) })
    }

    case 'REORDER_LAYER': {
      const doc = cloneDocument(state.document)
      const page = doc.pages.find((p) => p.id === state.document.activePageId)
      if (!page) return state
      const loc = findParentAndIndex(page.children, action.id)
      if (!loc) return state
      const { parent, index } = loc
      const target = action.direction === 'forward' ? index + 1 : index - 1
      if (target < 0 || target >= parent.length) return state
      const [item] = parent.splice(index, 1)
      parent.splice(target, 0, item)
      return withHistory(state, reflowDocument(doc))
    }

    case 'REORDER_TO_INDEX': {
      // Auto Layout 拖拽排序：把 id 所在节点移动到 targetIndex（与目标相邻元素比较的插入位置）
      const doc = cloneDocument(state.document)
      const page = doc.pages.find((p) => p.id === state.document.activePageId)
      if (!page) return state
      const loc = findParentAndIndex(page.children, action.id)
      if (!loc) return state
      const { parent, index } = loc
      if (index === action.targetIndex) return state
      const target = Math.max(0, Math.min(parent.length - 1, action.targetIndex))
      const [item] = parent.splice(index, 1)
      // splice 语义：插入到 target 索引元素之前；移除后数组已缩短，target>index 时需前移一位
      const insertAt = target > index ? target - 1 : target
      parent.splice(insertAt, 0, item)
      return withHistory(state, reflowDocument(doc))
    }

    case 'RENAME_PAGE': {
      const doc = cloneDocument(state.document)
      doc.pages = doc.pages.map((p) => (p.id === action.pageId ? { ...p, name: action.name } : p))
      return withHistory(state, doc)
    }

    case 'DELETE_PAGE': {
      if (state.document.pages.length <= 1) return state
      const doc = cloneDocument(state.document)
      const idx = doc.pages.findIndex((p) => p.id === action.pageId)
      if (idx < 0) return state
      doc.pages.splice(idx, 1)
      if (doc.activePageId === action.pageId) {
        doc.activePageId = doc.pages[Math.max(0, idx - 1)].id
      }
      doc.prototypeLinks = doc.prototypeLinks.filter((l) => l.targetPageId !== action.pageId)
      return withHistory(state, doc, { selectedIds: [] })
    }

    case 'DUPLICATE_PAGE': {
      const doc = cloneDocument(state.document)
      const idx = doc.pages.findIndex((p) => p.id === action.pageId)
      if (idx < 0) return state
      const orig = doc.pages[idx]
      const copy: PageNode = {
        ...JSON.parse(JSON.stringify(orig)) as PageNode,
        id: layerId('page'),
        name: `${orig.name} 副本`,
        children: orig.children.map(regenerateIds),
      }
      doc.pages.splice(idx + 1, 0, copy)
      doc.activePageId = copy.id
      return withHistory(state, doc, { selectedIds: [] })
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

    case 'CLEAR_HISTORY':
      return { ...state, history: { past: [], future: [] } }

    case 'SET_MASTER_OVERRIDE': {
      const mo = { ...(state.document.masterOverrides ?? {}) }
      mo[action.componentName] = { ...(mo[action.componentName] ?? {}), [action.key]: action.value }
      return withHistory(state, { ...state.document, masterOverrides: mo })
    }

    case 'RESET_MASTER_OVERRIDE': {
      const mo = { ...(state.document.masterOverrides ?? {}) }
      const entry = { ...(mo[action.componentName] ?? {}) }
      delete entry[action.key]
      if (Object.keys(entry).length === 0) delete mo[action.componentName]
      else mo[action.componentName] = entry
      return withHistory(state, { ...state.document, masterOverrides: mo })
    }

    case 'SET_MASTER_EDIT_DRAFT': {
      const me = state.masterEdit
      if (!me || me.componentName !== action.componentName) return state
      const draft = { ...(me.draft ?? {}) }
      if (action.value === undefined) delete draft[action.key]
      else draft[action.key] = action.value
      return { ...state, masterEdit: { ...me, draft } }
    }

    case 'SET_MASTER_EDIT_DRAFT_ALL': {
      const me = state.masterEdit
      if (!me || me.componentName !== action.componentName) return state
      return { ...state, masterEdit: { ...me, draft: action.draft } }
    }

    case 'ENTER_MASTER_EDIT':
      return { ...state, masterEdit: { componentName: action.componentName, draft: {} } }

    case 'SET_MASTER_EDIT_DRAFT': {
      const me = state.masterEdit
      if (!me || me.componentName !== action.componentName) return state
      const draft = { ...(me.draft ?? {}) }
      if (action.value === undefined) delete draft[action.key]
      else draft[action.key] = action.value
      return { ...state, masterEdit: { ...me, draft } }
    }

    case 'COMMIT_MASTER_EDIT': {
      const me = state.masterEdit
      if (!me || me.componentName !== action.componentName) return state
      const draft = me.draft ?? {}
      if (Object.keys(draft).length === 0) return { ...state, masterEdit: undefined }
      const mo = { ...(state.document.masterOverrides ?? {}), [action.componentName]: { ...(state.document.masterOverrides ?? {})[action.componentName], ...draft } }
      return withHistory({ ...state, masterEdit: undefined }, { ...state.document, masterOverrides: mo })
    }

    case 'EXIT_MASTER_EDIT':
      return { ...state, masterEdit: undefined }

    case 'APPLY_DESIGN': {
      // 将 AI 生成的图层数组应用到文档：
      // 1) ensureAiParent 兜底保证顶层父节点结构
      // 2) 顶层多个 frame（AI 多界面）→ 每个 frame 新建一个 Page（当前页为空则替换空白页）
      // 3) 单顶层 frame（画板）→ 页面根级与已有画板并列；单顶层 group（组件/局部）→ 并入第一个画板
      const doc = cloneDocument(state.document)
      const layers = ensureAiParent(action.layers)

      if (layers.length >= 2 && layers.every((n) => n.type === 'frame')) {
        const activePage = doc.pages.find((p) => p.id === doc.activePageId)
        const rest = [...layers]
        const frameToPage = new Map<string, string>()
        if (activePage && activePage.children.length === 0) {
          // 当前页为空：第一个界面替换空白页
          const first = rest.shift()!
          activePage.name = first.name || activePage.name
          activePage.children = [first]
          frameToPage.set(first.id, activePage.id)
        }
        for (const f of rest) {
          const pid = `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
          doc.pages.push({ id: pid, name: f.name || `页面 ${doc.pages.length + 1}`, children: [f] })
          frameToPage.set(f.id, pid)
        }
        doc.activePageId = doc.pages[doc.pages.length - 1].id
        // 原型跳转：AI 声明的 targetFrameId → 真实 pageId，写入 prototypeLinks
        const existing = new Set(doc.prototypeLinks.map((l) => `${l.sourceLayerId}|${l.targetPageId}`))
        for (const l of action.links ?? []) {
          const targetPageId = frameToPage.get(l.targetFrameId)
          if (!targetPageId) continue
          const key = `${l.sourceLayerId}|${targetPageId}`
          if (existing.has(key)) continue
          existing.add(key)
          doc.prototypeLinks.push({
            id: `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
            sourceLayerId: l.sourceLayerId,
            targetPageId,
            trigger: 'click',
            transition: l.transition,
          })
        }
        return withHistory(state, doc, { selectedIds: [] })
      }

      const page = doc.pages.find((p) => p.id === doc.activePageId)
      if (!page) return state
      const frame = page.children.find((n) => n.type === 'frame')
      const topType = layers[0]?.type
      if (frame && topType === 'group') {
        frame.children = [...frame.children, ...layers]
      } else {
        page.children = [...page.children, ...layers]
      }
      return withHistory(state, doc, { selectedIds: [] })
    }

    case 'APPLY_EDIT': {
      // 将 AI 修改操作（update/delete/replace）原位应用到当前文档，不新增副本
      let doc = cloneDocument(state.document)
      for (const op of action.operations) {
        if (op.op === 'update') {
          const patch = op.patch
          doc = mapLayers(doc, new Set([op.id]), (n) => {
            // componentProps 按 key 浅合并（AI 只写要改的 key，其余保留）
            const mergedProps = patch.componentProps
              ? { ...(n.componentProps ?? {}), ...patch.componentProps }
              : n.componentProps
            const next = { ...n, ...patch, componentProps: mergedProps }
            // 组件尺寸联动：props 显式给出 width/height 时同步到节点本体（与检视面板行为一致）
            if (n.component && mergedProps && typeof mergedProps.width === 'number') {
              next.width = mergedProps.width
            }
            if (n.component && mergedProps && typeof mergedProps.height === 'number') {
              next.height = mergedProps.height
            }
            next.style = patch.style ? { ...n.style, ...patch.style } : n.style
            return next
          })
        } else if (op.op === 'delete') {
          doc = {
            ...doc,
            pages: doc.pages.map((p) => ({
              ...p,
              children: deleteIds(p.children, new Set([op.id])),
            })),
          }
        } else if (op.op === 'replace') {
          // 保留原 id（替换内容但 id 不变，选中状态延续）
          const newNode = { ...op.node, id: op.id }
          doc = mapLayers(doc, new Set([op.id]), () => newNode)
        } else if (op.op === 'insert') {
          // 新增子元素：parentId 优先匹配容器图层（frame/group），其次匹配页面 id（加到该页顶层）。
          // 为新节点及其子树重新生成唯一 id，避免与已有图层 id 冲突；坐标缺省兜底 0/默认尺寸
          const inserted = regenerateIds({
            ...op.node,
            x: op.node.x ?? 0,
            y: op.node.y ?? 0,
            width: op.node.width ?? 120,
            height: op.node.height ?? 80,
          })
          let insertedFlag = false
          let next = mapLayers(doc, new Set([op.parentId]), (parent) => {
            insertedFlag = true
            return { ...parent, children: [...parent.children, inserted] }
          })
          if (!insertedFlag) {
            next = {
              ...next,
              pages: next.pages.map((p) => {
                if (p.id !== op.parentId) return p
                insertedFlag = true
                return { ...p, children: [...p.children, inserted] }
              }),
            }
          }
          doc = next
        }
      }
      return withHistory(state, doc, { selectedIds: [] })
    }

    case 'APPLY_BOOLEAN': {
      // 多选矢量形状做布尔运算：以第一个选中为准替换为结果路径，其余删除
      if (action.ids.length < 2) return state
      let doc = cloneDocument(state.document)
      // 收集选中节点（含绝对坐标），仅支持 rectangle / path
      const infos: { id: string; absX: number; absY: number; node: LayerNode }[] = []
      for (const page of doc.pages) {
        for (const id of action.ids) {
          if (infos.some((i) => i.id === id)) continue
          const found = findLayerAbs(page.children, id)
          if (found && (found.node.type === 'rectangle' || found.node.type === 'path')) {
            infos.push({ id, absX: found.absX, absY: found.absY, node: found.node })
          }
        }
      }
      if (infos.length < 2) return state
      const shapes: ShapePoly[] = infos.map((i) =>
        i.node.type === 'rectangle'
          ? { type: 'rect', x: i.absX, y: i.absY, width: i.node.width, height: i.node.height }
          : { type: 'path', x: i.absX, y: i.absY, width: i.node.width, height: i.node.height, points: i.node.points, closed: i.node.pathClosed },
      )
      const result = booleanPolygons(shapes, action.mode)
      if (result.length < 3) return state
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of result) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
      const primary = infos[0]
      // 结果坐标转回第一个选中的父级相对坐标
      const parentOx = primary.absX - primary.node.x
      const parentOy = primary.absY - primary.node.y
      const resultNode = createLayer('path', minX - parentOx, minY - parentOy)
      resultNode.type = 'path'
      resultNode.name = '路径'
      resultNode.width = Math.max(1, maxX - minX)
      resultNode.height = Math.max(1, maxY - minY)
      resultNode.points = result.map((p) => ({ x: p.x - minX, y: p.y - minY }))
      resultNode.pathClosed = true
      resultNode.style = { ...primary.node.style }
      const primaryId = primary.id
      const otherIds = new Set(infos.slice(1).map((i) => i.id))
      doc = mapLayers(doc, new Set([primaryId]), () => resultNode)
      doc = { ...doc, pages: doc.pages.map((p) => ({ ...p, children: deleteIds(p.children, otherIds) })) }
      return withHistory(state, doc, { selectedIds: [primaryId] })
    }

    case 'ADD_COMMENT_REPLY': {
      const doc = mapLayers(state.document, new Set([action.commentId]), (node) => ({
        ...node,
        replies: [...(node.replies ?? []), action.reply],
      }))
      return withHistory(state, doc)
    }

    case 'DELETE_COMMENT_REPLY': {
      const doc = mapLayers(state.document, new Set([action.commentId]), (node) => ({
        ...node,
        replies: (node.replies ?? []).filter((r) => r.id !== action.replyId),
      }))
      return withHistory(state, doc)
    }

    default:
      return state
  }
}

export { emptyHistory }
