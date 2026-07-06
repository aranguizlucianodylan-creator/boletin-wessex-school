import { useMemo, useState } from 'react'
import type { Issue } from '../types/issue'
import { buildSlug } from '../utils/issues'
import { buildShareUrl } from '../utils/paths'

interface AdminJsonGeneratorProps {
  issue: Partial<Issue>
  onIssueChange: (value: Partial<Issue>) => void
}

export const AdminJsonGenerator = ({ issue, onIssueChange }: AdminJsonGeneratorProps) => {
  const [copied, setCopied] = useState(false)
  const [publishedLink, setPublishedLink] = useState('')
  const generatedJson = useMemo(() => {
    const payload: Issue = {
      id: issue.slug || 'nueva-edicion',
      title: issue.title || 'Nueva edición',
      month: issue.month || 'Mes',
      year: issue.year || new Date().getFullYear(),
      slug: issue.slug || buildSlug(issue.title || 'Nueva edición', issue.month || 'Mes', issue.year || new Date().getFullYear()),
      description: issue.description || 'Descripción breve de la edición.',
      pdfUrl: issue.pdfUrl || '/pdfs/tu-revista.pdf',
      audioUrl: issue.audioUrl || '',
      coverUrl: issue.coverUrl || '',
      publishedAt: issue.publishedAt || new Date().toISOString().slice(0, 10),
      featured: Boolean(issue.featured),
    }

    return JSON.stringify([payload], null, 2)
  }, [issue])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedJson)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const handlePublish = () => {
    const payload: Issue = {
      id: issue.slug || 'nueva-edicion',
      title: issue.title || 'Nueva edición',
      month: issue.month || 'Mes',
      year: issue.year || new Date().getFullYear(),
      slug: issue.slug || buildSlug(issue.title || 'Nueva edición', issue.month || 'Mes', issue.year || new Date().getFullYear()),
      description: issue.description || 'Descripción breve de la edición.',
      pdfUrl: issue.pdfUrl || '/pdfs/tu-revista.pdf',
      audioUrl: issue.audioUrl || '',
      coverUrl: issue.coverUrl || '',
      publishedAt: issue.publishedAt || new Date().toISOString().slice(0, 10),
      featured: Boolean(issue.featured),
    }

    localStorage.setItem('draftIssue', JSON.stringify(payload))
    const link = buildShareUrl(`/revista/${payload.slug}`)
    setPublishedLink(link)
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="admin-panel__json">
      <h3>Bloque listo para copiar en issues.json</h3>
      <p>Cuando pulses “Listo, publicar”, se abrirá una vista previa local de tu revista y podrás copiar el bloque JSON.</p>
      {publishedLink ? (
        <div className="alert-box alert-box--info">
          Vista previa lista: <a href={publishedLink} target="_blank" rel="noreferrer">{publishedLink}</a>
        </div>
      ) : null}
      <textarea value={generatedJson} readOnly className="json-output" />
      <div className="button-row">
        <button type="button" className="button" onClick={handlePublish}>
          Listo, publicar
        </button>
        <button type="button" className="button" onClick={handleCopy}>
          {copied ? '¡Copiado!' : 'Copiar JSON'}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onIssueChange({ ...issue, slug: buildSlug(issue.title || 'Nueva edición', issue.month || 'Mes', issue.year || new Date().getFullYear()) })}
        >
          Sugerir slug
        </button>
      </div>
    </div>
  )
}
