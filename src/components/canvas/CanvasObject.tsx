import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'

interface Props {
  node: LayerNode
  state: EditorState
  dispatch: EditorDispatch
}

/**
 * 数据驱动的画布对象渲染器。
 * 将 LayerNode 树按绝对坐标渲染为 HTML，隐藏节点不渲染，选中节点显示边框。
 */
export function CanvasObject({ node, state, dispatch }: Props) {
  if (!node.visible) return null

  const selected = state.selectedIds.includes(node.id)
  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    opacity: node.style.opacity ?? 1,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
  }

  // 选中态：在对象外描边 + 覆盖整棵树（若该节点有子节点）
  if (node.children.length > 0) {
    return (
      <div className={`canvas-group ${selected ? 'canvas-selected' : ''}`} style={style} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_LAYERS', ids: [node.id] }) }}>
        {node.children.map((child) => <CanvasObject key={child.id} node={child} state={state} dispatch={dispatch} />)}
      </div>
    )
  }

  switch (node.type) {
    case 'rectangle':
      return (
        <div
          className={`canvas-rect ${selected ? 'canvas-selected' : ''}`}
          style={{
            ...style,
            background: node.style.fill ?? '#e5ebef',
            borderRadius: node.style.cornerRadius ?? 0,
            border: node.style.stroke ? `1px solid ${node.style.stroke}` : undefined,
            boxShadow: node.style.shadow,
          }}
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_LAYERS', ids: [node.id] }) }}
        />
      )

    case 'text':
      return (
        <div
          className={`canvas-text ${selected ? 'canvas-selected' : ''}`}
          style={{
            ...style,
            color: node.style.color ?? '#5c6b72',
            fontSize: node.style.fontSize ?? 14,
            fontWeight: node.style.fontWeight ?? 400,
            lineHeight: '1.2',
          }}
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_LAYERS', ids: [node.id] }) }}
        >
          {node.content ?? node.name}
        </div>
      )

    case 'chart': {
      const bars = node.chartBars ?? []
      const max = Math.max(...bars, 1)
      return (
        <div
          className={`canvas-chart ${selected ? 'canvas-selected' : ''}`}
          style={style}
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_LAYERS', ids: [node.id] }) }}
        >
          {bars.length > 0 ? (
            <div className="canvas-bars">
              {bars.map((h, i) => <i key={i} style={{ height: `${(h / max) * 100}%` }} />)}
            </div>
          ) : (
            <span className="canvas-chart-empty">↗</span>
          )}
        </div>
      )
    }

    default:
      return null
  }
}
