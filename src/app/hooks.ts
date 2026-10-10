import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(!!path)
  const load = useCallback(async () => {
    if (!path) return
    setLoading(true)
    try {
      setData(await api<T>(path))
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [path])
  useEffect(() => {
    load()
  }, [load])
  return { data, error, loading, reload: load, setData }
}

export type Brand = {
  id: string
  name: string
  description: string | null
  industry: string | null
  targetAudience: string | null
  primaryColor: string | null
  secondaryColor: string | null
  slogan: string | null
  tone: string | null
  language: 'tr' | 'en'
  preferredPhrases: string | null
  avoidedPhrases: string | null
  isDefault: boolean
}

export type ProjectSummary = {
  id: string
  brandId: string | null
  title: string
  type: 'text' | 'campaign' | 'image'
  status: 'draft' | 'in_progress' | 'completed'
  createdAt: string
  updatedAt: string
}

export type Usage = {
  date: string
  text: { used: number; limit: number; remaining: number }
  image: { used: number; limit: number; remaining: number }
  lastUsedAt: string | null
  resetsAt: string
  aiEnabled: boolean
  systemCapacity: { text: boolean; image: boolean }
  maxUploadMb: number
  announcement: string | null
}

export const useBrands = () => useFetch<{ brands: Brand[] }>('/api/brands')
export const useUsage = () => useFetch<Usage>('/api/ai/usage')
