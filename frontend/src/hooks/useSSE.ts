import { useEffect, useRef, useCallback, useState } from 'react'

interface UseSSEOptions {
  onMessage?: (data: string) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  autoConnect?: boolean
}

interface UseSSEResult {
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  error: Event | null
}

export function useSSE(
  url: string,
  options: UseSSEOptions = {}
): UseSSEResult {
  const { onMessage, onError, onOpen, autoConnect = true } = options
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Event | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = { onMessage, onError, onOpen }
  }, [onMessage, onError, onOpen])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [])

  const connect = useCallback(() => {
    disconnect()

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
      optionsRef.current.onOpen?.()
    }

    eventSource.onmessage = (event) => {
      optionsRef.current.onMessage?.(event.data)
    }

    eventSource.onerror = (err) => {
      setError(err)
      setIsConnected(false)
      optionsRef.current.onError?.(err)
    }
  }, [url, disconnect])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    return disconnect
  }, [autoConnect, connect, disconnect])

  return { isConnected, connect, disconnect, error }
}
