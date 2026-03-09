import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Wand2,
  Bot,
  MessageSquare,
  TerminalSquare,
  Server,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '@/stores/useAppStore'
import type { Page } from '@/types'

interface NavItem {
  id: Page
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'wizard', label: '安装向导', icon: Wand2 },
  { id: 'ai-config', label: 'AI 配置', icon: Bot },
  { id: 'channels', label: '渠道配置', icon: MessageSquare },
  { id: 'commands', label: '命令中心', icon: TerminalSquare },
  { id: 'service', label: '服务管理', icon: Server },
  { id: 'settings', label: '设置', icon: Settings },
]

export function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
        'flex flex-col fixed left-0 top-0 z-40'
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">Open-Wizard</span>
          </motion.div>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={clsx(
            'p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
            sidebarCollapsed && 'mx-auto'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id

            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentPage(item.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                    sidebarCollapsed && 'justify-center'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={clsx('w-5 h-5 flex-shrink-0', isActive && 'text-primary-600 dark:text-primary-400')} />
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            <p>Open-Wizard v1.0.0</p>
            <p className="mt-1">OpenClaw 安装引导工具</p>
          </motion.div>
        )}
      </div>
    </motion.aside>
  )
}
