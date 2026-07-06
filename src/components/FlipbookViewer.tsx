import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import type { Issue } from '../types/issue'
import { LoadingState } from './LoadingState'
import { loadPdfMetadata, renderPdfPageToCanvas } from '../utils/pdf'
import { withBasePath } from '../utils/paths'

const FlipBook = HTMLFlipBook as unknown as React.ComponentType<any>

interface FlipbookViewerProps {
  issue: Issue
}

export const FlipbookViewer = ({ issue }: FlipbookViewerProps) => {
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [pages, setPages] = useState<string[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const [pageAspect, setPageAspect] = useState(1.414) // height/width, A4 default
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [bookSize, setBookSize] = useState({ width: 420, height: 594 })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bookRef = useRef<any>(null)
  // Keep the same DOM node for fullscreen — never create a second one
  const shellRef = useRef<HTMLElement>(null)

  const pdfUrl = useMemo(() => withBasePath(issue.pdfUrl), [issue.pdfUrl])

  // ── Calculate the right page size for the current viewport ──────────────
  const recalcSize = useCallback(
    (aspect: number, fullscreen: boolean) => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isMobile = vw < 760

      if (fullscreen) {
        // In fullscreen: try to fill the screen height, one-page width if mobile
        const usableH = vh - 120
        const pageW = isMobile
          ? Math.min(vw - 24, usableH / aspect)
          : Math.min((vw - 32) / 2, usableH / aspect)
        const pageH = Math.round(pageW * aspect)
        setBookSize({ width: Math.round(pageW), height: pageH })
      } else {
        // Normal: use the panel width, allocate half per page on desktop
        const panelW = Math.min(vw - 48, 1200)
        const maxH = vh - 320
        const pageW = isMobile
          ? Math.min(panelW - 16, maxH / aspect)
          : Math.min((panelW - 16) / 2, maxH / aspect)
        const pageH = Math.round(pageW * aspect)
        setBookSize({ width: Math.round(pageW), height: pageH })
      }
    },
    [],
  )

  useEffect(() => {
    const onResize = () => recalcSize(pageAspect, isFullscreen)
    const onFsChange = () => {
      const fs = Boolean(document.fullscreenElement)
      setIsFullscreen(fs)
      recalcSize(pageAspect, fs)
    }
    recalcSize(pageAspect, false)
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onFsChange)
    }
  }, [pageAspect, isFullscreen, recalcSize])

  // ── Load PDF pages ───────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    const isMobile = window.innerWidth < 760

    const load = async () => {
      try {
        setIsLoading(true)
        setError('')
        setPages([])
        setCurrentPage(0)

        const meta = await loadPdfMetadata(pdfUrl)
        if (!active) return
        setPageCount(meta.pageCount)

        const rendered: string[] = []
        for (let i = 1; i <= meta.pageCount; i++) {
          const result = await renderPdfPageToCanvas(pdfUrl, i, isMobile ? 1.0 : 1.5)
          if (!active) return
          rendered.push(result.imageUrl)

          // After first page, detect real aspect ratio
          if (i === 1) {
            const img = new Image()
            img.onload = () => {
              const ratio = img.naturalHeight / img.naturalWidth
              setPageAspect(ratio)
              recalcSize(ratio, false)
            }
            img.src = result.imageUrl
          }
        }
        if (active) setPages(rendered)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Error cargando PDF.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [issue.pdfUrl, pdfUrl, recalcSize, retryCount])

  // ── Navigation ───────────────────────────────────────────────────────────
  const flipNext = useCallback(() => {
    bookRef.current?.pageFlip()?.flipNext()
  }, [])

  const flipPrev = useCallback(() => {
    bookRef.current?.pageFlip()?.flipPrev()
  }, [])

  // Keyboard navigation — always active
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') flipNext()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') flipPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipNext, flipPrev])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void shellRef.current?.requestFullscreen()
    }
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const toggleAudio = async () => {
    if (!audioRef.current) return
    if (audioRef.current.paused) {
      await audioRef.current.play()
      setIsPlaying(true)
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  // ── Render states ────────────────────────────────────────────────────────
  if (isLoading) {
    return <LoadingState message="Preparando páginas del boletín..." />
  }

  if (error) {
    return (
      <section className="flipbook-shell">
        <div className="no-pdf-card">
          <div className="no-pdf-icon">📄</div>
          <h3>PDF no disponible aún</h3>
          <p>Esta edición todavía no tiene su PDF cargado. Cuando esté listo aparecerá aquí.</p>
          <p className="assistant-text" style={{ fontSize: '0.82rem', opacity: 0.7 }}>{error}</p>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            {issue.pdfUrl && (
              <a className="button button-secondary" href={pdfUrl} target="_blank" rel="noreferrer">
                ↓ Descargar PDF directamente
              </a>
            )}
            <button type="button" className="button" onClick={() => { setError(''); setRetryCount(n => n + 1) }}>
              ↺ Reintentar
            </button>
          </div>
        </div>
      </section>
    )
  }

  const displayPage = Math.min(currentPage + 1, pageCount)

  return (
    <section ref={shellRef} className="flipbook-shell">
      {/* Audio player */}
      {issue.audioUrl && (
        <div className="audio-player">
          <div>
            <p className="eyebrow">Audio de acompañamiento</p>
            <strong>Reproduce mientras lees</strong>
          </div>
          <div className="audio-controls">
            <button type="button" className="button" onClick={toggleAudio}>
              {isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={volume}
              onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volumen" />
          </div>
          <audio ref={audioRef} src={issue.audioUrl} loop />
        </div>
      )}

      {/* Toolbar */}
      <div className="flipbook-toolbar">
        <div className="flipbook-nav-btns">
          <button type="button" className="button" onClick={flipPrev}>← Anterior</button>
          <span className="flipbook-page-pill">{displayPage} / {pageCount}</span>
          <button type="button" className="button" onClick={flipNext}>Siguiente →</button>
        </div>
        <div className="flipbook-action-btns">
          <button type="button" className="button button-secondary" onClick={toggleFullscreen}>
            {isFullscreen ? '✕ Salir' : '⛶ Pantalla completa'}
          </button>
          <a className="button button-secondary" href={pdfUrl} target="_blank" rel="noreferrer">
            ↓ PDF
          </a>
        </div>
      </div>
      <p className="assistant-text" style={{ marginBottom: 8 }}>
        {isFullscreen
          ? 'Flechas del teclado para navegar · ESC para salir'
          : 'Haz clic en los bordes de las páginas para girarlas'}
      </p>

      {/* The flipbook — always rendered, same DOM node */}
      <div className="flipbook-surface">
        <FlipBook
          ref={bookRef}
          width={bookSize.width}
          height={bookSize.height}
          size="fixed"
          flippingTime={500}
          showCover={false}
          usePortrait={window.innerWidth < 760}
          className="demo-book"
          onFlip={(e: { data: number }) => setCurrentPage(e.data)}
        >
          {pages.map((src, i) => (
            <div key={`${issue.slug}-p${i}`} className="flipbook-page">
              <img src={src} alt={`Página ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </FlipBook>
      </div>
    </section>
  )
}

