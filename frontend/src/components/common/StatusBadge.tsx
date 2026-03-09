import clsx from 'clsx'

type Status = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'default'

interface StatusBadgeProps {
  status: Status
  children: React.ReactNode
  dot?: boolean
  size?: 'sm' | 'md'
}

const statusStyles: Record<Status, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const dotStyles: Record<Status, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
  pending: 'bg-gray-400',
  default: 'bg-gray-400',
}

export function StatusBadge({
  status,
  children,
  dot = true,
  size = 'md',
}: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        statusStyles[status],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full', dotStyles[status])} />
      )}
      {children}
    </span>
  )
}

interface StatusIndicatorProps {
  status: Status
  label?: string
  pulse?: boolean
}

export function StatusIndicator({ status, label, pulse = false }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        {pulse && status === 'success' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span
          className={clsx(
            'relative inline-flex rounded-full h-3 w-3',
            dotStyles[status]
          )}
        />
      </span>
      {label && (
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      )}
    </div>
  )
}
