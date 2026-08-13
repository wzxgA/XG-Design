import type { DesignDocument } from '../types/design'
import type { ProjectMeta, ShareInfo } from '../types/project'
import { starterDocument } from '../fixtures/starter-document'

/**
 * 文档仓库统一接口：数据源可以是本地 localStorage 或远程后端 API。
 * 所有方法均为异步，便于在 local / remote 实现间无缝切换。
 */
export interface DocumentRepository {
  /** 数据源类型 */
  readonly kind: 'local' | 'remote'
  /** 项目列表（按更新时间倒序） */
  listDocuments(): Promise<ProjectMeta[]>
  /** 按 id 打开文档；不存在时返回 null */
  getDocument(id: string): Promise<DesignDocument | null>
  /** 创建项目；可携带初始内容（如 409 后“另存为新文件”） */
  createDocument(name?: string, content?: DesignDocument): Promise<ProjectMeta>
  /** 保存文档内容 */
  updateDocument(id: string, doc: DesignDocument): Promise<void>
  /** 复制项目为新项目 */
  duplicateDocument(id: string): Promise<ProjectMeta>
  /** 归档项目 */
  archiveDocument(id: string): Promise<void>
  /** 取消归档 */
  unarchiveDocument(id: string): Promise<void>
  /** 设置/清除分享信息（null 表示关闭分享） */
  setShare(id: string, share: ShareInfo | null): Promise<void>
}

const DOC_PREFIX = 'xgdesign:doc:'
const PROJECTS_KEY = 'xgdesign:projects:v1'

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function readProjects(): ProjectMeta[] {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '[]') as ProjectMeta[]
  } catch {
    return []
  }
}

function writeProjects(projects: ProjectMeta[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  } catch {
    /* ignore */
  }
}

function readDocument(id: string): DesignDocument | null {
  try {
    const raw = localStorage.getItem(DOC_PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw) as DesignDocument
  } catch {
    return null
  }
}

function writeDocument(doc: DesignDocument): void {
  try {
    localStorage.setItem(DOC_PREFIX + doc.id, JSON.stringify(doc))
  } catch {
    /* ignore */
  }
}

function cloneStarter(): DesignDocument {
  return JSON.parse(JSON.stringify(starterDocument)) as DesignDocument
}

/** 读取本地全部文档（含未纳入项目列表的），供“导入本地项目”使用 */
export function listLocalDocuments(): DesignDocument[] {
  const docs: DesignDocument[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(DOC_PREFIX)) {
        const doc = readDocument(key.slice(DOC_PREFIX.length))
        if (doc) docs.push(doc)
      }
    }
  } catch {
    /* ignore */
  }
  return docs.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const localRepository: DocumentRepository = {
  kind: 'local',

  async listDocuments() {
    return readProjects().sort((a, b) => b.updatedAt - a.updatedAt)
  },

  async getDocument(id) {
    return readDocument(id)
  },

  async createDocument(name?, content?) {
    const doc: DesignDocument = content ? JSON.parse(JSON.stringify(content)) : cloneStarter()
    const id = uid('doc')
    const now = Date.now()
    doc.id = id
    if (name) doc.name = name
    doc.updatedAt = now
    const meta: ProjectMeta = { id, name: doc.name, updatedAt: now, archived: false, share: undefined }
    const projects = readProjects()
    projects.unshift(meta)
    writeProjects(projects)
    writeDocument(doc)
    return meta
  },

  async updateDocument(id, doc) {
    writeDocument(doc)
    const projects = readProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], name: doc.name, updatedAt: Date.now() }
      writeProjects(projects)
    }
  },

  async duplicateDocument(id) {
    const original = readDocument(id)
    const projects = readProjects()
    const source = projects.find((p) => p.id === id) ?? { name: original?.name ?? '未命名设计稿' }
    const dupId = uid('doc')
    const now = Date.now()
    const name = `${source.name} 副本`
    const doc: DesignDocument = original ? JSON.parse(JSON.stringify(original)) : cloneStarter()
    doc.id = dupId
    doc.name = name
    doc.updatedAt = now
    const meta: ProjectMeta = { id: dupId, name, updatedAt: now, archived: false, share: undefined }
    projects.unshift(meta)
    writeProjects(projects)
    writeDocument(doc)
    return meta
  },

  async archiveDocument(id) {
    const projects = readProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], archived: true, updatedAt: Date.now() }
      writeProjects(projects)
    }
  },

  async unarchiveDocument(id) {
    const projects = readProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], archived: false, updatedAt: Date.now() }
      writeProjects(projects)
    }
  },

  async setShare(id, share) {
    const projects = readProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], share: share ?? undefined }
      writeProjects(projects)
    }
  },
}
