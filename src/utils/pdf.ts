import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

const pdfBytesCache = new Map<string, Promise<ArrayBuffer>>()
const pdfDocumentCache = new Map<string, Promise<any>>()
const renderedPageCache = new Map<string, Promise<{
  imageUrl: string
  pageCount: number
  width: number
  height: number
}>>()

const canvasToBlobUrl = (canvas: HTMLCanvasElement) =>
  new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo convertir la pagina renderizada.'))
          return
        }

        resolve(URL.createObjectURL(blob))
      },
      'image/jpeg',
      0.84,
    )
  })

async function fetchPdfBytes(pdfUrl: string): Promise<ArrayBuffer> {
  const absoluteUrl = pdfUrl.startsWith('blob:') || pdfUrl.startsWith('data:')
    ? pdfUrl
    : new URL(pdfUrl, window.location.href).toString()

  if (!pdfBytesCache.has(absoluteUrl)) {
    pdfBytesCache.set(absoluteUrl, (async () => {
      const response = await fetch(absoluteUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status} al obtener el PDF.`)
      return response.arrayBuffer()
    })())
  }

  return pdfBytesCache.get(absoluteUrl)!
}

async function getPdfDocument(pdfUrl: string) {
  const absoluteUrl = pdfUrl.startsWith('blob:') || pdfUrl.startsWith('data:')
    ? pdfUrl
    : new URL(pdfUrl, window.location.href).toString()

  if (!pdfDocumentCache.has(absoluteUrl)) {
    pdfDocumentCache.set(absoluteUrl, (async () => {
      const data = await fetchPdfBytes(absoluteUrl)
      const loadingTask = pdfjsLib.getDocument({ data: data.slice(0), verbosity: 0 })
      return loadingTask.promise
    })())
  }

  return pdfDocumentCache.get(absoluteUrl)!
}

export const renderPdfPageToCanvas = async (
  pdfUrl: string,
  pageNumber: number,
  scale = 1,
) => {
  const cacheKey = `${pdfUrl}::${pageNumber}::${scale}`

  if (!renderedPageCache.has(cacheKey)) {
    renderedPageCache.set(cacheKey, (async () => {
      const pdf = await getPdfDocument(pdfUrl)
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('No se pudo crear el contexto del canvas.')
      }

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise

      page.cleanup()
      const imageUrl = await canvasToBlobUrl(canvas)
      const width = canvas.width
      const height = canvas.height
      canvas.width = 0
      canvas.height = 0

      return {
        imageUrl,
        pageCount: pdf.numPages,
        width,
        height,
      }
    })())
  }

  return renderedPageCache.get(cacheKey)!
}

export const loadPdfMetadata = async (pdfUrl: string) => {
  const pdf = await getPdfDocument(pdfUrl)
  return { pageCount: pdf.numPages }
}
