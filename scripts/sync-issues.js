/**
 * sync-issues.js
 * Fetches the live issues.json from the deployed site and saves it locally
 * so that local builds never overwrite admin-published entries.
 */
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LIVE_URL = 'https://boletin-wessex-school.netlify.app/data/issues.json'
const LOCAL_PATH = join(__dirname, '../public/data/issues.json')

try {
  const res = await fetch(LIVE_URL, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  writeFileSync(LOCAL_PATH, JSON.stringify(data, null, 2))
  console.log(`✓ sync-issues: ${data.length} boletín(es) sincronizados desde el sitio en vivo`)
} catch (err) {
  console.warn(`⚠ sync-issues: no se pudo sincronizar (${err.message}). Usando archivo local.`)
}
