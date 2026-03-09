import { CheckCircle2, Circle } from 'lucide-react'
import clsx from 'clsx'
import type { AIProvider } from '@/types'

interface ProviderCardProps {
  provider: AIProvider
  selected: boolean
  onSelect: (id: string) => void
}

export function ProviderCard({ provider, selected, onSelect }: ProviderCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(provider.id)}
      className={clsx(
        'rounded-xl border p-4 text-left transition-all',
        selected
          ? 'border-primary-500 bg-primary-50 shadow-sm dark:border-primary-400 dark:bg-primary-900/20'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-white">{provider.name}</p>
        {provider.apiKeyConfigured ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <Circle className="h-4 w-4 text-gray-400" />
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{provider.description}</p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{provider.baseUrl}</p>
    </button>
  )
}
