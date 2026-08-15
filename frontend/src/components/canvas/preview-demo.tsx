import { createContext, useContext } from 'react'

/** 预览演示态（CO-4）：悬停/按下组件时临时覆盖其交互状态；交互模式下保存组件交互值（内存，退出预览丢弃） */
export interface PreviewDemoState {
  enabled: boolean
  hoveredId: string | null
  pressedId: string | null
  /** 预览态交互值（key = layerId）：输入框文字 / 开关状态 / 下拉、单选选中项 */
  values: Record<string, unknown>
  /** 更新某个组件的预览态交互值 */
  onValue: (id: string, value: unknown) => void
}

export const PreviewDemoContext = createContext<PreviewDemoState>({
  enabled: false,
  hoveredId: null,
  pressedId: null,
  values: {},
  onValue: () => {},
})

export const usePreviewDemo = () => useContext(PreviewDemoContext)
