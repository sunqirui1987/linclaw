import clsx from 'clsx'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  className?: string
  color?: 'primary' | 'success' | 'warning'
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  className,
  color = 'primary',
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(value, max))
  const percentage = Math.round((clampedValue / max) * 100)

  const barColor = {
    primary: 'bg-primary-600',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
  }

  return (
    <div className={clsx('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-300">{label}</span>
          {showValue && (
            <span className="font-medium text-gray-700 dark:text-gray-200">{percentage}%</span>
          )}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={clsx('h-full transition-all duration-300', barColor[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
