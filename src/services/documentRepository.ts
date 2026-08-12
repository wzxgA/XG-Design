import type { DesignDocument } from '../types/design'
import type { ProjectMeta, ShareInfo } from '../types/project'
import { starterDocument } from '../fixtures/starter-document'

/**
 * 数据服务抽象：隔离 UI 与具体存储。
 * 本地存储与远程 API 都实现此接口，便于开发环境切换。
 * 说明：本期无后端，实时协作（WebSocket 等）不在本期实现，接口仅覆盖单机文档管理。
 */
export interface DocumentRepository {
  listDocuments(): ProjectMeta[]
  getDocument(id: string): DesignDocument | null
  createDocument(name?: string): ProjectMeta
  updateDocument(id: string, doc: DesignDocument): void
  duplicateDocument(id: string): ProjectMeta
  archiveDocument(id: string): void
  unarchiveDocument(id: string): void
  setShare(id: string, share: ShareInfo | null): void
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ---- localStorage 实现 ----

const PROJECTS_KEY = 'xgdesign:projects:v1'
const DOC_PREFIX = 'xgdesign:doc:'

function readProjects(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ProjectMeta[]
  } catch {
    return []
  }
}

function writeProjects(projects: ProjectMeta[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  } catch { /* 存储失败静默 */ }
}

function readDocument(id: string): DesignDocument | null {
  try {
    const raw = localStorage.getItem(DOC_PREFIX + id)
    if (!raw) return null
    const doc = JSON.parse(raw) as DesignDocument
    if (!doc.prototypeLinks) doc.prototypeLinks = []
    return doc
  } catch {
    return null
  }
}

function writeDocument(doc: DesignDocument) {
  try {
    localStorage.setItem(DOC_PREFIX + doc.id, JSON.stringify(doc))
  } catch { /* 存储失败静默 */ }
}

/** 基于 localStorage 的本地仓库实现 */
export const localRepository: DocumentRepository = {
  listDocuments() {
    return readProjects().filter((p) => !p.archived)
  },

  getDocument(id) {
    return readDocument(id)
  },

  createDocument(name = '未命名设计稿') {
    const doc = JSON.parse(JSON.stringify(starterDocument)) as DesignDocument
    doc.id = uid('doc')
    doc.name = name
    const meta: ProjectMeta = { id: doc.id, name: doc.name, updatedAt: Date.now(), archived: false }
    const projects = readProjects()
    projects.unshift(meta)
    writeProjects(projects)
    writeDocument(doc)
    return meta
  },

  updateDocument(id, doc) {
    writeDocument(doc)
    const projects = readProjects().map((p) => (p.id === id ? { ...p, name: doc.name, updatedAt: Date.now() } : p))
    writeProjects(projects)
  },

  duplicateDocument(id) {
    const source = readDocument(id)
    const copy = source
      ? JSON.parse(JSON.stringify(source)) as DesignDocument
      : JSON.parse(JSON.stringify(starterDocument)) as DesignDocument
    copy.id = uid('doc')
    copy.name = `${source?.name ?? '未命名设计稿'} 副本`
    copy.updatedAt = Date.now()
    const meta: ProjectMeta = { id: copy.id, name: copy.name, updatedAt: copy.updatedAt, archived: false }
    const projects = readProjects()
    projects.unshift(meta)
    writeProjects(projects)
    writeDocument(copy)
    return meta
  },

  archiveDocument(id) {
    const projects = readProjects().map((p) => (p.id === id ? { ...p, archived: true } : p))
    writeProjects(projects)
  },

  unarchiveDocument(id) {
    const projects = readProjects().map((p) => (p.id === id ? { ...p, archived: false } : p))
    writeProjects(projects)
  },

  setShare(id, share) {
    const projects = readProjects().map((p) => (p.id === id ? { ...p, share: share ?? undefined } : p))
    writeProjects(projects)
  },
}
