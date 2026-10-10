export interface AgentProfile {
  id: string
  name: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  createdAt: number
  status?: 'streaming' | 'done' | 'error'
  requestId?: string
}

export interface ChatSession {
  id: string
  agentId: string
  title: string
  serverSessionId?: string
  messages: ChatMessage[]
  updatedAt: number
}

export type StreamEventKind = 'session' | 'delta' | 'thinking' | 'done' | 'error'

export interface StreamEventPayload {
  requestId: string
  kind: StreamEventKind
  data: string
}