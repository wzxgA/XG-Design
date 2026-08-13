import { useCallback, useEffect, useState } from 'react'
import { repository } from '../../services'
import { clearAuth } from '../../services/auth'
import { Icon, Watermelon } from '../common/brand'
import { openProject, createProject, duplicateProject, archiveProject, importLocalProject } from '../../services/projectsActions'
import type { ProjectMeta } from '../../types/project'

interface Props {
  userName?: string
  userEmail?: string
  onUserChange: (u: null) => void
}

/** 项目列表首页（EH1）：登录后默认落地页，展示当前用户的全部项目 */
export function ProjectsPage({ userName, userEmail, onUserChange }: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setProjects(await repository.listDocuments())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onLogout = useCallback(() => {
    clearAuth()
    onUserChange(null)
    window.location.hash = '#/login'
  }, [onUserChange])

  const create = async () => {
    if (busy) return
    setBusy(true)
    try {
      await createProject()
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async (id: string) => {
    if (busy) return
    setBusy(true)
    try {
      await duplicateProject(id)
    } finally {
      setBusy(false)
    }
  }

  const archive = async (id: string) => {
    setProjects(await archiveProject(id))
  }

  const importLocal = async () => {
    if (importing || repository.kind === 'local') return
    setImporting(true)
    setImportResult('')
    try {
      const { list, outcome } = await importLocalProject()
      setProjects(list)
      setImportResult(outcome.message)
    } finally {
      setImporting(false)
    }
  }

  const initials = userName ? userName.slice(0, 1).toUpperCase() : 'U'

  return (
    <div className="projects-page">
      <header className="projects-topbar">
        <div className="brand"><Watermelon /><strong>XG<span>Design</span></strong></div>
        <div className="projects-topbar-user">
          <div className="user-chip">
            <span className="user-avatar">{initials}</span>
            {userName && <span className="user-name">{userName}</span>}
            <button className="logout-button" onClick={onLogout} title="退出登录">退出</button>
          </div>
        </div>
      </header>

      <main className="projects-main">
        <div className="projects-head">
          <div>
            <h1>我的项目</h1>
            <p className="projects-sub">继续你的设计，或创建一个新项目。</p>
          </div>
          <button className="projects-new-btn" onClick={create} disabled={busy}>
            <Icon name="plus" /> 新建项目
          </button>
        </div>

        {repository.kind === 'remote' && (
          <div className="projects-import-row">
            <button className="import-local-btn" onClick={importLocal} disabled={importing}>
              {importing ? '导入中…' : '导入本地项目'}
            </button>
            {importResult && <span className="import-result">{importResult}</span>}
          </div>
        )}

        {loading ? (
          <div className="projects-state">
            <div className="editor-loading-spinner" />
            <span>正在加载项目…</span>
          </div>
        ) : error ? (
          <div className="projects-state">
            <span className="projects-state-error">{error}</span>
            <button className="btn" onClick={load}>重试</button>
          </div>
        ) : projects.length === 0 ? (
          <div className="projects-state">
            <span className="projects-empty-icon"><Icon name="frame" /></span>
            <strong>还没有项目</strong>
            <p>创建一个新项目，开始你的设计。</p>
            <button className="btn btn-primary" onClick={create}>新建项目</button>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <div className="project-grid-card" key={p.id} onClick={() => openProject(p.id)}>
                <div className="project-grid-thumb"><Icon name="frame" /></div>
                <div className="project-grid-info">
                  <div className="project-name">{p.name}</div>
                  <div className="project-meta">
                    更新于 {new Date(p.updatedAt).toLocaleString()}
                    {p.share?.active && <span className="shared-tag">已分享</span>}
                  </div>
                </div>
                <div className="project-actions" onClick={(e) => e.stopPropagation()}>
                  <button title="打开项目" onClick={() => openProject(p.id)}>打开</button>
                  <button title="复制项目" onClick={() => duplicate(p.id)} disabled={busy}>复制</button>
                  <button title="归档项目" onClick={() => archive(p.id)}>归档</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
