import { repository } from './index'
import { importLocalDocuments } from './importLocal'
import type { ProjectMeta } from '../types/project'

export interface ImportOutcome {
  ok: boolean
  message: string
}

/** 打开项目（跳转编辑器并刷新） */
export function openProject(id: string): void {
  window.location.hash = `#/doc/${id}`
  window.location.reload()
}

/** 新建项目，创建后直接进入编辑器 */
export async function createProject(name?: string): Promise<ProjectMeta> {
  const meta = await repository.createDocument(name?.trim() || undefined)
  openProject(meta.id)
  return meta
}

/** 复制项目为新项目，复制后进入新项目编辑器 */
export async function duplicateProject(id: string): Promise<ProjectMeta> {
  const meta = await repository.duplicateDocument(id)
  openProject(meta.id)
  return meta
}

/** 归档项目并返回最新项目列表 */
export async function archiveProject(id: string): Promise<ProjectMeta[]> {
  await repository.archiveDocument(id)
  return repository.listDocuments()
}

/** 导入本地项目（仅远程模式有意义），返回最新项目列表 */
export async function importLocalProject(): Promise<{ list: ProjectMeta[]; outcome: ImportOutcome }> {
  if (repository.kind === 'local') {
    return { list: await repository.listDocuments(), outcome: { ok: false, message: '当前数据源为本地，无需导入' } }
  }
  try {
    const res = await importLocalDocuments()
    let message: string
    if (res.imported === 0 && res.failed === 0 && res.skipped === 0) {
      message = '没有可导入的本地项目'
    } else {
      message =
        res.failed > 0
          ? `导入完成：成功 ${res.imported} 个，跳过 ${res.skipped} 个，失败 ${res.failed} 个`
          : `已导入 ${res.imported} 个项目${res.skipped > 0 ? `，跳过 ${res.skipped} 个同名项目` : ''}`
    }
    return { list: await repository.listDocuments(), outcome: { ok: res.failed === 0, message } }
  } catch {
    return { list: await repository.listDocuments(), outcome: { ok: false, message: '导入失败，请稍后重试' } }
  }
}
