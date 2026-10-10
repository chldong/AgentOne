import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ChatMessage, ChatSession, StreamEventPayload } from '@/types'
import { onChatStream, streamChat, abortChat } from '@/services/bridge'
import type { UnlistenFn } from '@tauri-apps/api/event'

const LS_KEY = 'saitronbot-desktop-sessions'

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function load(): ChatSession[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ChatSession[]) : []
  } catch {
    return []
  }
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>(load())
  const currentSessionId = ref('')
  const streaming = ref(false)
  const currentRequestId = ref('')
  let unlisten: UnlistenFn | null = null

  const currentSession = computed(
    () => sessions.value.find((s) => s.id === currentSessionId.value) || null
  )

  function persist() {
    localStorage.setItem(LS_KEY, JSON.stringify(sessions.value))
  }
  watch(sessions, persist, { deep: true })

  function sessionsForAgent(agentId: string): ChatSession[] {
    return sessions.value
      .filter((s) => s.agentId === agentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  function createSession(agentId: string): ChatSession {
    const session: ChatSession = {
      id: uid(),
      agentId,
      title: '新会话',
      messages: [],
      updatedAt: Date.now(),
    }
    sessions.value.unshift(session)
    currentSessionId.value = session.id
    return session
  }

  function selectSession(id: string) {
    if (!streaming.value) currentSessionId.value = id
  }

  function deleteSession(id: string) {
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (currentSessionId.value === id) currentSessionId.value = ''
  }

  function renameSession(id: string, title: string) {
    const s = sessions.value.find((x) => x.id === id)
    if (s) s.title = title || s.title
  }

  function findMessage(requestId: string): ChatMessage | undefined {
    for (const s of sessions.value) {
      const m = s.messages.find((x) => x.requestId === requestId)
      if (m) return m
    }
    return undefined
  }

  function sessionOf(message: ChatMessage): ChatSession | undefined {
    return sessions.value.find((s) => s.messages.includes(message))
  }

  function handleEvent(p: StreamEventPayload) {
    const msg = findMessage(p.requestId)
    if (!msg) return
    const session = sessionOf(msg)
    switch (p.kind) {
      case 'session':
        if (session && p.data) session.serverSessionId = p.data
        break
      case 'delta':
        msg.content += p.data
        break
      case 'thinking':
        msg.thinking = (msg.thinking || '') + p.data
        break
      case 'done':
        msg.status = 'done'
        streaming.value = false
        break
      case 'error':
        msg.status = 'error'
        msg.content += (msg.content ? '\n\n' : '') + '⚠️ ' + p.data
        streaming.value = false
        break
    }
    if (session) session.updatedAt = Date.now()
  }

  async function bindStream() {
    if (unlisten) return
    unlisten = await onChatStream(handleEvent)
  }

  async function send(args: { agentId: string; message: string; baseUrl: string; apiKey: string }) {
    if (streaming.value) return
    let session = currentSession.value
    if (!session || session.agentId !== args.agentId) {
      session = createSession(args.agentId)
    }

    session.messages.push({
      id: uid(),
      role: 'user',
      content: args.message,
      createdAt: Date.now(),
      status: 'done',
    })
    if (session.title === '新会话') {
      session.title = args.message.slice(0, 24) || '新会话'
    }

    const requestId = uid()
    const assistant: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      thinking: '',
      createdAt: Date.now(),
      status: 'streaming',
      requestId,
    }
    session.messages.push(assistant)
    session.updatedAt = Date.now()
    streaming.value = true
    currentRequestId.value = requestId

    try {
      await streamChat({
        requestId,
        baseUrl: args.baseUrl,
        apiKey: args.apiKey,
        agentId: args.agentId,
        message: args.message,
        sessionId: session.serverSessionId || null,
      })
    } catch (e) {
      assistant.status = 'error'
      assistant.content += (assistant.content ? '\n\n' : '') + '⚠️ ' + String(e)
      streaming.value = false
    }
  }

  async function stop() {
    if (currentRequestId.value) {
      try {
        await abortChat(currentRequestId.value)
      } catch {
        /* ignore */
      }
    }
    streaming.value = false
  }

  function clearAll() {
    sessions.value = []
    currentSessionId.value = ''
  }

  return {
    sessions,
    currentSessionId,
    streaming,
    currentSession,
    sessionsForAgent,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    bindStream,
    send,
    stop,
    clearAll,
  }
})