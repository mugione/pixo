// Browser-side image work (keeps heavy processing off the Worker's CPU budget).

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob)
}

/** Fits the image inside max×max and returns a JPEG data URL (model requires < 512×512 inputs). */
export async function toReferenceJpeg(file: File, max = 512): Promise<string> {
  const bmp = await loadBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // flatten transparency for JPEG
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return canvas.toDataURL('image/jpeg', 0.9)
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Re-encodes to PNG or JPEG in the browser and triggers a download. */
export async function downloadAs(blob: Blob, format: 'png' | 'jpg', name: string) {
  const bmp = await loadBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')!
  if (format === 'jpg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const out = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode_failed'))), format === 'png' ? 'image/png' : 'image/jpeg', 0.92),
  )
  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.${format}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
