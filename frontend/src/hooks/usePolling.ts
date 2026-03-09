import { useEffect, useRef, useCallback } from 'react'

interface UsePollingOptions {
  interval: number
  enabled?: boolean
  immediate?: boolean
}

export function usePolling(
  callback: () => void | Promise<void>,
  options: UsePollingOptions
) {
  const { interval, enabled = true, immediate = true } = options
  const savedCallback = useRef(callback)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    stop()
    if (enabled) {
      if (immediate) {
        savedCallback.current()
      }
      intervalRef.current = setInterval(() => {
        savedCallback.current()
      }, interval)
    }
  }, [enabled, immediate, interval, stop])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  return { start, stop }
}
