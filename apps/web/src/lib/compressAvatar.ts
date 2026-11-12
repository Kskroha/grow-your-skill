const MAX_EDGE = 512
const TARGET_BYTES = 180_000
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

export async function compressAvatar(file: File): Promise<Blob> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Фото слишком тяжёлое — выберите другое')
  }

  const source = await decodeImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Не получилось обработать фото')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  if ('close' in source) {
    source.close()
  }

  let quality = 0.82
  let blob = await canvasToJpeg(canvas, quality)
  while (blob.size > TARGET_BYTES && quality > 0.42) {
    quality -= 0.1
    blob = await canvasToJpeg(canvas, quality)
  }
  if (blob.size > 380_000) {
    throw new Error('Фото слишком тяжёлое — выберите другое')
  }
  return blob
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file)
  } catch {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      const url = URL.createObjectURL(file)
      image.onload = () => {
        URL.revokeObjectURL(url)
        resolve(image)
      }
      image.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Не получилось открыть фото'))
      }
      image.src = url
    })
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Не получилось сжать фото'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}
