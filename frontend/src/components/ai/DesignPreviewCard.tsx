import { useState } from 'react'
import type { DesignSuggestion } from '../../types/ai'
import { DesignThumbnail } from './DesignThumbnail'
import { DesignPreviewModal } from './DesignPreviewModal'

interface Props {
  suggestion: DesignSuggestion
  onApply?: (layers: DesignSuggestion['parsedLayers']) => void
}

export function DesignPreviewCard({ suggestion, onApply }: Props) {
  const [showFullPreview, setShowFullPreview] = useState(false)

  return (
    <div className="ai-design-card">
      <div className="ai-design-thumb">
        <DesignThumbnail layers={suggestion.parsedLayers} width={280} height={120} />
      </div>
      <p className="ai-design-desc">{suggestion.description}</p>
      <div className="ai-design-actions">
        <button className="ai-btn-preview" onClick={() => setShowFullPreview(true)}>
          预览
        </button>
        <button
          className="ai-btn-apply"
          onClick={() => onApply?.(suggestion.parsedLayers)}
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
            onApply?.(suggestion.parsedLayers)
            setShowFullPreview(false)
          }}
        />
      )}
    </div>
  )
}
