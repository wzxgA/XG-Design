// 项目级导出（.xgproj JSON 信封）
// 将完整 DesignDocument 打包为可移植文件，用于备份 / 迁移 / 交付。
// 纯前端实现：不依赖后端接口，本地 / 远程两种数据源通用。
//
// 设计约束：
// - document 字段与现有 DesignDocument 类型完全一致，导入时零转换；
// - project.id 仅作溯源参考，导入时重新分配，避免与现有项目冲突；
// - 不包含成员 / 分享 / 历史等协作数据，也不含任何凭据。

import type { DesignDocument } from '../types/design'

/** 信封格式标识，导入侧据此识别文件类型 */
export const PROJECT_FORMAT = 'xgdesign-project'
/** 信封格式版本，向前兼容靠此字段演进 */
export const PROJECT_FORMAT_VERSION = 1
/** 应用版本（写入信封，便于排查导出来源） */
export const APP_VERSION = '0.1.0'

/** 项目元信息（可选，来自项目列表摘要） */
export interface ProjectExportMeta {
  createdAt?: number
  updatedAt?: number
}

/** .xgproj 信封结构 */
export interface ProjectEnvelope {
  format: typeof PROJECT_FORMAT
  formatVersion: typeof PROJECT_FORMAT_VERSION
  exportedAt: string
  appVersion: string
  project: {
    id: string
    name: string
    createdAt?: string
    updatedAt?: string
  }
  document: DesignDocument
}

/**
 * 组装 .xgproj 信封（纯函数，便于测试）。
 * document 原样内嵌 DesignDocument，保证导入零转换。
 */
export function buildProjectEnvelope(doc: DesignDocument, meta?: ProjectExportMeta): ProjectEnvelope {
  return {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    project: {
      id: doc.id,
      name: doc.name,
      createdAt: meta?.createdAt != null ? new Date(meta.createdAt).toISOString() : undefined,
      updatedAt: meta?.updatedAt != null ? new Date(meta.updatedAt).toISOString() : undefined,
    },
    document: doc,
  }
}

/** 文件系统安全清洗：替换 Windows / macOS 非法字符为 '-' */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '-').trim()
  return cleaned.length > 0 ? cleaned : 'untitled'
}

/** 生成 yyyyMMdd-HHmm 时间戳 */
function timestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

/** 生成下载文件名：{项目名}-{yyyyMMdd-HHmm}.xgproj */
export function buildProjectFileName(doc: DesignDocument, now: Date = new Date()): string {
  return `${sanitizeFileName(doc.name)}-${timestamp(now)}.xgproj`
}

/** 触发浏览器下载（与 utils/export.ts 的 downloadBlob 保持一致的实现方式） */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 将项目导出为 .xgproj 文件并触发下载。
 * @param doc  完整设计文档（来自编辑器状态或 repository.getDocument）
 * @param meta 可选项目元信息（createdAt / updatedAt）
 * @returns 下载文件名
 */
export function downloadProjectFile(doc: DesignDocument, meta?: ProjectExportMeta): string {
  const envelope = buildProjectEnvelope(doc, meta)
  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const filename = buildProjectFileName(doc)
  downloadBlob(blob, filename)
  return filename
}

/**
 * 解析 .xgproj 文件文本，校验信封并返回内嵌的 DesignDocument（纯函数，便于测试）。
 * 校验失败时抛出带用户可读信息的错误，由调用方捕获提示。
 *
 * 版本策略：只拒绝比当前支持版本更新的 formatVersion（向前不兼容需升级应用）；
 * 旧版本信封只要结构合法仍可导入（向后兼容）。
 */
export function parseProjectEnvelope(text: string): DesignDocument {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('文件不是合法的 JSON 格式')
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('文件内容无效：不是一个项目文件')
  }
  const env = raw as Partial<ProjectEnvelope>
  if (env.format !== PROJECT_FORMAT) {
    throw new Error('不是有效的项目文件（缺少 xgdesign-project 标识）')
  }
  if (typeof env.formatVersion !== 'number') {
    throw new Error('项目文件缺少版本号')
  }
  if (env.formatVersion > PROJECT_FORMAT_VERSION) {
    throw new Error(`项目文件版本过新（v${env.formatVersion}），当前应用最高支持 v${PROJECT_FORMAT_VERSION}，请先升级`)
  }
  const doc = env.document
  if (!doc || typeof doc !== 'object') {
    throw new Error('项目文件缺少 document 内容')
  }
  if (!Array.isArray(doc.pages)) {
    throw new Error('项目文件内容损坏：缺少 pages 页面数据')
  }
  // 兜底补齐可选字段，保证导入后可编辑器可正常消费
  const result = doc as DesignDocument
  if (!result.prototypeLinks) result.prototypeLinks = []
  if (typeof result.updatedAt !== 'number') result.updatedAt = Date.now()
  if (!result.name || typeof result.name !== 'string') result.name = '导入的项目'
  return result
}
