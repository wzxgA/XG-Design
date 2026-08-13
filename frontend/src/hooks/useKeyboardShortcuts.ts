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
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** 全局快捷键：工具切换、删除、复制、撤销重做、Esc */
export function useKeyboardShortcuts({ onToolChange, onDelete, onDuplicate, onUndo, onRedo, onEscape, readOnly = false }: Options) {
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
      // 工具切换
      const toolMap: Record<string, ToolType> = { v: 'select', f: 'frame', r: 'rectangle', t: 'text', c: 'comment' }
      if (toolMap[key]) onToolChange(toolMap[key])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToolChange, onDelete, onDuplicate, onUndo, onRedo, onEscape, readOnly])
}
