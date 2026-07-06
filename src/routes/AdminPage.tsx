import { useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import type { Issue } from '../types/issue'
import { buildSlug } from '../utils/issues'
import { buildIssuesUrl } from '../utils/paths'
import {
  buildPublishedUrl,
  getSavedPat,
  publishBulletin,
  REPO_FULL_NAME,
  savePat,
  SITE_URL,
  updateIssuesJson,
} from '../utils/github-deploy'

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
        Este panel publica directo en GitHub Pages.
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

function PatSetup({ onSave }: { onSave: (token: string) => void }) {
  const [token, setToken] = useState('')

  return (
    <section className="admin-panel" style={{ maxWidth: 700, margin: '0 auto 32px' }}>
      <p className="eyebrow">Configuracion unica</p>
      <h2 className="admin-panel__title">Conectar con GitHub</h2>
      <p className="assistant-text" style={{ marginBottom: 20 }}>
        Configura una vez un token de GitHub y despues este panel quedara casi en subir PDF y publicar.
      </p>
      <div className="publish-steps" style={{ marginBottom: 24 }}>
        <div className="publish-step">
          <div className="publish-step__num">1</div>
          <div>
            <strong>Crea un token en GitHub</strong>
            <p className="assistant-text">
              Abre <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--c-teal)' }}>github.com/settings/tokens</a>.
            </p>
          </div>
        </div>
        <div className="publish-step">
          <div className="publish-step__num">2</div>
          <div>
            <strong>Permisos recomendados</strong>
            <p className="assistant-text">
              Usa un token clasico con permiso <code>repo</code>, o uno fine-grained con acceso de escritura a contenidos del repo <code>{REPO_FULL_NAME}</code>.
            </p>
          </div>
        </div>
        <div className="publish-step">
          <div className="publish-step__num">3</div>
          <div>
            <strong>Pega el token aqui</strong>
            <input
              type="password"
              value={token}
              placeholder="ghp_... o github_pat_..."
              onChange={(e) => setToken(e.target.value)}
              style={{
                marginTop: 10,
                borderRadius: 10,
                border: '1.5px solid var(--c-border)',
                padding: '10px 14px',
                width: '100%',
                background: 'white',
              }}
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="button"
        disabled={!token.trim()}
        onClick={() => {
          const cleanToken = token.trim()
          savePat(cleanToken)
          onSave(cleanToken)
        }}
      >
        Guardar y continuar
      </button>
    </section>
  )
}

type PublishState = 'idle' | 'publishing' | 'done' | 'error'

function PublishTab({ pat }: { pat: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()])
  const [year, setYear] = useState(new Date().getFullYear())
  const [featured, setFeatured] = useState(true)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pubState, setPubState] = useState<PublishState>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [doneIssue, setDoneIssue] = useState<Issue | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const slug = buildSlug(title || 'nueva-edicion', month, year)
  const isRecommendedToCompress = (pdfFile?.size ?? 0) > 50 * 1024 * 1024

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

  const handlePublish = async () => {
    if (!pdfFile || !title) return

    setPubState('publishing')
    setProgress('Cargando boletines actuales...')
    setError('')

    try {
      let existing: Issue[] = []
      try {
        const response = await fetch(`${buildIssuesUrl()}?t=${Date.now()}`)
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

      await publishBulletin(
        pat,
        pdfFile,
        updatedJson,
        `Publish bulletin: ${month} ${year}`,
        setProgress,
      )

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
    setProgress('')
    setError('')
    setDoneIssue(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (pubState === 'done' && doneIssue) {
    const bulletinUrl = buildPublishedUrl(`/revista/${doneIssue.slug}`)

    return (
      <div className="publish-done">
        <div style={{ fontSize: '3rem' }}>Publicado</div>
        <h3>Boletin enviado a GitHub</h3>
        <p className="assistant-text">
          GitHub Pages suele tardar entre 30 y 90 segundos en mostrar la nueva edicion.
        </p>
        <div className="alert-box alert-box--info" style={{ textAlign: 'left' }}>
          Sitio: <a href={SITE_URL} target="_blank" rel="noreferrer">{SITE_URL}</a>
          <br />
          Boletin: <a href={bulletinUrl} target="_blank" rel="noreferrer">{bulletinUrl}</a>
        </div>
        <div className="button-row" style={{ justifyContent: 'center' }}>
          <a href={bulletinUrl} target="_blank" rel="noreferrer" className="button">
            Ver boletin
          </a>
          <button type="button" className="button button-secondary" onClick={reset}>
            Publicar otro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-panel__form">
      <div className="alert-box alert-box--info">
        Este modo publica directo al repositorio y luego GitHub Pages actualiza el sitio automaticamente.
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
            <span className="assistant-text">El panel lo subira y publicara por ti.</span>
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

      {isRecommendedToCompress && (
        <div className="alert-box alert-box--info">
          El PDF pesa mas de 50 MB. GitHub lo aceptara, pero conviene comprimirlo para que cargue mas rapido.
        </div>
      )}

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

      {pubState === 'error' && (
        <div className="alert-box">
          <strong>Error:</strong> {error}
          {(error.includes('401') || error.includes('403')) && (
            <span>
              {' '}— token invalido.{' '}
              <button
                type="button"
                style={{
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'inherit',
                }}
                onClick={() => {
                  savePat('')
                  window.location.reload()
                }}
              >
                Reconfigurar
              </button>
            </span>
          )}
        </div>
      )}

      {pubState === 'publishing' && (
        <div
          className="alert-box alert-box--info"
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div className="spinner" style={{ width: 20, height: 20, margin: 0, flexShrink: 0 }} />
          {progress}
        </div>
      )}

      <button
        type="button"
        className="button"
        disabled={!pdfFile || !title || pubState === 'publishing'}
        onClick={handlePublish}
        style={{ marginTop: 4 }}
      >
        {pubState === 'publishing' ? 'Publicando...' : 'Publicar boletin'}
      </button>

      <p className="assistant-text" style={{ textAlign: 'center' }}>
        URL sugerida: <code style={{ fontSize: '0.82rem' }}>/revista/{slug}</code>
      </p>
    </div>
  )
}

function ManageTab({ pat }: { pat: string }) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null)

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

  const handleDelete = async (slug: string) => {
    setDeleting(slug)
    setProgress('Actualizando lista...')
    setError('')
    setMessage('')

    try {
      const updated = issues.filter((issue) => issue.slug !== slug)
      const updatedJson = JSON.stringify(updated, null, 2)

      await updateIssuesJson(
        pat,
        updatedJson,
        `Remove bulletin from list: ${slug}`,
        setProgress,
      )

      setIssues(updated)
      setConfirmSlug(null)
      setMessage('Boletin eliminado de la lista. GitHub Pages actualizara el sitio en breve.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando.')
    } finally {
      setDeleting(null)
      setProgress('')
    }
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
        Gestiona la lista publicada. Al eliminar, se actualiza <code>issues.json</code> en GitHub automaticamente.
      </div>

      {message && <div className="alert-box alert-box--info" style={{ marginBottom: 16 }}>{message}</div>}
      {error && <div className="alert-box" style={{ marginBottom: 16 }}>{error}</div>}
      {deleting && (
        <div
          className="alert-box alert-box--info"
          style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div className="spinner" style={{ width: 20, height: 20, margin: 0, flexShrink: 0 }} />
          {progress}
        </div>
      )}

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
                  href={buildPublishedUrl(`/revista/${issue.slug}`)}
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
                      disabled={Boolean(deleting)}
                      onClick={() => handleDelete(issue.slug)}
                    >
                      {deleting === issue.slug ? '...' : 'Confirmar'}
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
                    disabled={Boolean(deleting)}
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
  const [pat, setPat] = useState(getSavedPat)
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

  if (!pat) {
    return (
      <div className="page-shell">
        <Header />
        <main>
          <PatSetup onSave={setPat} />
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

        <section className="admin-panel" style={{ maxWidth: 720, margin: '0 auto 32px' }}>
          {tab === 'publish' ? (
            <>
              <p className="eyebrow">Nuevo boletin</p>
              <h2 className="admin-panel__title">Subir y publicar</h2>
              <PublishTab pat={pat} />
            </>
          ) : (
            <>
              <p className="eyebrow">Administracion</p>
              <h2 className="admin-panel__title">Boletines publicados</h2>
              <ManageTab pat={pat} />
            </>
          )}
        </section>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--c-muted)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              textDecoration: 'underline',
            }}
            onClick={() => {
              savePat('')
              setPat('')
            }}
          >
            Cambiar token de GitHub
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
