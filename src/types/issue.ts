export interface Issue {
  id: string
  title: string
  month: string
  year: number
  slug: string
  description: string
  pdfUrl: string
  audioUrl?: string
  coverUrl?: string
  publishedAt: string
  featured?: boolean
}
