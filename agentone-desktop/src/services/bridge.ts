import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { StreamEventPayload } from '@/types'

export interface StreamArgs {
  requestId: string
  baseUrl: string
  apiKey: string
  agentId: string
  message: string
  sessionId: string | null
}

export interface TestResult {
  ok: boolean
  message: string
}

/** 单次事件通道，Rust 侧按 requestId 区分并发请求 */
export const CHAT_EVENT = 'chat://stream'

export function streamChat(args: StreamArgs): Promise<void> {
  return invoke('stream_chat', { args })
}

export function abortChat(requestId: string): Promise<void> {
  return invoke('abort_chat', { requestId })
}

export function testConnection(baseUrl: string, apiKey: string): Promise<TestResult> {
  return invoke('test_connection', { baseUrl, apiKey })
}

export function onChatStream(cb: (payload: StreamEventPayload) => void): Promise<UnlistenFn> {
  return listen<StreamEventPayload>(CHAT_EVENT, (event) => cb(event.payload))
}