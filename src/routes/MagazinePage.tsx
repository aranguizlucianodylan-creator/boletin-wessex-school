import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FlipbookViewer } from '../components/FlipbookViewer'
import { ErrorState } from '../components/ErrorState'
import type { Issue } from '../types/issue'
import { sortIssues } from '../utils/issues'
import { buildIssuesUrl, withBasePath } from '../utils/paths'

export const MagazinePage = () => {
  const { slug } = useParams()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [draftIssue, setDraftIssue] = useState<Issue | null>(null)

  useEffect(() => {
    const savedDraft = localStorage.getItem('draftIssue')
    if (savedDraft) {
      try {
        setDraftIssue(JSON.parse(savedDraft))
      } catch {
        setDraftIssue(null)
      }
    }

    fetch(buildIssuesUrl())
      .then((response) => response.json())
      .then((data: Issue[]) => {
        setIssues(sortIssues(data))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const issue = useMemo(() => {
    const fromJson = issues.find((item) => item.slug === slug)
    if (fromJson) return fromJson
    return draftIssue && draftIssue.slug === slug ? draftIssue : null
  }, [draftIssue, issues, slug])

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return (
      <div className="page-shell">
        <Header />
        <main className="magazine-page">
          <div className="loading-card">Cargando revista...</div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="page-shell">
        <Header />
        <main className="magazine-page">
          <ErrorState title="Revista no encontrada" message="La edición solicitada no está disponible todavía." actionLabel="Volver al inicio" onAction={() => window.history.back()} />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <Header />
      <main className="magazine-page">
        <section className="magazine-toolbar">
          <div>
            <p className="eyebrow">Edición en línea · The Wessex School</p>
            <h2>{issue.title}</h2>
            <p>{issue.description}</p>
            {draftIssue && draftIssue.slug === issue.slug && !issues.some((item) => item.slug === issue.slug) ? (
              <div className="alert-box alert-box--info" style={{ marginTop: '10px' }}>
                Vista previa local activa. Cuando copies este bloque en issues.json, la revista quedará disponible en esta misma ruta.
              </div>
            ) : null}
          </div>
          <div className="button-row">
            <a className="button" href={withBasePath(issue.pdfUrl)} target="_blank" rel="noreferrer">
              ↓ Descargar PDF
            </a>
            <button type="button" className="button button-secondary" onClick={handleCopyLink}>
              {copied ? '✓ ¡Enlace copiado!' : '🔗 Compartir enlace'}
            </button>
            <Link className="button button-secondary" to="/">
              ← Volver al inicio
            </Link>
          </div>
        </section>
        <FlipbookViewer issue={issue} />
      </main>
      <Footer />
    </div>
  )
}
