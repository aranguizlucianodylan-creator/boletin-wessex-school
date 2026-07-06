import * as pdfjsLib from 'pdfjs-dist'

// Use unpkg CDN for the worker — avoids Vite bundling issues in production
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

// Cache fetched PDF bytes by URL so each page render reuses the same buffer
const pdfCache = new Map<string, ArrayBuffer>()

async function fetchPdfBytes(pdfUrl: string): Promise<ArrayBuffer> {
  // Resolve to absolute URL using the main thread's origin (same-origin, no CORS)
  const absoluteUrl = pdfUrl.startsWith('blob:') || pdfUrl.startsWith('data:')
    ? pdfUrl
    : new URL(pdfUrl, window.location.href).toString()

  if (pdfCache.has(absoluteUrl)) {
    return pdfCache.get(absoluteUrl)!
  }

  const res = await fetch(absoluteUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status} al obtener el PDF.`)
  const data = await res.arrayBuffer()
  pdfCache.set(absoluteUrl, data)
  return data
}

export const renderPdfPageToCanvas = async (
  pdfUrl: string,
  pageNumber: number,
  scale = 1.2,
) => {
  // Fetch in main thread → pass as ArrayBuffer → worker gets data via postMessage (no CORS)
  const data = await fetchPdfBytes(pdfUrl)
  const loadingTask = pdfjsLib.getDocument({ data: data.slice(0), verbosity: 0 })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('No se pudo crear el contexto del canvas.')
  }

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise

  return { imageUrl: canvas.toDataURL('image/png'), pageCount: pdf.numPages }
}

export const loadPdfMetadata = async (pdfUrl: string) => {
  const data = await fetchPdfBytes(pdfUrl)
  const loadingTask = pdfjsLib.getDocument({ data: data.slice(0), verbosity: 0 })
  const pdf = await loadingTask.promise
  return { pageCount: pdf.numPages }
}

