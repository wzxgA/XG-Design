import { createContext, useContext } from 'react'

/** 预览演示态（CO-4）：悬停/按下组件时临时覆盖其交互状态 */
export interface PreviewDemoState {
  enabled: boolean
  hoveredId: string | null
  pressedId: string | null
}

export const PreviewDemoContext = createContext<PreviewDemoState>({ enabled: false, hoveredId: null, pressedId: null })

export const usePreviewDemo = () => useContext(PreviewDemoContext)
