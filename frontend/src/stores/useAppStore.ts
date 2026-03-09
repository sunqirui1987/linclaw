import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Page, Theme, Toast } from '@/types'

interface AppState {
  currentPage: Page
  theme: Theme
  toasts: Toast[]
  sidebarCollapsed: boolean
  
  setCurrentPage: (page: Page) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentPage: 'wizard',
      theme: 'light',
      toasts: [],
      sidebarCollapsed: false,

      setCurrentPage: (page) => set({ currentPage: page }),
      
      setTheme: (theme) => {
        set({ theme })
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },
      
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light'
        get().setTheme(newTheme)
      },
      
      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }]
        }))
        
        const duration = toast.duration ?? 5000
        if (duration > 0) {
          setTimeout(() => {
            get().removeToast(id)
          }, duration)
        }
      },
      
      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
      },
      
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'open-wizard-app',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
