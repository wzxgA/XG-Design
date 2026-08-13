import { useEffect, useState } from 'react'
import { repository } from '../../services'
import type { HistoryEntry } from '../../types/project'

interface Props {
  projectId: string
  onClose: () => void
}

/** 操作日志历史弹窗：只读展示文档操作流水（历史版本/快照回滚为远期能力） */
export function HistoryModal({ projectId, onClose }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    repository
      .listHistory(projectId)
      .then((list) => { if (alive) setEntries(list) })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : '加载历史失败') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [projectId])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">历史版本</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading && <div className="history-loading">加载中…</div>}
          {!loading && error && <div className="export-error">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="history-empty">暂无操作记录</div>
          )}
          {!loading && !error && entries.length > 0 && (
            <div className="history-list">
              {entries.map((e) => (
                <div className="history-row" key={e.id}>
                  <span className={`history-badge action-${e.action}`}>{actionLabel(e.action)}</span>
                  <div className="history-info">
                    <div className="history-detail">{formatDetail(e.action, e.detail)}</div>
                    <div className="history-time">
                      {new Date(e.createdAt).toLocaleString()}
                      {e.userId ? ` · 用户 ${e.userId.slice(0, 8)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="history-hint">历史记录为操作流水；查看快照与「复制为当前」为远期能力。</div>
        </div>
      </div>
    </div>
  )
}

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '保存',
  duplicate: '复制',
  archive: '归档',
  unarchive: '恢复',
  delete: '删除',
  'share.create': '创建分享',
  'share.revoke': '取消分享',
  'shared.edit': '分享编辑',
  'member.invite': '邀请协作者',
  'member.role': '修改角色',
  'member.remove': '移除协作者',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function formatDetail(action: string, detail: string | null): string {
  if (!detail) return actionLabel(action)
  try {
    const parsed = JSON.parse(detail) as Record<string, string>
    if (parsed.user && parsed.role) return `${actionLabel(action)}：${parsed.user}（${parsed.role === 'editor' ? '可编辑' : '仅查看'}）`
    if (parsed.user) return `${actionLabel(action)}：${parsed.user}`
    if (parsed.token) return `${actionLabel(action)}：${parsed.token}…`
  } catch {
    /* detail 非 JSON 时原样展示 */
  }
  return detail
}
