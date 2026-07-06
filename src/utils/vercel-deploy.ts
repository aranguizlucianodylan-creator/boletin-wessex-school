const VERCEL_API = 'https://api.vercel.com'
export const VERCEL_PROJECT_ID = 'prj_UATDGsrLZiys9D3kMeB9UBPoj1as'
export const VERCEL_TEAM_ID = 'team_QSORm9AUfT4QpmHzqt679z0w'
export const SITE_URL = 'https://boletin-wessex-school.vercel.app'

export type ProgressFn = (msg: string) => void

async function sha1Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${VERCEL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Vercel API ${res.status}: ${t.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

interface VercelFile {
  name: string
  type: 'file' | 'directory' | 'lambda' | 'middleware'
  uid?: string   // SHA1 for files
  children?: VercelFile[]
}

// Flatten the Vercel file tree into {file: path, sha: uid} pairs
function flattenTree(nodes: VercelFile[], prefix = ''): { file: string; sha: string }[] {
  const result: { file: string; sha: string }[] = []
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name
    if (node.type === 'directory' && node.children) {
      result.push(...flattenTree(node.children, path))
    } else if (node.type === 'file' && node.uid) {
      result.push({ file: path, sha: node.uid })
    }
  }
  return result
}

export async function publishToVercel(
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
  const deploymentsRes = await apiGet<{ deployments: { uid: string }[] }>(
    `/v6/deployments?teamId=${VERCEL_TEAM_ID}&projectId=${VERCEL_PROJECT_ID}&target=production&limit=1`,
    token,
  )
  const latestDeplId = deploymentsRes.deployments[0]?.uid
  if (!latestDeplId) throw new Error('No se encontró ningún deploy en producción.')

  const fileTree = await apiGet<VercelFile[]>(
    `/v13/deployments/${latestDeplId}/files?teamId=${VERCEL_TEAM_ID}`,
    token,
  )
  const existingFiles = flattenTree(fileTree)

  onProgress('Subiendo PDF…')
  await uploadVercelFile(token, pdfSha, pdfFile.size, pdfBytes)

  onProgress('Subiendo issues.json…')
  await uploadVercelFile(token, jsonSha, jsonBytes.length, jsonBytes)

  onProgress('Creando nuevo despliegue…')
  const pdfPath = `pdfs/${pdfFile.name}`
  const newFileList = [
    ...existingFiles.filter((f) => f.file !== pdfPath && f.file !== 'data/issues.json'),
    { file: pdfPath, sha: pdfSha },
    { file: 'data/issues.json', sha: jsonSha },
  ]

  const deployRes = await fetch(
    `${VERCEL_API}/v13/deployments?teamId=${VERCEL_TEAM_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'boletin-wessex-school',
        target: 'production',
        files: newFileList,
        projectSettings: { framework: null },
      }),
    },
  )
  if (!deployRes.ok) {
    const err = await deployRes.text()
    throw new Error(`Error creando despliegue: ${err.slice(0, 300)}`)
  }
}

async function uploadVercelFile(
  token: string,
  sha: string,
  size: number,
  content: Uint8Array,
): Promise<void> {
  const res = await fetch(`${VERCEL_API}/v2/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': sha,
      'x-vercel-size': String(size),
      'x-now-digest': sha,
      'x-now-size': String(size),
    },
    body: content as BodyInit,
  })
  // 200 = uploaded, 409 = already exists (both OK)
  if (!res.ok && res.status !== 409) {
    throw new Error(`Error subiendo archivo (${res.status})`)
  }
}

export const PAT_KEY = 'vercel_pat_v1'
export function getSavedPat(): string {
  return localStorage.getItem(PAT_KEY) ?? ''
}
export function savePat(token: string) {
  localStorage.setItem(PAT_KEY, token)
}

// ── Delete: update just the issues.json ─────────────────────────────────────
export async function updateIssuesJson(
  token: string,
  updatedJson: string,
  onProgress: ProgressFn,
): Promise<void> {
  const enc = new TextEncoder()
  const jsonBytes = enc.encode(updatedJson)

  onProgress('Calculando hash…')
  const jsonSha = await sha1Hex(jsonBytes.buffer as ArrayBuffer)

  onProgress('Obteniendo archivos actuales…')
  const deploymentsRes = await apiGet<{ deployments: { uid: string }[] }>(
    `/v6/deployments?teamId=${VERCEL_TEAM_ID}&projectId=${VERCEL_PROJECT_ID}&target=production&limit=1`,
    token,
  )
  const latestDeplId = deploymentsRes.deployments[0]?.uid
  if (!latestDeplId) throw new Error('No se encontró ningún deploy.')

  const fileTree = await apiGet<VercelFile[]>(
    `/v13/deployments/${latestDeplId}/files?teamId=${VERCEL_TEAM_ID}`,
    token,
  )
  const existingFiles = flattenTree(fileTree)

  onProgress('Subiendo issues.json…')
  await uploadVercelFile(token, jsonSha, jsonBytes.length, jsonBytes)

  onProgress('Creando despliegue…')
  const newFileList = [
    ...existingFiles.filter((f) => f.file !== 'data/issues.json'),
    { file: 'data/issues.json', sha: jsonSha },
  ]

  const deployRes = await fetch(
    `${VERCEL_API}/v13/deployments?teamId=${VERCEL_TEAM_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'boletin-wessex-school',
        target: 'production',
        files: newFileList,
        projectSettings: { framework: null },
      }),
    },
  )
  if (!deployRes.ok) {
    const err = await deployRes.text()
    throw new Error(`Error: ${err.slice(0, 300)}`)
  }
}
