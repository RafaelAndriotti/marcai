import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/api'

interface FetchState<T> {
  data: T | undefined
  error: ApiError | undefined
  loading: boolean
  refetch: () => void
}

/** Busca simples. Refaz a busca quando `deps` mudam; ignora respostas obsoletas. */
export function useFetch<T>(fetcher: () => Promise<T>, deps: readonly unknown[]): FetchState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<ApiError>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(undefined)
    fetcherRef.current().then(
      (d) => {
        if (stale) return
        setData(d)
        setLoading(false)
      },
      (e: unknown) => {
        if (stale) return
        setError(e instanceof ApiError ? e : new ApiError('NETWORK_ERROR', 'Erro inesperado.', 0))
        setLoading(false)
      },
    )
    return () => {
      stale = true
    }
  }, [...deps, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, refetch }
}
