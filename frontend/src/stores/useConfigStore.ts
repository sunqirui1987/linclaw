import { create } from 'zustand'
import type { AIProvider, ChannelConfig } from '@/types'

interface ConfigState {
  aiProviders: AIProvider[]
  currentProvider: string
  currentModel: string
  channels: ChannelConfig[]
  isLoading: boolean
  
  setAIProviders: (providers: AIProvider[]) => void
  setCurrentProvider: (provider: string) => void
  setCurrentModel: (model: string) => void
  setChannels: (channels: ChannelConfig[]) => void
  updateChannel: (id: string, config: Partial<ChannelConfig>) => void
  setIsLoading: (loading: boolean) => void
}

export const useConfigStore = create<ConfigState>()((set) => ({
  aiProviders: [],
  currentProvider: '',
  currentModel: '',
  channels: [],
  isLoading: false,

  setAIProviders: (providers) => set({ aiProviders: providers }),
  setCurrentProvider: (provider) => set({ currentProvider: provider }),
  setCurrentModel: (model) => set({ currentModel: model }),
  setChannels: (channels) => set({ channels }),
  updateChannel: (id, config) => set((state) => ({
    channels: state.channels.map((ch) =>
      ch.id === id ? { ...ch, ...config } : ch
    ),
  })),
  setIsLoading: (loading) => set({ isLoading: loading }),
}))
