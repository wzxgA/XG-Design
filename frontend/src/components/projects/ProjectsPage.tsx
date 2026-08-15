import { useCallback, useEffect, useRef, useState } from 'react'
import { repository } from '../../services'
import { clearAuth } from '../../services/auth'
import { Icon, Watermelon } from '../common/brand'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { openProject, createProject, duplicateProject, archiveProject, unarchiveProject, deleteProject, exportProject, importProjectFile, attachCovers, isCoverFresh, refreshProjectCover } from '../../services/projectsActions'
import type { ProjectMeta } from '../../types/project'

interface Props {
  userName?: string
  userEmail?: string
  onUserChange: (u: null) => void
}

type View = 'active' | 'archived'

/** 项目列表首页（EH1）：登录后默认落地页，展示当前用户的全部项目 */
export function ProjectsPage({ userName, userEmail, onUserChange }: Props) {
  const [view, setView] = useState<View>('active')
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const load = useCallback(async (v: View = view) => {
    setLoading(true)
    setError('')
    try {
      setProjects(attachCovers(await repository.listDocuments(v === 'archived')))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    load()
  }, [load, view])

  const switchView = (v: View) => {
    if (v !== view) {
      setView(v)
      load(v)
    }
  }

  const doLogout = useCallback(() => {
    clearAuth()
    onUserChange(null)
    window.location.hash = '#/login'
  }, [onUserChange])

  const onLogout = useCallback(() => {
    setLogoutConfirmOpen(true)
  }, [])

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
    if (busy) return
    setBusy(true)
    try {
      setProjects(attachCovers(await archiveProject(id)))
    } finally {
      setBusy(false)
    }
  }

  const restore = async (id: string) => {
    if (busy) return
    setBusy(true)
    try {
      setProjects(attachCovers(await unarchiveProject(id)))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (busy) return
    if (!window.confirm('确定永久删除该项目吗？此操作不可恢复。')) return
    setBusy(true)
    try {
      setProjects(attachCovers(await deleteProject(id)))
    } finally {
      setBusy(false)
    }
  }

  const exportFile = async (p: ProjectMeta) => {
    if (busy) return
    setBusy(true)
    try {
      await exportProject(p.id, { updatedAt: p.updatedAt })
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : '请稍后重试'}`)
    } finally {
      setBusy(false)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- 封面懒加载兜底：对无封面 / 封面过期的项目限量并发生成（并发 ≤4）----
  const coverQueueRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (loading) return
    const queue = projects
      .filter((p) => !isCoverFresh(p))
      .filter((p) => !coverQueueRef.current.has(p.id))
    if (queue.length === 0) return
    queue.forEach((p) => coverQueueRef.current.add(p.id))

    let cancelled = false
    let active = 0
    const MAX_CONCURRENT = 4

    const work = async () => {
      while (!cancelled) {
        const meta = queue.shift()
        if (!meta) break
        const updated = await refreshProjectCover(meta)
        if (updated && !cancelled) {
          setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        }
      }
    }

    const pump = () => {
      while (!cancelled && active < MAX_CONCURRENT && queue.length > 0) {
        active += 1
        work().finally(() => {
          active -= 1
        })
      }
    }

    // 浏览器空闲时隙启动，避免与首屏渲染争抢主线程
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    let idleHandle: number | undefined
    if (w.requestIdleCallback) {
      idleHandle = w.requestIdleCallback(pump, { timeout: 2000 })
    } else {
      idleHandle = window.setTimeout(pump, 300)
    }

    // 已启动的 work 通过 cancelled 退出；未启动的 idle 回调在此取消
    return () => {
      cancelled = true
      if (idleHandle !== undefined) {
        if (w.cancelIdleCallback) w.cancelIdleCallback(idleHandle)
        else window.clearTimeout(idleHandle)
      }
    }
  }, [loading, projects])

  /** 选择 .xgproj 文件后导入，结果（成功/失败原因）显示在导入行 */
  const onImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || importing) return
    setImporting(true)
    setImportResult('')
    try {
      const { list, outcome } = await importProjectFile(file)
      setProjects(attachCovers(list))
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
            <h1>{view === 'active' ? '我的项目' : '归档项目'}</h1>
            <p className="projects-sub">{view === 'active' ? '继续你的设计，或创建一个新项目。' : '已归档的项目可恢复或永久删除。'}</p>
          </div>
          <div className="projects-head-right">
            <div className="projects-tabs">
              <button className={`projects-tab ${view === 'active' ? 'active' : ''}`} onClick={() => switchView('active')}>我的项目</button>
              <button className={`projects-tab ${view === 'archived' ? 'active' : ''}`} onClick={() => switchView('archived')}>已归档</button>
            </div>
            {view === 'active' && (
              <button className="projects-new-btn" onClick={create} disabled={busy}>
                <Icon name="plus" /> 新建项目
              </button>
            )}
          </div>
        </div>

        {view === 'active' && (
          <div className="projects-import-row">
            <button className="import-local-btn" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? '导入中…' : '导入项目文件'}
            </button>
            {importResult && <span className="import-result">{importResult}</span>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xgproj,application/json"
              style={{ display: 'none' }}
              onChange={onImportFileChange}
            />
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
            <button className="btn" onClick={() => load()}>重试</button>
          </div>
        ) : projects.length === 0 ? (
          <div className="projects-state">
            <span className="projects-empty-icon"><Icon name="frame" /></span>
            {view === 'active' ? (
              <>
                <strong>还没有项目</strong>
                <p>创建一个新项目，开始你的设计。</p>
                <button className="btn btn-primary" onClick={create}>新建项目</button>
              </>
            ) : (
              <>
                <strong>暂无归档项目</strong>
                <p>归档的项目会显示在这里。</p>
              </>
            )}
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <div className="project-grid-card" key={p.id} onClick={() => view === 'active' && openProject(p.id)}>
                <div className="project-grid-thumb">
                  {isCoverFresh(p) && p.cover ? <img src={p.cover} alt={p.name} loading="lazy" /> : <Icon name="frame" />}
                </div>
                <div className="project-grid-info">
                  <div className="project-name">{p.name}</div>
                  <div className="project-meta">
                    更新于 {new Date(p.updatedAt).toLocaleString()}
                    {p.share?.active && <span className="shared-tag">已分享</span>}
                  </div>
                </div>
                <div className="project-actions" onClick={(e) => e.stopPropagation()}>
                  {view === 'active' ? (
                    <>
                      <button title="打开项目" onClick={() => openProject(p.id)}>打开</button>
                      <button title="复制项目" onClick={() => duplicate(p.id)} disabled={busy}>复制</button>
                      <button title="导出为 .xgproj 文件" onClick={() => exportFile(p)} disabled={busy}>导出</button>
                      <button title="归档项目" onClick={() => archive(p.id)} disabled={busy}>归档</button>
                    </>
                  ) : (
                    <>
                      <button title="恢复项目" onClick={() => restore(p.id)} disabled={busy}>恢复</button>
                      <button title="永久删除项目" className="danger" onClick={() => remove(p.id)} disabled={busy}>删除</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="退出登录"
        message="确定要退出当前账号吗？"
        confirmText="退出登录"
        cancelText="取消"
        danger
        onConfirm={() => {
          setLogoutConfirmOpen(false)
          doLogout()
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  )
}
