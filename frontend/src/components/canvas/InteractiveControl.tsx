import type { LayerNode } from '../../types/design'
import type { InteractionSpec } from './preview-interactions'

interface Props {
  spec: InteractionSpec
  node: LayerNode
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * 预览交互模式的 DOM 覆盖控件。
 * 叠加在组件容器内（绝对定位铺满），交互真实且不动组件模板 render；
 * 事件 stopPropagation，避免干扰 stage 的 hover/pressed 演示逻辑。
 */
export function InteractiveControl({ spec, node, value, onChange }: Props) {
  // 按钮：pressed 视觉走 demoState、跳转走 HotspotLayer，无需覆盖控件
  if (spec.kind === 'button') return null

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'auto',
    boxSizing: 'border-box',
  }

  if (spec.kind === 'text') {
    return (
      <input
        className="preview-input"
        style={baseStyle}
        value={typeof value === 'string' ? value : ''}
        placeholder=""
        onChange={(e) => { e.stopPropagation(); onChange(e.target.value) }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    )
  }

  if (spec.kind === 'select') {
    return (
      <select
        className="preview-select"
        style={baseStyle}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.value) }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <option value="">请选择…</option>
        {(spec.options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    )
  }

  if (spec.kind === 'radio') {
    const options = spec.options ?? []
    const current = typeof value === 'string' ? value : ''
    return (
      <div
        className="preview-radio"
        style={{ ...baseStyle, display: 'flex', flexDirection: 'column' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {options.map((o) => (
          <div
            key={o}
            className="preview-radio-row"
            style={{ flex: 1, display: 'flex', alignItems: 'center' }}
            onClick={(e) => { e.stopPropagation(); onChange(o) }}
          >
            {current === o && <span className="preview-radio-check" />}
          </div>
        ))}
      </div>
    )
  }

  // toggle：点击热区，视觉由 CanvasObject 覆盖 props（on）驱动
  return (
    <div
      className="preview-toggle"
      style={baseStyle}
      onClick={(e) => { e.stopPropagation(); onChange(!value) }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}
