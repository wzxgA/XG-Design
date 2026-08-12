import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode } from '../../types/design'
import { Icon } from '../common/brand'

interface Props {
  state: EditorState
  dispatch: EditorDispatch
}

function findLayer(root: LayerNode[], id: string): LayerNode | null {
  for (const node of root) {
    if (node.id === id) return node
    const found = findLayer(node.children, id)
    if (found) return found
  }
  return null
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="property-row">
      <label>{label}</label>
      <input
        className="property-input"
        type="number"
        value={value}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n) }}
      />
    </div>
  )
}

export function InspectorPanel({ state, dispatch }: Props) {
  const tab = state.inspectorTab
  const activePage = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const selected = findLayer(activePage.children, state.selectedIds[0] ?? '')

  const patch = (p: Partial<LayerNode>) => {
    if (!selected) return
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [selected.id], patch: p })
  }
  const patchStyle = (style: Partial<LayerNode['style']>) => {
    if (!selected) return
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [selected.id], patch: { style } })
  }

  return (
    <aside className="inspector-panel panel">
      <div className="inspector-tabs">
        {(['design', 'prototype', 'inspect'] as const).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => dispatch({ type: 'SET_INSPECTOR_TAB', tab: item })}>
            {item === 'design' ? '设计' : item === 'prototype' ? '原型' : '检查'}
          </button>
        ))}
      </div>

      {tab === 'design' && selected ? (
        <>
          <div className="selection-title">
            <span className="selection-icon"><Icon name="layers" /></span>
            <div><strong>{selected.name}</strong><small>{selected.type} · {selected.children.length} 个图层</small></div>
            <Icon name="chevron" />
          </div>

          <section className="property-section">
            <div className="section-heading">位置与尺寸 <span>↔</span></div>
            <div className="property-grid">
              <NumInput label="X" value={selected.x} onChange={(v) => patch({ x: v })} />
              <NumInput label="Y" value={selected.y} onChange={(v) => patch({ y: v })} />
              <NumInput label="W" value={selected.width} onChange={(v) => patch({ width: Math.max(1, v) })} />
              <NumInput label="H" value={selected.height} onChange={(v) => patch({ height: Math.max(1, v) })} />
            </div>
            <div className="property-grid secondary">
              <NumInput label="↻" value={selected.rotation} onChange={(v) => patch({ rotation: v })} />
              <NumInput label="◒" value={selected.style.cornerRadius ?? 0} onChange={(v) => patchStyle({ cornerRadius: v })} />
            </div>
          </section>

          <section className="property-section">
            <div className="section-heading">填充 <span>＋</span></div>
            <div className="fill-row">
              <span className="color-swatch" style={{ background: selected.style.fill ?? '#ffffff' }} />
              <span>{selected.style.fill ?? '无'}</span>
              <span className="opacity">{Math.round((selected.style.opacity ?? 1) * 100)}%</span>
              <Icon name="chevron" />
            </div>
          </section>

          <section className="property-section">
            <div className="section-heading">描边 <span>＋</span></div>
            <div className="fill-row muted"><span>—</span><span>{selected.style.stroke ?? '无'}</span></div>
          </section>

          <section className="property-section">
            <div className="section-heading">效果 <span>＋</span></div>
            <div className="effect-row"><span className="effect-icon">◒</span><span>阴影</span><span className="effect-value">{selected.style.shadow ?? '0 2 8 8%'}</span><Icon name="eye" /></div>
          </section>

          <section className="property-section export-section">
            <div className="section-heading">导出 <span>＋</span></div>
            <div className="export-row"><span>1x</span><span>PNG</span><Icon name="chevron" /></div>
            <button className="export-button">导出 {selected.name} <Icon name="external" /></button>
          </section>
        </>
      ) : (
        <div className="empty-inspector">
          <Icon name={tab === 'design' ? 'cursor' : tab === 'prototype' ? 'play' : 'external'} />
          <strong>{tab === 'design' ? '设计' : tab === 'prototype' ? '原型' : '检查'}设置</strong>
          <span>{tab === 'design' ? '在画布或图层中选择一个对象' : '选择画布中的图层后继续编辑'}</span>
        </div>
      )}

      <div className="inspector-footer"><span>按住 <kbd>⌥</kbd> 查看间距</span><span><Icon name="lock" /> 解锁图层</span></div>
    </aside>
  )
}
