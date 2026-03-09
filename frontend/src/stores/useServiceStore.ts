import { create } from 'zustand'
import type { ServiceStatus } from '@/types'

interface ServiceState {
  status: ServiceStatus
  logs: string[]
  isLoading: boolean
  
  setStatus: (status: ServiceStatus) => void
  setLogs: (logs: string[]) => void
  addLog: (log: string) => void
  clearLogs: () => void
  setIsLoading: (loading: boolean) => void
}

const initialStatus: ServiceStatus = {
  running: false,
  pid: null,
  port: null,
  memory: null,
  uptime: null,
  gatewayUrl: null,
}

const LOG_LIMIT = 1200

export const useServiceStore = create<ServiceState>()((set) => ({
  status: initialStatus,
  logs: [],
  isLoading: false,

  setStatus: (status) => set({ status }),
  setLogs: (logs) => set({ logs }),
  addLog: (log) =>
    set((state) => {
      const nextLogs = [...state.logs, log]
      if (nextLogs.length > LOG_LIMIT) {
        nextLogs.splice(0, nextLogs.length - LOG_LIMIT)
      }
      return { logs: nextLogs }
    }),
  clearLogs: () => set({ logs: [] }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}))
