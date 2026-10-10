<template>
  <n-drawer
    :show="show"
    :width="440"
    placement="right"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-drawer-content title="设置" closable>
      <n-form label-placement="top">
        <n-form-item label="服务器地址">
          <n-input v-model:value="config.baseUrl" placeholder="https://uibp.saitron.net" />
        </n-form-item>
        <n-form-item label="API Key">
          <n-input
            v-model:value="config.apiKey"
            type="password"
            show-password-on="click"
            placeholder="在控制台「API Key」页创建后粘贴"
          />
        </n-form-item>
        <n-button :loading="testing" block @click="onTest">测试连接</n-button>
        <div v-if="testMsg" class="test-result" :class="{ ok: testOk }">{{ testMsg }}</div>
      </n-form>

      <n-divider />

      <div class="section-title">Agent 列表</div>
      <div class="hint">
        开放 API 不提供 Agent 列举接口，请从控制台 Agent 详情页复制 Agent ID 后添加，可保存多个随时切换。
      </div>
      <div class="add-row">
        <n-input v-model:value="draftName" placeholder="名称（可选）" style="flex: 0 0 38%" />
        <n-input v-model:value="draftId" placeholder="Agent ID" />
        <n-button type="primary" @click="onAdd">添加</n-button>
      </div>

      <div class="agent-list">
        <div
          v-for="a in config.agents"
          :key="a.id"
          class="agent-row"
          :class="{ active: a.id === config.activeAgentId }"
        >
          <div class="agent-meta" @click="config.activeAgentId = a.id">
            <div class="agent-name">{{ a.name }}</div>
            <div class="agent-id">{{ a.id }}</div>
          </div>
          <n-button size="tiny" quaternary type="error" @click="config.removeAgent(a.id)">
            删除
          </n-button>
        </div>
        <div v-if="config.agents.length === 0" class="empty">还没有添加 Agent</div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NDivider,
  useMessage,
} from 'naive-ui'
import { useConfigStore } from '@/stores/config'
import { testConnection } from '@/services/bridge'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const config = useConfigStore()
const message = useMessage()

const testing = ref(false)
const testOk = ref(false)
const testMsg = ref('')
const draftName = ref('')
const draftId = ref('')

async function onTest() {
  testing.value = true
  testMsg.value = ''
  try {
    const r = await testConnection(config.baseUrl.trim(), config.apiKey.trim())
    testOk.value = r.ok
    testMsg.value = r.message
  } catch (e) {
    testOk.value = false
    testMsg.value = '调用失败：' + String(e)
  } finally {
    testing.value = false
  }
}

function onAdd() {
  if (!draftId.value.trim()) {
    message.warning('请填写 Agent ID')
    return
  }
  config.addAgent({ id: draftId.value, name: draftName.value })
  message.success('已添加')
  draftName.value = ''
  draftId.value = ''
}

void props
</script>

<style scoped>
.section-title {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 6px;
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 12px;
}
.add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.test-result {
  margin-top: 10px;
  font-size: 12px;
  color: var(--red);
}
.test-result.ok {
  color: var(--green);
}
.agent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.agent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.agent-row:hover {
  border-color: var(--primary-border);
}
.agent-row.active {
  border-color: var(--primary);
  background: var(--primary-bg);
}
.agent-meta {
  min-width: 0;
  flex: 1;
}
.agent-name {
  font-size: 13px;
  font-weight: 600;
}
.agent-id {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 0;
  text-align: center;
}
</style>