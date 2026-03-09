import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import clsx from 'clsx'

interface Step {
  id: string
  label: string
  description?: string
}

interface StepperProps {
  steps: Step[]
  currentStep: string
  completedSteps: string[]
  onStepClick?: (stepId: string) => void
}

export function Stepper({ steps, currentStep, completedSteps, onStepClick }: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id)
          const isCurrent = step.id === currentStep
          const isPast = index < currentIndex

          return (
            <div
              key={step.id}
              className={clsx(
                'flex-1 flex items-center',
                index < steps.length - 1 && 'pr-4'
              )}
            >
              <button
                onClick={() => onStepClick?.(step.id)}
                disabled={!isCompleted && !isCurrent}
                className={clsx(
                  'flex items-center gap-3',
                  (isCompleted || isCurrent) && onStepClick && 'cursor-pointer',
                  !isCompleted && !isCurrent && 'cursor-default'
                )}
              >
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                  }}
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-colors',
                    isCompleted
                      ? 'bg-primary-600 text-white'
                      : isCurrent
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-600 dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-500'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </motion.div>
                <div className="hidden sm:block text-left">
                  <p
                    className={clsx(
                      'text-sm font-medium',
                      isCurrent
                        ? 'text-primary-700 dark:text-primary-400'
                        : isCompleted
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {step.description}
                    </p>
                  )}
                </div>
              </button>

              {index < steps.length - 1 && (
                <div className="flex-1 mx-4">
                  <div className="h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: isPast || isCompleted ? '100%' : '0%',
                      }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-primary-600"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface VerticalStepperProps {
  steps: Step[]
  currentStep: string
  completedSteps: string[]
}

export function VerticalStepper({ steps, currentStep, completedSteps }: VerticalStepperProps) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id)
        const isCurrent = step.id === currentStep

        return (
          <div key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  isCompleted
                    ? 'bg-primary-600 text-white'
                    : isCurrent
                    ? 'bg-primary-100 text-primary-700 border-2 border-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={clsx(
                    'w-0.5 flex-1 mt-2',
                    isCompleted ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                />
              )}
            </div>
            <div className="flex-1 pb-8">
              <p
                className={clsx(
                  'font-medium',
                  isCurrent
                    ? 'text-primary-700 dark:text-primary-400'
                    : isCompleted
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500'
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
