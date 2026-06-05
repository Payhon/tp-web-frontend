<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref, watch } from 'vue'
import { NButton, NCard, NDataTable, NDescriptions, NDescriptionsItem, NSpace, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useRoute } from 'vue-router'
import { getOtaTaskDetailByPage, updateOtaTaskDetailStatus } from '@/service/api/bms'

const route = useRoute()
const message = useMessage()

const taskId = computed(() => (route.query.task_id as string) || '')

const loading = ref(false)
const list = ref<any[]>([])
const statistics = ref<any[]>([])

function statusLabel(v: number) {
  // 1-待推送2-已推送3-升级中4-升级成功5-升级失败6-已取消
  const map: Record<number, string> = {
    1: bt('auto.s_bf258f2517'),
    2: bt('auto.s_cd015eac54'),
    3: bt('auto.s_c65f8ac5c0'),
    4: bt('auto.s_e64d788d11'),
    5: bt('auto.s_4ae2f0a20f'),
    6: bt('auto.s_2111ccbb19')
  }
  return map[v] || String(v)
}

function statusTagType(v: number) {
  if (v === 4) return 'success'
  if (v === 5) return 'error'
  if (v === 6) return 'default'
  if (v === 3) return 'warning'
  if (v === 2) return 'info'
  return 'warning'
}

async function fetchDetail() {
  if (!taskId.value) return
  loading.value = true
  try {
    const res: any = await getOtaTaskDetailByPage({
      page: 1,
      page_size: 1000,
      ota_upgrade_task_id: taskId.value
    })
    list.value = res?.data?.list || []
    statistics.value = res?.data?.statistics || []
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_b1e725344d'))
    list.value = []
    statistics.value = []
  } finally {
    loading.value = false
  }
}

async function cancelUpgrade(detailId: string) {
  try {
    await updateOtaTaskDetailStatus({ id: detailId, action: 6 })
    message.success(bt('auto.s_2111ccbb19'))
    fetchDetail()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_482e8539da'))
  }
}

async function retryUpgrade(detailId: string) {
  try {
    await updateOtaTaskDetailStatus({ id: detailId, action: 1 })
    message.success(bt('auto.s_eb318b2c53'))
    fetchDetail()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_5ce757ed8c'))
  }
}

const columns = computed<DataTableColumns<any>>(() => [
  { key: 'device_number', title: bt('auto.s_7079d2e6c4'), minWidth: 140 },
  { key: 'name', title: bt('auto.s_9f694f603c'), minWidth: 160, render: r => r.name || '--' },
  { key: 'current_version', title: bt('auto.s_9b601b8efa'), minWidth: 120, render: r => r.current_version || '--' },
  { key: 'version', title: bt('auto.s_bc15bf0b06'), minWidth: 120, render: r => r.version || '--' },
  { key: 'step', title: bt('auto.s_c7bff79d05'), minWidth: 90, render: r => r.step ?? '--' },
  { key: 'updated_at', title: bt('auto.s_a001a226fd'), minWidth: 160, render: r => r.updated_at || '--' },
  {
    key: 'status',
    title: bt('auto.s_3fea7ca76c'),
    minWidth: 120,
    render: r => <NTag type={statusTagType(r.status)}>{statusLabel(r.status)}</NTag>
  },
  { key: 'status_description', title: bt('auto.s_920f05031b'), minWidth: 220, render: r => r.status_description || '--' },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    minWidth: 180,
    fixed: 'right',
    render: r => (
      <NSpace>
        <NButton
          size="small"
          type="warning"
          disabled={!(r.status === 1 || r.status === 2 || r.status === 3)}
          onClick={() => cancelUpgrade(r.id)}
        >{bt('auto.s_625fb26b4b')}</NButton>
        <NButton size="small" type="primary" disabled={r.status !== 5} onClick={() => retryUpgrade(r.id)}>{bt('auto.s_d188392d3d')}</NButton>
      </NSpace>
    )
  }
])

watch(
  () => taskId.value,
  () => fetchDetail(),
  { immediate: true }
)
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard
      :title="bt('pages.ota.taskDetailTitle', { id: taskId || '-' })"
      :bordered="false"
      size="small"
      class="sm:flex-1-hidden card-wrapper"
    >
      <div class="mb-4 flex items-center justify-between">
        <div />
        <NSpace>
          <NButton :loading="loading" @click="fetchDetail">{{ bt('auto.s_694fc5efa9') }}</NButton>
        </NSpace>
      </div>

      <NDescriptions v-if="statistics?.length" bordered label-placement="left" :column="4" class="mb-4">
        <NDescriptionsItem v-for="s in statistics" :key="s.status" :label="statusLabel(Number(s.status))">
          {{ s.count }}
        </NDescriptionsItem>
      </NDescriptions>

      <NDataTable :columns="columns" :data="list" :loading="loading" :row-key="row => row.id" :scroll-x="1400" />
    </NCard>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
