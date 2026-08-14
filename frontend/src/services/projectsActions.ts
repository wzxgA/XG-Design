import { repository } from './index'
import { importLocalDocuments } from './importLocal'
import { downloadProjectFile, parseProjectEnvelope } from './exportProject'
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

/** 恢复已归档项目并返回最新归档列表 */
export async function unarchiveProject(id: string): Promise<ProjectMeta[]> {
  await repository.unarchiveDocument(id)
  return repository.listDocuments(true)
}

/** 物理删除已归档项目并返回最新归档列表 */
export async function deleteProject(id: string): Promise<ProjectMeta[]> {
  await repository.deleteDocument(id)
  return repository.listDocuments(true)
}

/**
 * 导出项目为 .xgproj 文件并触发下载。
 * 从仓储读取完整文档（本地 / 远程通用），导出失败时抛出错误由调用方提示。
 * @param meta 可选项目元信息（updatedAt 等），用于写入信封
 */
export async function exportProject(id: string, meta?: { updatedAt?: number }): Promise<void> {
  const doc = await repository.getDocument(id)
  if (!doc) throw new Error('项目不存在或已被删除')
  downloadProjectFile(doc, meta)
}

/**
 * 导入 .xgproj 项目文件：读取文件文本 → 解析校验信封 → 创建新项目。
 * createDocument 会重新分配 id，避免与现有项目冲突；
 * 同名项目自动追加序号后缀（如 "设计稿 (2)"）。
 * @returns 最新项目列表与导入结果
 */
export async function importProjectFile(file: File): Promise<{ list: ProjectMeta[]; outcome: ImportOutcome }> {
  try {
    const text = await file.text()
    const doc = parseProjectEnvelope(text)
    const existing = await repository.listDocuments()
    const names = new Set(existing.map((p) => p.name))
    let name = doc.name
    if (names.has(name)) {
      let n = 2
      while (names.has(`${name} (${n})`)) n += 1
      name = `${name} (${n})`
    }
    await repository.createDocument(name, doc)
    return {
      list: await repository.listDocuments(),
      outcome: { ok: true, message: `已导入项目「${name}」` },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '导入失败，请稍后重试'
    return { list: await repository.listDocuments(), outcome: { ok: false, message } }
  }
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
