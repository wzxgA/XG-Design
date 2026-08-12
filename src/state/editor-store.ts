import { useReducer } from 'react'
import type { DesignDocument, EditorState, EditorAction, ToolType } from '../types/design'
import { editorReducer } from './editor-reducer'
import { starterDocument } from '../fixtures/starter-document'

export type { EditorState, EditorAction, ToolType }

// 初始化：拷贝一份初始文档，避免共享引用被 reducer 修改
function initDocument(): DesignDocument {
  return JSON.parse(JSON.stringify(starterDocument)) as DesignDocument
}

export function createInitialState(): EditorState {
  const doc = initDocument()
  return {
    document: doc,
    selectedIds: ['grp-data-cards'],
    activeTool: 'select',
    zoom: 100,
    pan: { x: 0, y: 0 },
    leftPanelTab: 'layers',
    inspectorTab: 'design',
  }
}

export function useEditorStore() {
  return useReducer(editorReducer, undefined, createInitialState)
}

export type EditorDispatch = (action: EditorAction) => void
