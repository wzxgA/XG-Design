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
  onPreview?: () => void
  onOpenProjects?: () => void
  onShare?: () => void
  saveStatus?: SaveStatus
}

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '已保存',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
}

export function TopToolbar({ state, dispatch, onRenameDocument, onPreview, onOpenProjects, onShare, saveStatus = 'idle' }: Props) {
  const doc: DesignDocument = state.document
  const zoom = state.zoom
  const saving = saveStatus === 'saving'

  return (
    <header className="topbar">
      <div className="brand" onClick={onOpenProjects} title="打开项目" style={{ cursor: 'pointer' }}><Watermelon /><strong>XG<span>Design</span></strong></div>
      <div className="file-meta" title="点击重命名">
        <input
          className="file-name-input"
          value={doc.name}
          maxLength={80}
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
        <div className="avatars">
          <span className="avatar avatar-one">M</span>
          <span className="avatar avatar-two">L</span>
          <span className="avatar avatar-three">A</span>
          <span className="avatar-more">+2</span>
        </div>
        <button className="preview-button" onClick={onPreview}><Icon name="play" /> 预览</button>
        <button className="share-button" onClick={onShare}>分享 <Icon name="external" /></button>
        <span className="top-zoom">{zoom}%</span>
      </div>
    </header>
  )
}
