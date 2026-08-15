import type { LayerNode } from '../../types/design'
import { DesignThumbnail } from './DesignThumbnail'

interface Props {
  layers: LayerNode[]
  description: string
  onClose: () => void
  onApply: () => void
}

export function DesignPreviewModal({ layers, description, onClose, onApply }: Props) {
  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        <div className="ai-modal-header">
          <span className="ai-modal-title">{description}</span>
          <button className="ai-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="ai-modal-body">
          <DesignThumbnail layers={layers} width={600} height={400} />
        </div>
        <div className="ai-modal-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={onApply}>应用到画布</button>
        </div>
      </div>
    </div>
  )
}
