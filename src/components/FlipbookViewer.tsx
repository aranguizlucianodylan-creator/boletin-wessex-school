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
  const [loadedPages, setLoadedPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [pages, setPages] = useState<string[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const [pageAspect, setPageAspect] = useState(1.414)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [bookSize, setBookSize] = useState({ width: 420, height: 594 })
  const [isMobileLayout, setIsMobileLayout] = useState(window.innerWidth < 900)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bookRef = useRef<any>(null)
  const shellRef = useRef<HTMLElement>(null)

  const pdfUrl = useMemo(() => withBasePath(issue.pdfUrl), [issue.pdfUrl])
  const displayPage = Math.min(currentPage + 1, pageCount || 1)
  const canFlipPrev = currentPage > 0
  const canFlipNext = currentPage < Math.max(pages.length - 1, 0)
  const isStillRendering = loadedPages > 0 && loadedPages < pageCount

  const recalcSize = useCallback(
    (aspect: number, fullscreen: boolean) => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const mobileLayout = viewportWidth < 900
      const spreadPages = mobileLayout ? 1 : 2
      const horizontalPadding = fullscreen ? 32 : 40
      const verticalChrome = fullscreen ? 132 : 240
      const usableWidth = Math.max(viewportWidth - horizontalPadding, 260)
      const usableHeight = Math.max(viewportHeight - verticalChrome, 280)
      const pageWidth = Math.floor(
        Math.min(
          usableWidth / spreadPages,
          usableHeight / aspect,
        ),
      )

      setIsMobileLayout(mobileLayout)
      setBookSize({
        width: Math.max(pageWidth, 180),
        height: Math.max(Math.round(pageWidth * aspect), 250),
      })
    },
    [],
  )

  useEffect(() => {
    const onResize = () => recalcSize(pageAspect, isFullscreen)
    const onFullscreenChange = () => {
      const fullscreen = Boolean(document.fullscreenElement)
      setIsFullscreen(fullscreen)
      recalcSize(pageAspect, fullscreen)
    }

    recalcSize(pageAspect, false)
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [isFullscreen, pageAspect, recalcSize])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setIsLoading(true)
        setError('')
        setPages([])
        setPageCount(0)
        setLoadedPages(0)
        setCurrentPage(0)

        const metadata = await loadPdfMetadata(pdfUrl)
        if (!active) return

        setPageCount(metadata.pageCount)

        const renderedPages: string[] = []
        const initialVisiblePages = window.innerWidth < 900 ? 1 : Math.min(2, metadata.pageCount)
        const renderScale = window.innerWidth < 900 ? 1 : 1.18

        for (let pageNumber = 1; pageNumber <= metadata.pageCount; pageNumber += 1) {
          const result = await renderPdfPageToCanvas(pdfUrl, pageNumber, renderScale)
          if (!active) return

          renderedPages.push(result.imageUrl)
          setPages([...renderedPages])
          setLoadedPages(renderedPages.length)

          if (pageNumber === 1) {
            const image = new Image()
            image.onload = () => {
              const ratio = image.naturalHeight / image.naturalWidth
              setPageAspect(ratio)
              recalcSize(ratio, Boolean(document.fullscreenElement))
            }
            image.src = result.imageUrl
          }

          if (pageNumber >= initialVisiblePages) {
            setIsLoading(false)
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Error cargando PDF.')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [pdfUrl, recalcSize, retryCount])

  const flipNext = useCallback(() => {
    if (!canFlipNext) return
    bookRef.current?.pageFlip()?.flipNext()
  }, [canFlipNext])

  const flipPrev = useCallback(() => {
    if (!canFlipPrev) return
    bookRef.current?.pageFlip()?.flipPrev()
  }, [canFlipPrev])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') flipNext()
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') flipPrev()
      if (event.key === 'Escape' && document.fullscreenElement) {
        void document.exitFullscreen()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [flipNext, flipPrev])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    if (shellRef.current?.requestFullscreen) {
      await shellRef.current.requestFullscreen()
    }
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const toggleAudio = async () => {
    if (!audioRef.current) return

    if (audioRef.current.paused) {
      await audioRef.current.play()
      setIsPlaying(true)
      return
    }

    audioRef.current.pause()
    setIsPlaying(false)
  }

  if (isLoading) {
    return <LoadingState message="Preparando primeras paginas del boletin..." />
  }

  if (error) {
    return (
      <section className="flipbook-shell">
        <div className="no-pdf-card">
          <div className="no-pdf-icon">PDF</div>
          <h3>PDF no disponible aun</h3>
          <p>Esta edicion todavia no tiene su PDF cargado. Cuando este listo aparecera aqui.</p>
          <p className="assistant-text" style={{ fontSize: '0.82rem', opacity: 0.7 }}>{error}</p>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            {issue.pdfUrl && (
              <a className="button button-secondary" href={pdfUrl} target="_blank" rel="noreferrer">
                Descargar PDF directamente
              </a>
            )}
            <button
              type="button"
              className="button"
              onClick={() => {
                setError('')
                setRetryCount((count) => count + 1)
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      ref={shellRef}
      className={`flipbook-shell ${isFullscreen ? 'flipbook-shell--fullscreen' : ''}`}
    >
      {issue.audioUrl && (
        <div className="audio-player">
          <div>
            <p className="eyebrow">Audio de acompanamiento</p>
            <strong>Reproduce mientras lees</strong>
          </div>
          <div className="audio-controls">
            <button type="button" className="button" onClick={toggleAudio}>
              {isPlaying ? 'Pausar' : 'Reproducir'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volumen"
            />
          </div>
          <audio ref={audioRef} src={issue.audioUrl} loop />
        </div>
      )}

      <div className="flipbook-toolbar">
        <div className="flipbook-nav-btns">
          <button type="button" className="button" onClick={flipPrev} disabled={!canFlipPrev}>
            ← Anterior
          </button>
          <span className="flipbook-page-pill">{displayPage} / {pageCount}</span>
          <button type="button" className="button" onClick={flipNext} disabled={!canFlipNext}>
            Siguiente →
          </button>
        </div>
        <div className="flipbook-action-btns">
          <button type="button" className="button button-secondary" onClick={toggleFullscreen}>
            {isFullscreen ? 'Salir' : 'Pantalla completa'}
          </button>
          <a className="button button-secondary" href={pdfUrl} target="_blank" rel="noreferrer">
            PDF
          </a>
        </div>
      </div>

      <div className="flipbook-meta-row">
        <p className="assistant-text">
          {isFullscreen
            ? 'Usa flechas para navegar. Puedes salir con ESC o con la X.'
            : 'Haz clic en los bordes para girar las paginas.'}
        </p>
        {isStillRendering && (
          <div className="flipbook-progress-badge">
            Cargando paginas... {loadedPages}/{pageCount}
          </div>
        )}
      </div>

      {isFullscreen && (
        <button
          type="button"
          className="flipbook-fullscreen-close"
          onClick={() => void document.exitFullscreen()}
          aria-label="Salir de pantalla completa"
        >
          ×
        </button>
      )}

      <div className="flipbook-surface">
        <FlipBook
          ref={bookRef}
          width={bookSize.width}
          height={bookSize.height}
          size="fixed"
          minWidth={180}
          maxWidth={1200}
          minHeight={250}
          maxHeight={1700}
          maxShadowOpacity={0.22}
          mobileScrollSupport
          drawShadow
          flippingTime={420}
          showCover={false}
          usePortrait={isMobileLayout}
          startZIndex={10}
          className="demo-book"
          onFlip={(event: { data: number }) => setCurrentPage(event.data)}
        >
          {pages.map((src, index) => (
            <div key={`${issue.slug}-page-${index}`} className="flipbook-page">
              <img src={src} alt={`Pagina ${index + 1}`} loading={index < 2 ? 'eager' : 'lazy'} />
            </div>
          ))}
        </FlipBook>
      </div>
    </section>
  )
}
