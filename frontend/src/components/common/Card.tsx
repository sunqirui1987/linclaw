import { motion } from 'framer-motion'
import clsx from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

export function Card({
  children,
  className,
  padding = 'md',
  hover = false,
  onClick,
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  const Component = onClick ? motion.button : motion.div

  return (
    <Component
      onClick={onClick}
      whileHover={hover ? { scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      className={clsx(
        'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800',
        hover && 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200',
        onClick && 'cursor-pointer text-left w-full',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </Component>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

interface CardContentProps {
  children: React.ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={className}>{children}</div>
}

interface CardFooterProps {
  children: React.ReactNode
  className?: string
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={clsx(
        'mt-4 pt-4 border-t border-gray-200 dark:border-gray-800',
        className
      )}
    >
      {children}
    </div>
  )
}
