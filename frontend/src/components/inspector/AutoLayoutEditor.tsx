import type { Dispatch, ReactNode } from 'react'
import type { AutoLayout, DesignDocument, EditorAction, LayerNode } from '../../types/design'
import { PropertyInput } from './PropertyInput'
import { defaultAutoLayout } from '../../utils/layout'

interface Props {
  /** 当前选中的容器节点（frame/group）或其子项 */
  node: LayerNode
  document: DesignDocument
  readOnly: boolean
  patch: (p: Partial<LayerNode>) => void
  patchChild: (childId: string, p: Partial<LayerNode> & { style?: Partial<LayerNode['style']> }) => void
  dispatch: Dispatch<EditorAction>
}

const DIRECTIONS: { key: 'horizontal' | 'vertical' | null; label: string; title: string }[] = [
  { key: null, label: '无', title: '关闭自动布局' },
  { key: 'horizontal', label: '↔', title: '水平排列' },
  { key: 'vertical', label: '↕', title: '垂直排列' },
]

const ALIGN_OPTS: { key: AutoLayout['align']; label: string; title: string }[] = [
  { key: 'start', label: '⤒', title: '起点' },
  { key: 'center', label: '⤓', title: '居中' },
  { key: 'end', label: '⤓', title: '终点' },
  { key: 'stretch', label: '⇕', title: '拉伸' },
]

const JUSTIFY_OPTS: { key: AutoLayout['justify']; label: string; title: string }[] = [
  { key: 'start', label: '⊞', title: '起点' },
  { key: 'center', label: '⊟', title: '居中' },
  { key: 'end', label: '⊠', title: '终点' },
  { key: 'space-between', label: '≡', title: '两端对齐' },
  { key: 'space-around', label: '⋮', title: '均匀分布' },
]

function findParentNode(root: LayerNode[], id: string): LayerNode | null {
  for (const n of root) {
    if (n.children.some((c) => c.id === id)) return n
    const found = findParentNode(n.children, id)
    if (found) return found
  }
  return null
}

/**
 * Auto Layout 检视面板：
 * - 选中容器（frame/group）→ 配置方向/间距/内边距/对齐/分布/固定尺寸
 * - 选中容器内子项 → 显示「填充剩余空间」开关
 */
export function AutoLayoutEditor({ node, document, readOnly, patch, patchChild }: Props) {
  const activePage = document.pages.find((p) => p.id === document.activePageId)
  const parent = activePage ? findParentNode(activePage.children, node.id) : null
  const parentHasAL = !!parent?.autoLayout

  // 子项：填充剩余空间（layoutGrow）
  if (parentHasAL) {
    const grow = node.layoutGrow === true
    return (
      <Section title="自动布局">
        <div className="style-line">
          <span className="style-label">填充剩余空间</span>
          <button
            className={`mini-switch ${grow ? 'on' : ''}`}
            disabled={readOnly}
            onClick={() => patchChild(node.id, { layoutGrow: !grow })}
          >
            {grow ? '开' : '关'}
          </button>
        </div>
      </Section>
    )
  }

  // 仅 frame/group 容器可配置（组件整体不接入，避免回归）
  if (node.type !== 'frame' && node.type !== 'group') return null
  if (node.component) return null

  const al = node.autoLayout
  const setAL = (next: Partial<AutoLayout>) => {
    if (readOnly) return
    patch({ autoLayout: { ...(al ?? defaultAutoLayout('vertical')), ...next } })
  }
  const removeAL = () => {
    if (readOnly) return
    patch({ autoLayout: undefined })
  }

  return (
    <Section title="自动布局">
      <div className="al-row al-row-direction">
        <span className="style-label">布局</span>
        <div className="seg-group">
          {DIRECTIONS.map((d) => (
            <button
              key={d.key ?? 'none'}
              className={`seg-btn ${al?.direction === d.key ? 'active' : ''}`}
              title={d.title}
              disabled={readOnly}
              onClick={() => (d.key ? setAL({ direction: d.key }) : removeAL())}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {al && (
        <>
          <div className="style-line">
            <span className="style-label">间距</span>
            <PropertyInput label="" value={al.gap} min={0} max={200} disabled={readOnly} onChange={(v) => setAL({ gap: v })} />
          </div>

          <div className="style-line">
            <span className="style-label">内边距</span>
            <PropertyInput label="T" value={al.paddingTop} min={0} max={200} disabled={readOnly} onChange={(v) => setAL({ paddingTop: v })} />
            <PropertyInput label="R" value={al.paddingRight} min={0} max={200} disabled={readOnly} onChange={(v) => setAL({ paddingRight: v })} />
          </div>
          <div className="style-line">
            <span className="style-label" />
            <PropertyInput label="B" value={al.paddingBottom} min={0} max={200} disabled={readOnly} onChange={(v) => setAL({ paddingBottom: v })} />
            <PropertyInput label="L" value={al.paddingLeft} min={0} max={200} disabled={readOnly} onChange={(v) => setAL({ paddingLeft: v })} />
          </div>

          <div className="style-line">
            <span className="style-label">对齐</span>
            <div className="seg-group">
              {ALIGN_OPTS.map((o) => (
                <button key={o.key} className={`seg-btn ${al.align === o.key ? 'active' : ''}`} title={o.title} disabled={readOnly} onClick={() => setAL({ align: o.key })}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="style-line">
            <span className="style-label">分布</span>
            <div className="seg-group">
              {JUSTIFY_OPTS.map((o) => (
                <button key={o.key} className={`seg-btn ${al.justify === o.key ? 'active' : ''}`} title={o.title} disabled={readOnly} onClick={() => setAL({ justify: o.key })}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="style-line">
            <span className="style-label">尺寸</span>
            <button className={`mini-switch ${al.mainFixed ? 'on' : ''}`} disabled={readOnly} onClick={() => setAL({ mainFixed: !al.mainFixed })}>
              {al.mainFixed ? '固定' : '自适应'}
            </button>
          </div>
        </>
      )}
    </Section>
  )
}

/** 轻量 Section（与 InspectorPanel 内部 Section 一致的折叠样式） */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="property-section collapsible">
      <div className="section-heading">
        <span className="section-name"><span className="section-caret">▾</span>{title}</span>
      </div>
      {children}
    </section>
  )
}
