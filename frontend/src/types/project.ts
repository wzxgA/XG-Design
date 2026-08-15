// 项目与分享相关类型

export type Permission = 'view' | 'edit'

export interface ShareInfo {
  link: string
  permission: Permission
  active: boolean
  createdAt: number
}

export interface ProjectMeta {
  id: string
  name: string
  updatedAt: number
  archived: boolean
  share?: ShareInfo
  /** 项目第一页封面缩略图（JPEG dataURL），UI 层缓存，不属于设计文档内容 */
  cover?: string
  /** 生成 cover 时对应的项目 updatedAt，用于新鲜度判断（>= updatedAt 视为新鲜） */
  coverUpdatedAt?: number
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** 协作者角色：owner 全权限 / editor 可写 / viewer 只读 */
export type MemberRole = 'owner' | 'editor' | 'viewer'

/** 文档成员（document_members 行 + 用户信息） */
export interface ProjectMember {
  userId: string
  email: string
  displayName: string
  role: MemberRole
  createdAt: number
}

/** 操作日志条目（历史版本） */
export interface HistoryEntry {
  id: number
  userId: string
  action: string
  detail: string
  createdAt: number
}
