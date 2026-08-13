import type { LayerNode } from '../types/design'

/** 将单个图层节点渲染为 HTML 片段（用于离屏导出） */
function renderNode(node: LayerNode): HTMLElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = '0px'
  el.style.top = '0px'
  el.style.width = `${node.width}px`
  el.style.height = `${node.height}px`
  el.style.boxSizing = 'border-box'
  if (node.style.opacity !== undefined) el.style.opacity = String(node.style.opacity)

  switch (node.type) {
    case 'rectangle':
      el.style.background = node.style.fill ?? 'transparent'
      if (node.style.cornerRadius) el.style.borderRadius = `${node.style.cornerRadius}px`
      if (node.style.stroke) el.style.border = `${node.style.strokeWidth ?? 1}px solid ${node.style.stroke}`
      if (node.style.shadow) el.style.boxShadow = node.style.shadow
      break
    case 'text':
      el.style.color = node.style.color ?? '#5c6b72'
      el.style.fontSize = `${node.style.fontSize ?? 14}px`
      el.style.fontWeight = String(node.style.fontWeight ?? 400)
      el.style.fontFamily = "'DM Sans', 'Microsoft YaHei', sans-serif"
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.whiteSpace = 'nowrap'
      el.style.overflow = 'hidden'
      el.textContent = node.content ?? node.name
      break
    case 'comment':
      el.textContent = '💬'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.fontSize = '16px'
      break
    case 'chart': {
      const bars = node.chartBars ?? []
      if (bars.length > 0) {
        const max = Math.max(...bars, 1)
        const wrapper = document.createElement('div')
        wrapper.style.display = 'flex'
        wrapper.style.alignItems = 'flex-end'
        wrapper.style.gap = '3px'
        wrapper.style.width = '100%'
        wrapper.style.height = '100%'
        wrapper.style.padding = '2px'
        for (const h of bars) {
          const bar = document.createElement('i')
          bar.style.flex = '1'
          bar.style.height = `${(h / max) * 100}%`
          bar.style.background = 'linear-gradient(to top, #bcd9fb, #68a0f5)'
          bar.style.borderRadius = '2px 2px 0 0'
          wrapper.appendChild(bar)
        }
        el.appendChild(wrapper)
      }
      break
    }
    case 'group':
    case 'frame':
      node.children.forEach((child) => {
        const childEl = renderNode(child)
        childEl.style.left = `${child.x}px`
        childEl.style.top = `${child.y}px`
        el.appendChild(childEl)
      })
      if (node.style.fill) el.style.background = node.style.fill
      break
  }
  return el
}

/** 将图层节点导出为 PNG 并触发下载 */
export async function exportNodeAsPng(node: LayerNode, scale = 2): Promise<void> {
  const width = Math.max(1, Math.round(node.width * scale))
  const height = Math.max(1, Math.round(node.height * scale))

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-99999px'
  container.style.top = '-99999px'
  container.style.width = `${node.width}px`
  container.style.height = `${node.height}px`
  container.style.overflow = 'hidden'
  container.appendChild(renderNode(node))
  document.body.appendChild(container)

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('viewBox', `0 0 ${node.width} ${node.height}`)
  const xmlns = 'http://www.w3.org/1999/xhtml'
  const foreign = document.createElementNS(xmlns, 'foreignObject')
  foreign.setAttribute('width', '100%')
  foreign.setAttribute('height', '100%')
  foreign.appendChild(container)
  svg.appendChild(foreign)

  // 注意：foreignObject.appendChild(container) 已把 container 从 body 移动到 SVG，
  // 因此之后用 container.remove() 清理，而不能 document.body.removeChild(container)。
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('导出图片加载失败'))
    img.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.fillStyle = node.type === 'frame' ? (node.style.fill ?? '#ffffff') : '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  container.remove()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('生成图片失败')
  if (!blob) return

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${node.name}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
