import { useState } from 'react'
import type { LayerNode } from '../../types/design'
import { DesignThumbnail, splitFrames } from './DesignThumbnail'

interface Props {
  layers: LayerNode[]
  description: string
  onClose: () => void
  onApply: () => void
}

export function DesignPreviewModal({ layers, description, onClose, onApply }: Props) {
  const [page, setPage] = useState(0)
  const pages = splitFrames(layers)
  const current = pages[Math.min(page, pages.length - 1)]

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        <div className="ai-modal-header">
          <span className="ai-modal-title">{description}</span>
          <button className="ai-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="ai-modal-body">
          <DesignThumbnail layers={current} width={600} height={400} />
          {pages.length > 1 && (
            <div className="ai-design-pages ai-design-pages-center">
              <button className="ai-design-page-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
              <span className="ai-design-page-info">{page + 1}/{pages.length}</span>
              <button className="ai-design-page-btn" disabled={page >= pages.length - 1} onClick={() => setPage((p) => p + 1)}>›</button>
            </div>
          )}
        </div>
        <div className="ai-modal-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={onApply}>应用到画布</button>
        </div>
      </div>
    </div>
  )
}
