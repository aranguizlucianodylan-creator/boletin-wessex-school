import { useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import type { Issue } from '../types/issue'
import { buildSlug } from '../utils/issues'
import { buildIssuesUrl } from '../utils/paths'

const ADMIN_PASSWORD = 'revista2026'
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadJson(json: string, filename = 'issues.json') {
  downloadBlob(new Blob([json], { type: 'application/json' }), filename)
}

function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  const submit = () => {
    if (pw.trim() === ADMIN_PASSWORD) {
      onAuth()
      return
    }
    setErr('Contrasena incorrecta.')
  }

  return (
    <section className="admin-panel" style={{ maxWidth: 420, margin: '56px auto' }}>
      <p className="eyebrow">Area restringida</p>
      <h2 className="admin-panel__title">Panel de publicacion</h2>
      <p className="assistant-text" style={{ marginBottom: 24 }}>
        Flujo gratis: prepara los archivos y luego subelos a tu hosting estatico.
      </p>
      <div className="admin-panel__form">
        <label>
          Contrasena
          <input
            type="password"
            value={pw}
            placeholder="********"
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        {err && <div className="alert-box">{err}</div>}
        <button type="button" className="button" onClick={submit}>
          Ingresar -&gt;
        </button>
      </div>
    </section>
  )
}

type PublishState = 'idle' | 'preparing' | 'done' | 'error'

function PublishTab() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()])
  const [year, setYear] = useState(new Date().getFullYear())
  const [featured, setFeatured] = useState(true)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pubState, setPubState] = useState<PublishState>('idle')
  const [error, setError] = useState('')
  const [doneIssue, setDoneIssue] = useState<Issue | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const slug = buildSlug(title || 'nueva-edicion', month, year)

  const handlePdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const safe = sanitizeFilename(file.name)
    const safeFile = new File([file], safe, { type: file.type })
    setPdfFile(safeFile)
    if (!title) {
      const guessed = safe
        .replace(/\.pdf$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
      setTitle(guessed)
    }
  }

  const handlePrepare = async () => {
    if (!pdfFile || !title) return

    setPubState('preparing')
    setError('')

    try {
      let existing: Issue[] = []
      try {
        const response = await fetch(buildIssuesUrl())
        existing = await response.json()
      } catch {
        existing = []
      }

      const newIssue: Issue = {
        id: slug,
        title,
        month,
        year,
        slug,
        description: description || `Boletin mensual de ${month} ${year}.`,
        pdfUrl: `/pdfs/${pdfFile.name}`,
        audioUrl: audioUrl.trim(),
        coverUrl: '',
        publishedAt: new Date().toISOString().slice(0, 10),
        featured,
      }

      const rest = existing
        .filter((issue) => issue.slug !== slug)
        .map((issue) => (featured ? { ...issue, featured: false } : issue))
      const updatedJson = JSON.stringify([newIssue, ...rest], null, 2)

      downloadBlob(pdfFile, pdfFile.name)
      downloadJson(updatedJson)

      setDoneIssue(newIssue)
      setPubState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
      setPubState('error')
    }
  }

  const reset = () => {
    setTitle('')
    setDescription('')
    setAudioUrl('')
    setPdfFile(null)
    setPubState('idle')
    setError('')
    setDoneIssue(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (pubState === 'done' && doneIssue) {
    return (
      <div className="publish-done">
        <div style={{ fontSize: '3rem' }}>Listo</div>
        <h3>Archivos preparados</h3>
        <p className="assistant-text">
          Se descargaron el PDF y el nuevo <code>issues.json</code>.
        </p>
        <div className="alert-box alert-box--info" style={{ textAlign: 'left' }}>
          1. Sube <code>{pdfFile?.name}</code> a <code>public/pdfs/</code>.
          <br />
          2. Reemplaza <code>public/data/issues.json</code> con el archivo descargado.
          <br />
          3. Ejecuta <code>npm run build</code> y publica la carpeta <code>dist/</code> en cualquier hosting gratis.
          <br />
          4. La ruta final sera <code>/revista/{doneIssue.slug}</code>.
        </div>
        <div className="button-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="button" onClick={reset}>
            Preparar otro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-panel__form">
      <div className="alert-box alert-box--info">
        Este modo no usa Netlify ni Vercel. Solo prepara los archivos finales para subirlos gratis donde quieras.
      </div>

      <div className="pdf-drop-zone" onClick={() => fileRef.current?.click()}>
        {pdfFile ? (
          <>
            <span style={{ fontSize: '2rem' }}>PDF</span>
            <strong>{pdfFile.name}</strong>
            <span className="assistant-text">
              {(pdfFile.size / 1024 / 1024).toFixed(1)} MB · clic para cambiar
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: '2.5rem' }}>Archivo</span>
            <strong>Haz clic para elegir el PDF del boletin</strong>
            <span className="assistant-text">Se renombrara en forma segura para web.</span>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={handlePdf}
        />
      </div>

      <label>
        Titulo del boletin
        <input
          value={title}
          placeholder="Boletin Julio 2026"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label>
        Descripcion breve <span style={{ fontWeight: 400, color: 'var(--c-muted)' }}>(opcional)</span>
        <input
          value={description}
          placeholder={`Actividades y novedades de ${month} ${year}...`}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label>
        URL de audio <span style={{ fontWeight: 400, color: 'var(--c-muted)' }}>(opcional)</span>
        <input
          type="url"
          value={audioUrl}
          placeholder="https://drive.google.com/... o enlace directo a .mp3"
          onChange={(e) => setAudioUrl(e.target.value)}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label>
          Mes
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ano
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </label>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
        />
        <span>
          Mostrar como <strong>edicion destacada</strong> en el inicio
        </span>
      </label>

      {pubState === 'error' && <div className="alert-box"><strong>Error:</strong> {error}</div>}

      <button
        type="button"
        className="button"
        disabled={!pdfFile || !title || pubState === 'preparing'}
        onClick={handlePrepare}
        style={{ marginTop: 4 }}
      >
        {pubState === 'preparing' ? 'Preparando...' : 'Descargar archivos listos'}
      </button>

      <p className="assistant-text" style={{ textAlign: 'center' }}>
        URL sugerida: <code style={{ fontSize: '0.82rem' }}>/revista/{slug}</code>
      </p>
    </div>
  )
}

function ManageTab() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadIssues = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${buildIssuesUrl()}?t=${Date.now()}`)
      const data = await response.json()
      setIssues(data)
    } catch {
      setError('No se pudieron cargar los boletines.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadIssues()
  }, [])

  const handleDelete = (slug: string) => {
    const updated = issues.filter((issue) => issue.slug !== slug)
    downloadJson(JSON.stringify(updated, null, 2))
    setIssues(updated)
    setConfirmSlug(null)
    setMessage('Se descargo un nuevo issues.json sin ese boletin.')
  }

  if (loading) {
    return (
      <div className="loading-card">
        <div className="spinner" />
        <p>Cargando boletines...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="alert-box alert-box--info" style={{ marginBottom: 16 }}>
        Gestion local: al eliminar, se descarga un <code>issues.json</code> actualizado para que lo reemplaces en <code>public/data/</code>.
      </div>

      {message && <div className="alert-box alert-box--info" style={{ marginBottom: 16 }}>{message}</div>}
      {error && <div className="alert-box" style={{ marginBottom: 16 }}>{error}</div>}

      {issues.length === 0 ? (
        <p className="assistant-text" style={{ textAlign: 'center', padding: 32 }}>
          No hay boletines publicados aun.
        </p>
      ) : (
        <div className="manage-list">
          {issues.map((issue) => (
            <div key={issue.slug} className="manage-row">
              <div className="manage-row__info">
                <div
                  className="manage-row__dot"
                  style={{ background: issue.featured ? 'var(--c-teal)' : 'var(--c-border)' }}
                />
                <div>
                  <strong>{issue.title}</strong>
                  <p className="assistant-text" style={{ margin: 0 }}>
                    {issue.month} {issue.year} · <code style={{ fontSize: '0.78rem' }}>{issue.pdfUrl}</code>
                    {issue.audioUrl ? ' · audio' : ''}
                    {issue.featured ? ' · destacado' : ''}
                  </p>
                </div>
              </div>
              <div className="manage-row__actions">
                <a
                  href={`/revista/${issue.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-secondary"
                  style={{ padding: '7px 14px', fontSize: '0.85rem' }}
                >
                  Ver
                </a>
                {confirmSlug === issue.slug ? (
                  <>
                    <button
                      type="button"
                      className="btn-delete-confirm"
                      onClick={() => handleDelete(issue.slug)}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setConfirmSlug(null)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => setConfirmSlug(issue.slug)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="button button-secondary"
        style={{ marginTop: 16 }}
        onClick={loadIssues}
      >
        Actualizar lista
      </button>
    </div>
  )
}

export const AdminPage = () => {
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState<'publish' | 'manage'>('publish')

  if (!authorized) {
    return (
      <div className="page-shell">
        <Header />
        <main>
          <AuthScreen onAuth={() => setAuthorized(true)} />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <Header />
      <main>
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab ${tab === 'publish' ? 'admin-tab--active' : ''}`}
            onClick={() => setTab('publish')}
          >
            Publicar boletin
          </button>
          <button
            type="button"
            className={`admin-tab ${tab === 'manage' ? 'admin-tab--active' : ''}`}
            onClick={() => setTab('manage')}
          >
            Gestionar boletines
          </button>
        </div>

        <section className="admin-panel" style={{ maxWidth: 660, margin: '0 auto 32px' }}>
          {tab === 'publish' ? (
            <>
              <p className="eyebrow">Nuevo boletin</p>
              <h2 className="admin-panel__title">Preparar archivos</h2>
              <PublishTab />
            </>
          ) : (
            <>
              <p className="eyebrow">Administracion</p>
              <h2 className="admin-panel__title">Boletines publicados</h2>
              <ManageTab />
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
