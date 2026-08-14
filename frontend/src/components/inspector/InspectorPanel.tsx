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
  readOnly?: boolean
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

function PrototypePanel({ state, dispatch, selected, readOnly }: { state: EditorState; dispatch: EditorDispatch; selected: LayerNode; readOnly: boolean }) {
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
        ) : readOnly ? (
          <div className="inspect-hint">只读模式下不可编辑原型连接。</div>
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
                {!readOnly && <button className="link-remove" onClick={() => removeLink(link.id)} title="删除连接">✕</button>}
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

const SWATCHES = [
  '#000000', '#ffffff', '#f4b400', '#4e8ff4', '#34a853', '#ea4335',
  '#9c27b0', '#5c6b72', '#e5ebef', '#1a73e8', '#dadce0', '#188038',
  '#ff7043', '#7e57c2', '#26a69a', '#78909c',
]

function ColorField({ value, onChange, allowEmpty }: { value: string | undefined; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const [open, setOpen] = useState(false)
  const v = value ?? ''
  return (
    <div className="color-field">
      <button
        className="color-swatch-btn"
        style={v ? { background: v } : { background: 'linear-gradient(135deg,#fff 0,#fff 45%,#ea4335 45%,#ea4335 55%,#fff 55%)' }}
        onClick={() => setOpen((o) => !o)}
        title={v || '无填充'}
      />
      <input className="hex-input" value={v} placeholder="无" onChange={(e) => onChange(e.target.value)} />
      {allowEmpty && v && <button className="color-clear" onClick={() => onChange('')} title="清除">✕</button>}
      {open && (
        <div className="color-popover">
          {SWATCHES.map((c) => (
            <button key={c} className="swatch-cell" style={{ background: c }} onClick={() => { onChange(c); setOpen(false) }} />
          ))}
        </div>
      )}
    </div>
  )
}

function parseShadow(s?: string) {
  const def = { x: 0, y: 2, blur: 8, color: 'rgba(0,0,0,0.15)' }
  if (!s) return def
  const m = s.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(.+)/)
  if (!m) return def
  return { x: Number(m[1]), y: Number(m[2]), blur: Number(m[3]), color: m[4].trim() }
}
function buildShadow(p: { x: number; y: number; blur: number; color: string }) {
  return `${p.x}px ${p.y}px ${p.blur}px ${p.color}`
}

function ShadowEditor({ value, onChange, readOnly }: { value: string | undefined; onChange: (v: string) => void; readOnly: boolean }) {
  const [open, setOpen] = useState(false)
  const p = parseShadow(value)
  const set = (k: 'x' | 'y' | 'blur' | 'color', val: number | string) => onChange(buildShadow({ ...p, [k]: val }))
  return (
    <div className="expandable">
      <button className="fill-row" onClick={() => setOpen((o) => !o)} disabled={readOnly}>
        <span className="effect-icon">◒</span>
        <span>阴影</span>
        <span className="effect-value">{value ? `${p.x}/${p.y}/${p.blur}` : '无'}</span>
        <Icon name={open ? 'chevron' : 'chevron'} />
      </button>
      {open && !readOnly && (
        <div className="expand-body">
          <div className="property-grid">
            <PropertyInput label="X" value={p.x} onChange={(v) => set('x', v)} />
            <PropertyInput label="Y" value={p.y} onChange={(v) => set('y', v)} />
            <PropertyInput label="模糊" value={p.blur} min={0} onChange={(v) => set('blur', v)} />
          </div>
          <div className="style-line">
            <span className="style-label">颜色</span>
            <ColorField value={p.color} onChange={(v) => set('color', v)} />
          </div>
        </div>
      )}
    </div>
  )
}

function ChartEditor({ node, dispatch, readOnly }: { node: LayerNode; dispatch: EditorDispatch; readOnly: boolean }) {
  const bars = node.chartBars ?? []
  const setBars = (next: number[]) => dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { chartBars: next } })
  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(12, n))
    const next = Array.from({ length: count }, (_, i) => bars[i] ?? 50)
    setBars(next)
  }
  return (
    <div className="chart-editor">
      <div className="style-line">
        <span className="style-label">柱数</span>
        <PropertyInput label="" value={bars.length} min={1} max={12} disabled={readOnly} onChange={setCount} />
      </div>
      {!readOnly && bars.map((h, i) => (
        <div className="chart-bar-row" key={i}>
          <span className="chart-bar-label">柱{i + 1}</span>
          <input type="range" min={0} max={100} value={h} onChange={(e) => { const next = [...bars]; next[i] = +e.target.value; setBars(next) }} />
          <span className="chart-bar-value">{h}</span>
        </div>
      ))}
    </div>
  )
}

export function InspectorPanel({ state, dispatch, readOnly = false }: Props) {
  const tab = state.inspectorTab
  const activePage = state.document.pages.find((p) => p.id === state.document.activePageId)!
  const selected = findLayer(activePage.children, state.selectedIds[0] ?? '')

  const patch = (p: Partial<LayerNode>) => {
    if (!selected || readOnly) return
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [selected.id], patch: p })
  }
  const patchStyle = (style: Partial<LayerNode['style']>) => {
    if (!selected || readOnly) return
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [selected.id], patch: { style } })
  }
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportScale, setExportScale] = useState(2)

  const handleExport = async () => {
    if (!selected || exporting) return
    setExporting(true)
    setExportError('')
    try {
      await exportNodeAsPng(selected, exportScale)
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
        <PrototypePanel state={state} dispatch={dispatch} selected={selected} readOnly={readOnly} />
      ) : tab === 'inspect' && selected ? (
        <InspectPanel state={state} selected={selected} />
      ) : tab === 'design' && selected ? (
        <>
          <div className="selection-title">
            <span className="selection-icon"><Icon name="layers" /></span>
            <div><strong>{selected.name}</strong><small>{selected.type} · {selected.children.length} 个图层</small></div>
            <Icon name="chevron" />
          </div>

          {selected.type === 'text' && (
            <section className="property-section">
              <div className="section-heading">文本 <span>＋</span></div>
              <div className="style-line text-content-line">
                <span className="style-label">内容</span>
                <textarea
                  className="comment-textarea"
                  rows={3}
                  placeholder="输入文本内容…"
                  disabled={readOnly}
                  value={selected.content ?? ''}
                  onChange={(e) => patch({ content: e.target.value, name: e.target.value ? e.target.value.slice(0, 12) : '文本' })}
                />
              </div>
              <div className="style-line">
                <span className="style-label">字号</span>
                <PropertyInput label="" value={selected.style.fontSize ?? 14} min={8} disabled={readOnly} onChange={(v) => patchStyle({ fontSize: v })} />
              </div>
              <div className="style-line">
                <span className="style-label">字重</span>
                <select className="proto-select" value={selected.style.fontWeight ?? 400} disabled={readOnly}
                  onChange={(e) => patchStyle({ fontWeight: +e.target.value })}>
                  <option value={300}>细体 300</option>
                  <option value={400}>常规 400</option>
                  <option value={500}>中等 500</option>
                  <option value={600}>半粗 600</option>
                  <option value={700}>粗体 700</option>
                </select>
              </div>
            </section>
          )}

          <section className="property-section">
            <div className="section-heading">位置与尺寸 <span>↔</span></div>
            <div className="property-grid">
              <PropertyInput label="X" value={selected.x} disabled={readOnly} onChange={(v) => patch({ x: v })} />
              <PropertyInput label="Y" value={selected.y} disabled={readOnly} onChange={(v) => patch({ y: v })} />
              <PropertyInput label="W" value={selected.width} min={MIN_SIZE} disabled={readOnly} onChange={(v) => patch({ width: v })} />
              <PropertyInput label="H" value={selected.height} min={MIN_SIZE} disabled={readOnly} onChange={(v) => patch({ height: v })} />
            </div>
            <div className="property-grid secondary">
              <PropertyInput label="↻" value={selected.rotation} disabled={readOnly} onChange={(v) => patch({ rotation: v })} />
              <PropertyInput label="◒" value={selected.style.cornerRadius ?? 0} min={0} disabled={readOnly} onChange={(v) => patchStyle({ cornerRadius: v })} />
            </div>
          </section>

          <section className="property-section">
            <div className="section-heading">填充 <span>＋</span></div>
            {selected.type === 'frame' ? (
              <div className="style-line">
                <span className="style-label">背景</span>
                <ColorField value={selected.style.backgroundColor ?? selected.style.fill} allowEmpty onChange={(v) => patchStyle({ backgroundColor: v, fill: v })} />
              </div>
            ) : selected.type === 'text' ? (
              <div className="style-line">
                <span className="style-label">字体色</span>
                <ColorField value={selected.style.fontColor ?? selected.style.color} onChange={(v) => patchStyle({ fontColor: v, color: v })} />
              </div>
            ) : (
              <div className="style-line">
                <span className="style-label">填充</span>
                <ColorField value={selected.style.fill} allowEmpty onChange={(v) => patchStyle({ fill: v })} />
              </div>
            )}
            <div className="style-line opacity-line">
              <span className="style-label">透明度</span>
              <input type="range" min={0} max={100} value={Math.round((selected.style.opacity ?? 1) * 100)} disabled={readOnly}
                onChange={(e) => patchStyle({ opacity: +e.target.value / 100 })} />
              <span className="style-value">{Math.round((selected.style.opacity ?? 1) * 100)}%</span>
            </div>
          </section>

          {selected.type !== 'text' && (
            <section className="property-section">
              <div className="section-heading">描边 <span>＋</span></div>
              <div className="style-line">
                <span className="style-label">颜色</span>
                <ColorField value={selected.style.stroke} allowEmpty onChange={(v) => patchStyle({ stroke: v })} />
              </div>
              {selected.style.stroke && (
                <div className="style-line">
                  <span className="style-label">宽度</span>
                  <PropertyInput label="" value={selected.style.strokeWidth ?? 1} min={0} disabled={readOnly} onChange={(v) => patchStyle({ strokeWidth: v })} />
                </div>
              )}
            </section>
          )}

          <section className="property-section">
            <div className="section-heading">效果 <span>＋</span></div>
            <ShadowEditor value={selected.style.shadow} onChange={(v) => patchStyle({ shadow: v })} readOnly={readOnly} />
          </section>

          {selected.type === 'chart' && (
            <section className="property-section">
              <div className="section-heading">图表数据 <span>＋</span></div>
              <ChartEditor node={selected} dispatch={dispatch} readOnly={readOnly} />
            </section>
          )}

          {selected.type === 'comment' && (
            <section className="property-section">
              <div className="section-heading">评论 <span>＋</span></div>
              <textarea className="comment-textarea" value={selected.content ?? ''} rows={3} placeholder="输入评论内容…"
                onChange={(e) => patch({ content: e.target.value, name: e.target.value ? e.target.value.slice(0, 12) : '评论' })} />
              {(selected.replies ?? []).length > 0 && (
                <div className="reply-list">
                  {(selected.replies ?? []).map((r) => (
                    <div className="reply-item" key={r.id}>
                      <span className="reply-author">{r.author}</span>
                      <span className="reply-content">{r.content}</span>
                      {!readOnly && <button className="reply-remove" onClick={() => dispatch({ type: 'DELETE_COMMENT_REPLY', commentId: selected.id, replyId: r.id })}>✕</button>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}


          <section className="property-section export-section">
            <div className="section-heading">导出 <span>＋</span></div>
            <div className="export-row">
              <span className="export-format">PNG</span>
              <div className="export-scale-group">
                {([1, 2, 3] as const).map((s) => (
                  <button
                    key={s}
                    className={`export-scale-btn ${exportScale === s ? 'active' : ''}`}
                    onClick={() => setExportScale(s)}
                    title={`导出 ${s}x 倍图`}
                  >{s}x</button>
                ))}
              </div>
            </div>
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
