import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DesignDocument, EditorState, LayerNode } from '../../types/design'
import { CanvasObject } from '../canvas/CanvasObject'
import { DemoPlayer } from './DemoPlayer'
import type { TutorialEntry } from './tutorialContent'

const noop = () => {}

/** 递归在场景树中按 id 查找节点 */
function findNode(nodes: LayerNode[], id: string): LayerNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return undefined
}

/** 深度更新场景树中 id 节点的部分字段（componentProps 做合并） */
function patchTree(nodes: LayerNode[], id: string, patch: Record<string, unknown>): LayerNode[] {
  return nodes.map((n) => {
    if (n.id === id) {
      const next = { ...n, ...patch } as LayerNode
      if (patch.componentProps && n.componentProps) {
        next.componentProps = { ...n.componentProps, ...patch.componentProps }
      }
      return next
    }
    if (n.children && n.children.length > 0) {
      return { ...n, children: patchTree(n.children, id, patch) }
    }
    return n
  })
}

/** 构建 CanvasObject 渲染所需的最小只读 EditorState */
function buildMinimalState(scene: LayerNode[]): EditorState {
  const doc: DesignDocument = {
    id: 'demo',
    name: '演示',
    activePageId: 'p',
    updatedAt: 0,
    pages: [{ id: 'p', name: '演示页', children: scene }],
    prototypeLinks: [],
  }
  return {
    document: doc,
    selectedIds: [],
    activeTool: 'select',
    zoom: 100,
    pan: { x: 0, y: 0 },
    leftPanelTab: 'layers',
    inspectorTab: 'design',
    history: { past: [], future: [] },
  }
}

interface Props {
  demo: TutorialEntry['demo']
}

/**
 * 教程演示区：用真实画布渲染（CanvasObject 只读 passive 模式）承载演示场景，
 * 交给 DemoPlayer 按脚本自动播放动画效果；右下角提供「重放」按钮。
 */
export function DemoStage({ demo }: Props) {
  const [scene, setScene] = useState<LayerNode[]>(() => JSON.parse(JSON.stringify(demo.scene())))
  const [playerKey, setPlayerKey] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  const updateNode = useCallback((id: string, patch: Record<string, unknown>) => {
    setScene((prev) => patchTree(prev, id, patch))
  }, [])
  const getNode = useCallback((id: string) => findNode(sceneRef.current, id), [])

  const state = useMemo(() => buildMinimalState(scene), [scene])

  const frameW = Math.max(...scene.map((f) => f.width), 260)
  const frameH = Math.max(...scene.map((f) => f.height), 200)
  const stageW = demo.width ?? frameW + 72
  const stageH = demo.height ?? frameH + 72

  // 挂载 / 条目切换 / 重放：新建播放器并自动播放（useLayoutEffect 防首帧堆叠闪烁）
  useLayoutEffect(() => {
    const stageEl = stageRef.current
    if (!stageEl) return
    const player = new DemoPlayer({ stage: stageEl, getNode, updateNode })
    player.prime()
    player.run(demo.script)
    return () => player.stop()
  }, [demo, playerKey, getNode, updateNode])

  const replay = useCallback(() => setPlayerKey((k) => k + 1), [])

  return (
    <div className="demo-stage-wrap">
      <div
        className="demo-stage"
        ref={stageRef}
        style={{ width: stageW, height: stageH }}
      >
        {scene.map((f) => (
          <div
            key={f.id}
            data-demo-frame={f.id}
            className="demo-frame"
            style={{
              left: (stageW - f.width) / 2,
              top: (stageH - f.height) / 2,
              width: f.width,
              height: f.height,
            }}
          >
            <CanvasObject node={{ ...f, x: 0, y: 0 }} state={state} dispatch={noop} drawing readOnly passive />
          </div>
        ))}
        <div className="demo-backdrop" />
      </div>
      <button className="demo-replay" onClick={replay} title="重新播放演示">⟳ 重放</button>
    </div>
  )
}
