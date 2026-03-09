import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'

interface UseApiOptions {
  showErrorToast?: boolean
}

interface UseApiResult<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  execute: () => Promise<T | null>
}

export function useApi<T>(
  apiCall: () => Promise<{ ok: boolean; data?: T; error?: string }>,
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { showErrorToast = true } = options
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const addToast = useAppStore((state) => state.addToast)

  const execute = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await apiCall()

      if (result.ok && result.data !== undefined) {
        setData(result.data)
        return result.data
      } else {
        const errorMessage = result.error || 'Unknown error'
        setError(errorMessage)
        if (showErrorToast) {
          addToast({ type: 'error', message: errorMessage })
        }
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      if (showErrorToast) {
        addToast({ type: 'error', message: errorMessage })
      }
      return null
    } finally {
      setIsLoading(false)
    }
  }, [apiCall, showErrorToast, addToast])

  return { data, error, isLoading, execute }
}
