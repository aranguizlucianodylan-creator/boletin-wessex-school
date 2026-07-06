const GITHUB_API = 'https://api.github.com'
const API_VERSION = '2026-03-10'

export const REPO_FULL_NAME = 'aranguizlucianodylan-creator/boletin-wessex-school'
export const REPO_BRANCH = 'main'
export const SITE_URL = 'https://aranguizlucianodylan-creator.github.io/boletin-wessex-school/'

const MAX_GITHUB_FILE_SIZE = 100 * 1024 * 1024

export const PAT_KEY = 'github_pat_v1'

export type ProgressFn = (message: string) => void

interface GitRefResponse {
  object: {
    sha: string
  }
}

interface GitCommitResponse {
  sha: string
  tree: {
    sha: string
  }
}

interface CreateBlobResponse {
  sha: string
}

function buildHeaders(token: string, extraHeaders?: HeadersInit): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
    ...extraHeaders,
  }
}

async function githubRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: buildHeaders(token, init?.headers),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GitHub ${response.status}: ${text.slice(0, 300)}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Formato de lectura no compatible.'))
        return
      }

      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error('No se pudo codificar el archivo en base64.'))
        return
      }

      resolve(base64)
    }
    reader.readAsDataURL(blob)
  })
}

async function createBlob(
  token: string,
  content: string,
  encoding: 'utf-8' | 'base64',
): Promise<string> {
  const response = await githubRequest<CreateBlobResponse>(
    `/repos/${REPO_FULL_NAME}/git/blobs`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, encoding }),
    },
  )

  return response.sha
}

async function commitFiles(
  token: string,
  files: Array<{ path: string; content: string; encoding: 'utf-8' | 'base64' }>,
  message: string,
  onProgress: ProgressFn,
): Promise<void> {
  onProgress('Leyendo rama principal...')
  const currentRef = await githubRequest<GitRefResponse>(
    `/repos/${REPO_FULL_NAME}/git/ref/heads/${REPO_BRANCH}`,
    token,
  )

  onProgress('Leyendo commit actual...')
  const currentCommit = await githubRequest<GitCommitResponse>(
    `/repos/${REPO_FULL_NAME}/git/commits/${currentRef.object.sha}`,
    token,
  )

  onProgress('Subiendo archivos al repositorio...')
  const blobEntries = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: await createBlob(token, file.content, file.encoding),
    })),
  )

  onProgress('Creando arbol de cambios...')
  const newTree = await githubRequest<{ sha: string }>(
    `/repos/${REPO_FULL_NAME}/git/trees`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: currentCommit.tree.sha,
        tree: blobEntries,
      }),
    },
  )

  onProgress('Creando commit...')
  const newCommit = await githubRequest<{ sha: string }>(
    `/repos/${REPO_FULL_NAME}/git/commits`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [currentRef.object.sha],
      }),
    },
  )

  onProgress('Actualizando rama principal...')
  await githubRequest<void>(
    `/repos/${REPO_FULL_NAME}/git/refs/heads/${REPO_BRANCH}`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sha: newCommit.sha,
        force: false,
      }),
    },
  )
}

export async function publishBulletin(
  token: string,
  pdfFile: File,
  updatedJson: string,
  commitMessage: string,
  onProgress: ProgressFn,
): Promise<void> {
  if (pdfFile.size > MAX_GITHUB_FILE_SIZE) {
    throw new Error('El PDF supera 100 MB y GitHub no lo acepta. Comprimelo antes de publicar.')
  }

  onProgress('Codificando PDF...')
  const pdfBase64 = await readBlobAsBase64(pdfFile)

  await commitFiles(
    token,
    [
      {
        path: `public/pdfs/${pdfFile.name}`,
        content: pdfBase64,
        encoding: 'base64',
      },
      {
        path: 'public/data/issues.json',
        content: updatedJson,
        encoding: 'utf-8',
      },
    ],
    commitMessage,
    onProgress,
  )
}

export async function updateIssuesJson(
  token: string,
  updatedJson: string,
  commitMessage: string,
  onProgress: ProgressFn,
): Promise<void> {
  await commitFiles(
    token,
    [
      {
        path: 'public/data/issues.json',
        content: updatedJson,
        encoding: 'utf-8',
      },
    ],
    commitMessage,
    onProgress,
  )
}

export function getSavedPat(): string {
  return localStorage.getItem(PAT_KEY) ?? ''
}

export function savePat(token: string) {
  localStorage.setItem(PAT_KEY, token)
}

export function buildPublishedUrl(route: string): string {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  return `${SITE_URL.replace(/\/$/, '')}/#${normalizedRoute}`
}
