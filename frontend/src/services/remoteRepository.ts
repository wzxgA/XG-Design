import { api } from './http'
import type { DesignDocument } from '../types/design'
import type { ProjectMeta, Permission, ShareInfo, MemberRole, ProjectMember, HistoryEntry } from '../types/project'
import type { DocumentRepository } from './documentRepository'

/** 后端 ProjectMetaDto */
interface RemoteProjectMeta {
  id: string
  name: string
  updatedAt: number
  archived: boolean
  share: { token: string; permission: Permission; active: boolean; createdAt: number } | null
}

/** 后端 DocumentDto：{ meta, content, version } */
interface RemoteDocumentDto {
  meta: RemoteProjectMeta
  content: DesignDocument
  version: number
}

/** 后端 ShareInfoDto：{ token, permission, active, createdAt } */
interface RemoteShareInfo {
  token: string
  permission: Permission
  active: boolean
  createdAt: number
}

/** 后端 SharedDocumentDto：{ meta, content, version, permission } */
interface RemoteSharedDocumentDto {
  meta: RemoteProjectMeta
  content: DesignDocument
  version: number
  permission: Permission
}

/**
 * 文档版本号只存在于当前会话内存：
 * 打开时记录后端 version，保存时携带该 version；返回新 version。
 * 若期间被他人保存，后端校验 version 不匹配返回 409。
 */
const versions = new Map<string, number>()

/**
 * 文档 content.id（形如 "doc-<uuid>"）→ 后端真实 UUID 的映射。
 * 后端创建文档时 content.id 带 "doc-" 前缀，而路径参数要求纯 UUID，
 * 保存/分享等操作需先用此映射把 doc.id 转成后端 UUID。
 */
const docIdToBackendUuid = new Map<string, string>()

/** 后端路径 id 必须是 UUID；本地 doc-xxx 这类 id 不能直接用于远程保存 */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function isUuid(id: string): boolean {
  return UUID_RE.test(id)
}

/** 把可能带 "doc-" 前缀的文档 id 解析为后端纯 UUID；解析不出则抛错 */
function resolveBackendId(docId: string, action: string): string {
  if (isUuid(docId)) return docId
  const mapped = docIdToBackendUuid.get(docId)
  if (mapped) return mapped
  // 兜底：doc-<uuid> 前缀剥离
  if (docId.startsWith('doc-')) {
    const rest = docId.slice('doc-'.length)
    if (isUuid(rest)) {
      docIdToBackendUuid.set(docId, rest)
      return rest
    }
  }
  throw new Error(`该文档尚未关联到远程服务器（${action}），请先导入或另存为新文件`)
}

function requireUuid(id: string, action: string): void {
  resolveBackendId(id, action)
}

function mapShare(s: RemoteShareInfo | null): ShareInfo | undefined {
  if (!s || !s.active) return undefined
  return {
    link: `${window.location.origin}${window.location.pathname}#/share/${s.token}`,
    permission: s.permission,
    active: s.active,
    createdAt: s.createdAt,
  }
}

function mapMeta(m: RemoteProjectMeta): ProjectMeta {
  return { id: String(m.id), name: m.name, updatedAt: m.updatedAt, archived: m.archived, share: mapShare(m.share ?? null) }
}

export const remoteRepository: DocumentRepository = {
  kind: 'remote',

  async listDocuments(archived = false) {
    const list = await api.get<RemoteProjectMeta[]>(`/api/projects?archived=${archived}`)
    return list.map(mapMeta).sort((a, b) => b.updatedAt - a.updatedAt)
  },

  async getDocument(id) {
    requireUuid(id, '打开')
    const dto = await api.get<RemoteDocumentDto>(`/api/documents/${id}`)
    versions.set(id, dto.version)
    const doc = dto.content
    if (!doc.prototypeLinks) doc.prototypeLinks = []
    // 记录 content.id（doc-<uuid>）→ 后端 UUID，供保存等操作转换
    docIdToBackendUuid.set(doc.id, id)
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
    const backendId = resolveBackendId(id, '保存')
    const version = versions.get(backendId) ?? 1
    const res = await api.put<{ version: number }>(`/api/documents/${backendId}`, {
      name: doc.name,
      content: JSON.stringify(doc),
      version,
    })
    versions.set(backendId, res.version)
  },

  async duplicateDocument(id) {
    const backendId = resolveBackendId(id, '复制')
    return mapMeta(await api.post<RemoteProjectMeta>(`/api/projects/${backendId}/duplicate`))
  },

  async archiveDocument(id) {
    const backendId = resolveBackendId(id, '归档')
    await api.post(`/api/projects/${backendId}/archive`)
  },

  async unarchiveDocument(id) {
    const backendId = resolveBackendId(id, '恢复')
    await api.post(`/api/projects/${backendId}/unarchive`)
  },

  async deleteDocument(id) {
    const backendId = resolveBackendId(id, '删除')
    await api.del(`/api/projects/${backendId}`)
  },

  async setShare(id, share) {
    const backendId = resolveBackendId(id, '分享')
    // share 非空即创建/更新；空即撤销
    if (share) {
      const info = await api.put<RemoteShareInfo>(`/api/documents/${backendId}/share`, { permission: share.permission })
      // 返回后端生成的新 token（含新链接）
      Object.assign(share, { link: `${window.location.origin}${window.location.pathname}#/share/${info.token}` })
    } else {
      await api.del(`/api/documents/${backendId}/share`)
    }
  },

  async openShared(token) {
    const dto = await api.get<RemoteSharedDocumentDto>(`/api/shared/${token}`)
    const doc = dto.content
    if (!doc.prototypeLinks) doc.prototypeLinks = []
    return { doc, permission: dto.permission, version: dto.version }
  },

  async saveShared(token, doc, version) {
    const res = await api.put<{ version: number; updatedAt: number }>(`/api/shared/${token}`, {
      name: doc.name,
      content: JSON.stringify(doc),
      version,
    })
    return res.version
  },

  async listMembers(id) {
    const backendId = resolveBackendId(id, '协作者')
    const list = await api.get<ProjectMember[]>(`/api/documents/${backendId}/members`)
    return list.map((m) => ({ ...m, role: m.role as MemberRole }))
  },

  async inviteMember(id, email, role) {
    const backendId = resolveBackendId(id, '邀请')
    return api.post<ProjectMember>(`/api/documents/${backendId}/members`, { email, role })
  },

  async updateMemberRole(id, userId, role) {
    const backendId = resolveBackendId(id, '权限')
    await api.put(`/api/documents/${backendId}/members/${userId}`, { role })
  },

  async removeMember(id, userId) {
    const backendId = resolveBackendId(id, '移除')
    await api.del(`/api/documents/${backendId}/members/${userId}`)
  },

  async listHistory(id) {
    const backendId = resolveBackendId(id, '历史')
    return api.get<HistoryEntry[]>(`/api/documents/${backendId}/history`)
  },
}
