<script setup lang="tsx">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NButton, NCard, NDataTable, NModal, NProgress, NSpace, NTag, NText, NUpload, useMessage } from 'naive-ui'
import type { UploadCustomRequestOptions } from 'naive-ui'
import {
  getBatteryImportJobLogs,
  getBatteryImportJobStatus,
  getBatteryImportTemplate,
  importBatteryList
} from '@/service/api/bms'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'finished'): void
}>()

const message = useMessage()

const jobId = ref<string>('')
const jobStatus = ref<{
  status: string
  total_rows: number
  processed_rows: number
  success_rows: number
  failed_rows: number
  error_message?: string | null
}>({
  status: '',
  total_rows: 0,
  processed_rows: 0,
  success_rows: 0,
  failed_rows: 0,
  error_message: null
})

const polling = ref(false)
let timer: number | null = null
const lastAfterId = ref(0)
const logs = ref<any[]>([])

const percent = computed(() => {
  const total = jobStatus.value.total_rows || 0
  const processed = jobStatus.value.processed_rows || 0
  if (!total) return 0
  return Math.min(100, Math.round((processed / total) * 100))
})

function stopPolling() {
  polling.value = false
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

async function downloadTemplate() {
  try {
    const response = await getBatteryImportTemplate()
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '电池导入模板.xlsx'
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (e: any) {
    message.error(e?.message || '模板下载失败')
  }
}

async function fetchStatusAndLogs() {
  if (!jobId.value) return
  try {
    const statusRes: any = await getBatteryImportJobStatus(jobId.value)
    jobStatus.value = statusRes?.data || jobStatus.value

    const logRes: any = await getBatteryImportJobLogs(jobId.value, { after_id: lastAfterId.value, limit: 200 })
    const list = logRes?.data?.list || []
    const nextAfterId = logRes?.data?.next_after_id || lastAfterId.value
    if (list.length) {
      logs.value = [...logs.value, ...list]
    }
    lastAfterId.value = nextAfterId

    if (jobStatus.value.status === 'SUCCESS' || jobStatus.value.status === 'FAILED') {
      stopPolling()
      emit('finished')
    }
  } catch (e: any) {
    stopPolling()
    message.error(e?.message || '获取导入进度失败')
  }
}

function startPolling() {
  stopPolling()
  polling.value = true
  fetchStatusAndLogs()
  timer = window.setInterval(fetchStatusAndLogs, 1000)
}

async function customUploadRequest(options: UploadCustomRequestOptions) {
  const file = options.file.file as File
  try {
    logs.value = []
    lastAfterId.value = 0
    jobId.value = ''
    jobStatus.value = { status: 'RUNNING', total_rows: 0, processed_rows: 0, success_rows: 0, failed_rows: 0 }

    const res: any = await importBatteryList(file)
    const id = res?.data?.job_id
    if (!id) throw new Error('未返回 job_id')
    jobId.value = id
    startPolling()
    options.onFinish()
  } catch (e: any) {
    options.onError()
    message.error(e?.message || '导入失败')
  }
}

const logColumns = [
  { key: 'created_at', title: '时间', minWidth: 150 },
  {
    key: 'level',
    title: '级别',
    minWidth: 80,
    render: (row: any) => <NTag type={row.level === 'ERROR' ? 'error' : 'default'}>{row.level}</NTag>
  },
  { key: 'row_number', title: '行', minWidth: 70, render: (row: any) => row.row_number ?? '-' },
  { key: 'device_number', title: '电池编号', minWidth: 160, render: (row: any) => row.device_number || '-' },
  { key: 'message', title: '内容', minWidth: 260, ellipsis: { tooltip: true } }
]

function handleClose() {
  stopPolling()
  emit('update:visible', false)
}

function reset() {
  stopPolling()
  jobId.value = ''
  logs.value = []
  lastAfterId.value = 0
  jobStatus.value = {
    status: '',
    total_rows: 0,
    processed_rows: 0,
    success_rows: 0,
    failed_rows: 0,
    error_message: null
  }
}

watch(
  () => props.visible,
  v => {
    if (!v) reset()
  }
)

onBeforeUnmount(() => stopPolling())
</script>

<template>
  <NModal :show="visible" preset="card" style="width: 860px" title="导入电池" @close="handleClose">
    <NSpace vertical size="large">
      <NCard size="small" :bordered="false">
        <NText>请先下载并填写导入模板，确保必填字段完整：</NText>
        <NButton text type="primary" class="ml-8px" @click="downloadTemplate">下载导入 Excel 模板</NButton>
        <div class="mt-8px text-12px text-gray-500">
          必填：电池序列号ID（对应
          devices.device_number）、批号；可选：电池型号（按名称匹配）、蓝牙Mac、4G通讯卡ID、出厂日期、质保到期。
        </div>
      </NCard>

      <NCard size="small" :bordered="false">
        <NUpload :max="1" accept=".xlsx,.xls" :default-upload="false" :custom-request="customUploadRequest">
          <NButton type="primary">选择并上传 Excel</NButton>
        </NUpload>
      </NCard>

      <NCard v-if="jobId" size="small" :bordered="false">
        <NSpace align="center" justify="space-between" class="mb-10px">
          <NSpace align="center">
            <NTag type="info">任务：{{ jobId }}</NTag>
            <NTag
              v-if="jobStatus.status"
              :type="jobStatus.status === 'FAILED' ? 'error' : jobStatus.status === 'SUCCESS' ? 'success' : 'warning'"
            >
              {{ jobStatus.status }}
            </NTag>
            <NText class="text-12px text-gray-500">
              {{ jobStatus.processed_rows }}/{{ jobStatus.total_rows }}（成功 {{ jobStatus.success_rows }}，失败
              {{ jobStatus.failed_rows }}）
            </NText>
          </NSpace>
          <NButton v-if="!polling && (jobStatus.status === 'SUCCESS' || jobStatus.status === 'FAILED')" @click="reset">
            重新导入
          </NButton>
        </NSpace>

        <NProgress type="line" :percentage="percent" :show-indicator="true" />

        <div v-if="jobStatus.status === 'FAILED' && jobStatus.error_message" class="mt-10px text-12px text-red-600">
          任务失败：{{ jobStatus.error_message }}
        </div>

        <div class="mt-12px">
          <NDataTable :columns="logColumns" :data="logs" :bordered="false" :scroll-x="900" :max-height="280" />
        </div>
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
.ml-8px {
  margin-left: 8px;
}
.mt-8px {
  margin-top: 8px;
}
.mt-10px {
  margin-top: 10px;
}
.mt-12px {
  margin-top: 12px;
}
</style>
