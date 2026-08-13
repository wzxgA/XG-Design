import { useState } from 'react'
import type { EditorState } from '../../state/editor-store'
import type { LayerNode, PrototypeLink } from '../../types/design'
import { CanvasObject } from './CanvasObject'
import { Icon } from '../common/brand'

interface Props {
  state: EditorState
  onClose: () => void
}

function findLink(state: EditorState, layerId: string): PrototypeLink | undefined {
  return state.document.prototypeLinks.find((l) => l.sourceLayerId === layerId)
}

/** 递归渲染所有带原型连接节点的热点（按累积偏移定位） */
function HotspotLayer({ node, offsetX, offsetY, state, onNavigate }: {
  node: LayerNode
  offsetX: number
  offsetY: number
  state: EditorState
  onNavigate: (link: PrototypeLink) => void
}) {
  const absX = offsetX + node.x
  const absY = offsetY + node.y
  const link = findLink(state, node.id)

  return (
    <>
      {link && (
        <div
          className="hotspot"
          style={{ position: 'absolute', left: absX, top: absY, width: node.width, height: node.height }}
          title={`跳转到 ${state.document.pages.find((p) => p.id === link.targetPageId)?.name ?? ''}`}
          onClick={(e) => { e.stopPropagation(); onNavigate(link) }}
        />
      )}
      {node.children.map((child) => (
        <HotspotLayer key={child.id} node={child} offsetX={absX} offsetY={absY} state={state} onNavigate={onNavigate} />
      ))}
    </>
  )
}

/** 只读预览层：支持原型连接跳转与返回 */
export function PreviewOverlay({ state, onClose }: Props) {
  const [pageId, setPageId] = useState(state.document.activePageId)
  const [history, setHistory] = useState<string[]>([])

  const page = state.document.pages.find((p) => p.id === pageId)!
  const frame = page.children.find((n) => n.type === 'frame') as LayerNode | undefined

  const navigate = (link: PrototypeLink) => {
    setHistory((h) => [...h, pageId])
    setPageId(link.targetPageId)
  }

  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setPageId(prev)
      return h.slice(0, -1)
    })
  }

  const noop = () => {}

  return (
    <div className="preview-overlay">
      <div className="preview-toolbar">
        <div className="preview-nav">
          <button className="preview-back" onClick={goBack} disabled={history.length === 0} title="返回上一页"><Icon name="chevron" /></button>
          <span className="preview-title">{frame ? frame.name : page.name}</span>
        </div>
        <button className="preview-close" onClick={onClose}><Icon name="external" /> 退出预览</button>
      </div>
      <div className="preview-stage">
        {frame ? (
          <div className="preview-board" style={{ width: frame.width, height: frame.height }}>
            <CanvasObject node={frame} state={{ ...state, selectedIds: [], activeTool: 'select' }} dispatch={noop} drawing />
            {frame.children.map((child) => (
              <HotspotLayer key={child.id} node={child} offsetX={frame.x} offsetY={frame.y} state={state} onNavigate={navigate} />
            ))}
          </div>
        ) : (
          <div className="preview-empty">空画板</div>
        )}
      </div>
    </div>
  )
}
