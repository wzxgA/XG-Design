import { useCallback, useEffect, useState } from 'react'
import { repository } from '../../services'
import { getCurrentUser } from '../../services/auth'
import { Icon } from '../common/brand'
import type { Permission, ShareInfo, MemberRole, ProjectMember } from '../../types/project'

interface Props {
  projectId: string
  onClose: () => void
}

/** 分享弹窗：权限选择、复制链接、取消分享 + 协作者管理（对接 /api/documents/{id}/share 与 /members） */
export function ShareModal({ projectId, onClose }: Props) {
  const [permission, setPermission] = useState<Permission>('view')
  const [copied, setCopied] = useState(false)
  const [info, setInfo] = useState<ShareInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 协作者区块
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer')
  const [memberBusy, setMemberBusy] = useState(false)
  const [memberError, setMemberError] = useState('')

  const remoteOnly = repository.kind === 'remote'
  const currentUserId = getCurrentUser()?.id ?? ''
  const currentMember = members.find((m) => m.userId === currentUserId)
  const isManager = currentMember?.role === 'owner' || currentMember?.role === 'editor'

  const active = !!info

  const loadMembers = useCallback(async () => {
    if (!remoteOnly) return
    try {
      setMembers(await repository.listMembers(projectId))
    } catch {
      /* 成员加载失败不阻塞分享主流程 */
    }
  }, [projectId, remoteOnly])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const startShare = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const share: ShareInfo = {
        link: '',
        permission,
        active: true,
        createdAt: Date.now(),
      }
      await repository.setShare(projectId, share)
      setInfo(share)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建分享失败')
    } finally {
      setBusy(false)
    }
  }

  const updatePermission = async (p: Permission) => {
    setPermission(p)
    if (!info || busy) return
    setBusy(true)
    setError('')
    try {
      await repository.setShare(projectId, { ...info, permission: p })
      setInfo({ ...info, permission: p })
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新权限失败')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await repository.setShare(projectId, null)
      setInfo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消分享失败')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!info?.link) return
    try {
      await navigator.clipboard.writeText(info.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* 剪贴板不可用 */ }
  }

  const invite = async () => {
    const email = inviteEmail.trim()
    if (!email || memberBusy) return
    setMemberBusy(true)
    setMemberError('')
    try {
      const member = await repository.inviteMember(projectId, email, inviteRole)
      setMembers((prev) => [...prev.filter((m) => m.userId !== member.userId), member])
      setInviteEmail('')
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : '邀请失败')
    } finally {
      setMemberBusy(false)
    }
  }

  const changeRole = async (member: ProjectMember, role: 'editor' | 'viewer') => {
    if (memberBusy || member.role === role) return
    setMemberBusy(true)
    setMemberError('')
    try {
      await repository.updateMemberRole(projectId, member.userId, role)
      setMembers((prev) => prev.map((m) => (m.userId === member.userId ? { ...m, role } : m)))
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : '修改角色失败')
    } finally {
      setMemberBusy(false)
    }
  }

  const remove = async (member: ProjectMember) => {
    if (memberBusy) return
    if (!window.confirm(`确定移除协作者 ${member.displayName} 吗？`)) return
    setMemberBusy(true)
    setMemberError('')
    try {
      await repository.removeMember(projectId, member.userId)
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId))
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : '移除失败')
    } finally {
      setMemberBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">分享设计稿</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {!active ? (
            <>
              <div className="share-permission-row">
                <label>谁可以访问</label>
                <select className="proto-select" value={permission} onChange={(e) => setPermission(e.target.value as Permission)}>
                  <option value="view">仅查看</option>
                  <option value="edit">可编辑</option>
                </select>
              </div>
              <button className="export-button" onClick={startShare} disabled={busy}>创建分享链接</button>
              <div className="share-hint">分享链接不会暴露内部用户信息，仅按权限访问。</div>
            </>
          ) : (
            <>
              <div className="share-active">
                <span className="share-status">已分享</span>
                <div className="share-link-box">
                  <span className="share-link">{info?.link || '生成中…'}</span>
                  <button className="share-copy" onClick={copy} disabled={!info?.link}>{copied ? '已复制 ✓' : '复制'}</button>
                </div>
              </div>
              <div className="share-permission-row">
                <label>权限</label>
                <select className="proto-select" value={permission} onChange={(e) => updatePermission(e.target.value as Permission)}>
                  <option value="view">仅查看</option>
                  <option value="edit">可编辑</option>
                </select>
              </div>
              <button className="share-revoke" onClick={revoke} disabled={busy}>取消分享</button>
              <div className="share-hint">取消分享后，原链接将失效。</div>
            </>
          )}
          {error && <div className="export-error">{error}</div>}

          <div className="members-section">
            <div className="members-title">协作者</div>
            {!remoteOnly && <div className="share-hint">协作者仅远程模式可用。</div>}

            {remoteOnly && members.length === 0 && !memberBusy && (
              <div className="members-empty">暂无协作者</div>
            )}

            {remoteOnly && (
              <div className="member-list">
                {members.map((m) => (
                  <div className="member-row" key={m.userId}>
                    <span className="member-avatar" style={{ background: avatarColor(m.userId) }}>
                      {m.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="member-info">
                      <div className="member-name">
                        {m.displayName}
                        {m.userId === currentUserId && <span className="member-me">我</span>}
                        {m.role === 'owner' && <span className="member-tag">拥有者</span>}
                      </div>
                      <div className="member-email">{m.email}</div>
                    </div>
                    {isManager && m.role !== 'owner' ? (
                      <div className="member-controls">
                        <select
                          className="proto-select member-role-select"
                          value={m.role}
                          disabled={memberBusy}
                          onChange={(e) => changeRole(m, e.target.value as 'editor' | 'viewer')}
                        >
                          <option value="editor">可编辑</option>
                          <option value="viewer">仅查看</option>
                        </select>
                        <button className="member-remove" onClick={() => remove(m)} disabled={memberBusy} title="移除协作者">✕</button>
                      </div>
                    ) : (
                      <span className="member-role-badge">{roleLabel(m.role as MemberRole)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {remoteOnly && isManager && (
              <div className="member-invite-row">
                <input
                  className="member-invite-input"
                  placeholder="输入协作者邮箱"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') invite() }}
                />
                <select className="proto-select member-invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}>
                  <option value="editor">可编辑</option>
                  <option value="viewer">仅查看</option>
                </select>
                <button className="member-invite-btn" onClick={invite} disabled={memberBusy || !inviteEmail.trim()}>
                  {memberBusy ? '邀请中…' : '邀请'}
                </button>
              </div>
            )}
            {memberError && <div className="export-error">{memberError}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function roleLabel(role: MemberRole): string {
  if (role === 'owner') return '拥有者'
  return role === 'editor' ? '可编辑' : '仅查看'
}

const AVATAR_COLORS = ['#f1a46d', '#8ba4dc', '#70c69b', '#e07b9c', '#a78bdc', '#6dc5d6']

function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
