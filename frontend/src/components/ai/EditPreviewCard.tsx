import type { EditOperation } from '../../types/ai'
import type { LayerNode } from '../../types/design'

interface Props {
  operations: EditOperation[]
  description?: string
  onApply?: (operations: EditOperation[]) => void
}

/** 修改场景的操作摘要卡片（不显示缩略图，列出每条操作摘要 + 应用按钮） */
export function EditPreviewCard({ operations, description, onApply }: Props) {
  return (
    <div className="ai-edit-card">
      <p className="ai-edit-desc">{description ?? 'AI 修改建议'}</p>
      <ul className="ai-edit-ops">
        {operations.map((op, i) => (
          <li key={i} className="ai-edit-op">
            <span className={`ai-edit-op-tag ai-edit-op-${op.op}`}>{opLabel(op)}</span>
          </li>
        ))}
      </ul>
      <div className="ai-edit-actions">
        <button className="ai-btn-apply" onClick={() => onApply?.(operations)}>
          应用到画布
        </button>
      </div>
    </div>
  )
}

/** 生成单条操作的摘要文字 */
function opLabel(op: EditOperation): string {
  switch (op.op) {
    case 'update': {
      const fields: string[] = []
      const p = op.patch
      if (p.style) fields.push(...Object.keys(p.style).map(styleLabel))
      if (p.content !== undefined) fields.push('内容')
      if (p.name !== undefined) fields.push('名称')
      if (p.width !== undefined || p.height !== undefined) fields.push('尺寸')
      if (p.x !== undefined || p.y !== undefined) fields.push('位置')
      return `修改 ${op.id.slice(0, 12)}${fields.length ? '：' + fields.join('、') : ''}`
    }
    case 'delete':
      return `删除 ${op.id.slice(0, 12)}`
    case 'replace': {
      const node = op.node as LayerNode
      const target = node.component ? `组件「${node.component}」` : node.type
      return `替换 ${op.id.slice(0, 12)} → ${target}`
    }
    case 'insert': {
      const node = op.node as LayerNode
      const target = node.component ? `组件「${node.component}」` : node.type
      return `新增 ${target} → ${op.parentId.slice(0, 12)}`
    }
  }
}

function styleLabel(key: string): string {
  const map: Record<string, string> = {
    fill: '填充色', color: '颜色', fontColor: '颜色', fontSize: '字号',
    fontWeight: '字重', textAlign: '对齐', cornerRadius: '圆角',
    stroke: '描边', strokeWidth: '描边宽', opacity: '透明度', shadow: '阴影',
  }
  return map[key] ?? key
}
