import type { EditorState, EditorDispatch, ToolType } from '../../state/editor-store'
import type { DesignDocument } from '../../types/design'
import type { SaveStatus } from '../../types/project'
import { Icon, Watermelon, type IconName } from '../common/brand'

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

export function TopToolbar({ state, dispatch, onRenameDocument, onHome, onPreview, onOpenProjects, onShare, saveStatus = 'idle', readOnly = false, userName, logoutNode }: Props) {
  const doc: DesignDocument = state.document
  const zoom = state.zoom
  const saving = saveStatus === 'saving'

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
        <button className="tool-button more">•••</button>
      </div>
      <div className="top-actions">
        {userName ? (
          <div className="user-chip" title={state.document.name ? undefined : undefined}>
            <span className="user-avatar">{userName.slice(0, 1).toUpperCase()}</span>
            <span className="user-name">{userName}</span>
            {logoutNode}
          </div>
        ) : (
          <div className="avatars">
            <span className="avatar avatar-one">M</span>
            <span className="avatar avatar-two">L</span>
            <span className="avatar avatar-three">A</span>
            <span className="avatar-more">+2</span>
          </div>
        )}
        <button className="preview-button" onClick={onPreview}><Icon name="play" /> 预览</button>
        {!readOnly && <button className="share-button" onClick={onShare}>分享 <Icon name="external" /></button>}
        <span className="top-zoom">{zoom}%</span>
      </div>
    </header>
  )
}
