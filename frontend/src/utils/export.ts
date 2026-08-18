import type { DesignDocument, LayerNode, PageNode } from '../types/design'
import { isComponentNode } from './layers'
import { backgroundCss } from './style'
import { pathToSvgD } from './path'
import { renderComponentChildren } from '../fixtures/component-library'
import { renderChartSvg } from './chart'
import { MUTED } from '../constants/colors'

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
      el.style.background = backgroundCss(node.style) ?? 'transparent'
      if (node.style.cornerRadius) el.style.borderRadius = `${node.style.cornerRadius}px`
      if (node.style.stroke) el.style.border = `${node.style.strokeWidth ?? 1}px solid ${node.style.stroke}`
      if (node.style.shadow) el.style.boxShadow = node.style.shadow
      break
    case 'text':
      el.style.color = node.style.fontColor ?? node.style.color ?? MUTED
      el.style.fontSize = `${node.style.fontSize ?? 14}px`
      el.style.fontWeight = String(node.style.fontWeight ?? 400)
      el.style.fontFamily = "'DM Sans', 'Microsoft YaHei', sans-serif"
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = node.style.textAlign === 'center' ? 'center' : node.style.textAlign === 'right' ? 'flex-end' : 'flex-start'
      el.style.textAlign = node.style.textAlign ?? 'left'
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
      const svg = renderChartSvg(node)
      if (svg) {
        const wrapper = document.createElement('div')
        wrapper.style.width = '100%'
        wrapper.style.height = '100%'
        wrapper.innerHTML = svg
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
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', pathToSvgD(pts, node.pathClosed))
        path.setAttribute('fill', node.style.fill ?? 'none')
        path.setAttribute('stroke', node.style.stroke ?? '#4e8ff4')
        path.setAttribute('stroke-width', String(node.style.strokeWidth ?? 2))
        path.setAttribute('stroke-linejoin', 'round')
        path.setAttribute('stroke-linecap', 'round')
        svg.appendChild(path)
        el.appendChild(svg)
      }
      break
    }
    case 'image': {
      // 未设置图片时保留背景占位色（统一 backgroundCss 优先级）
      if (!node.imageUrl) el.style.background = backgroundCss(node.style) ?? '#eef2f4'
      if (node.style.cornerRadius) {
        el.style.borderRadius = `${node.style.cornerRadius}px`
        el.style.overflow = 'hidden'
      }
      if (node.imageUrl) {
        const img = document.createElement('img')
        img.src = node.imageUrl
        img.alt = node.name
        img.style.width = '100%'
        img.style.height = '100%'
        img.style.objectFit = node.style.objectFit ?? 'contain'
        img.style.display = 'block'
        el.appendChild(img)
      }
      break
    }
    case 'group':
    case 'frame': {
      const isComp = isComponentNode(node)
      // 组件优先用 componentProps + 模板 render 实时计算子节点（fallback 到落盘的 node.children）
      // 导出始终使用 default 态，不受编辑态/预览演示态影响
      const children = isComp ? (renderComponentChildren(node, 'default') ?? node.children) : node.children
      children.forEach((child) => {
        const childEl = renderNodeToHtml(child)
        if (!childEl) return
        childEl.style.left = `${child.x}px`
        childEl.style.top = `${child.y}px`
        el.appendChild(childEl)
      })
      // 组件节点自身不画背景（与画布一致，视觉由模板 render 子节点承担）；非组件容器补画
      if (!isComp) {
        const bg = backgroundCss(node.style)
        if (bg) el.style.background = bg
      }
      break
    }
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

/** 公共渲染管线：HTML → SVG foreignObject → Canvas（离屏，不触发下载） */
async function renderHtmlToCanvas(
  content: HTMLElement,
  width: number,
  height: number,
  scale: number,
  background: string,
): Promise<HTMLCanvasElement> {
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
  return canvas
}

/** 公共渲染管线：HTML → SVG foreignObject → Canvas → PNG Blob */
async function renderHtmlToPng(
  content: HTMLElement,
  width: number,
  height: number,
  scale: number,
  background: string,
): Promise<Blob> {
  const canvas = await renderHtmlToCanvas(content, width, height, scale, background)
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

/**
 * 离屏渲染页面为 PNG Blob（纯函数：不触发下载，供单页 / 批量导出复用）。
 * 与编辑器共用 renderNodeToHtml / renderHtmlToPng 渲染管线，保证所见即所得。
 * 页面无可见内容时抛出「没有可导出的内容」。
 */
export async function renderPageOffscreen(page: PageNode, scale: number): Promise<Blob> {
  const visibleNodes = page.children.filter((n) => n.visible)
  if (visibleNodes.length === 0) throw new Error(`页面「${page.name}」没有可导出的内容`)
  const bounds = computeBounds(visibleNodes)
  if (!bounds) throw new Error(`页面「${page.name}」没有可导出的内容`)

  const pageEl = buildPageElement(visibleNodes, bounds)
  return renderHtmlToPng(pageEl, bounds.width, bounds.height, scale, pageBackground(visibleNodes))
}

/** 组装页面离屏元素：可见顶层节点按包围盒原点重定位到同一容器 */
function buildPageElement(visibleNodes: LayerNode[], bounds: Bounds): HTMLElement {
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
  return pageEl
}

/** 页面背景：有 frame 以 frame 背景色为准，无 frame 时白色 */
function pageBackground(visibleNodes: LayerNode[]): string {
  const firstFrame = visibleNodes.find((n) => n.type === 'frame')
  return firstFrame ? (firstFrame.style.backgroundColor ?? firstFrame.style.fill ?? '#ffffff') : '#ffffff'
}

/** 项目卡片封面缩略图默认输出宽度（px），约为卡片缩略区宽度的 2 倍 */
export const THUMBNAIL_MAX_WIDTH = 400

/**
 * 渲染页面第一屏为 JPEG dataURL 缩略图（供项目卡片封面展示）。
 * 复用 renderHtmlToCanvas 离屏渲染管线，与编辑器所见即所得。
 * - 页面无可见内容时返回 null（调用方保留占位图标）
 * - 宽边按 maxWidth 等比缩小，最小倍率 1 保证不放大失真
 * - JPEG quality 0.7 在清晰度与体积（约 15–40KB）间取得平衡
 */
export async function renderPageThumbnail(page: PageNode, maxWidth = THUMBNAIL_MAX_WIDTH): Promise<string | null> {
  const visibleNodes = page.children.filter((n) => n.visible)
  if (visibleNodes.length === 0) return null
  const bounds = computeBounds(visibleNodes)
  if (!bounds) return null

  const pageEl = buildPageElement(visibleNodes, bounds)
  const scale = Math.min(1, maxWidth / bounds.width)
  const canvas = await renderHtmlToCanvas(pageEl, bounds.width, bounds.height, scale, pageBackground(visibleNodes))
  return canvas.toDataURL('image/jpeg', 0.7)
}

/** 文件系统安全清洗（与 exportProject.sanitizeFileName 规则一致，避免反向依赖） */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '-').trim()
  return cleaned.length > 0 ? cleaned : 'untitled'
}

/** 将当前活动页面的全部可见顶层节点导出为 PNG（导出整页） */
export async function exportPageAsPng(page: PageNode, scale: number, docName: string): Promise<void> {
  const blob = await renderPageOffscreen(page, scale)
  triggerDownload(blob, `${safeFileName(docName)}-${safeFileName(page.name)}-@${scale}x.png`)
}

/**
 * 批量导出文档全部页面为 PNG（导出项目 → 全部页面）。
 * 逐页离屏渲染 + 逐张下载；空页面/渲染失败自动跳过；
 * onProgress 在每页处理后回调，用于界面进度提示（index 从 1 开始）。
 * @returns 成功导出的页数
 */
export async function exportDocumentPagesAsPng(
  doc: DesignDocument,
  scale: number,
  onProgress?: (index: number, total: number, pageName: string) => void,
): Promise<number> {
  const total = doc.pages.length
  let exported = 0
  for (let i = 0; i < total; i += 1) {
    const page = doc.pages[i]
    try {
      const blob = await renderPageOffscreen(page, scale)
      triggerDownload(blob, `${safeFileName(doc.name)}-${safeFileName(page.name)}-@${scale}x.png`)
      exported += 1
    } catch {
      // 空页面等渲染失败跳过，通过 onProgress / 返回值提示
    }
    onProgress?.(i + 1, total, page.name)
  }
  return exported
}
