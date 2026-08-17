import { useState } from 'react'
import type { AiProtoLink, DesignSuggestion } from '../../types/ai'
import { DesignThumbnail, splitFrames } from './DesignThumbnail'
import { DesignPreviewModal } from './DesignPreviewModal'

interface Props {
  suggestion: DesignSuggestion
  onApply?: (layers: DesignSuggestion['parsedLayers'], links?: AiProtoLink[]) => void
}

export function DesignPreviewCard({ suggestion, onApply }: Props) {
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [page, setPage] = useState(0)
  const pages = splitFrames(suggestion.parsedLayers)
  const current = pages[Math.min(page, pages.length - 1)]

  return (
    <div className="ai-design-card">
      <div className="ai-design-thumb">
        <DesignThumbnail layers={current} width={280} height={120} />
        {pages.length > 1 && (
          <div className="ai-design-pages">
            <button className="ai-design-page-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="ai-design-page-info">{page + 1}/{pages.length}</span>
            <button className="ai-design-page-btn" disabled={page >= pages.length - 1} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        )}
      </div>
      <p className="ai-design-desc">{suggestion.description}</p>
      <div className="ai-design-actions">
        <button className="ai-btn-preview" onClick={() => setShowFullPreview(true)}>
          预览
        </button>
        <button
          className="ai-btn-apply"
          onClick={() => onApply?.(suggestion.parsedLayers, suggestion.links)}
        >
          应用到画布
        </button>
      </div>
      {showFullPreview && (
        <DesignPreviewModal
          layers={suggestion.parsedLayers}
          description={suggestion.description}
          onClose={() => setShowFullPreview(false)}
          onApply={() => {
            onApply?.(suggestion.parsedLayers, suggestion.links)
            setShowFullPreview(false)
          }}
        />
      )}
    </div>
  )
}
