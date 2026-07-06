const BASE_URL = import.meta.env.BASE_URL || '/'

export const withBasePath = (path: string) => {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }

  const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${normalizedBase}${normalizedPath}`
}

export const buildIssuesUrl = () => withBasePath('data/issues.json')

export const buildShareUrl = (route: string) => {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  return `${window.location.origin}${withBasePath('')}#${normalizedRoute}`
}
