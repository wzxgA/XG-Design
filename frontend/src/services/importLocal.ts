import { listLocalDocuments } from './documentRepository'
import { repository } from './index'

export interface ImportResult {
  imported: number
  failed: number
  skipped: number
}

/**
 * 一次性功能：将 localStorage 中的全部本地文档（xgdesign:doc:*）导入当前数据源。
 * 逐个 createDocument（POST /api/projects + PUT /api/documents/{id}），
 * 已存在于目标数据源的同名项目自动跳过，避免重复导入。
 */
export async function importLocalDocuments(): Promise<ImportResult> {
  // 目标数据源仍是本地时没有导入意义
  if (repository.kind === 'local') return { imported: 0, failed: 0, skipped: 0 }

  const docs = listLocalDocuments()
  if (docs.length === 0) return { imported: 0, failed: 0, skipped: 0 }

  const existing = new Set((await repository.listDocuments()).map((m) => m.name))
  let imported = 0
  let failed = 0
  let skipped = 0

  for (const doc of docs) {
    if (existing.has(doc.name)) {
      skipped += 1
      continue
    }
    try {
      await repository.createDocument(doc.name, doc)
      imported += 1
    } catch {
      failed += 1
    }
  }
  return { imported, failed, skipped }
}
