import { useEffect, useState } from 'react'
import { MainLayout, WizardLayout } from '@/components/Layout/MainLayout'
import { WizardContainer } from '@/components/Wizard/WizardContainer'
import { Dashboard } from '@/components/Dashboard/Dashboard'
import { AIConfig } from '@/components/AIConfig/AIConfig'
import { ChannelsConfig } from '@/components/Channels/ChannelsConfig'
import { CommandCenter } from '@/components/Commands/CommandCenter'
import { ServiceControl } from '@/components/Service/ServiceControl'
import { Settings } from '@/components/Settings/Settings'
import { useAppStore } from '@/stores/useAppStore'
import { setupApi } from '@/utils/api'
import type { SetupState } from '@/types'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 dark:bg-gray-950 dark:text-gray-300">
      正在加载 Open-Wizard...
    </div>
  )
}

export default function App() {
  const { currentPage, theme, setCurrentPage } = useAppStore()
  const [setupState, setSetupState] = useState<SetupState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    const loadSetupState = async () => {
      setLoading(true)
      try {
        const result = await setupApi.getState()
        if (result.ok && result.data) {
          setSetupState(result.data)
        }
      } finally {
        setLoading(false)
      }
    }

    void loadSetupState()
  }, [])

  const onWizardCompleted = () => {
    setSetupState((prev) => (prev ? { ...prev, isConfigured: true } : prev))
    setCurrentPage('dashboard')
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (setupState && !setupState.isConfigured) {
    return (
      <WizardLayout>
        <WizardContainer onCompleted={onWizardCompleted} />
      </WizardLayout>
    )
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'wizard':
        return <WizardContainer onCompleted={onWizardCompleted} />
      case 'dashboard':
        return <Dashboard />
      case 'ai-config':
        return <AIConfig />
      case 'channels':
        return <ChannelsConfig />
      case 'commands':
        return <CommandCenter />
      case 'service':
        return <ServiceControl />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return <MainLayout>{renderPage()}</MainLayout>
}
