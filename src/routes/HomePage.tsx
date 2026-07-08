import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { IssueCard } from '../components/IssueCard'
import { LoadingState } from '../components/LoadingState'
import type { Issue } from '../types/issue'
import { warmPdfPreview } from '../utils/pdf'
import { sortIssues } from '../utils/issues'
import { buildIssuesUrl, withBasePath } from '../utils/paths'

export const HomePage = () => {
  const [issues, setIssues] = useState<Issue[]>([])
  const [search, setSearch] = useState('')
  const [selectedYear, setSelectedYear] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(buildIssuesUrl())
      .then((response) => response.json())
      .then((data: Issue[]) => {
        setIssues(sortIssues(data))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const featuredIssue = useMemo(() => issues.find((issue) => issue.featured) || issues[0], [issues])

  useEffect(() => {
    if (!featuredIssue) return
    void warmPdfPreview(withBasePath(featuredIssue.pdfUrl))
  }, [featuredIssue])

  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(issues.map((issue) => issue.year)))
    return uniqueYears.sort((a, b) => b - a)
  }, [issues])

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSearch = `${issue.month} ${issue.year} ${issue.title}`.toLowerCase().includes(search.toLowerCase())
      const matchesYear = selectedYear === 'all' || issue.year.toString() === selectedYear
      return matchesSearch && matchesYear
    })
  }, [issues, search, selectedYear])

  if (loading) {
    return <LoadingState message="Cargando revistas disponibles..." />
  }

  return (
    <div className="page-shell">
      <Header />
      <main className="home-page">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Publicaciones mensuales</p>
            <h2>Una revista digital elegante para cada edición del colegio.</h2>
            <p className="hero-copy">
              Explora las novedades, actividades y mensajes del mes en una experiencia visual clara, moderna y fácil de compartir con familias y apoderados.
            </p>
            {featuredIssue ? (
              <Link to={`/revista/${featuredIssue.slug}`} className="button hero-button">
                Ver última edición
              </Link>
            ) : null}
          </div>
          <div className="hero-card">
            <p className="eyebrow">Edición destacada</p>
            {featuredIssue ? (
              <>
                <h3>{featuredIssue.title}</h3>
                <p>{featuredIssue.description}</p>
                <div className="hero-card__pill">Disponible en línea · Acceso inmediato</div>
              </>
            ) : (
              <p>No hay revistas aún.</p>
            )}
          </div>
        </section>

        <section className="filters-panel">
          <input
            type="search"
            placeholder="Buscar por mes, año o título"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
            <option value="all">Todos los años</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </section>

        <h2 className="section-heading">
          Todas las <span>ediciones</span>
        </h2>

        <section className="issues-grid">
          {filteredIssues.length === 0 ? (
            <p className="empty-state">No se encontraron ediciones con esos filtros.</p>
          ) : (
            filteredIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
