import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { COMPONENT_TEMPLATES, defaultProps } from '../../fixtures/component-library'
import { SchemaForm } from '../inspector/InspectorPanel'
import { CanvasObject } from '../canvas/CanvasObject'

interface Props {
  state: EditorState
  dispatch: EditorDispatch
  readOnly?: boolean
}

/** 左侧组件栏点击组件磁贴 → 弹出的大组件属性编辑对话框（编辑 state.document.masterOverrides） */
export function MasterComponentModal({ state, dispatch, readOnly = false }: Props) {
  const name = state.masterEdit?.componentName
  if (!name) return null
  const tpl = COMPONENT_TEMPLATES.find((t) => t.name === name)
  if (!tpl) return null

  const close = () => dispatch({ type: 'EXIT_MASTER_EDIT' })
  const commit = () => dispatch({ type: 'COMMIT_MASTER_EDIT', componentName: name })
  // 恢复默认：把整份草稿设为模板默认（预览即时恢复默认样式），点"完成编辑"才提交应用到所有实例
  const restoreDefault = () => dispatch({ type: 'SET_MASTER_EDIT_DRAFT_ALL', componentName: name, draft: defaultProps(tpl) })
  // 占位节点：master 模式下 SchemaForm 只依赖 tpl + state，node 仅用于类型（不读取其实例字段）
  const placeholderNode: LayerNode = {
    id: '', type: 'group', name, x: 0, y: 0, width: 0, height: 0,
    rotation: 0, visible: true, locked: false, expanded: true,
    style: { opacity: 1 }, children: [],
  }
  // 实时预览节点：直接吃构建产物；CanvasObject 渲染时叠加本次草稿（instanceOverrides），编辑即可预览，提交前不影响画布实例
  const previewNode = tpl.build(0, 0)
  if (state.masterEdit?.draft && Object.keys(state.masterEdit.draft).length) {
    previewNode.instanceOverrides = { ...state.masterEdit.draft }
  }

  return (
    <div className="modal-overlay">
      <div className="modal master-modal" style={{ width: 440 }}>
        <div className="modal-header">
          <span className="modal-title">编辑主组件 · {tpl.short}</span>
          <button className="modal-close" onClick={close} title="取消（不应用到画布）">✕</button>
        </div>
        <div className="master-modal-note">改动仅在此预览生效，点「完成编辑」才应用到所有实例</div>
        <div className="modal-body">
          <div className="master-preview-stage">
            <div className="master-preview-wrap" style={{ width: previewNode.width, height: previewNode.height }}>
              <CanvasObject node={previewNode} state={state} dispatch={dispatch} drawing={false} readOnly passive />
            </div>
          </div>
          <SchemaForm tpl={tpl} node={placeholderNode} state={state} dispatch={dispatch} readOnly={readOnly} />
        </div>
        <div className="master-modal-footer">
          <button className="master-restore-btn" onClick={restoreDefault} title="在主组件编辑内恢复为模板默认样式，点「完成编辑」才应用到所有实例">恢复默认</button>
          <button className="btn primary" onClick={commit}>完成编辑</button>
        </div>
      </div>
    </div>
  )
}