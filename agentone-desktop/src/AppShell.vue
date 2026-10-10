<template>
  <div class="shell">
    <aside class="side">
      <div class="brand">
        <img class="brand-logo" src="/saitronbot-logo-inline.svg" alt="SaitronBot" />
      </div>

      <div class="agent-picker">
        <n-select
          :value="config.activeAgentId || null"
          :options="agentOptions"
          :placeholder="config.agents.length ? '选择 Agent' : '请先在设置中添加 Agent'"
          size="small"
          @update:value="onPickAgent"
        />
      </div>

      <n-button
        class="new-btn"
        type="primary"
        size="small"
        :disabled="!config.activeAgentId"
        @click="onNewSession"
      >
        + 新建会话
      </n-button>

      <div class="session-list">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === chat.currentSessionId }"
          @click="chat.selectSession(s.id)"
        >
          <span class="session-title">{{ s.title }}</span>
          <n-button
            class="del"
            size="tiny"
            quaternary
            type="error"
            @click.stop="chat.deleteSession(s.id)"
          >
            ×
          </n-button>
        </div>
        <div v-if="sessions.length === 0" class="session-empty">暂无会话</div>
      </div>

      <div class="side-footer">
        <n-button size="small" block @click="settingsOpen = true">设置</n-button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-title">{{ config.activeAgent?.name || 'SaitronBot' }}</div>
        <div class="conn" :class="{ on: config.isConfigured }">
          <span class="conn-dot"></span>
          {{ config.isConfigured ? '已配置' : '未配置' }}
        </div>
      </header>

      <div ref="scrollEl" class="messages">
        <div v-if="currentMessages.length === 0" class="welcome">
          <img class="welcome-logo" src="/saitronbot-icon.svg" alt="SaitronBot" />
          <div class="welcome-title">SaitronBot 桌面客户端</div>
          <div class="welcome-sub">选择 Agent 后直接开始对话</div>
        </div>
        <MessageItem v-for="m in currentMessages" :key="m.id" :message="m" />
      </div>

      <footer class="composer">
        <n-input
          v-model:value="input"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 6 }"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          @keydown="onKeydown"
        />
        <n-button v-if="chat.streaming" type="error" @click="chat.stop()">停止</n-button>
        <n-button v-else type="primary" :disabled="!input.trim()" @click="onSend">发送</n-button>
      </footer>
    </main>

    <SettingsDrawer v-model:show="settingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { NSelect, NButton, NInput, useMessage } from 'naive-ui'
import MessageItem from './components/MessageItem.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import { useConfigStore } from '@/stores/config'
import { useChatStore } from '@/stores/chat'

const config = useConfigStore()
const chat = useChatStore()
const message = useMessage()

const settingsOpen = ref(false)
const input = ref('')
const scrollEl = ref<HTMLElement | null>(null)

const agentOptions = computed(() =>
  config.agents.map((a) => ({ label: a.name, value: a.id }))
)
const sessions = computed(() =>
  config.activeAgentId ? chat.sessionsForAgent(config.activeAgentId) : []
)
const currentMessages = computed(() => chat.currentSession?.messages || [])

function ensureSession() {
  const list = config.activeAgentId ? chat.sessionsForAgent(config.activeAgentId) : []
  chat.currentSessionId = list.length ? list[0].id : ''
}

function onPickAgent(id: string) {
  config.activeAgentId = id
  ensureSession()
}

function onNewSession() {
  if (config.activeAgentId) chat.createSession(config.activeAgentId)
}

async function onSend() {
  const text = input.value.trim()
  if (!text) return
  if (!config.isConfigured) {
    message.warning('请先在设置中填写服务器地址、API Key 并添加 Agent')
    settingsOpen.value = true
    return
  }
  input.value = ''
  await chat.send({
    agentId: config.activeAgentId,
    message: text,
    baseUrl: config.baseUrl.trim(),
    apiKey: config.apiKey.trim(),
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    onSend()
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}

watch(currentMessages, scrollToBottom, { deep: true })
watch(() => config.activeAgentId, ensureSession)

onMounted(async () => {
  await chat.bindStream()
  ensureSession()
  if (!config.isConfigured) settingsOpen.value = true
})
</script>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.side {
  width: 260px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 12px;
}
.brand {
  padding: 4px 6px 10px;
  border-bottom: 1px solid var(--border-light);
}
.brand-logo {
  height: 34px;
  width: auto;
  display: block;
}
.agent-picker {
  margin-top: 4px;
}
.new-btn {
  width: 100%;
}
.session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}
.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: background 0.15s ease;
}
.session-item:hover {
  background: var(--surface-alt);
}
.session-item.active {
  background: var(--primary-bg);
  color: var(--primary);
  font-weight: 600;
}
.session-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.del {
  opacity: 0;
}
.session-item:hover .del {
  opacity: 1;
}
.session-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 16px 0;
}
.side-footer {
  border-top: 1px solid var(--border-light);
  padding-top: 12px;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid var(--border);
}
.topbar-title {
  font-size: 15px;
  font-weight: 700;
}
.conn {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.conn-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-placeholder);
}
.conn.on .conn-dot {
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 24px 16px;
  min-height: 0;
}
.welcome {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
}
.welcome-logo {
  width: 64px;
  height: 64px;
  opacity: 0.85;
}
.welcome-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.welcome-sub {
  font-size: 13px;
}
.composer {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 14px 24px 18px;
  background: #fff;
  border-top: 1px solid var(--border);
}
.composer :deep(.n-input) {
  flex: 1;
}
</style>