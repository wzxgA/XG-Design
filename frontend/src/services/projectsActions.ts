import { repository } from './index'
import { importLocalDocuments } from './importLocal'
import { downloadProjectFile, parseProjectEnvelope } from './exportProject'
import { renderPageThumbnail } from '../utils/export'
import { readProjects, writeProjects } from './documentRepository'
import type { ProjectMeta } from '../types/project'
import type { DesignDocument } from '../types/design'

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

/** 远程模式封面缓存 key：localStorage['xgdesign:cover:'+id] */
const COVER_PREFIX = 'xgdesign:cover:'

interface CoverCache {
  dataUrl: string
  updatedAt: number
}

/** 封面是否新鲜：coverUpdatedAt >= updatedAt 视为可直接复用 */
export function isCoverFresh(meta: ProjectMeta): boolean {
  return !!meta.cover && !!meta.coverUpdatedAt && meta.coverUpdatedAt >= meta.updatedAt
}

function readCoverCache(id: string): CoverCache | null {
  try {
    const raw = localStorage.getItem(COVER_PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw) as CoverCache
  } catch {
    return null
  }
}

function writeCoverCache(id: string, cache: CoverCache): void {
  try {
    localStorage.setItem(COVER_PREFIX + id, JSON.stringify(cache))
  } catch {
    /* localStorage 配额超限：本次仅内存展示，下次重新生成 */
  }
}

/** 列表页加载后合并封面缓存到 meta（本地模式 meta 自带 cover，无需处理） */
export function attachCovers(list: ProjectMeta[]): ProjectMeta[] {
  if (repository.kind === 'local') return list
  return list.map((p) => {
    const cached = readCoverCache(p.id)
    if (!cached) return p
    return { ...p, cover: cached.dataUrl, coverUpdatedAt: cached.updatedAt }
  })
}

/** 本地模式：将封面写回 PROJECTS_KEY 对应项目 */
async function saveLocalCover(id: string, dataUrl: string, stamp: number): Promise<void> {
  const projects = readProjects()
  const idx = projects.findIndex((p) => p.id === id)
  if (idx < 0) return
  projects[idx] = { ...projects[idx], cover: dataUrl, coverUpdatedAt: stamp }
  writeProjects(projects)
}

/**
 * 编辑器保存成功后调用：生成第一页封面并写入对应数据源的缓存。
 * 纯 fire-and-forget：内部异常一律吞掉，不影响保存主流程。
 */
export async function generateAndCacheCover(id: string, doc: DesignDocument): Promise<void> {
  try {
    const page = doc.pages[0]
    if (!page) return
    const dataUrl = await renderPageThumbnail(page)
    if (!dataUrl) return
    // 封面时间戳取生成时刻与文档最新更新时间的较大值，保证生成后即新鲜，
    // 避免列表页因 coverUpdatedAt < updatedAt 重复拉取重生成
    const stamp = Math.max(Date.now(), doc.updatedAt ?? 0)
    if (repository.kind === 'local') {
      await saveLocalCover(id, dataUrl, stamp)
    } else {
      writeCoverCache(id, { dataUrl, updatedAt: stamp })
    }
  } catch {
    /* 封面生成失败不影响主流程，静默跳过 */
  }
}

/**
 * 列表页懒加载兜底：拉取完整文档 → 生成第一页封面 → 写入缓存。
 * 失败（无第一页 / 渲染异常 / 网络错误）返回 null，调用方保留占位图标。
 */
export async function refreshProjectCover(meta: ProjectMeta): Promise<ProjectMeta | null> {
  try {
    const doc = await repository.getDocument(meta.id)
    if (!doc) return null
    const page = doc.pages[0]
    if (!page) return null
    const dataUrl = await renderPageThumbnail(page)
    if (!dataUrl) return null
    const stamp = Math.max(Date.now(), meta.updatedAt ?? 0, doc.updatedAt ?? 0)
    if (repository.kind === 'local') {
      await saveLocalCover(meta.id, dataUrl, stamp)
    } else {
      writeCoverCache(meta.id, { dataUrl, updatedAt: stamp })
    }
    return { ...meta, cover: dataUrl, coverUpdatedAt: stamp }
  } catch {
    return null
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
