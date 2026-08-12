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
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
