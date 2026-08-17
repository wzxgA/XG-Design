import type { AutoLayout, LayerNode } from '../types/design'

/**
 * Auto Layout 数据层重排引擎。
 *
 * 对带 autoLayout 的 frame/group 计算每个子节点的新位置/尺寸（hug 后父尺寸、FILL 子项拉伸、
 * space-between/around 空白分配、stretch 交叉轴拉伸），返回待写回的数据变更。
 * 纯函数：不改入参，返回全新对象。无 autoLayout 或空 children 返回 null。
 */

export interface LayoutResult {
  /** 重排后的子节点数组（新坐标/尺寸已写入） */
  children: LayerNode[]
  /** hug 后父节点尺寸（仅未固定主轴方向时提供） */
  width?: number
  height?: number
}

export function applyAutoLayout(node: LayerNode): LayoutResult | null {
  const al = node.autoLayout
  if (!al || !node.children || node.children.length === 0) return null
  const isH = al.direction === 'horizontal'
  const n = node.children.length

  // 主轴/交叉轴长度访问
  const main = (c: LayerNode) => (isH ? c.width : c.height)
  const cross = (c: LayerNode) => (isH ? c.height : c.width)
  const padMainStart = isH ? al.paddingLeft : al.paddingTop
  const padMainEnd = isH ? al.paddingRight : al.paddingBottom
  const padCrossStart = isH ? al.paddingTop : al.paddingLeft
  const padCrossEnd = isH ? al.paddingBottom : al.paddingRight
  const parentMain = isH ? node.width : node.height
  const parentCross = isH ? node.height : node.width
  const crossAvail = Math.max(0, parentCross - padCrossStart - padCrossEnd)

  // ---- 主轴空间 ----
  const mainFixed = al.mainFixed === true
  const gap = al.gap
  // 固定（非 grow）子项在主轴的和
  const fixedMainSum = node.children
    .filter((c) => !c.layoutGrow)
    .reduce((s, c) => s + main(c), 0)
  const growCount = node.children.filter((c) => c.layoutGrow).length
  // 可用主轴空间：固定父 → 父尺寸；hug → 内容自适应（全部子项自身尺寸 + 间距，无剩余给 grow/space）
  const availableMain = mainFixed
    ? Math.max(0, parentMain - padMainStart - padMainEnd)
    : node.children.reduce((s, c) => s + main(c), 0) + gap * Math.max(0, n - 1)

  // grow 子项平均分配剩余空间（仅固定父尺寸时有剩余；hug 时不拉伸，保持自身尺寸）
  let growMain: number | undefined
  if (growCount > 0 && mainFixed) {
    const remaining = availableMain - fixedMainSum - gap * Math.max(0, n - 1)
    growMain = Math.max(0, remaining / growCount)
  }

  // 主轴分布：space-between / space-around 时重算间距（仅在固定父且有剩余时生效）
  let mainGap = gap
  const distribute = al.justify === 'space-between' || al.justify === 'space-around'
  if (distribute && growCount === 0 && mainFixed) {
    const sum = node.children.reduce((s, c) => s + main(c), 0)
    const extra = availableMain - sum
    if (al.justify === 'space-between') {
      mainGap = n > 1 ? extra / (n - 1) : 0
    } else {
      mainGap = n > 0 ? extra / n : 0
    }
    mainGap = Math.max(0, mainGap)
  }

  // ---- 逐子项定位 ----
  const children: LayerNode[] = []
  let cursor = padMainStart
  for (let i = 0; i < n; i++) {
    const c = node.children[i]
    const grow = c.layoutGrow && growMain !== undefined ? growMain : main(c)
    // 主轴位置（space-around 时每项前附加半个 gap）
    let mainPos = cursor
    if (distribute && al.justify === 'space-around') mainPos += mainGap / 2

    // 交叉轴位置与尺寸
    let crossPos: number
    let crossSize: number
    if (al.align === 'stretch') {
      crossPos = padCrossStart
      crossSize = crossAvail
    } else {
      crossSize = cross(c)
      if (al.align === 'center') {
        crossPos = padCrossStart + (crossAvail - crossSize) / 2
      } else if (al.align === 'end') {
        crossPos = padCrossStart + crossAvail - crossSize
      } else {
        crossPos = padCrossStart
      }
    }

    const x = isH ? mainPos : crossPos
    const y = isH ? crossPos : mainPos
    const width = isH ? grow : crossSize
    const height = isH ? crossSize : grow
    children.push({ ...c, x, y, width, height })

    cursor += grow + mainGap
  }

  // ---- hug：未固定主轴方向时父尺寸随内容 ----
  const contentMain = availableMain + padMainStart + padMainEnd
  const result: LayoutResult = { children }
  if (!mainFixed) {
    if (isH) result.width = contentMain
    else result.height = contentMain
  }
  return result
}

/** 构造默认 Auto Layout 配置 */
export function defaultAutoLayout(direction: 'horizontal' | 'vertical'): AutoLayout {
  return {
    direction,
    gap: 12,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    align: 'start',
    justify: 'start',
    mainFixed: false,
  }
}
