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

/** 只读预览层：支持原型连接跳转与返回；一页多画板平铺渲染 */
export function PreviewOverlay({ state, onClose }: Props) {
  const [pageId, setPageId] = useState(state.document.activePageId)
  const [history, setHistory] = useState<string[]>([])

  const page = state.document.pages.find((p) => p.id === pageId)!
  const frames = page.children.filter((n) => n.type === 'frame') as LayerNode[]

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

  // 平铺布局：按 frame 坐标排布，横向流式（gap 48px）
  let cursorX = 0
  const placed = frames.map((frame) => {
    const item = { frame, left: cursorX }
    cursorX += frame.width + 48
    return item
  })

  return (
    <div className="preview-overlay">
      <div className="preview-toolbar">
        <div className="preview-nav">
          <button className="preview-back" onClick={goBack} disabled={history.length === 0} title="返回上一页"><Icon name="chevron" /></button>
          <span className="preview-title">{frames.length > 0 ? frames[0].name : page.name}</span>
        </div>
        <button className="preview-close" onClick={onClose}><Icon name="external" /> 退出预览</button>
      </div>
      <div className="preview-stage">
        {frames.length > 0 ? (
          <div className="preview-boards" style={{ width: cursorX - 48 }}>
            {placed.map(({ frame, left }) => (
              <div key={frame.id} className="preview-board" style={{ left, width: frame.width, height: frame.height }}>
                <CanvasObject node={{ ...frame, x: 0, y: 0 }} state={{ ...state, selectedIds: [], activeTool: 'select' }} dispatch={noop} drawing />
                {frame.children.map((child) => (
                  <HotspotLayer key={child.id} node={child} offsetX={0} offsetY={0} state={state} onNavigate={navigate} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="preview-empty">空画板</div>
        )}
      </div>
    </div>
  )
}
