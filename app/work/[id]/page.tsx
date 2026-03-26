import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import WorkPageClient from './WorkPageClient'

interface WorkRow {
  id: string
  image_url: string
  title: string
  year: string
  place: string
  width: string
  height: string
  unit: string
  material: string
  ai_analysis?: {
    style?: string
    description?: string
    subject?: string
    colorPalette?: string[]
  }
  copyright_holder: string
  copyright_year: string
  is_public: boolean
}

async function fetchWork(id: string): Promise<WorkRow | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/work/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const work = await fetchWork(id)
  if (!work) return { title: 'Work not found' }
  const title = work.title || 'Untitled'
  const description = work.ai_analysis?.description ?? `${work.year ? work.year + ' · ' : ''}${work.material}`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: work.image_url }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [work.image_url],
    },
  }
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const work = await fetchWork(id)
  if (!work) notFound()
  return <WorkPageClient work={work} />
}
