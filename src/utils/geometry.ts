// 画布几何计算工具

export const MIN_SIZE = 1

export type ResizeHandle =
  | 'n' | 's' | 'e' | 'w'
  | 'ne' | 'nw' | 'se' | 'sw'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 根据拖拽手柄方向与位移计算新的矩形。
 * @param handle 手柄方向（n/s/e/w 及组合）
 * @param start 拖拽起始矩形
 * @param dx 相对位移（未缩放画布坐标）
 * @param dy 相对位移（未缩放画布坐标）
 * @param min 最小宽高
 */
export function resizeRect(handle: ResizeHandle, start: Rect, dx: number, dy: number, min = MIN_SIZE): Rect {
  let { x, y, width, height } = start
  let newX = x
  let newY = y

  const moveLeft = handle.includes('w')
  const moveRight = handle.includes('e')
  const moveUp = handle.includes('n')
  const moveDown = handle.includes('s')

  if (moveRight) width = Math.max(min, start.width + dx)
  if (moveLeft) {
    newX = Math.min(start.x + start.width - min, start.x + dx)
    width = Math.max(min, start.width - dx)
  }
  if (moveDown) height = Math.max(min, start.height + dy)
  if (moveUp) {
    newY = Math.min(start.y + start.height - min, start.y + dy)
    height = Math.max(min, start.height - dy)
  }

  return { x: newX, y: newY, width, height }
}

/** 将相对手柄的缩放换算进矩形：保持对侧锚点不动 */
export function clampRectToParent(rect: Rect, parent: Rect): Rect {
  return {
    x: Math.max(parent.x, Math.min(rect.x, parent.x + parent.width - MIN_SIZE)),
    y: Math.max(parent.y, Math.min(rect.y, parent.y + parent.height - MIN_SIZE)),
    width: Math.max(MIN_SIZE, Math.min(rect.width, parent.width)),
    height: Math.max(MIN_SIZE, Math.min(rect.height, parent.height)),
  }
}
