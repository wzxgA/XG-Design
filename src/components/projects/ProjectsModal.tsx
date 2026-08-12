import { useState } from 'react'
import { localRepository } from '../../services/documentRepository'
import { Icon, Watermelon } from '../common/brand'
import type { ProjectMeta } from '../../types/project'

interface Props {
  onClose: () => void
}

/** 项目列表弹窗：新建 / 打开 / 复制 / 归档 */
export function ProjectsModal({ onClose }: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>(() => localRepository.listDocuments())
  const [name, setName] = useState('')

  const refresh = () => setProjects(localRepository.listDocuments())

  const open = (id: string) => {
    window.location.hash = `#/doc/${id}`
    window.location.reload()
  }

  const create = () => {
    const meta = localRepository.createDocument(name.trim() || undefined)
    open(meta.id)
  }

  const duplicate = (id: string) => {
    const meta = localRepository.duplicateDocument(id)
    open(meta.id)
  }

  const archive = (id: string) => {
    localRepository.archiveDocument(id)
    refresh()
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
            <button className="export-button new-project-btn" onClick={create}>新建项目</button>
          </div>

          {projects.length === 0 ? (
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
                    <button title="复制项目" onClick={() => duplicate(p.id)}>复制</button>
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
