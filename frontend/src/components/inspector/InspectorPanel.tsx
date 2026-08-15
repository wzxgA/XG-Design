import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { EditorState, EditorDispatch } from '../../state/editor-store'
import type { LayerNode, PrototypeLink, ComponentPropDef, ComponentState } from '../../types/design'
import { Icon } from '../common/brand'
import { PropertyInput } from './PropertyInput'
import { MIN_SIZE } from '../../utils/geometry'
import { exportPageAsPng } from '../../utils/export'
import { toCss, toJson, checkLayer } from '../../utils/inspect'
import { compressImageFile } from '../../utils/image'
import { COMPONENT_TEMPLATES, defaultProps } from '../../fixtures/component-library'
import type { ComponentTemplate } from '../../fixtures/component-library'
import { DEFAULT_CHART_COLORS } from '../../utils/chart'
import { CHART_MAX_POINTS, CHART_MAX_SERIES, CHART_MAX_COLORS, RADIUS_MAX, FONT_SIZE_MIN, FEEDBACK_DELAY } from '../../constants/limits'

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

      <Section title="连接" hint="＋">
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
      </Section>

      {links.length > 0 && (
        <Section title="已配置的连接">
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
        </Section>
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
      setTimeout(() => setCopied(null), FEEDBACK_DELAY)
    } catch { /* clipboard 不可用时静默 */ }
  }

  return (
    <div className="inspect-panel">
      <div className="selection-title">
        <span className="selection-icon"><Icon name="external" /></span>
        <div><strong>{selected.name}</strong><small>{selected.type}</small></div>
        <Icon name="chevron" />
      </div>

      <Section title="属性">
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
      </Section>

      <Section title="CSS" hint="＋">
        <pre className="code-block">{toCss(selected)}</pre>
        <button className="export-button" onClick={() => copy('css', toCss(selected))}>{copied === 'css' ? '已复制 ✓' : '复制 CSS'} <Icon name="external" /></button>
      </Section>

      <Section title="JSON" hint="＋">
        <pre className="code-block">{toJson(selected)}</pre>
        <button className="export-button" onClick={() => copy('json', toJson(selected))}>{copied === 'json' ? '已复制 ✓' : '复制 JSON'} <Icon name="external" /></button>
      </Section>

      <Section title="设计检查">
        {issues.length === 0 ? (
          <div className="inspect-ok">✓ 未发现问题</div>
        ) : (
          <ul className="issue-list">
            {issues.map((issue, i) => <li key={i} className="issue-item">⚠ {issue.message}</li>)}
          </ul>
        )}
      </Section>
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

/** 图片选择面板：本地上传（转 dataURL）或 URL 输入 */
function ImageEditor({ node, dispatch, readOnly }: { node: LayerNode; dispatch: EditorDispatch; readOnly: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [urlDraft, setUrlDraft] = useState(node.imageUrl ?? '')
  const [compressTip, setCompressTip] = useState('')
  const [uploading, setUploading] = useState(false)

  // 选中对象切换时同步 URL 草稿
  useEffect(() => {
    setUrlDraft(node.imageUrl ?? '')
    setCompressTip('')
  }, [node.id, node.imageUrl])

  const patchUrl = (v: string) => {
    const trimmed = v.trim()
    if (!trimmed) {
      dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { imageUrl: undefined } })
      return
    }
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { imageUrl: trimmed } })
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // 图片会在存入文档前自动压缩（降分辨率 + 转码），因此对原文件放宽到 20MB；
    // 超过 20MB 的原图解码/压缩会明显占用内存并卡顿，仍建议先自行压缩。
    if (file.size > 20 * 1024 * 1024) {
      alert('图片过大（>20MB），请先压缩后再上传')
      return
    }
    setUploading(true)
    setCompressTip('')
    try {
      const { dataUrl, originalBytes, compressedBytes, resized } = await compressImageFile(file)
      if (!dataUrl) return
      dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { imageUrl: dataUrl } })
      // 反馈压缩效果（未压缩时不提示）
      const savedPct = Math.round((1 - compressedBytes / originalBytes) * 100)
      if (savedPct > 0) {
        const kb = (b: number) => (b / 1024).toFixed(0)
        setCompressTip(`${resized ? '已降分辨率并压缩' : '已压缩'}：${kb(originalBytes)}KB → ${kb(compressedBytes)}KB（省 ${savedPct}%）`)
      }
    } catch {
      setCompressTip('图片处理失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="image-editor">
      {node.imageUrl ? (
        <div className="image-preview">
          <img src={node.imageUrl} alt={node.name} />
          <button className="image-remove" onClick={() => patchUrl('')} title="移除图片">✕</button>
        </div>
      ) : (
        <div className="image-empty">未设置图片</div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
      <div className="image-actions">
        <button className="export-button" onClick={() => fileRef.current?.click()} disabled={readOnly || uploading}>{uploading ? '处理中…' : '上传图片'}</button>
      </div>
      {compressTip && <div className="image-compress-tip">{compressTip}</div>}
      <div className="style-line image-url-line">
        <span className="style-label">URL</span>
        <input
          className="image-url-input"
          value={urlDraft}
          placeholder="粘贴图片地址…"
          disabled={readOnly}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={(e) => patchUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
      </div>
      <div className="style-line">
        <span className="style-label">填充方式</span>
        <select
          className="proto-select"
          disabled={readOnly}
          value={node.style.objectFit ?? 'contain'}
          onChange={(e) => dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { style: { ...node.style, objectFit: e.target.value as 'contain' | 'cover' } } })}
        >
          <option value="contain">包含（完整显示）</option>
          <option value="cover">铺满（裁剪）</option>
        </select>
      </div>
      <div className="style-line">
        <span className="style-label">圆角</span>
        <PropertyInput label="" value={node.style.cornerRadius ?? 0} min={0} max={RADIUS_MAX} disabled={readOnly} onChange={(v) => dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { style: { ...node.style, cornerRadius: v } } })} />
      </div>
    </div>
  )
}

function ChartEditor({ node, dispatch, readOnly }: { node: LayerNode; dispatch: EditorDispatch; readOnly: boolean }) {
  const bars = node.chartBars ?? []
  const series = node.chartSeries && node.chartSeries.length > 0
    ? node.chartSeries.map((s) => [...s])
    : (bars.length > 0 ? [bars] : [[50, 70, 55, 88, 62, 78]])
  const dataCount = Math.max(...series.map((s) => s.length))
  const colors = node.chartColors && node.chartColors.length > 0 ? [...node.chartColors] : [...DEFAULT_CHART_COLORS]
  const labels = node.chartLabels ?? []
  const [labelText, setLabelText] = useState(labels.join(', '))

  const patch = (p: Record<string, unknown>) => dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: p })
  const setSeries = (next: number[][]) => {
    if (next.length === 1) patch({ chartBars: next[0], chartSeries: undefined })
    else patch({ chartSeries: next })
  }
  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(CHART_MAX_POINTS, n))
    setSeries(series.map((s) => Array.from({ length: count }, (_, i) => s[i] ?? 50)))
  }
  const setSeriesCount = (n: number) => {
    const count = Math.max(1, Math.min(CHART_MAX_SERIES, n))
    const next = series.slice(0, count)
    while (next.length < count) next.push(Array.from({ length: dataCount }, () => 50))
    setSeries(next)
  }
  const setPoint = (si: number, i: number, v: number) => {
    const next = series.map((s, idx) => idx === si ? s.map((a, ai) => ai === i ? v : a) : [...s])
    setSeries(next)
  }
  const setColors = (next: string[]) => patch({ chartColors: next })
  const setLabels = (v: string) => patch({ chartLabels: v.split(/[,，]/).map((t) => t.trim()).filter(Boolean) })

  const type = node.chartType ?? 'bar'
  const isPie = type === 'pie' || type === 'donut'

  return (
    <div className="chart-editor">
      <div className="style-line">
        <span className="style-label">类型</span>
        <select className="proto-select" disabled={readOnly} value={type} onChange={(e) => patch({ chartType: e.target.value })}>
          <option value="bar">柱状图</option>
          <option value="line">折线图</option>
          <option value="area">面积图</option>
          <option value="pie">饼图</option>
          <option value="donut">环形图</option>
        </select>
      </div>

      {!isPie && (
        <div className="style-line">
          <span className="style-label">数据点</span>
          <PropertyInput label="" value={dataCount} min={1} max={CHART_MAX_POINTS} disabled={readOnly} onChange={setCount} />
        </div>
      )}
      {isPie ? (
        series[0].map((h, i) => (
          <div className="chart-bar-row" key={i}>
            <span className="chart-bar-label">{labels[i] || `项${i + 1}`}</span>
            <input type="range" min={0} max={100} disabled={readOnly} value={h} onChange={(e) => setPoint(0, i, +e.target.value)} />
            <span className="chart-bar-value">{h}</span>
          </div>
        ))
      ) : series.map((s, si) => (
        <div className="chart-series" key={si}>
          {series.length > 1 && <div className="schema-group-label">系列 {si + 1}</div>}
          {s.map((h, i) => (
            <div className="chart-bar-row" key={i}>
              <span className="chart-bar-label">{labels[i] || `柱${i + 1}`}</span>
              <input type="range" min={0} max={100} disabled={readOnly} value={h} onChange={(e) => setPoint(si, i, +e.target.value)} />
              <span className="chart-bar-value">{h}</span>
            </div>
          ))}
        </div>
      ))}
      {!isPie && (
        <div className="chart-series-actions">
          {series.length > 1 && <button className="mini-btn" disabled={readOnly} onClick={() => setSeriesCount(series.length - 1)}>− 系列</button>}
          <button className="mini-btn" disabled={readOnly} onClick={() => setSeriesCount(series.length + 1)}>＋ 系列</button>
        </div>
      )}

      <div className="schema-group-label">配色</div>
      <div className="chart-colors">
        {colors.map((c, i) => (
          <div className="chart-color-row" key={i}>
            <ColorField value={c} onChange={(v) => setColors(colors.map((cc, ci) => ci === i ? v : cc))} />
            {colors.length > 1 && !readOnly && <button className="mini-btn" onClick={() => setColors(colors.filter((_, ci) => ci !== i))}>×</button>}
          </div>
        ))}
        {!readOnly && <button className="mini-btn" onClick={() => setColors([...colors, '#6b7680'])}>＋ 颜色</button>}
      </div>

      <div className="style-line">
        <span className="style-label">标签</span>
        <input
          className="image-url-input"
          disabled={readOnly}
          value={labelText}
          placeholder="用逗号分隔"
          onChange={(e) => { setLabelText(e.target.value); setLabels(e.target.value) }}
        />
      </div>

      <label className="schema-checkbox">
        <input type="checkbox" disabled={readOnly} checked={!!node.chartShowValue} onChange={(e) => patch({ chartShowValue: e.target.checked })} />
        <span>显示数值</span>
      </label>
      <label className="schema-checkbox">
        <input type="checkbox" disabled={readOnly} checked={!!node.chartShowLegend} onChange={(e) => patch({ chartShowLegend: e.target.checked })} />
        <span>显示图例</span>
      </label>
    </div>
  )
}

/**
 * schema 驱动的组件属性表单（CO-1）。
 * 按模板 props 声明自动生成控件，变更写入 componentProps；
 * width/height 等尺寸类 prop 同时同步到节点本体，保证组件尺寸一致。
 */
function SchemaForm({ tpl, node, dispatch, readOnly }: {
  tpl: ComponentTemplate
  node: LayerNode
  dispatch: EditorDispatch
  readOnly: boolean
}) {
  const values = { ...defaultProps(tpl), ...(node.componentProps ?? {}) }
  const set = (key: string, value: unknown) => {
    const next = { ...values, [key]: value }
    const patch: Record<string, unknown> = { componentProps: next }
    if (key === 'width') patch.width = Number(value)
    if (key === 'height') patch.height = Number(value)
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch })
  }
  const renderControl = (p: ComponentPropDef) => {
    switch (p.type) {
      case 'color':
        return (
          <ColorField
            value={String(values[p.key] ?? '')}
            onChange={(v) => set(p.key, v)}
          />
        )
      case 'textarea':
        return (
          <textarea
            className="comment-textarea"
            rows={2}
            disabled={readOnly}
            value={String(values[p.key] ?? '')}
            onChange={(e) => set(p.key, e.target.value)}
          />
        )
      case 'number':
        return (
          <PropertyInput
            label=""
            value={Number(values[p.key] ?? 0)}
            min={p.min}
            max={p.max}
            step={p.step}
            disabled={readOnly}
            onChange={(v) => set(p.key, v)}
          />
        )
      case 'slider':
        return (
          <div className="style-line opacity-line">
            <input
              type="range"
              min={p.min ?? 0}
              max={p.max ?? 100}
              step={p.step ?? 1}
              disabled={readOnly}
              value={Number(values[p.key] ?? p.default ?? 0)}
              onChange={(e) => set(p.key, +e.target.value)}
            />
            <span className="style-value">{Number(values[p.key] ?? p.default ?? 0)}</span>
          </div>
        )
      case 'boolean':
        return (
          <label className="schema-checkbox">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={Boolean(values[p.key] ?? p.default ?? false)}
              onChange={(e) => set(p.key, e.target.checked)}
            />
            <span>{p.label}</span>
          </label>
        )
      case 'select':
        return (
          <select
            className="proto-select"
            disabled={readOnly}
            value={String(values[p.key] ?? '')}
            onChange={(e) => set(p.key, e.target.value)}
          >
            {(p.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )
      case 'bars': {
        // 逐项编辑：每个柱子/饼块一行（数值 + 独立颜色 + 删除），添加按钮追加并同步色板
        const colorKey = 'chartColors'
        const bars = Array.isArray(values[p.key]) ? (values[p.key] as number[]) : []
        const colors = Array.isArray(values[colorKey]) ? (values[colorKey] as string[]) : []
        const validColor = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c)
        const patchBoth = (barsNext: number[], colorsNext: string[]) => {
          const next = { ...values, [p.key]: barsNext, [colorKey]: colorsNext }
          dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { componentProps: next } })
        }
        const colorAt = (i: number) => validColor(colors[i] ?? '') ? colors[i] : DEFAULT_CHART_COLORS[i % DEFAULT_CHART_COLORS.length]
        const setBarAt = (i: number, v: number) => { const nb = [...bars]; nb[i] = v; patchBoth(nb, colors) }
        const setColorAt = (i: number, c: string) => {
          const nc = [...colors]
          while (nc.length <= i) nc.push(DEFAULT_CHART_COLORS[nc.length % DEFAULT_CHART_COLORS.length])
          nc[i] = c
          patchBoth(bars, nc)
        }
        const removeBar = (i: number) => {
          const nb = bars.filter((_, k) => k !== i)
          const nc = colors.length >= bars.length ? colors.filter((_, k) => k !== i) : colors
          patchBoth(nb, nc)
        }
        const addBar = () => {
          const idx = Math.max(bars.length, colors.length)
          patchBoth([...bars, 0], [...colors, DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length]])
        }
        return (
          <div className="schema-bars">
            {bars.length === 0 && <span className="schema-bars-empty">暂无数据，点击下方添加</span>}
            {bars.map((v, i) => (
              <div className="schema-bar-row" key={i}>
                <span className="schema-bar-idx">{i + 1}</span>
                <input
                  className="schema-bar-num"
                  type="number"
                  min={0}
                  max={100}
                  disabled={readOnly}
                  value={Number.isFinite(v) ? v : 0}
                  onChange={(e) => setBarAt(i, Number(e.target.value) || 0)}
                />
                <span className="color-chip" style={{ background: colorAt(i) }}>
                  <input
                    type="color"
                    disabled={readOnly}
                    value={colorAt(i)}
                    onChange={(e) => setColorAt(i, e.target.value)}
                  />
                </span>
                {!readOnly && bars.length > 1 && (
                  <button className="schema-bar-del" disabled={readOnly} onClick={() => removeBar(i)} title="删除该项">✕</button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button className="schema-bar-add" disabled={readOnly} onClick={addBar}>＋ 添加数据项</button>
            )}
          </div>
        )
      }
      case 'colors': {
        const arr = Array.isArray(values[p.key]) ? (values[p.key] as string[]) : []
        const valid = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c)
        return (
          <div className="schema-colors">
            {arr.map((c, i) => (
              <span key={i} className="color-chip" style={{ background: valid(c) ? c : '#eef1f2' }}>
                <input
                  type="color"
                  disabled={readOnly}
                  value={valid(c) ? c : '#4e8ff4'}
                  onChange={(e) => {
                    const next = [...arr]; next[i] = e.target.value
                    set(p.key, next)
                  }}
                />
              </span>
            ))}
            {arr.length < CHART_MAX_COLORS && (
              <button className="color-chip-add" disabled={readOnly} onClick={() => set(p.key, [...arr, '#4e8ff4'])}>＋</button>
            )}
            {arr.length > 1 && (
              <button className="color-chip-del" disabled={readOnly} onClick={() => set(p.key, arr.slice(0, -1))}>−</button>
            )}
          </div>
        )
      }
      case 'gradient': {
        const g = (values[p.key] ?? {}) as { enabled?: boolean; from?: string; to?: string; angle?: number }
        const setG = (patchG: Partial<typeof g>) => set(p.key, { ...g, ...patchG })
        return (
          <div className="schema-gradient">
            <label className="schema-checkbox">
              <input type="checkbox" disabled={readOnly} checked={!!g.enabled} onChange={(e) => setG({ enabled: e.target.checked })} />
              <span>启用渐变</span>
            </label>
            {g.enabled && (
              <div className="schema-gradient-body">
                <div className="style-line">
                  <span className="style-label">起始色</span>
                  <ColorField value={g.from ?? '#ffffff'} onChange={(v) => setG({ from: v })} />
                </div>
                <div className="style-line">
                  <span className="style-label">结束色</span>
                  <ColorField value={g.to ?? '#4e8ff4'} onChange={(v) => setG({ to: v })} />
                </div>
                <div className="style-line opacity-line">
                  <span className="style-label">角度</span>
                  <input type="range" min={0} max={360} step={1} disabled={readOnly} value={g.angle ?? 0} onChange={(e) => setG({ angle: +e.target.value })} />
                  <span className="style-value">{g.angle ?? 0}°</span>
                </div>
              </div>
            )}
          </div>
        )
      }
      case 'text':
      default:
        return (
          <input
            className="image-url-input"
            disabled={readOnly}
            value={String(values[p.key] ?? '')}
            onChange={(e) => set(p.key, e.target.value)}
          />
        )
    }
  }
  // 按 group 分组：无 group 的归入「组件」；不满足 dependsOn 条件的控件隐藏
  const groups = new Map<string, ComponentPropDef[]>()
  for (const p of tpl.props ?? []) {
    if (p.dependsOn) {
      const dep = values[p.dependsOn.key]
      if (!p.dependsOn.equals.includes(String(dep ?? ''))) continue
    }
    const g = p.group ?? '组件'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(p)
  }
  const applyTheme = (themeProps: Record<string, unknown>) => {
    const next = { ...values, ...themeProps }
    const patch: Record<string, unknown> = { componentProps: next }
    if (next.width !== undefined) patch.width = Number(next.width)
    if (next.height !== undefined) patch.height = Number(next.height)
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch })
  }
  return (
    <div className="schema-form">
      {tpl.themes && tpl.themes.length > 0 && (
        <div className="schema-themes">
          {tpl.themes.map((t) => (
            <button key={t.name} className="theme-chip" disabled={readOnly} onClick={() => applyTheme(t.props)}>{t.name}</button>
          ))}
        </div>
      )}
      {tpl.states && tpl.states.length > 0 && (
        <div className="style-line">
          <span className="style-label">状态</span>
          <select
            className="proto-select"
            disabled={readOnly}
            value={node.componentState ?? 'default'}
            onChange={(e) => dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [node.id], patch: { componentState: (e.target.value === 'default' ? undefined : e.target.value) as ComponentState | undefined } })}
          >
            <option value="default">默认</option>
            {tpl.states.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      )}
      {tpl.slots && tpl.slots.length > 0 && (
        <div className="style-line schema-slots-note">
          <span className="style-label">插槽</span>
          <em>{tpl.slots.map((s) => s.label).join('、')}</em>
        </div>
      )}
      {[...groups.entries()].map(([g, defs]) => (
        <div key={g}>
          {groups.size > 1 && <div className="schema-group-label">{g}</div>}
          {defs.map((p) => (
            <div key={p.key} className="style-line">
              <span className="style-label">{p.label}</span>
              {renderControl(p)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** 可折叠属性分区：点击标题行收起/展开（子内容用 CSS 隐藏，内部状态得以保留） */
function Section({ title, hint, className, defaultOpen = true, children }: { title: string; hint?: string; className?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`property-section collapsible${open ? '' : ' collapsed'}${className ? ` ${className}` : ''}`}>
      <div className="section-heading" onClick={() => setOpen((o) => !o)} title={open ? '点击折叠' : '点击展开'}>
        <span className="section-name"><span className="section-caret">▾</span>{title}</span>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </section>
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
  const patchChild = (childId: string, p: Partial<LayerNode> & { style?: Partial<LayerNode['style']> }) => {
    if (readOnly) return
    dispatch({ type: 'UPDATE_LAYER_PROPERTIES', ids: [childId], patch: p })
  }
  const isComponentGroup = selected?.type === 'group' && selected.children.length > 0
  const componentChildren = isComponentGroup
    ? {
        bgRect: selected.children.find((c) => c.type === 'rectangle'),
        textNodes: selected.children.filter((c) => c.type === 'text'),
      }
    : null
  // CO-1：组件 schema 模板（有 props 声明的组件用 SchemaForm，否则走旧 bgRect/textNodes 逻辑）
  const schemaTpl = selected?.component
    ? COMPONENT_TEMPLATES.find((t) => t.name === selected.component)
    : undefined
  const hasSchema = !!schemaTpl?.props?.length
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportScale, setExportScale] = useState(2)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const selectedId = selected?.id ?? ''

  // 切换选中对象 / 切换 tab 时滚动回顶部；编辑属性时位置保持不变
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = 0
    setScrolled(false)
  }, [selectedId, tab])

  const handleScroll = () => {
    const el = scrollRef.current
    if (el) setScrolled(el.scrollTop > 2)
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      await exportPageAsPng(activePage, exportScale, state.document.name)
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

      <div ref={scrollRef} className={`inspector-scroll${scrolled ? ' is-scrolled' : ''}`} onScroll={handleScroll}>
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
            <Section title="文本" hint="＋">
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
                <PropertyInput label="" value={selected.style.fontSize ?? 14} min={FONT_SIZE_MIN} disabled={readOnly} onChange={(v) => patchStyle({ fontSize: v })} />
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
            </Section>
          )}

          {selected.type === 'image' && (
            <Section title="图片" hint="＋">
              <ImageEditor node={selected} dispatch={dispatch} readOnly={readOnly} />
            </Section>
          )}

          <Section title="位置与尺寸" hint="↔">
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
          </Section>

          {hasSchema && schemaTpl ? (
            <Section title="组件" hint="＋">
              <SchemaForm tpl={schemaTpl} node={selected} dispatch={dispatch} readOnly={readOnly} />
            </Section>
          ) : (
            componentChildren && (componentChildren.bgRect || componentChildren.textNodes.length > 0) && (
            <Section title="组件" hint="＋">
              {componentChildren.bgRect && (
                <>
                  <div className="style-line">
                    <span className="style-label">背景色</span>
                    <ColorField value={componentChildren.bgRect.style.fill} allowEmpty onChange={(v) => patchChild(componentChildren.bgRect!.id, { style: { fill: v } })} />
                  </div>
                  <div className="style-line">
                    <span className="style-label">圆角</span>
                    <PropertyInput label="" value={componentChildren.bgRect.style.cornerRadius ?? 0} min={0} disabled={readOnly} onChange={(v) => patchChild(componentChildren.bgRect!.id, { style: { cornerRadius: v } })} />
                  </div>
                  <div className="style-line">
                    <span className="style-label">边框</span>
                    <ColorField value={componentChildren.bgRect.style.stroke} allowEmpty onChange={(v) => patchChild(componentChildren.bgRect!.id, { style: { stroke: v } })} />
                  </div>
                  {componentChildren.bgRect.style.stroke && (
                    <div className="style-line">
                      <span className="style-label">边框宽度</span>
                      <PropertyInput label="" value={componentChildren.bgRect.style.strokeWidth ?? 1} min={0} disabled={readOnly} onChange={(v) => patchChild(componentChildren.bgRect!.id, { style: { strokeWidth: v } })} />
                    </div>
                  )}
                </>
              )}
              {componentChildren.textNodes.map((tn, i) => (
                <div key={tn.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined, paddingTop: i > 0 ? 8 : 0 }}>
                  <div className="style-line text-content-line">
                    <span className="style-label">{componentChildren.textNodes.length > 1 ? `文字${i + 1}` : '文字'}</span>
                    <textarea
                      className="comment-textarea"
                      rows={2}
                      placeholder="输入文字…"
                      disabled={readOnly}
                      value={tn.content ?? ''}
                      onChange={(e) => patchChild(tn.id, { content: e.target.value })}
                    />
                  </div>
                  <div className="style-line">
                    <span className="style-label">文字色</span>
                    <ColorField value={tn.style.fontColor ?? tn.style.color} onChange={(v) => patchChild(tn.id, { style: { fontColor: v, color: v } })} />
                  </div>
                  <div className="style-line">
                    <span className="style-label">字号</span>
                    <PropertyInput label="" value={tn.style.fontSize ?? 14} min={FONT_SIZE_MIN} disabled={readOnly} onChange={(v) => patchChild(tn.id, { style: { fontSize: v } })} />
                  </div>
                </div>
              ))}
            </Section>
            )
          )}

          <Section title="填充" hint="＋">
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
            ) : isComponentGroup ? null : (
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
          </Section>

          {selected.type !== 'text' && !isComponentGroup && (
            <Section title="描边" hint="＋">
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
            </Section>
          )}

          <Section title="效果" hint="＋">
            <ShadowEditor value={selected.style.shadow} onChange={(v) => patchStyle({ shadow: v })} readOnly={readOnly} />
          </Section>

          {selected.type === 'chart' && (
            <Section title="图表数据" hint="＋">
              <ChartEditor node={selected} dispatch={dispatch} readOnly={readOnly} />
            </Section>
          )}

          {selected.type === 'comment' && (
            <Section title="评论" hint="＋">
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
            </Section>
          )}


        </>
      ) : (
        <div className="empty-inspector">
          <Icon name={tab === 'design' ? 'cursor' : tab === 'prototype' ? 'play' : 'external'} />
          <strong>{tab === 'design' ? '设计' : tab === 'prototype' ? '原型' : '检查'}设置</strong>
          <span>在画布或图层中选择一个对象</span>
        </div>
      )}

      {tab === 'design' && (
        <Section title="导出" hint="＋" className="export-section">
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
          <button className="export-button" onClick={handleExport} disabled={exporting}>{exporting ? '导出中…' : '导出整页'} <Icon name="external" /></button>
          {exportError && <div className="export-error">{exportError}</div>}
        </Section>
      )}
      </div>

      <div className="inspector-footer"><span>按住 <kbd>⌥</kbd> 查看间距</span><span><Icon name="lock" /> 解锁图层</span></div>
    </aside>
  )
}
