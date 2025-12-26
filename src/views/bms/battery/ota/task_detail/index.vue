<script setup lang="tsx">
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
    1: '待推送',
    2: '已推送',
    3: '升级中',
    4: '升级成功',
    5: '升级失败',
    6: '已取消'
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
    message.error(e?.message || '获取任务详情失败')
    list.value = []
    statistics.value = []
  } finally {
    loading.value = false
  }
}

async function cancelUpgrade(detailId: string) {
  try {
    await updateOtaTaskDetailStatus({ id: detailId, action: 6 })
    message.success('已取消')
    fetchDetail()
  } catch (e: any) {
    message.error(e?.message || '取消失败')
  }
}

async function retryUpgrade(detailId: string) {
  try {
    await updateOtaTaskDetailStatus({ id: detailId, action: 1 })
    message.success('已重新下发')
    fetchDetail()
  } catch (e: any) {
    message.error(e?.message || '重新升级失败')
  }
}

const columns = computed<DataTableColumns<any>>(() => [
  { key: 'device_number', title: '序列号', minWidth: 140 },
  { key: 'name', title: '设备名称', minWidth: 160, render: r => r.name || '--' },
  { key: 'current_version', title: '当前版本', minWidth: 120, render: r => r.current_version || '--' },
  { key: 'version', title: '目标版本', minWidth: 120, render: r => r.version || '--' },
  { key: 'step', title: '进度', minWidth: 90, render: r => r.step ?? '--' },
  { key: 'updated_at', title: '更新时间', minWidth: 160, render: r => r.updated_at || '--' },
  {
    key: 'status',
    title: '状态',
    minWidth: 120,
    render: r => <NTag type={statusTagType(r.status)}>{statusLabel(r.status)}</NTag>
  },
  { key: 'status_description', title: '状态描述', minWidth: 220, render: r => r.status_description || '--' },
  {
    key: 'actions',
    title: '操作',
    minWidth: 180,
    fixed: 'right',
    render: r => (
      <NSpace>
        <NButton
          size="small"
          type="warning"
          disabled={!(r.status === 1 || r.status === 2 || r.status === 3)}
          onClick={() => cancelUpgrade(r.id)}
        >
          取消
        </NButton>
        <NButton size="small" type="primary" disabled={r.status !== 5} onClick={() => retryUpgrade(r.id)}>
          重新升级
        </NButton>
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
      :title="`OTA任务详情：${taskId || '-'}`"
      :bordered="false"
      size="small"
      class="sm:flex-1-hidden card-wrapper"
    >
      <div class="mb-4 flex items-center justify-between">
        <div />
        <NSpace>
          <NButton :loading="loading" @click="fetchDetail">刷新</NButton>
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
