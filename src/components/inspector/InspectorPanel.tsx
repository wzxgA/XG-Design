import { useState } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode, PrototypeLink } from '../../types/design'
import { Icon } from '../common/brand'
import { PropertyInput } from './PropertyInput'
import { MIN_SIZE } from '../../utils/geometry'
import { exportNodeAsPng } from '../../utils/export'
import { toCss, toJson, checkLayer } from '../../utils/inspect'

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

function findBoard(state: EditorState): { width: number; height: number } | undefined {
  const page = state.document.pages.find((p) => p.id === state.document.activePageId)
  const frame = page?.children.find((n) => n.type === 'frame')
  return frame ? { width: frame.width, height: frame.height } : undefined
}

function PrototypePanel({ state, dispatch, selected }: { state: EditorState; dispatch: EditorDispatch; selected: LayerNode }) {
  const links = state.document.prototypeLinks.filter((l) => l.sourceLayerId === selected.id)
  const otherPages = state.document.pages.filter((p) => p.id !== state.document.activePageId)
  const [targetPageId, setTargetPageId] = useState(otherPages[0]?.id ?? '')
  const [transition, setTransition] = useState<'instant' | 'dissolve' | 'slide'>('instant')

  const addLink = () => {
    if (!targetPageId) return
    // 避免对同一对象重复添加同一目标
    if (links.some((l) => l.targetPageId === targetPageId)) return
    const link: PrototypeLink = {
      id: `link-${Date.now().toString(36)}`,
      sourceLayerId: selected.id,
      targetPageId,
      trigger: 'click',
      transition,
    }
    dispatch({ type: 'ADD_PROTOTYPE_LINK', link })
  }

  const removeLink = (id: string) => dispatch({ type: 'REMOVE_PROTOTYPE_LINK', id })

  return (
    <div className="prototype-panel">
      <div className="selection-title">
        <span className="selection-icon"><Icon name="play" /></span>
        <div><strong>{selected.name}</strong><small>原型连接 · {links.length} 个</small></div>
        <Icon name="chevron" />
      </div>

      <section className="property-section">
        <div className="section-heading">连接 <span>＋</span></div>
        {otherPages.length === 0 ? (
          <div className="inspect-hint">没有其他页面可连接，请先新建页面。</div>
        ) : (
          <>
            <div className="proto-field">
              <label>跳转到</label>
              <select className="proto-select" value={targetPageId} onChange={(e) => setTargetPageId(e.target.value)}>
                {otherPages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="proto-field">
              <label>转场</label>
              <select className="proto-select" value={transition} onChange={(e) => setTransition(e.target.value as typeof transition)}>
                <option value="instant">无动画</option>
                <option value="dissolve">淡入</option>
                <option value="slide">滑动</option>
              </select>
            </div>
            <button className="export-button" onClick={addLink} disabled={!targetPageId}>添加跳转连接 <Icon name="plus" /></button>
          </>
        )}
      </section>

      {links.length > 0 && (
        <section className="property-section">
          <div className="section-heading">已配置的连接</div>
          {links.map((link) => {
            const target = state.document.pages.find((p) => p.id === link.targetPageId)
            return (
              <div className="link-row" key={link.id}>
                <Icon name="external" />
                <span className="link-name">→ {target?.name ?? '未知页面'}</span>
                <span className="link-meta">{link.trigger} · {link.transition}</span>
                <button className="link-remove" onClick={() => removeLink(link.id)} title="删除连接">✕</button>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

function InspectPanel({ state, selected }: { state: EditorState; selected: LayerNode }) {
  const [copied, setCopied] = useState<'css' | 'json' | null>(null)
  const board = findBoard(state)
  const issues = checkLayer(selected, board)

  const copy = async (type: 'css' | 'json', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* clipboard 不可用时静默 */ }
  }

  return (
    <div className="inspect-panel">
      <div className="selection-title">
        <span className="selection-icon"><Icon name="external" /></span>
        <div><strong>{selected.name}</strong><small>{selected.type}</small></div>
        <Icon name="chevron" />
      </div>

      <section className="property-section">
        <div className="section-heading">属性</div>
        <div className="inspect-grid">
          <div><span>类型</span><b>{selected.type}</b></div>
          <div><span>X / Y</span><b>{selected.x} / {selected.y}</b></div>
          <div><span>W / H</span><b>{selected.width} / {selected.height}</b></div>
          <div><span>填充</span><b>{selected.style.fill ?? '无'}</b></div>
          <div><span>描边</span><b>{selected.style.stroke ?? '无'}</b></div>
          <div><span>阴影</span><b>{selected.style.shadow ?? '无'}</b></div>
          {selected.type === 'text' && (
            <>
              <div><span>字体大小</span><b>{selected.style.fontSize ?? 14}px</b></div>
              <div><span>字重</span><b>{selected.style.fontWeight ?? 400}</b></div>
            </>
          )}
        </div>
      </section>

      <section className="property-section">
        <div className="section-heading">CSS <span>＋</span></div>
        <pre className="code-block">{toCss(selected)}</pre>
        <button className="export-button" onClick={() => copy('css', toCss(selected))}>{copied === 'css' ? '已复制 ✓' : '复制 CSS'} <Icon name="external" /></button>
      </section>

      <section className="property-section">
        <div className="section-heading">JSON <span>＋</span></div>
        <pre className="code-block">{toJson(selected)}</pre>
        <button className="export-button" onClick={() => copy('json', toJson(selected))}>{copied === 'json' ? '已复制 ✓' : '复制 JSON'} <Icon name="external" /></button>
      </section>

      <section className="property-section">
        <div className="section-heading">设计检查</div>
        {issues.length === 0 ? (
          <div className="inspect-ok">✓ 未发现问题</div>
        ) : (
          <ul className="issue-list">
            {issues.map((issue, i) => <li key={i} className="issue-item">⚠ {issue.message}</li>)}
          </ul>
        )}
      </section>
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
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const handleExport = async () => {
    if (!selected || exporting) return
    setExporting(true)
    setExportError('')
    try {
      await exportNodeAsPng(selected, 2)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '导出失败，请重试')
    } finally {
      setExporting(false)
    }
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

      {tab === 'prototype' && selected ? (
        <PrototypePanel state={state} dispatch={dispatch} selected={selected} />
      ) : tab === 'inspect' && selected ? (
        <InspectPanel state={state} selected={selected} />
      ) : tab === 'design' && selected ? (
        <>
          <div className="selection-title">
            <span className="selection-icon"><Icon name="layers" /></span>
            <div><strong>{selected.name}</strong><small>{selected.type} · {selected.children.length} 个图层</small></div>
            <Icon name="chevron" />
          </div>

          <section className="property-section">
            <div className="section-heading">位置与尺寸 <span>↔</span></div>
            <div className="property-grid">
              <PropertyInput label="X" value={selected.x} onChange={(v) => patch({ x: v })} />
              <PropertyInput label="Y" value={selected.y} onChange={(v) => patch({ y: v })} />
              <PropertyInput label="W" value={selected.width} min={MIN_SIZE} onChange={(v) => patch({ width: v })} />
              <PropertyInput label="H" value={selected.height} min={MIN_SIZE} onChange={(v) => patch({ height: v })} />
            </div>
            <div className="property-grid secondary">
              <PropertyInput label="↻" value={selected.rotation} onChange={(v) => patch({ rotation: v })} />
              <PropertyInput label="◒" value={selected.style.cornerRadius ?? 0} min={0} onChange={(v) => patchStyle({ cornerRadius: v })} />
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
            <button className="export-button" onClick={handleExport} disabled={exporting}>{exporting ? '导出中…' : `导出 ${selected.name}`} <Icon name="external" /></button>
            {exportError && <div className="export-error">{exportError}</div>}
          </section>
        </>
      ) : (
        <div className="empty-inspector">
          <Icon name={tab === 'design' ? 'cursor' : tab === 'prototype' ? 'play' : 'external'} />
          <strong>{tab === 'design' ? '设计' : tab === 'prototype' ? '原型' : '检查'}设置</strong>
          <span>在画布或图层中选择一个对象</span>
        </div>
      )}

      <div className="inspector-footer"><span>按住 <kbd>⌥</kbd> 查看间距</span><span><Icon name="lock" /> 解锁图层</span></div>
    </aside>
  )
}
