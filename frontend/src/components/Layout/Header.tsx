import { Sun, Moon, Bell, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '@/stores/useAppStore'
import { useServiceStore } from '@/stores/useServiceStore'

const pageTitles: Record<string, string> = {
  dashboard: '仪表盘',
  wizard: '安装向导',
  'ai-config': 'AI 配置',
  channels: '渠道配置',
  commands: '命令中心',
  service: '服务管理',
  settings: '设置',
}

export function Header() {
  const { currentPage, theme, toggleTheme } = useAppStore()
  const { status } = useServiceStore()

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {pageTitles[currentPage] || ''}
        </h1>
        
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              status.running
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            )}
          >
            <span
              className={clsx(
                'w-2 h-2 rounded-full',
                status.running ? 'bg-green-500' : 'bg-gray-400'
              )}
            />
            {status.running ? '服务运行中' : '服务未运行'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status.gatewayUrl && (
          <a
            href={status.gatewayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            打开 Gateway
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <button
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
          title="通知"
        >
          <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5 text-gray-500" />
          ) : (
            <Sun className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>
    </header>
  )
}
