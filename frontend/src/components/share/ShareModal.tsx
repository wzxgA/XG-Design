import { useState } from 'react'
import { repository } from '../../services'
import { Icon } from '../common/brand'
import type { Permission, ShareInfo } from '../../types/project'

interface Props {
  projectId: string
  onClose: () => void
}

/** 分享弹窗：权限选择、复制链接、取消分享 */
export function ShareModal({ projectId, onClose }: Props) {
  const [permission, setPermission] = useState<Permission>('view')
  const [copied, setCopied] = useState(false)
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)

  const link = active ? `${window.location.origin}${window.location.pathname}#/doc/${projectId}` : ''

  const shareFor = (p: Permission): ShareInfo => ({
    link: `${window.location.origin}${window.location.pathname}#/doc/${projectId}`,
    permission: p,
    active: true,
    createdAt: Date.now(),
  })

  const startShare = async () => {
    if (busy) return
    setBusy(true)
    try {
      await repository.setShare(projectId, shareFor(permission))
      setActive(true)
    } finally {
      setBusy(false)
    }
  }

  const updatePermission = async (p: Permission) => {
    setPermission(p)
    if (!active || busy) return
    setBusy(true)
    try {
      await repository.setShare(projectId, shareFor(p))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (busy) return
    setBusy(true)
    try {
      await repository.setShare(projectId, null)
      setActive(false)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* 剪贴板不可用 */ }
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
                  <span className="share-link">{link}</span>
                  <button className="share-copy" onClick={copy}>{copied ? '已复制 ✓' : '复制'}</button>
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
        </div>
      </div>
    </div>
  )
}
