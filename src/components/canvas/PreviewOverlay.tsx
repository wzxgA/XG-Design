import type { EditorState } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { CanvasObject } from './CanvasObject'
import { Icon } from '../common/brand'

interface Props {
  state: EditorState
  onClose: () => void
}

/** 只读预览层：隐藏编辑面板与选中框，仅展示画板内容 */
export function PreviewOverlay({ state, onClose }: Props) {
  const page = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const frame = page.children.find((n) => n.type === 'frame') as LayerNode | undefined
  const noop = () => {} // 预览中不响应任何编辑派发（通过空 dispatch 禁用交互）

  return (
    <div className="preview-overlay">
      <div className="preview-toolbar">
        <span className="preview-title">{frame ? frame.name : state.document.name}</span>
        <button className="preview-close" onClick={onClose}><Icon name="external" /> 退出预览</button>
      </div>
      <div className="preview-stage">
        {frame ? (
          <div className="preview-board" style={{ width: frame.width, height: frame.height }}>
            {frame.children.map((child) => (
              <CanvasObject key={child.id} node={child} state={{ ...state, selectedIds: [], activeTool: 'select' }} dispatch={() => {}} drawing />
            ))}
          </div>
        ) : (
          <div className="preview-empty">空画板</div>
        )}
      </div>
    </div>
  )
}
