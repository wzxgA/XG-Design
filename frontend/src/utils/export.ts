import type { LayerNode, PageNode } from '../types/design'

/**
 * 将单个图层节点渲染为 HTML 片段（用于离屏导出）。
 * 隐藏节点返回 null，调用方在遍历时过滤。
 */
function renderNodeToHtml(node: LayerNode): HTMLElement | null {
  if (!node.visible) return null
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = '0px'
  el.style.top = '0px'
  el.style.width = `${node.width}px`
  el.style.height = `${node.height}px`
  el.style.boxSizing = 'border-box'
  if (node.style.opacity !== undefined) el.style.opacity = String(node.style.opacity)
  if (node.rotation) el.style.transform = `rotate(${node.rotation}deg)`

  switch (node.type) {
    case 'rectangle':
      el.style.background = node.style.fill ?? 'transparent'
      if (node.style.cornerRadius) el.style.borderRadius = `${node.style.cornerRadius}px`
      if (node.style.stroke) el.style.border = `${node.style.strokeWidth ?? 1}px solid ${node.style.stroke}`
      if (node.style.shadow) el.style.boxShadow = node.style.shadow
      break
    case 'text':
      el.style.color = node.style.fontColor ?? node.style.color ?? '#5c6b72'
      el.style.fontSize = `${node.style.fontSize ?? 14}px`
      el.style.fontWeight = String(node.style.fontWeight ?? 400)
      el.style.fontFamily = "'DM Sans', 'Microsoft YaHei', sans-serif"
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.textAlign = 'center'
      el.style.lineHeight = '1.2'
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
    case 'path': {
      const pts = node.points ?? []
      if (pts.length >= 2) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', String(node.width))
        svg.setAttribute('height', String(node.height))
        svg.setAttribute('viewBox', `0 0 ${node.width} ${node.height}`)
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
        poly.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '))
        poly.setAttribute('fill', 'none')
        poly.setAttribute('stroke', node.style.stroke ?? '#4e8ff4')
        poly.setAttribute('stroke-width', String(node.style.strokeWidth ?? 2))
        poly.setAttribute('stroke-linejoin', 'round')
        poly.setAttribute('stroke-linecap', 'round')
        svg.appendChild(poly)
        el.appendChild(svg)
      }
      break
    }
    case 'group':
    case 'frame':
      node.children.forEach((child) => {
        const childEl = renderNodeToHtml(child)
        if (!childEl) return
        childEl.style.left = `${child.x}px`
        childEl.style.top = `${child.y}px`
        el.appendChild(childEl)
      })
      // 画板背景：backgroundColor 优先于 fill
      const bg = node.style.backgroundColor ?? node.style.fill
      if (bg) el.style.background = bg
      break
  }
  return el
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** 计算一组顶层节点旋转后的包围盒（AABB 并集）；隐藏节点不参与 */
function computeBounds(nodes: LayerNode[]): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    if (!node.visible) continue
    const rad = (node.rotation * Math.PI) / 180
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))
    const halfW = (node.width * cos + node.height * sin) / 2
    const halfH = (node.width * sin + node.height * cos) / 2
    const cx = node.x + node.width / 2
    const cy = node.y + node.height / 2
    minX = Math.min(minX, cx - halfW)
    minY = Math.min(minY, cy - halfH)
    maxX = Math.max(maxX, cx + halfW)
    maxY = Math.max(maxY, cy + halfH)
  }
  if (!isFinite(minX)) return null
  // 多画板边界留 1px 冗余，避免抗锯齿裁切
  return {
    x: Math.floor(minX) - 1,
    y: Math.floor(minY) - 1,
    width: Math.ceil(maxX - minX) + 2,
    height: Math.ceil(maxY - minY) + 2,
  }
}

/** 输出像素上限，超出自动降倍率，避免大画板 @3x 内存溢出 */
const MAX_OUTPUT_PIXELS = 4096 * 4096

/** 公共渲染管线：HTML → SVG foreignObject → Canvas → PNG Blob */
async function renderHtmlToPng(
  content: HTMLElement,
  width: number,
  height: number,
  scale: number,
  background: string,
): Promise<Blob> {
  let outW = Math.max(1, Math.round(width * scale))
  let outH = Math.max(1, Math.round(height * scale))
  if (outW * outH > MAX_OUTPUT_PIXELS) {
    const ratio = Math.sqrt(MAX_OUTPUT_PIXELS / (width * height))
    outW = Math.max(1, Math.round(width * ratio))
    outH = Math.max(1, Math.round(height * ratio))
    console.warn(`[export] 导出尺寸过大，已自动降倍率至 ${(outW / width).toFixed(1)}x`)
  }

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '0px'
  container.style.top = '0px'
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  container.style.overflow = 'hidden'
  container.appendChild(content)

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(outW))
  svg.setAttribute('height', String(outH))
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
  foreign.setAttribute('width', '100%')
  foreign.setAttribute('height', '100%')
  foreign.appendChild(container)
  svg.appendChild(foreign)

  // container 直接作为 foreignObject 子节点序列化（无需挂载到 body，避免页面上闪现）；
  // 序列化时 Chrome 会自动为容器加上 xhtml 命名空间，确保 SVG 内 HTML 可解析。
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('导出图片加载失败'))
    img.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(img, 0, 0, outW, outH)

  container.remove()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('生成图片失败')
  return blob
}

/** 触发浏览器下载 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 将图层节点导出为 PNG 并触发下载（导出选中） */
export async function exportNodeAsPng(node: LayerNode, scale = 2): Promise<void> {
  const el = renderNodeToHtml(node)
  if (!el) throw new Error('所选图层已被隐藏，无法导出')
  const background = node.type === 'frame' ? (node.style.backgroundColor ?? node.style.fill ?? '#ffffff') : '#ffffff'
  const blob = await renderHtmlToPng(el, node.width, node.height, scale, background)
  triggerDownload(blob, `${node.name}.png`)
}

/** 将当前活动页面的全部可见顶层节点导出为 PNG（导出整页） */
export async function exportPageAsPng(page: PageNode, scale: number, docName: string): Promise<void> {
  const visibleNodes = page.children.filter((n) => n.visible)
  if (visibleNodes.length === 0) throw new Error('当前页面没有可导出的内容')
  const bounds = computeBounds(visibleNodes)
  if (!bounds) throw new Error('当前页面没有可导出的内容')

  // 背景：有 frame 以 frame 背景色为准，无 frame 时白色
  const firstFrame = visibleNodes.find((n) => n.type === 'frame')
  const background = firstFrame ? (firstFrame.style.backgroundColor ?? firstFrame.style.fill ?? '#ffffff') : '#ffffff'

  const pageEl = document.createElement('div')
  pageEl.style.position = 'absolute'
  pageEl.style.left = '0px'
  pageEl.style.top = '0px'
  pageEl.style.width = `${bounds.width}px`
  pageEl.style.height = `${bounds.height}px`
  for (const node of visibleNodes) {
    const el = renderNodeToHtml(node)
    if (!el) continue
    el.style.left = `${node.x - bounds.x}px`
    el.style.top = `${node.y - bounds.y}px`
    pageEl.appendChild(el)
  }

  const blob = await renderHtmlToPng(pageEl, bounds.width, bounds.height, scale, background)
  triggerDownload(blob, `${docName}-${page.name}-@${scale}x.png`)
}
