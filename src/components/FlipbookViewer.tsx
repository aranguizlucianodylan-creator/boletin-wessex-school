import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import type { Issue } from '../types/issue'
import { LoadingState } from './LoadingState'
import { renderPdfPageToCanvas } from '../utils/pdf'
import { withBasePath } from '../utils/paths'

const FlipBook = HTMLFlipBook as unknown as React.ComponentType<any>

interface FlipbookViewerProps {
  issue: Issue
}

const getRenderScale = () => {
  if (window.innerWidth < 640) return 0.9
  if (window.innerWidth < 900) return 0.96
  return 1.04
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
  const [isReadingMode, setIsReadingMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [bookSize, setBookSize] = useState({ width: 420, height: 594 })
  const [isMobileLayout, setIsMobileLayout] = useState(window.innerWidth < 900)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bookRef = useRef<any>(null)
  const shellRef = useRef<HTMLElement>(null)

  const pdfUrl = useMemo(() => withBasePath(issue.pdfUrl), [issue.pdfUrl])
  const displayPage = Math.min(currentPage + 1, pageCount || 1)
  const useSinglePageLayout = isFullscreen || isMobileLayout || pages.length < 2
  const canFlipPrev = currentPage > 0
  const canFlipNext = currentPage < Math.max(pages.length - 1, 0)
  const isStillRendering = loadedPages > 0 && loadedPages < pageCount
  const showChrome = !isFullscreen || !isReadingMode

  const recalcSize = useCallback(
    (
      aspect: number,
      fullscreen: boolean,
      readingMode: boolean,
      loadedPageTotal: number,
    ) => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const mobileLayout = viewportWidth < 900
      const singlePageLayout = fullscreen || mobileLayout || loadedPageTotal < 2
      const spreadPages = singlePageLayout ? 1 : 2
      const horizontalPadding = fullscreen ? (readingMode ? 0 : 8) : mobileLayout ? 24 : 28
      const verticalChrome = fullscreen ? (readingMode ? 0 : 18) : mobileLayout ? 170 : 190
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
    const onResize = () => {
      recalcSize(pageAspect, Boolean(document.fullscreenElement), isReadingMode, pages.length)
    }

    const onFullscreenChange = () => {
      const fullscreen = Boolean(document.fullscreenElement)
      setIsFullscreen(fullscreen)
      setIsReadingMode(fullscreen)
      recalcSize(pageAspect, fullscreen, fullscreen, pages.length)
    }

    recalcSize(pageAspect, isFullscreen, isReadingMode, pages.length)
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [isFullscreen, isReadingMode, pageAspect, pages.length, recalcSize])

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

        const renderScale = getRenderScale()
        const firstPage = await renderPdfPageToCanvas(pdfUrl, 1, renderScale)
        if (!active) return

        setPageCount(firstPage.pageCount)
        setPages([firstPage.imageUrl])
        setLoadedPages(1)

        const ratio = firstPage.height / firstPage.width
        setPageAspect(ratio)
        recalcSize(ratio, Boolean(document.fullscreenElement), isReadingMode, 1)
        setIsLoading(false)

        for (let pageNumber = 2; pageNumber <= firstPage.pageCount; pageNumber += 1) {
          if (!active) return

          const result = await renderPdfPageToCanvas(pdfUrl, pageNumber, renderScale)
          if (!active) return

          setPages((currentPages) => [...currentPages, result.imageUrl])
          setLoadedPages(pageNumber)

          if (pageNumber >= 3) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Error cargando PDF.')
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
    return <LoadingState message="Abriendo boletin..." />
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

  if (!pages.length) {
    return <LoadingState message="Preparando visor..." />
  }

  return (
    <section
      ref={shellRef}
      className={`flipbook-shell ${isFullscreen ? 'flipbook-shell--fullscreen' : ''} ${isReadingMode ? 'flipbook-shell--reading' : ''}`}
    >
      {issue.audioUrl && showChrome && (
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

      {showChrome && (
        <>
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
              {isFullscreen ? (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsReadingMode(true)}
                >
                  Lectura total
                </button>
              ) : (
                <button type="button" className="button button-secondary" onClick={toggleFullscreen}>
                  Pantalla completa
                </button>
              )}
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
        </>
      )}

      {isFullscreen && !isReadingMode && (
        <button
          type="button"
          className="flipbook-fullscreen-close"
          onClick={() => void document.exitFullscreen()}
          aria-label="Salir de pantalla completa"
        >
          ×
        </button>
      )}

      {isFullscreen && isReadingMode && (
        <div className="flipbook-reading-ui">
          <div className="flipbook-reading-top">
            <span className="flipbook-page-pill">{displayPage} / {pageCount}</span>
            <div className="flipbook-reading-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setIsReadingMode(false)}
              >
                Controles
              </button>
              <button
                type="button"
                className="flipbook-fullscreen-close flipbook-fullscreen-close--inline"
                onClick={() => void document.exitFullscreen()}
                aria-label="Salir de pantalla completa"
              >
                ×
              </button>
            </div>
          </div>

          <button
            type="button"
            className="flipbook-reading-nav flipbook-reading-nav--prev"
            onClick={flipPrev}
            disabled={!canFlipPrev}
            aria-label="Pagina anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="flipbook-reading-nav flipbook-reading-nav--next"
            onClick={flipNext}
            disabled={!canFlipNext}
            aria-label="Pagina siguiente"
          >
            ›
          </button>
        </div>
      )}

      <div className="flipbook-surface">
        <FlipBook
          ref={bookRef}
          key={`${useSinglePageLayout ? 'single' : 'spread'}-${isFullscreen ? 'fullscreen' : 'windowed'}-${isReadingMode ? 'reading' : 'standard'}-${pages.length}-${bookSize.width}-${bookSize.height}`}
          width={bookSize.width}
          height={bookSize.height}
          size="fixed"
          minWidth={180}
          maxWidth={1400}
          minHeight={250}
          maxHeight={1900}
          maxShadowOpacity={0.22}
          mobileScrollSupport
          drawShadow
          flippingTime={360}
          showCover={false}
          startPage={Math.min(currentPage, Math.max(pages.length - 1, 0))}
          usePortrait={useSinglePageLayout}
          startZIndex={10}
          className="demo-book"
          onFlip={(event: { data: number }) => setCurrentPage(event.data)}
        >
          {pages.map((src, index) => (
            <div
              key={`${issue.slug}-page-${index}`}
              className="flipbook-page"
            >
              <img src={src} alt={`Pagina ${index + 1}`} loading={index < 2 ? 'eager' : 'lazy'} />
            </div>
          ))}
        </FlipBook>
      </div>
    </section>
  )
}
