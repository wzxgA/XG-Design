import { useEffect, useState } from 'react'
import type { EditorState, EditorDispatch, ToolType } from '../../state/editor-store'
import type { DesignDocument, LayerNode } from '../../types/design'
import type { ProjectMember, SaveStatus } from '../../types/project'
import { repository } from '../../services'
import { Icon, Watermelon, type IconName } from '../common/brand'
import { exportNodeAsPng, exportPageAsPng, exportDocumentPagesAsPng } from '../../utils/export'
import { downloadProjectFile } from '../../services/exportProject'
import { HistoryModal } from '../history/HistoryModal'
import { avatarColor } from '../../constants/colors'
import { AVATAR_MAX_VISIBLE } from '../../constants/limits'

const toolItems: [IconName, string, string, ToolType][] = [
  ['cursor', '选择', 'V', 'select'],
  ['frame', '画板', 'F', 'frame'],
  ['rect', '矩形', 'R', 'rectangle'],
  ['pen', '路径', 'P', 'pen'],
  ['text', '文字', 'T', 'text'],
  ['comment', '评论', 'C', 'comment'],
]

interface Props {
  state: EditorState
  dispatch: EditorDispatch
  onRenameDocument: (name: string) => void
  /** 返回项目列表首页 */
  onHome?: () => void
  onPreview?: () => void
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
  state, dispatch, onRenameDocument, onHome, onPreview, onShare,
  onUndo, onRedo, saveStatus = 'idle', readOnly = false, userName, logoutNode,
}: Props) {
  const doc: DesignDocument = state.document
  const zoom = state.zoom
  const saving = saveStatus === 'saving'
  const canUndo = state.history.past.length > 0 && !readOnly
  const canRedo = state.history.future.length > 0 && !readOnly
  const [moreOpen, setMoreOpen] = useState(false)
  const [exporting, setExporting] = useState<'selected-1' | 'selected-2' | 'page-1' | 'page-2' | 'page-3' | 'project' | 'pages-1' | 'pages-2' | null>(null)
  const [exportProgress, setExportProgress] = useState<{ index: number; total: number; pageName: string } | null>(null)
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

  /** 导出项目文件（.xgproj）：直接序列化编辑器当前文档，无需重新拉取 */
  const exportProjectFile = () => {
    setExporting('project')
    try {
      downloadProjectFile(doc, { updatedAt: doc.updatedAt })
    } catch {
      // 导出失败静默
    } finally {
      setExporting(null)
      setMoreOpen(false)
    }
  }

  /** 批量导出全部页面 PNG：逐页渲染 + 下载，实时显示进度 */
  const exportAllPages = async (scale: 1 | 2) => {
    if (doc.pages.length === 0) return
    setExporting(`pages-${scale}`)
    setExportProgress(null)
    try {
      await exportDocumentPagesAsPng(doc, scale, (index, total, pageName) => {
        setExportProgress({ index, total, pageName })
      })
    } catch {
      // 导出失败静默
    } finally {
      setExportProgress(null)
      setExporting(null)
      setMoreOpen(false)
    }
  }

  return (
    <header className="topbar">
      <div className="brand" onClick={readOnly ? undefined : onHome} title={readOnly ? '只读分享页' : '返回项目列表'} style={{ cursor: readOnly ? 'default' : 'pointer' }}><Watermelon /><strong>XG<span>Design</span></strong></div>
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
            title={`${label}（${key}）`}
          >
            <Icon name={icon} />
            <kbd className="tool-key">{key}</kbd>
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
              <div className="more-menu-label">导出项目</div>
              <button onClick={exportProjectFile} disabled={exporting !== null}>
                {exporting === 'project' ? '导出中…' : '项目文件 .xgproj'}
              </button>
              <button onClick={() => exportAllPages(1)} disabled={exporting !== null || doc.pages.length === 0}>
                {exporting === 'pages-1' ? '导出中…' : '全部页面 PNG @1x'}
              </button>
              <button onClick={() => exportAllPages(2)} disabled={exporting !== null || doc.pages.length === 0}>
                {exporting === 'pages-2' ? '导出中…' : '全部页面 PNG @2x'}
              </button>
              {exportProgress && (
                <div className="more-menu-progress">
                  正在导出第 {exportProgress.index}/{exportProgress.total} 页（{exportProgress.pageName}）…
                </div>
              )}
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
                {members.slice(0, AVATAR_MAX_VISIBLE).map((m) => (
                  <span key={m.userId} className="avatar" style={{ background: avatarColor(m.userId) }} title={m.displayName}>
                    {m.displayName.slice(0, 1).toUpperCase()}
                  </span>
                ))}
                {members.length > AVATAR_MAX_VISIBLE && <span className="avatar-more">+{members.length - AVATAR_MAX_VISIBLE}</span>}
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

