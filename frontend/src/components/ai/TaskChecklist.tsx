import type { AiProtoLink, DesignSuggestion, EditOperation, TaskItem, TaskResultItem } from '../../types/ai'
import type { LayerNode } from '../../types/design'
import { aiService } from '../../services/aiService'
import { DesignPreviewCard } from './DesignPreviewCard'
import { EditPreviewCard } from './EditPreviewCard'

interface Props {
  plan: TaskItem[]
  results: TaskResultItem[]
  /** 消息仍在流式接收中（用于标记"执行中"任务） */
  streaming: boolean
  onApplyDesign?: (layers: LayerNode[], links?: AiProtoLink[]) => void
  onApplyEdit?: (operations: EditOperation[]) => void
}

/** AI 任务清单：展示拆解出的任务 + 逐项打勾 + 每任务结果卡 + 全部应用 */
export function TaskChecklist({ plan, results, streaming, onApplyDesign, onApplyEdit }: Props) {
  const resultMap = new Map(results.map(r => [r.taskId, r]))
  const doneCount = plan.filter(t => resultMap.has(t.taskId)).length
  const firstPendingIndex = plan.findIndex(t => !resultMap.has(t.taskId))

  const applyDesign = (result: TaskResultItem) => {
    try {
      const suggestion = aiService.parseDesignSuggestion(result.content, result.description, result.linksJson)
      onApplyDesign?.(suggestion.parsedLayers, suggestion.links)
    } catch { /* skip invalid design */ }
  }

  const applyEdit = (result: TaskResultItem) => {
    try {
      const suggestion = aiService.parseEditOperations(result.content, result.description)
      onApplyEdit?.(suggestion.parsedOperations)
    } catch { /* skip invalid edit */ }
  }

  const applyAll = () => {
    // 按 generate 先、edit 后的顺序应用，保证 edit 引用的 id 已存在
    const done = plan.filter(t => resultMap.has(t.taskId))
    for (const t of done) {
      const result = resultMap.get(t.taskId)!
      if (result.kind === 'edit') applyEdit(result)
    }
    for (const t of done) {
      const result = resultMap.get(t.taskId)!
      if (result.kind === 'design') applyDesign(result)
    }
  }

  return (
    <div className="ai-task-checklist">
      <div className="ai-task-header">
        <span className="ai-task-title">任务清单</span>
        <span className="ai-task-count">{doneCount}/{plan.length}</span>
      </div>
      <ul className="ai-task-list">
        {plan.map((task, i) => {
          const result = resultMap.get(task.taskId)
          const state = result
            ? 'done'
            : streaming && i === firstPendingIndex
              ? 'running'
              : 'pending'
          return (
            <li key={task.taskId} className={`ai-task-item ai-task-${state}`}>
              <div className="ai-task-row">
                <span className="ai-task-icon">
                  {state === 'done' ? '✓' : state === 'running' ? '⟳' : '☐'}
                </span>
                <div className="ai-task-info">
                  <span className="ai-task-name">{task.title}</span>
                  {task.description && <span className="ai-task-desc">{task.description}</span>}
                </div>
              </div>
              {result && result.kind === 'design' && (
                <DesignResultCard result={result} onApply={() => applyDesign(result)} />
              )}
              {result && result.kind === 'edit' && (
                <EditResultCard result={result} onApply={() => applyEdit(result)} />
              )}
            </li>
          )
        })}
      </ul>
      {doneCount === plan.length && plan.length > 0 && (
        <div className="ai-task-actions">
          <button className="ai-btn-apply" onClick={applyAll}>全部应用</button>
        </div>
      )}
    </div>
  )
}

function DesignResultCard({ result, onApply }: { result: TaskResultItem; onApply: () => void }) {
  let suggestion: DesignSuggestion | null = null
  try {
    suggestion = aiService.parseDesignSuggestion(result.content, result.description, result.linksJson)
  } catch { /* ignore */ }
  if (!suggestion || !Array.isArray(suggestion.parsedLayers)) return null
  return <DesignPreviewCard suggestion={suggestion} onApply={onApply} />
}

function EditResultCard({ result, onApply }: { result: TaskResultItem; onApply: () => void }) {
  let operations: EditOperation[] | null = null
  try {
    operations = aiService.parseEditOperations(result.content, result.description).parsedOperations
  } catch { /* ignore */ }
  if (!operations || operations.length === 0) return null
  return (
    <EditPreviewCard
      operations={operations}
      description={result.description}
      onApply={onApply}
    />
  )
}
