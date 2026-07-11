<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NButton, NCard, NDataTable, NModal, NProgress, NSpace, NTag, NText, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  getBatteryWarrantyRecalcJobLogs,
  getBatteryWarrantyRecalcJobStatus,
  type BatteryWarrantyRecalcJobLogItem,
  type BatteryWarrantyRecalcJobStatus
} from '@/service/api/bms'

const props = defineProps<{
  visible: boolean
  jobId: string
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  finished: []
}>()

const message = useMessage()
const polling = ref(false)
const lastAfterId = ref(0)
const logs = ref<BatteryWarrantyRecalcJobLogItem[]>([])
const jobStatus = ref<BatteryWarrantyRecalcJobStatus | null>(null)
let timer: number | null = null

const percent = computed(() => {
  const total = jobStatus.value?.total_rows || 0
  const processed = jobStatus.value?.processed_rows || 0
  if (!total) return 0
  return Math.min(100, Math.round((processed / total) * 100))
})

const logColumns = computed<DataTableColumns<BatteryWarrantyRecalcJobLogItem>>(() => [
  { key: 'created_at', title: bt('warrantyRecalc.createdAt'), minWidth: 150 },
  {
    key: 'level',
    title: bt('warrantyRecalc.level'),
    minWidth: 80,
    render: row => (
      <NTag type={row.level === 'ERROR' ? 'error' : row.level === 'WARN' ? 'warning' : 'default'}>{row.level}</NTag>
    )
  },
  {
    key: 'device_number',
    title: bt('warrantyRecalc.deviceNumber'),
    minWidth: 160,
    render: row => row.device_number || row.device_id || '-'
  },
  {
    key: 'battery_model_id',
    title: bt('warrantyRecalc.modelId'),
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: row => row.battery_model_id || '-'
  },
  { key: 'message', title: bt('warrantyRecalc.message'), minWidth: 300, ellipsis: { tooltip: true } }
])

function stopPolling() {
  polling.value = false
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

async function fetchStatusAndLogs() {
  if (!props.jobId) return
  try {
    const statusRes: any = await getBatteryWarrantyRecalcJobStatus(props.jobId)
    jobStatus.value = statusRes?.data || jobStatus.value

    const logRes: any = await getBatteryWarrantyRecalcJobLogs(props.jobId, {
      after_id: lastAfterId.value,
      limit: 200
    })
    const list = logRes?.data?.list || []
    const nextAfterId = logRes?.data?.next_after_id || lastAfterId.value
    if (list.length) {
      logs.value = [...logs.value, ...list]
    }
    lastAfterId.value = nextAfterId

    if (jobStatus.value?.status === 'SUCCESS' || jobStatus.value?.status === 'FAILED') {
      stopPolling()
      emit('finished')
    }
  } catch (e: any) {
    stopPolling()
    message.error(e?.message || bt('warrantyRecalc.loadFailed'))
  }
}

function startPolling() {
  stopPolling()
  if (!props.visible || !props.jobId) return
  polling.value = true
  fetchStatusAndLogs()
  timer = window.setInterval(fetchStatusAndLogs, 1000)
}

function reset() {
  stopPolling()
  lastAfterId.value = 0
  logs.value = []
  jobStatus.value = null
}

function handleClose() {
  reset()
  emit('update:visible', false)
}

watch(
  () => [props.visible, props.jobId] as const,
  ([visible]) => {
    reset()
    if (visible) startPolling()
  },
  { immediate: true }
)

onBeforeUnmount(stopPolling)
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    style="width: 900px; max-width: 96vw"
    :title="bt('warrantyRecalc.title')"
    @close="handleClose"
  >
    <NSpace vertical size="large">
      <NCard v-if="jobId" size="small" :bordered="false">
        <NSpace align="center" justify="space-between" class="mb-10px">
          <NSpace align="center">
            <NTag type="info">{{ bt('common.task', { id: jobId }) }}</NTag>
            <NTag
              v-if="jobStatus?.status"
              :type="jobStatus.status === 'FAILED' ? 'error' : jobStatus.status === 'SUCCESS' ? 'success' : 'warning'"
            >
              {{ jobStatus.status }}
            </NTag>
            <NText class="text-12px text-gray-500">
              {{
                bt('warrantyRecalc.progress', {
                  processed: jobStatus?.processed_rows || 0,
                  total: jobStatus?.total_rows || 0,
                  success: jobStatus?.success_rows || 0,
                  skipped: jobStatus?.skipped_rows || 0,
                  failed: jobStatus?.failed_rows || 0
                })
              }}
            </NText>
          </NSpace>
          <NButton
            v-if="!polling && (jobStatus?.status === 'SUCCESS' || jobStatus?.status === 'FAILED')"
            @click="startPolling"
          >
            {{ bt('warrantyRecalc.refresh') }}
          </NButton>
        </NSpace>

        <NProgress type="line" :percentage="percent" :show-indicator="true" />

        <div v-if="jobStatus?.status === 'FAILED' && jobStatus.error_message" class="mt-10px text-12px text-red-600">
          {{ bt('warrantyRecalc.failed', { message: jobStatus.error_message }) }}
        </div>
      </NCard>

      <NCard size="small" :bordered="false">
        <NDataTable :columns="logColumns" :data="logs" :bordered="false" :scroll-x="980" :max-height="320" />
      </NCard>
    </NSpace>
  </NModal>
</template>

<style scoped>
.text-gray-500 {
  color: rgba(55, 65, 81, 0.7);
}
.text-red-600 {
  color: #dc2626;
}
.mb-10px {
  margin-bottom: 10px;
}
.mt-10px {
  margin-top: 10px;
}
</style>
