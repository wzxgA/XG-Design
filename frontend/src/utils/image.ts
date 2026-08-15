/** 图片压缩与降分辨率工具（上传时转 dataURL 前调用，控制文档体积） */

export interface CompressedImage {
  /** 压缩后的 dataURL */
  dataUrl: string
  /** 原始文件字节数 */
  originalBytes: number
  /** 压缩后 dataURL 的近似字节数 */
  compressedBytes: number
  /** 是否实际发生了降分辨率 */
  resized: boolean
}

const MIME_JPEG = 'image/jpeg'
const MIME_PNG = 'image/png'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/** 采样检测 canvas 内容是否含透明像素（步长随面积自适应，控制开销） */
function detectAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const step = Math.max(1, Math.floor(Math.sqrt(w * h) / 2000))
  const data = ctx.getImageData(0, 0, w, h).data
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] < 250) return true
    }
  }
  return false
}

/**
 * 压缩本地图片：按最长边降分辨率并转码，返回 dataURL。
 * - 透明图片保持 PNG（仅降分辨率，保留 alpha）
 * - 不透明图片转 JPEG（进一步压缩，默认质量 0.82）
 * - 无需缩放且压缩后体积未减小时，退回原始文件 dataURL，避免无谓转码
 * - SVG 为矢量格式，直接返回原文件不转码
 */
export async function compressImageFile(file: File, maxDim = 2048, quality = 0.82): Promise<CompressedImage> {
  const originalBytes = file.size
  // 矢量图不栅格化，直接使用原文件
  if (file.type === 'image/svg+xml') {
    return { dataUrl: await readFileAsDataUrl(file), originalBytes, compressedBytes: originalBytes, resized: false }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const { naturalWidth: w, naturalHeight: h } = img
    const ratio = Math.min(1, maxDim / Math.max(w, h))
    const outW = Math.max(1, Math.round(w * ratio))
    const outH = Math.max(1, Math.round(h * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布上下文')

    ctx.clearRect(0, 0, outW, outH)
    ctx.drawImage(img, 0, 0, outW, outH)

    let dataUrl: string
    if (detectAlpha(ctx, outW, outH)) {
      // 含透明像素：转 PNG 保留 alpha，仅降分辨率
      dataUrl = canvas.toDataURL(MIME_PNG)
    } else {
      // 不透明：转 JPEG
      dataUrl = canvas.toDataURL(MIME_JPEG, quality)
    }

    const compressedBytes = Math.round((dataUrl.length * 3) / 4)
    // 未缩放且压缩后体积未减小：退回原文件，避免无谓转码
    if (ratio >= 1 && compressedBytes >= originalBytes) {
      return { dataUrl: await readFileAsDataUrl(file), originalBytes, compressedBytes: originalBytes, resized: false }
    }
    return { dataUrl, originalBytes, compressedBytes, resized: ratio < 1 }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
