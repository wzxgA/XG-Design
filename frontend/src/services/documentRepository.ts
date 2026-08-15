import type { DesignDocument } from '../types/design'
import type { ProjectMeta, ShareInfo, Permission, MemberRole, ProjectMember, HistoryEntry } from '../types/project'
import { starterDocument } from '../fixtures/starter-document'

/**
 * 文档仓库统一接口：数据源可以是本地 localStorage 或远程后端 API。
 * 所有方法均为异步，便于在 local / remote 实现间无缝切换。
 */
export interface DocumentRepository {
  /** 数据源类型 */
  readonly kind: 'local' | 'remote'
  /** 项目列表（按更新时间倒序）；archived=true 查归档视图 */
  listDocuments(archived?: boolean): Promise<ProjectMeta[]>
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
  /** 物理删除项目（仅归档视图操作） */
  deleteDocument(id: string): Promise<void>
  /** 设置/清除分享信息（null 表示关闭分享） */
  setShare(id: string, share: ShareInfo | null): Promise<void>
  /** 通过分享 token 打开文档，返回 { doc, permission, version } */
  openShared(token: string): Promise<{ doc: DesignDocument; permission: Permission; version: number }>
  /** 通过分享 token 保存（仅 permission=edit 可用） */
  saveShared(token: string, doc: DesignDocument, version: number): Promise<number>
  /** 成员列表（本地模式返回空数组） */
  listMembers(id: string): Promise<ProjectMember[]>
  /** 邀请协作者（邮箱 → userId，角色 editor/viewer） */
  inviteMember(id: string, email: string, role: 'editor' | 'viewer'): Promise<ProjectMember>
  /** 修改成员角色（owner 不可改） */
  updateMemberRole(id: string, userId: string, role: 'editor' | 'viewer'): Promise<void>
  /** 移除成员（owner 不可移除） */
  removeMember(id: string, userId: string): Promise<void>
  /** 操作日志历史（按时间倒序） */
  listHistory(id: string): Promise<HistoryEntry[]>
}

const DOC_PREFIX = 'xgdesign:doc:'
const PROJECTS_KEY = 'xgdesign:projects:v1'
/** 本地分享 token → 文档 id 映射 */
const SHARE_PREFIX = 'xgdesign:share:'

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 读取本地项目元数据列表（供 projectsActions 读写封面缓存复用） */
export function readProjects(): ProjectMeta[] {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '[]') as ProjectMeta[]
  } catch {
    return []
  }
}

function readLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 写回本地项目元数据列表（供 projectsActions 写封面缓存复用） */
export function writeProjects(projects: ProjectMeta[]): void {
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

  async listDocuments(archived = false) {
    return readProjects()
      .filter((p) => !!p.archived === archived)
      .sort((a, b) => b.updatedAt - a.updatedAt)
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

  async deleteDocument(id) {
    const projects = readProjects()
    writeProjects(projects.filter((p) => p.id !== id))
    try {
      localStorage.removeItem(DOC_PREFIX + id)
    } catch {
      /* ignore */
    }
  },

  async setShare(id, share) {
    const projects = readProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx < 0) return
    if (share) {
      // 复用已有本地 token，否则生成新 token，并写入 token→docId 映射
      let token = readLocalStorage('xgdesign:share-token:' + id)
      if (!token) {
        token = uid('sh')
        try {
          localStorage.setItem('xgdesign:share-token:' + id, token)
          localStorage.setItem(SHARE_PREFIX + token, id)
        } catch {
          /* ignore */
        }
      }
      share.link = `${window.location.origin}${window.location.pathname}#/share/${token}`
      share.active = true
      projects[idx] = { ...projects[idx], share: { ...share } }
    } else {
      const token = readLocalStorage('xgdesign:share-token:' + id)
      if (token) {
        try {
          localStorage.removeItem(SHARE_PREFIX + token)
          localStorage.removeItem('xgdesign:share-token:' + id)
        } catch {
          /* ignore */
        }
      }
      projects[idx] = { ...projects[idx], share: undefined }
    }
    writeProjects(projects)
  },

  async openShared(token) {
    // 按 token→docId 映射解析；兜底兼容旧格式（token 即文档 id）
    const docId = readLocalStorage(SHARE_PREFIX + token) ?? token
    const doc = readDocument(docId)
    if (!doc) throw new Error('分享链接已失效或不存在')
    const meta = readProjects().find((p) => p.id === docId)
    return { doc, permission: meta?.share?.permission ?? 'view', version: 1 }
  },

  async saveShared(_token, _doc, _version) {
    return 1
  },

  // 本地模式不引入成员概念：列表恒为空，写操作直接报错提示
  async listMembers() {
    return []
  },

  async inviteMember() {
    throw new Error('本地模式不支持协作者，请切换到远程模式')
  },

  async updateMemberRole() {
    throw new Error('本地模式不支持协作者，请切换到远程模式')
  },

  async removeMember() {
    throw new Error('本地模式不支持协作者，请切换到远程模式')
  },

  async listHistory() {
    return []
  },
}
