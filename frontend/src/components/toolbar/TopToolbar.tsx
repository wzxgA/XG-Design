import { useEffect, useState } from 'react'
import type { EditorState, EditorDispatch, ToolType } from '../../state/editor-store'
import type { DesignDocument, LayerNode } from '../../types/design'
import type { ProjectMember, SaveStatus } from '../../types/project'
import { repository } from '../../services'
import { Icon, Watermelon, type IconName } from '../common/brand'
import { exportNodeAsPng, exportPageAsPng } from '../../utils/export'
import { HistoryModal } from '../history/HistoryModal'

const toolItems: [IconName, string, string, ToolType][] = [
  ['cursor', '选择', 'V', 'select'],
  ['frame', '画板', 'F', 'frame'],
  ['rect', '矩形', 'R', 'rectangle'],
  ['pen', '钢笔', 'P', 'pen'],
  ['text', '文字', 'T', 'text'],
  ['comment', '评论', 'C', 'comment'],
  ['grid', '组件', '', 'components'],
]

interface Props {
  state: EditorState
  dispatch: EditorDispatch
  onRenameDocument: (name: string) => void
  /** 返回项目列表首页 */
  onHome?: () => void
  onPreview?: () => void
  onOpenProjects?: () => void
  onShare?: () => void
  onUndo?: () => void
  onRedo?: () => void
  saveStatus?: SaveStatus
  /** 只读模式（分享仅查看链接） */
  readOnly?: boolean
  /** 当前登录用户昵称 */
  userName?: string
  /** 登录用户邮箱 */
  userEmail?: string
  /** 退出登录按钮节点 */
  logoutNode?: React.ReactNode
}

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '已保存',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
}

function findLayerInDoc(doc: DesignDocument, id: string): LayerNode | null {
  for (const page of doc.pages) {
    const found = findInTree(page.children, id)
    if (found) return found
  }
  return null
}

function findInTree(nodes: LayerNode[], id: string): LayerNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findInTree(node.children, id)
    if (found) return found
  }
  return null
}

export function TopToolbar({
  state, dispatch, onRenameDocument, onHome, onPreview, onOpenProjects, onShare,
  onUndo, onRedo, saveStatus = 'idle', readOnly = false, userName, logoutNode,
}: Props) {
  const doc: DesignDocument = state.document
  const zoom = state.zoom
  const saving = saveStatus === 'saving'
  const canUndo = state.history.past.length > 0 && !readOnly
  const canRedo = state.history.future.length > 0 && !readOnly
  const [moreOpen, setMoreOpen] = useState(false)
  const [exporting, setExporting] = useState<'selected-1' | 'selected-2' | 'page-1' | 'page-2' | 'page-3' | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [members, setMembers] = useState<ProjectMember[]>([])

  // 协作头像读取真实成员（仅远程模式；只读分享页不展示）
  useEffect(() => {
    if (readOnly || repository.kind !== 'remote') return
    let alive = true
    repository.listMembers(doc.id)
      .then((list) => { if (alive) setMembers(list) })
      .catch(() => { /* 成员加载失败静默 */ })
    return () => { alive = false }
  }, [doc.id, readOnly])

  const exportSelected = async (scale: 1 | 2) => {
    const selected = findLayerInDoc(doc, state.selectedIds[0] ?? '')
    if (!selected) return
    setExporting(`selected-${scale}`)
    try {
      await exportNodeAsPng(selected, scale)
    } catch {
      // 导出失败静默
    } finally {
      setExporting(null)
      setMoreOpen(false)
    }
  }

  const exportPage = async (scale: 1 | 2 | 3) => {
    const page = doc.pages.find((p) => p.id === doc.activePageId)
    if (!page) return
    setExporting(`page-${scale}`)
    try {
      await exportPageAsPng(page, scale, doc.name)
    } catch {
      // 导出失败静默（空页面等）
    } finally {
      setExporting(null)
      setMoreOpen(false)
    }
  }

  return (
    <header className="topbar">
      {onHome && <button className="home-button" onClick={onHome} title="返回项目列表">项目列表</button>}
      <div className="brand" onClick={readOnly ? undefined : onOpenProjects} title={readOnly ? '只读分享页' : '打开项目'} style={{ cursor: readOnly ? 'default' : 'pointer' }}><Watermelon /><strong>XG<span>Design</span></strong></div>
      <div className="file-meta" title={readOnly ? '只读模式' : '点击重命名'}>
        <input
          className="file-name-input"
          value={doc.name}
          maxLength={80}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value
            if (v.trim().length > 0) onRenameDocument(v)
          }}
          onBlur={(e) => {
            if (!e.target.value.trim()) { e.target.value = doc.name }
          }}
        />
        <Icon name="chevron" />
        <span className={`save-dot ${saveStatus}`} />
        <span className="saved">{SAVE_LABEL[saveStatus]}</span>
        {readOnly && <span className="readonly-badge"><Icon name="eye" /> 只读</span>}
      </div>

      <div className="toolbar-tools">
        {onUndo && onRedo && !readOnly && (
          <>
            <button className="tool-button" onClick={onUndo} disabled={!canUndo} title="撤销 (⌘Z)"><span className="undo-redo">↶</span></button>
            <button className="tool-button" onClick={onRedo} disabled={!canRedo} title="重做 (⇧⌘Z)"><span className="undo-redo">↷</span></button>
          </>
        )}
        {toolItems.map(([icon, label, key, tool], index) => (
          <button
            key={label}
            className={`tool-button ${state.activeTool === tool ? 'selected' : ''} ${index === 5 ? 'tool-divider' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool })}
            title={`${label} ${key}`}
          >
            <Icon name={icon} /><span className="tool-key">{key}</span>
          </button>
        ))}
        <div className="more-wrap" onClick={(e) => e.stopPropagation()}>
          <button className="tool-button more" onClick={() => setMoreOpen((v) => !v)}>•••</button>
          {moreOpen && (
            <div className="more-menu">
              <div className="more-menu-label">导出选中</div>
              <button onClick={() => exportSelected(1)} disabled={exporting !== null}>
                {exporting === 'selected-1' ? '导出中…' : 'PNG @1x'}
              </button>
              <button onClick={() => exportSelected(2)} disabled={exporting !== null}>
                {exporting === 'selected-2' ? '导出中…' : 'PNG @2x'}
              </button>
              <div className="more-menu-divider" />
              <div className="more-menu-label">导出整页</div>
              <button onClick={() => exportPage(1)} disabled={exporting !== null}>
                {exporting === 'page-1' ? '导出中…' : 'PNG @1x'}
              </button>
              <button onClick={() => exportPage(2)} disabled={exporting !== null}>
                {exporting === 'page-2' ? '导出中…' : 'PNG @2x'}
              </button>
              <button onClick={() => exportPage(3)} disabled={exporting !== null}>
                {exporting === 'page-3' ? '导出中…' : 'PNG @3x'}
              </button>
              <div className="more-menu-divider" />
              {!readOnly && (
                <button onClick={() => { dispatch({ type: 'CLEAR_HISTORY' }); setMoreOpen(false) }} disabled={state.history.past.length === 0 && state.history.future.length === 0}>
                  清除历史
                </button>
              )}
              <button onClick={() => { dispatch({ type: 'SET_INSPECTOR_TAB', tab: 'inspect' }); setMoreOpen(false) }}>
                设计检查
              </button>
              {!readOnly && (
                <button onClick={() => { setHistoryOpen(true); setMoreOpen(false) }}>
                  历史版本
                </button>
              )}
              {onHome && <button onClick={() => { setMoreOpen(false); onHome() }}>返回项目列表</button>}
            </div>
          )}
        </div>
      </div>

      <div className="top-actions">
        {!readOnly && (
          <>
            {userName && (
              <div className="user-chip">
                <span className="user-avatar">{userName.slice(0, 1).toUpperCase()}</span>
                <span className="user-name">{userName}</span>
                {logoutNode}
              </div>
            )}
            {members.length > 0 && (
              <div className="avatars" title={`协作者 ${members.length} 人`}>
                {members.slice(0, 4).map((m) => (
                  <span key={m.userId} className="avatar" style={{ background: avatarColor(m.userId) }} title={m.displayName}>
                    {m.displayName.slice(0, 1).toUpperCase()}
                  </span>
                ))}
                {members.length > 4 && <span className="avatar-more">+{members.length - 4}</span>}
              </div>
            )}
          </>
        )}
        <button className="preview-button" onClick={onPreview}><Icon name="play" /> 预览</button>
        {!readOnly && <button className="share-button" onClick={onShare}>分享 <Icon name="external" /></button>}
        <span className="top-zoom">{zoom}%</span>
      </div>
      {historyOpen && <HistoryModal projectId={doc.id} onClose={() => setHistoryOpen(false)} />}
    </header>
  )
}

const AVATAR_COLORS = ['#f1a46d', '#8ba4dc', '#70c69b', '#e07b9c', '#a78bdc', '#6dc5d6']

function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
