import type { DesignDocument, PageNode } from '../types/design'

let counter = 0
function uid(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

const pages: PageNode[] = [
  { id: 'page-1', name: '页面 1', children: [] },
]

export const starterDocument: DesignDocument = {
  id: uid('doc'),
  name: '未命名设计稿',
  pages,
  activePageId: 'page-1',
  prototypeLinks: [],
  updatedAt: Date.now(),
}
