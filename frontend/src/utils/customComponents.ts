import type { ComponentPropDef, LayerNode } from '../types/design'
import type { ComponentTemplate } from '../fixtures/component-library'
import { layerId } from '../utils/layers'

/** 自定义组件本地存储 key */
const STORAGE_KEY = 'xgdesign:custom-components'

/** 存储定义：保存「名字 + 源 group 结构」，加载时再推断模板（函数不可 JSON 序列化） */
interface CustomComponentDef {
  name: string
  group: LayerNode
}

function deepCloneLayer(node: LayerNode, renewId = false): LayerNode {
  return {
    ...node,
    id: renewId ? layerId(node.type) : node.id,
    style: { ...node.style },
    children: node.children.map((c) => deepCloneLayer(c, renewId)),
  }
}

function setPath(obj: Record<string, unknown>, path: string[], value: unknown) {
  let cur = obj
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] as Record<string, unknown>
  cur[path[path.length - 1]] = value
}

/** 从 group 结构启发式推断 schema（矩形→背景/圆角；文字→文案/色/字号；图片→地址） */
export function inferCustomTemplate(group: LayerNode, name?: string): ComponentTemplate {
  const props: ComponentPropDef[] = []
  const bindings: { key: string; childId: string; path: string[] }[] = []
  const baseName = name || `${group.name}副本`

  group.children.forEach((child, i) => {
    if (child.type === 'rectangle') {
      const key = `bg${i}`
      props.push({ key, label: '背景色', type: 'color', default: child.style.fill ?? '#ffffff' })
      bindings.push({ key, childId: child.id, path: ['style', 'fill'] })
      const rk = `radius${i}`
      props.push({ key: rk, label: '圆角', type: 'slider', min: 0, max: 32, default: child.style.cornerRadius ?? 0 })
      bindings.push({ key: rk, childId: child.id, path: ['style', 'cornerRadius'] })
    }
    if (child.type === 'text') {
      const tk = `text${i}`
      props.push({ key: tk, label: `文字${props.filter((p) => p.key.startsWith('text')).length + 1}`, type: 'text', default: child.content ?? '' })
      bindings.push({ key: tk, childId: child.id, path: ['content'] })
      const ck = `textColor${i}`
      props.push({ key: ck, label: '文字色', type: 'color', default: child.style.fontColor ?? child.style.color ?? '#5c6b72' })
      bindings.push({ key: ck, childId: child.id, path: ['style', 'fontColor'] })
      const fk = `fontSize${i}`
      props.push({ key: fk, label: '字号', type: 'number', min: 8, max: 72, default: child.style.fontSize ?? 14 })
      bindings.push({ key: fk, childId: child.id, path: ['style', 'fontSize'] })
    }
    if (child.type === 'image') {
      const ik = `image${i}`
      props.push({ key: ik, label: '图片地址', type: 'text', default: child.imageUrl ?? '' })
      bindings.push({ key: ik, childId: child.id, path: ['imageUrl'] })
    }
  })

  return {
    name: baseName,
    short: baseName.length > 4 ? baseName.slice(0, 4) : baseName,
    description: '自定义组件：由画布中的分组保存而来',
    props: props.length > 0 ? props : undefined,
    render: (p) => {
      const clone = deepCloneLayer(group)
      const byId = new Map(clone.children.map((c) => [c.id, c]))
      for (const b of bindings) {
        const target = byId.get(b.childId)
        if (!target || p[b.key] === undefined) continue
        setPath(target as unknown as Record<string, unknown>, b.path, p[b.key])
      }
      return clone
    },
    build: (x, y) => {
      const g = deepCloneLayer(group, true)
      g.x = x; g.y = y
      return g
    },
  }
}

function loadDefs(): CustomComponentDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as CustomComponentDef[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function persist(defs: CustomComponentDef[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defs))
}

/** 加载自定义组件模板列表（推断 schema 后返回） */
export function loadCustomComponents(): ComponentTemplate[] {
  return loadDefs().map((d) => inferCustomTemplate(d.group, d.name))
}

/** 保存画布 group 为自定义组件，返回更新后的模板列表 */
export function saveCustomComponent(group: LayerNode, name?: string): ComponentTemplate[] {
  const defs = loadDefs()
  const target = name?.trim() || `${group.name}副本`
  defs.push({ name: target, group: deepCloneLayer(group, true) })
  persist(defs)
  return loadCustomComponents()
}

/** 删除自定义组件，返回更新后的模板列表 */
export function removeCustomComponent(name: string): ComponentTemplate[] {
  persist(loadDefs().filter((d) => d.name !== name))
  return loadCustomComponents()
}

/** 重命名自定义组件，返回更新后的模板列表 */
export function renameCustomComponent(oldName: string, newName: string): ComponentTemplate[] {
  persist(loadDefs().map((d) => (d.name === oldName ? { ...d, name: newName.trim() || d.name } : d)))
  return loadCustomComponents()
}
