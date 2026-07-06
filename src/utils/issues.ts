import type { Issue } from '../types/issue'

export const sortIssues = (issues: Issue[]) => {
  return [...issues].sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1

    const dateA = new Date(a.publishedAt).getTime()
    const dateB = new Date(b.publishedAt).getTime()
    return dateB - dateA
  })
}

export const getIssueBySlug = (issues: Issue[], slug: string) => {
  return issues.find((issue) => issue.slug === slug)
}

export const buildSlug = (title: string, month: string, year: number) => {
  const base = `${title}-${month}-${year}`.toLowerCase()
  return base.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export const formatIssueDate = (publishedAt: string) => {
  return new Date(publishedAt).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
}
