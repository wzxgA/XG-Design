import { useEffect, useState } from 'react'
import { repository } from '../../services'
import { importLocalDocuments } from '../../services/importLocal'
import { Icon, Watermelon } from '../common/brand'
import type { ProjectMeta } from '../../types/project'

interface Props {
  onClose: () => void
}

/** 项目列表弹窗：新建 / 打开 / 复制 / 归档 / 导入本地项目 */
export function ProjectsModal({ onClose }: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')

  useEffect(() => {
    let alive = true
    repository.listDocuments().then((list) => {
      if (alive) {
        setProjects(list)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [])

  const open = (id: string) => {
    window.location.hash = `#/doc/${id}`
    window.location.reload()
  }

  const create = async () => {
    if (busy) return
    setBusy(true)
    try {
      const meta = await repository.createDocument(name.trim() || undefined)
      open(meta.id)
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async (id: string) => {
    if (busy) return
    setBusy(true)
    try {
      const meta = await repository.duplicateDocument(id)
      open(meta.id)
    } finally {
      setBusy(false)
    }
  }

  const archive = async (id: string) => {
    await repository.archiveDocument(id)
    setProjects(await repository.listDocuments())
  }

  const importLocal = async () => {
    if (importing || repository.kind === 'local') return
    setImporting(true)
    setImportResult('')
    try {
      const res = await importLocalDocuments()
      if (res.imported === 0 && res.failed === 0 && res.skipped === 0) {
        setImportResult('没有可导入的本地项目')
      } else {
        setImportResult(
          res.failed > 0
            ? `导入完成：成功 ${res.imported} 个，跳过 ${res.skipped} 个，失败 ${res.failed} 个`
            : `已导入 ${res.imported} 个项目${res.skipped > 0 ? `，跳过 ${res.skipped} 个同名项目` : ''}`,
        )
      }
      setProjects(await repository.listDocuments())
    } catch {
      setImportResult('导入失败，请稍后重试')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal projects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title"><Watermelon /> XGDesign 项目</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="new-project-row">
            <input
              className="new-project-input"
              placeholder="新项目名称…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create() }}
            />
            <button className="export-button new-project-btn" onClick={create} disabled={busy}>新建项目</button>
          </div>

          {repository.kind === 'remote' && (
            <div className="import-local-row">
              <button className="export-button import-local-btn" onClick={importLocal} disabled={importing}>
                {importing ? '导入中…' : '导入本地项目'}
              </button>
              {importResult && <span className="import-result">{importResult}</span>}
            </div>
          )}

          {loading ? (
            <div className="projects-empty">正在加载项目…</div>
          ) : projects.length === 0 ? (
            <div className="projects-empty">还没有项目，创建一个开始设计吧。</div>
          ) : (
            <div className="project-list">
              {projects.map((p) => (
                <div className="project-card" key={p.id} onClick={() => open(p.id)}>
                  <span className="project-thumb"><Icon name="frame" /></span>
                  <div className="project-info">
                    <div className="project-name">{p.name}</div>
                    <div className="project-meta">
                      更新于 {new Date(p.updatedAt).toLocaleString()}
                      {p.share?.active && <span className="shared-tag">已分享</span>}
                    </div>
                  </div>
                  <div className="project-actions" onClick={(e) => e.stopPropagation()}>
                    <button title="复制项目" onClick={() => duplicate(p.id)} disabled={busy}>复制</button>
                    <button title="归档项目" onClick={() => archive(p.id)}>归档</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
