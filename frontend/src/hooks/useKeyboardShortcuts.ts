import { useEffect } from 'react'
import type { EditorDispatch, ToolType } from '../state/editor-store'

interface Options {
  onToolChange: (tool: ToolType) => void
  onDelete: () => void
  onDuplicate: () => void
  onUndo: () => void
  onRedo: () => void
  onEscape: () => void
  /** 只读模式：禁用删除/复制/撤销/重做及工具切换（保留 Esc） */
  readOnly?: boolean
  /** 分组（⌘⌥G）/ 取消分组（⌘⇧G） */
  onGroup?: () => void
  onUngroup?: () => void
  /** 图层顺序（[ / ]） */
  onReorder?: (direction: 'forward' | 'backward') => void
  /** 缩放（+/-/0/1） */
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomFit?: () => void
  onZoom100?: () => void
  /** 聚焦图层搜索（⌘F） */
  onSearch?: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** 全局快捷键：工具切换、删除、复制、撤销重做、分组、顺序、缩放、搜索、Esc */
export function useKeyboardShortcuts({
  onToolChange, onDelete, onDuplicate, onUndo, onRedo, onEscape,
  readOnly = false, onGroup, onUngroup, onReorder, onZoomIn, onZoomOut, onZoomFit, onZoom100, onSearch,
}: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return

      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // Esc（只读时也保留，用于退出预览/弹窗）
      if (key === 'escape') {
        onEscape()
        return
      }

      // 只读模式：屏蔽一切修改类快捷键
      if (readOnly) return

      // 撤销 / 重做
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
        return
      }
      // 复制
      if (mod && key === 'd') {
        e.preventDefault()
        onDuplicate()
        return
      }
      // 删除
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        onDelete()
        return
      }
      // 分组 / 取消分组（⌘⌥G / ⌘⇧G）
      if (mod && e.altKey && key === 'g') {
        e.preventDefault()
        if (e.shiftKey) onUngroup?.()
        else onGroup?.()
        return
      }
      // 图层顺序：[ 后移一层 / ] 前移一层
      if (key === '[' || key === ']') {
        e.preventDefault()
        onReorder?.(key === ']' ? 'forward' : 'backward')
        return
      }
      // 搜索聚焦（⌘F）
      if (mod && key === 'f') {
        e.preventDefault()
        onSearch?.()
        return
      }
      // 缩放
      if (!mod && (key === '+' || key === '=')) { onZoomIn?.(); return }
      if (!mod && key === '-') { onZoomOut?.(); return }
      if (!mod && key === '0') { onZoomFit?.(); return }
      if (!mod && key === '1') { onZoom100?.(); return }

      // 工具切换
      const toolMap: Record<string, ToolType> = { v: 'select', f: 'frame', r: 'rectangle', p: 'pen', t: 'text', c: 'comment' }
      if (toolMap[key]) onToolChange(toolMap[key])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToolChange, onDelete, onDuplicate, onUndo, onRedo, onEscape, readOnly, onGroup, onUngroup, onReorder, onZoomIn, onZoomOut, onZoomFit, onZoom100, onSearch])
}
