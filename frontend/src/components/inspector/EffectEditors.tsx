import type { LayerStyle } from '../../types/design'

/**
 * v2.1 组件特效编辑器：
 * - GradientStyleEditor：style.fillGradient（线性/径向 + 多色 stops）
 * - EffectsEditor：style.effects（渐变流光/扫光/发光脉冲）
 */

interface BaseProps {
  style: LayerStyle
  readOnly: boolean
  /** 返回要 patch 到 style 的部分（只写变化的键） */
  onChange: (patch: Partial<LayerStyle>) => void
}

export function GradientStyleEditor({ style, readOnly, onChange }: BaseProps) {
  const g = style.fillGradient
  const enabled = !!g
  const type = g?.type ?? 'linear'
  // 有 stops（>=2）编辑多色，否则编辑 from/to 双色
  const list = g?.stops && g.stops.length >= 2
    ? g.stops.map((s) => ({ color: s.color, position: s.position }))
    : [{ color: g?.from ?? '#ffffff', position: 0 }, { color: g?.to ?? '#4e8ff4', position: 100 }]

  const setG = (patch: Partial<NonNullable<LayerStyle['fillGradient']>>) => {
    onChange({ fillGradient: { from: g?.from ?? '#ffffff', to: g?.to ?? '#4e8ff4', angle: g?.angle ?? 0, type, ...g, ...patch } })
  }
  const setStops = (next: { color: string; position?: number }[]) => {
    const stops = next.length >= 2 ? next : undefined
    onChange({
      fillGradient: {
        from: next[0]?.color ?? '#ffffff',
        to: next[next.length - 1]?.color ?? '#4e8ff4',
        angle: g?.angle ?? 0,
        type,
        ...(stops ? { stops } : {}),
      },
    })
  }
  const toggle = (on: boolean) => {
    if (on) onChange({ fillGradient: g ?? { from: '#ffffff', to: '#4e8ff4', angle: 0, type: 'linear' } })
    else onChange({ fillGradient: undefined })
  }

  return (
    <div className="schema-gradient">
      <label className="schema-checkbox">
        <input type="checkbox" disabled={readOnly} checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        <span>渐变背景</span>
      </label>
      {enabled && (
        <div className="schema-gradient-body">
          <div className="style-line">
            <span className="style-label">类型</span>
            <select className="proto-select" disabled={readOnly} value={type}
              onChange={(e) => setG({ type: e.target.value as 'linear' | 'radial' })}>
              <option value="linear">线性</option>
              <option value="radial">径向</option>
            </select>
          </div>
          {type === 'linear' && (
            <div className="style-line opacity-line">
              <span className="style-label">角度</span>
              <input type="range" min={0} max={360} step={1} disabled={readOnly} value={g?.angle ?? 0}
                onChange={(e) => setG({ angle: +e.target.value })} />
              <span className="style-value">{g?.angle ?? 0}°</span>
            </div>
          )}
          <div className="schema-colors" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {list.map((s, i) => (
              <div key={i} className="style-line">
                <span className="color-swatch-btn" style={{ background: s.color }} />
                <input type="color" disabled={readOnly} value={/^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : '#ffffff'}
                  onChange={(e) => {
                    const next = list.map((x, j) => (j === i ? { ...x, color: e.target.value } : x))
                    setStops(next)
                  }} />
                <input type="range" min={0} max={100} disabled={readOnly} value={s.position ?? (list.length > 1 ? Math.round((i / (list.length - 1)) * 100) : 0)}
                  onChange={(e) => {
                    const next = list.map((x, j) => (j === i ? { ...x, position: +e.target.value } : x))
                    setStops(next)
                  }} />
                <span className="style-value">{s.position ?? (list.length > 1 ? Math.round((i / (list.length - 1)) * 100) : 0)}%</span>
                {list.length > 2 && (
                  <button className="color-chip-del" disabled={readOnly}
                    onClick={() => setStops(list.filter((_, j) => j !== i))}>−</button>
                )}
              </div>
            ))}
            {list.length < 8 && (
              <button className="schema-bar-add" disabled={readOnly}
                onClick={() => setStops([...list, { color: '#4e8ff4', position: 100 }])}>＋ 添加色标</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function EffectsEditor({ style, readOnly, onChange }: BaseProps) {
  const e = style.effects
  const flow = e?.flow
  const shimmer = e?.shimmer
  const glow = e?.glow
  const setE = (patch: Partial<NonNullable<LayerStyle['effects']>>) => onChange({ effects: { ...e, ...patch } })

  return (
    <div className="schema-gradient">
      <div className="style-line">
        <span className="style-label">渐变流光</span>
        <input type="checkbox" disabled={readOnly} checked={!!flow}
          onChange={(ev) => setE(ev.target.checked ? { flow: { speed: flow?.speed ?? 3 } } : { flow: undefined })} />
      </div>
      {flow && (
        <div className="style-line opacity-line">
          <span className="style-label">速度</span>
          <input type="range" min={1} max={8} step={0.5} disabled={readOnly} value={flow.speed ?? 3}
            onChange={(ev) => setE({ flow: { speed: +ev.target.value } })} />
          <span className="style-value">{flow.speed ?? 3}s</span>
        </div>
      )}
      <div className="style-line">
        <span className="style-label">扫光</span>
        <input type="checkbox" disabled={readOnly} checked={!!shimmer}
          onChange={(ev) => setE(ev.target.checked ? { shimmer: { color: shimmer?.color ?? 'rgba(255,255,255,.35)', speed: shimmer?.speed ?? 2 } } : { shimmer: undefined })} />
      </div>
      {shimmer && (
        <div className="style-line">
          <span className="style-label">光色</span>
          <input type="color" disabled={readOnly} value={shimmer.color ?? '#ffffff'}
            onChange={(ev) => setE({ shimmer: { ...shimmer, color: ev.target.value } })} />
          <input type="range" min={1} max={8} step={0.5} disabled={readOnly} value={shimmer.speed ?? 2}
            onChange={(ev) => setE({ shimmer: { ...shimmer, speed: +ev.target.value } })} />
          <span className="style-value">{shimmer.speed ?? 2}s</span>
        </div>
      )}
      <div className="style-line">
        <span className="style-label">发光</span>
        <input type="checkbox" disabled={readOnly} checked={!!glow}
          onChange={(ev) => setE(ev.target.checked ? { glow: { color: glow?.color ?? '#4e8ff4', speed: glow?.speed ?? 2 } } : { glow: undefined })} />
      </div>
      {glow && (
        <div className="style-line">
          <span className="style-label">光色</span>
          <input type="color" disabled={readOnly} value={glow.color ?? '#4e8ff4'}
            onChange={(ev) => setE({ glow: { ...glow, color: ev.target.value } })} />
          <input type="range" min={1} max={8} step={0.5} disabled={readOnly} value={glow.speed ?? 2}
            onChange={(ev) => setE({ glow: { ...glow, speed: +ev.target.value } })} />
          <span className="style-value">{glow.speed ?? 2}s</span>
        </div>
      )}
    </div>
  )
}
