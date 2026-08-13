import { api } from './http'
import type { DesignDocument } from '../types/design'
import type { ProjectMeta, ShareInfo } from '../types/project'
import type { DocumentRepository } from './documentRepository'

/** 后端 ProjectMetaDto */
interface RemoteProjectMeta {
  id: string
  name: string
  updatedAt: number
  archived: boolean
  share: ShareInfo | null
}

/** 后端 DocumentDto：{ meta, content, version } */
interface RemoteDocumentDto {
  meta: RemoteProjectMeta
  content: DesignDocument
  version: number
}

/**
 * 文档版本号只存在于当前会话内存：
 * 打开时记录后端 version，保存时携带该 version；返回新 version。
 * 若期间被他人保存，后端校验 version 不匹配返回 409。
 */
const versions = new Map<string, number>()

// 分享信息本期仍为本地语义（S3 再接远程），用 localStorage 覆盖层保留演示效果
const SHARE_OVERLAY_KEY = 'xgdesign:share-overlay:v1'

function readShareOverlay(): Record<string, ShareInfo> {
  try {
    return JSON.parse(localStorage.getItem(SHARE_OVERLAY_KEY) ?? '{}') as Record<string, ShareInfo>
  } catch {
    return {}
  }
}

function writeShareOverlay(overlay: Record<string, ShareInfo>): void {
  try {
    localStorage.setItem(SHARE_OVERLAY_KEY, JSON.stringify(overlay))
  } catch {
    /* ignore */
  }
}

function mapMeta(m: RemoteProjectMeta): ProjectMeta {
  return { id: String(m.id), name: m.name, updatedAt: m.updatedAt, archived: m.archived, share: m.share ?? undefined }
}

export const remoteRepository: DocumentRepository = {
  kind: 'remote',

  async listDocuments() {
    const list = await api.get<RemoteProjectMeta[]>('/api/projects')
    const overlay = readShareOverlay()
    return list
      .map(mapMeta)
      .map((m) => (overlay[m.id] ? { ...m, share: overlay[m.id] } : m))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  async getDocument(id) {
    const dto = await api.get<RemoteDocumentDto>(`/api/documents/${id}`)
    versions.set(id, dto.version)
    const doc = dto.content
    if (!doc.prototypeLinks) doc.prototypeLinks = []
    return doc
  },

  async createDocument(name?, content?) {
    const meta = mapMeta(await api.post<RemoteProjectMeta>('/api/projects', { name }))
    if (content) {
      const doc: DesignDocument = { ...content, id: meta.id, name: meta.name, updatedAt: Date.now() }
      const res = await api.put<{ version: number }>(`/api/documents/${meta.id}`, {
        name: doc.name,
        content: JSON.stringify(doc),
        version: 1,
      })
      versions.set(meta.id, res.version)
    }
    return meta
  },

  async updateDocument(id, doc) {
    const version = versions.get(id) ?? 1
    const res = await api.put<{ version: number }>(`/api/documents/${id}`, {
      name: doc.name,
      content: JSON.stringify(doc),
      version,
    })
    versions.set(id, res.version)
  },

  async duplicateDocument(id) {
    return mapMeta(await api.post<RemoteProjectMeta>(`/api/projects/${id}/duplicate`))
  },

  async archiveDocument(id) {
    await api.post(`/api/projects/${id}/archive`)
  },

  async unarchiveDocument(id) {
    await api.post(`/api/projects/${id}/unarchive`)
  },

  async setShare(id, share) {
    const overlay = readShareOverlay()
    if (share) overlay[id] = share
    else delete overlay[id]
    writeShareOverlay(overlay)
  },
}
