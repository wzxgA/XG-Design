import { useEffect, useMemo, useState } from 'react'
import { Watermelon } from '../common/brand'
import { TUTORIALS, TUTORIAL_GROUPS } from './tutorialContent'
import { DemoStage } from './DemoStage'

interface Props {
  initialId?: string
  onBack: () => void
}

/**
 * 教程页：顶栏（品牌 + 标题 + 返回首页）+ 左目录（分组）+ 右内容区（说明 + 动态演示）。
 * 支持深链 #/tutorials/<id>；切换条目时右侧演示自动重放。
 */
export function TutorialPage({ initialId, onBack }: Props) {
  const [activeId, setActiveId] = useState<string>(() => {
    if (initialId && TUTORIALS.some((t) => t.id === initialId)) return initialId
    return TUTORIALS[0]?.id ?? ''
  })

  // 深链变化（浏览器前进/后退或地址栏直改）时跟随切换
  useEffect(() => {
    if (initialId && TUTORIALS.some((t) => t.id === initialId)) {
      setActiveId(initialId)
    }
  }, [initialId])

  const active = useMemo(() => TUTORIALS.find((t) => t.id === activeId) ?? TUTORIALS[0], [activeId])

  const select = (id: string) => {
    setActiveId(id)
    // 同步深链，便于分享/收藏指定教程
    window.location.hash = `#/tutorials/${id}`
  }

  return (
    <div className="tutorial-page">
      <header className="tutorial-topbar">
        <div className="tutorial-brand">
          <Watermelon />
          <strong>XG<span>Design</span></strong>
        </div>
        <div className="tutorial-topbar-title">使用教程</div>
        <button className="tutorial-back" onClick={onBack} title="返回项目列表">← 返回首页</button>
      </header>

      <div className="tutorial-layout">
        <nav className="tutorial-nav">
          {TUTORIAL_GROUPS.map((g) => {
            const items = TUTORIALS.filter((t) => t.group === g.id)
            if (items.length === 0) return null
            return (
              <div key={g.id} className="tutorial-group">
                <div className="tutorial-group-label">{g.label}</div>
                {items.map((t) => (
                  <button
                    key={t.id}
                    className={`tutorial-nav-item${t.id === active?.id ? ' active' : ''}`}
                    onClick={() => select(t.id)}
                    title={t.summary}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )
          })}
        </nav>

        <main className="tutorial-content">
          {active && (
            <>
              <div className="tutorial-head">
                <h2 className="tutorial-title">{active.title}</h2>
                <p className="tutorial-summary">{active.summary}</p>
                {active.points && active.points.length > 0 && (
                  <ul className="tutorial-points">
                    {active.points.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
              </div>
              <div className="tutorial-demo">
                {/* key=id 强制切换条目时重建 DemoStage（useState 仅在挂载时初始化场景，复用实例会导致所有演示显示同一场景） */}
                <DemoStage key={active.id} demo={active.demo} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
