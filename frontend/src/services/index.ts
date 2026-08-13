import type { DocumentRepository } from './documentRepository'
import { localRepository } from './documentRepository'
import { remoteRepository } from './remoteRepository'
import { isConflictError } from './http'

export type { DocumentRepository }
export { localRepository, remoteRepository, isConflictError }

/**
 * 当前数据源：
 * 默认远程 API；设置 VITE_REPOSITORY=local 可切回本地 localStorage。
 */
export const repository: DocumentRepository =
  import.meta.env.VITE_REPOSITORY === 'local' ? localRepository : remoteRepository
