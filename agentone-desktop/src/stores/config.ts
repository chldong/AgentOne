import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { AgentProfile } from '@/types'

const LS_KEY = 'saitronbot-desktop-config'
const DEFAULT_BASE_URL = 'https://uibp.saitron.net'

interface PersistShape {
  baseUrl: string
  apiKey: string
  agents: AgentProfile[]
  activeAgentId: string
}

function load(): PersistShape {
  const fallback: PersistShape = {
    baseUrl: DEFAULT_BASE_URL,
    apiKey: '',
    agents: [],
    activeAgentId: '',
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PersistShape>
    return {
      baseUrl: parsed.baseUrl || fallback.baseUrl,
      apiKey: parsed.apiKey || '',
      agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      activeAgentId: parsed.activeAgentId || '',
    }
  } catch {
    return fallback
  }
}

export const useConfigStore = defineStore('config', () => {
  const initial = load()
  const baseUrl = ref(initial.baseUrl)
  const apiKey = ref(initial.apiKey)
  const agents = ref<AgentProfile[]>(initial.agents)
  const activeAgentId = ref(initial.activeAgentId)

  const activeAgent = computed(
    () => agents.value.find((a) => a.id === activeAgentId.value) || null
  )
  const isConfigured = computed(
    () => !!baseUrl.value.trim() && !!apiKey.value.trim() && !!activeAgentId.value
  )

  function persist() {
    const data: PersistShape = {
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
      agents: agents.value,
      activeAgentId: activeAgentId.value,
    }
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  }

  watch([baseUrl, apiKey, agents, activeAgentId], persist, { deep: true })

  function addAgent(profile: AgentProfile) {
    const id = profile.id.trim()
    if (!id) return
    const existing = agents.value.find((a) => a.id === id)
    if (existing) existing.name = profile.name.trim() || existing.name
    else agents.value.push({ id, name: profile.name.trim() || id })
    if (!activeAgentId.value) activeAgentId.value = id
  }

  function removeAgent(id: string) {
    agents.value = agents.value.filter((a) => a.id !== id)
    if (activeAgentId.value === id) activeAgentId.value = agents.value[0]?.id || ''
  }

  return {
    baseUrl,
    apiKey,
    agents,
    activeAgentId,
    activeAgent,
    isConfigured,
    addAgent,
    removeAgent,
  }
})