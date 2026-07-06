const NETLIFY_API = 'https://api.netlify.com/api/v1'

export const SITE_ID = '30cefdb2-93ca-4c7f-9a5a-6d3a4dd8300d'
export const SITE_URL = 'https://boletin-wessex-school.netlify.app'

async function sha1Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function netlifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${NETLIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

interface DeployFile {
  id: string
  sha: string
}

interface Deploy {
  id: string
  required: string[]
}

export type ProgressFn = (msg: string) => void

export async function publishBulletin(
  token: string,
  pdfFile: File,
  updatedJson: string,
  onProgress: ProgressFn,
): Promise<void> {
  const enc = new TextEncoder()
  const jsonBytes = enc.encode(updatedJson)
  const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer())

  onProgress('Calculando hashes…')
  const [pdfSha, jsonSha] = await Promise.all([
    sha1Hex(pdfBytes.buffer as ArrayBuffer),
    sha1Hex(jsonBytes.buffer as ArrayBuffer),
  ])

  onProgress('Obteniendo archivos actuales del sitio…')
  const site = await netlifyGet<{ published_deploy: { id: string } }>(
    `/sites/${SITE_ID}`,
    token,
  )
  const currentFiles = await netlifyGet<DeployFile[]>(
    `/deploys/${site.published_deploy.id}/files`,
    token,
  )

  onProgress('Creando nuevo despliegue…')
  const fileMap: Record<string, string> = {}
  for (const f of currentFiles) {
    fileMap[f.id] = f.sha
  }
  const pdfPath = `/pdfs/${pdfFile.name}`
  fileMap[pdfPath] = pdfSha
  fileMap['/data/issues.json'] = jsonSha

  const deployRes = await fetch(`${NETLIFY_API}/sites/${SITE_ID}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: fileMap }),
  })
  if (!deployRes.ok) {
    const err = await deployRes.text()
    throw new Error(`Error creando despliegue: ${err}`)
  }
  const deploy = (await deployRes.json()) as Deploy

  const toUpload = [
    { sha: pdfSha, path: pdfPath, content: pdfBytes },
    { sha: jsonSha, path: '/data/issues.json', content: jsonBytes },
  ]

  for (const item of toUpload) {
    if (deploy.required.includes(item.sha)) {
      onProgress(`Subiendo ${item.path}…`)
      const up = await fetch(`${NETLIFY_API}/deploys/${deploy.id}/files${item.path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: item.content as BodyInit,
      })
      if (!up.ok) throw new Error(`Error subiendo ${item.path}: ${up.status}`)
    }
  }
}

// ── Update only issues.json (for delete / edits — no PDF upload) ───────────
export async function updateIssuesJson(
  token: string,
  updatedJson: string,
  onProgress: ProgressFn,
): Promise<void> {
  const enc = new TextEncoder()
  const jsonBytes = enc.encode(updatedJson)

  onProgress('Calculando hash…')
  const jsonSha = await sha1Hex(jsonBytes.buffer as ArrayBuffer)

  onProgress('Obteniendo estado actual del sitio…')
  const site = await netlifyGet<{ published_deploy: { id: string } }>(
    `/sites/${SITE_ID}`,
    token,
  )
  const currentFiles = await netlifyGet<DeployFile[]>(
    `/deploys/${site.published_deploy.id}/files`,
    token,
  )

  onProgress('Creando despliegue…')
  const fileMap: Record<string, string> = {}
  for (const f of currentFiles) {
    fileMap[f.id] = f.sha
  }
  fileMap['/data/issues.json'] = jsonSha

  const deployRes = await fetch(`${NETLIFY_API}/sites/${SITE_ID}/deploys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: fileMap }),
  })
  if (!deployRes.ok) throw new Error(`Error creando despliegue: ${deployRes.status}`)
  const deploy = (await deployRes.json()) as Deploy

  if (deploy.required.includes(jsonSha)) {
    onProgress('Subiendo issues.json…')
    const up = await fetch(`${NETLIFY_API}/deploys/${deploy.id}/files/data/issues.json`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: jsonBytes as BodyInit,
    })
    if (!up.ok) throw new Error(`Error subiendo JSON: ${up.status}`)
  }
}

export const PAT_KEY = 'netlify_pat_v1'
export function getSavedPat(): string {
  return localStorage.getItem(PAT_KEY) ?? ''
}
export function savePat(token: string) {
  localStorage.setItem(PAT_KEY, token)
}

