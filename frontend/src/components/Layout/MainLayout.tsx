import { motion } from 'framer-motion'
import clsx from 'clsx'
import { useAppStore } from '@/stores/useAppStore'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ToastContainer } from '../common/Toast'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed } = useAppStore()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      
      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col min-h-screen"
      >
        <Header />
        
        <main className="flex-1 p-6 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </motion.div>

      <ToastContainer />
    </div>
  )
}

export function WizardLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50 dark:from-gray-900 dark:to-gray-950">
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className={clsx(
            'w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl',
            'border border-gray-200 dark:border-gray-800'
          )}
        >
          {children}
        </motion.div>
      </div>
      <ToastContainer />
    </div>
  )
}
