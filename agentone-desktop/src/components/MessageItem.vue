<template>
  <div class="bubble" :class="message.role">
    <div class="avatar">
      <template v-if="message.role === 'user'">我</template>
      <img v-else :src="'/saitronbot-icon-tight.svg'" alt="bot" />
    </div>
    <div class="body">
      <details v-if="message.thinking" class="thinking">
        <summary>思考过程</summary>
        <pre>{{ message.thinking }}</pre>
      </details>
      <div v-if="message.role === 'user'" class="text plain">{{ message.content }}</div>
      <div v-else class="text markdown" v-html="html"></div>
      <span v-if="message.status === 'streaming'" class="caret">▍</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '@/types'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{ message: ChatMessage }>()
const html = computed(() => renderMarkdown(props.message.content))
</script>

<style scoped>
.bubble {
  display: flex;
  gap: 10px;
  margin: 18px 0;
  align-items: flex-start;
}
.bubble.user {
  flex-direction: row-reverse;
}
.avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--grad-primary);
}
.bubble.user .avatar {
  background: #334155;
}
.avatar img {
  width: 20px;
  height: 20px;
}
.body {
  max-width: 78%;
  min-width: 0;
}
.bubble.user .body {
  text-align: right;
}
.text {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
  display: inline-block;
  text-align: left;
}
.bubble.user .text {
  background: var(--primary);
  color: #fff;
  border-top-right-radius: 4px;
}
.bubble.assistant .text {
  background: #fff;
  border: 1px solid var(--border);
  color: var(--text);
  border-top-left-radius: 4px;
}
.markdown :deep(p) {
  margin: 0 0 8px;
}
.markdown :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown :deep(pre) {
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
}
.markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
.markdown :deep(:not(pre) > code) {
  background: var(--primary-light);
  padding: 1px 5px;
  border-radius: 4px;
}
.markdown :deep(a) {
  color: var(--primary);
}
.thinking {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.thinking summary {
  cursor: pointer;
  user-select: none;
}
.thinking pre {
  white-space: pre-wrap;
  margin: 6px 0 0;
  padding: 8px 10px;
  background: var(--surface-alt);
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
}
.caret {
  animation: blink 1s steps(2) infinite;
  color: var(--primary);
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>