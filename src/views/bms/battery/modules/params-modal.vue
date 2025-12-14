<script setup lang="tsx">
import { computed, ref, watch } from 'vue'
import { NButton, NDataTable, NInput, NModal, NPagination, NSpace, NTabPane, NTabs, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { getBatteryParamSetLogs, getBatteryParams, putBatteryParams, requestBatteryParamsFromDevice } from '@/service/api/bms'

type ParamRow = {
  id: string
  key: string
  data_name?: string | null
  value?: any
  unit?: string | null
  ts?: string | number | null
  read_write_flag?: any
  data_type?: any
  enum?: any
  checked?: boolean
  inputValue?: string
}

const props = defineProps<{
  show: boolean
  deviceId: string
  deviceNumber?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
}>()

const message = useMessage()
const visible = computed({
  get: () => props.show,
  set: v => emit('update:show', v)
})

const loading = ref(false)
const rows = ref<ParamRow[]>([])
const activeTab = ref<'params' | 'logs'>('params')

// 下发记录/回执
const logsLoading = ref(false)
const logs = ref<any[]>([])
const logPage = ref(1)
const logPageSize = ref(10)
const logTotal = ref(0)

function isWritable(flag: any) {
  // 常见：RW / W / 1 / true
  if (flag === true) return true
  if (flag === 1 || flag === '1') return true
  const s = String(flag || '').toUpperCase()
  return s.includes('W')
}

async function fetchParams() {
  if (!props.deviceId) return
  loading.value = true
  try {
    const res: any = await getBatteryParams(props.deviceId)
    const list = (res?.data || []) as any[]
    rows.value = list.map((r: any) => ({
      ...r,
      checked: false,
      inputValue: r.value === null || r.value === undefined ? '' : typeof r.value === 'string' ? r.value : JSON.stringify(r.value)
    }))
  } catch (e: any) {
    message.error(e?.message || '获取参数失败')
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function fetchLogs() {
  if (!props.deviceId) return
  logsLoading.value = true
  try {
    const res: any = await getBatteryParamSetLogs({
      device_id: props.deviceId,
      page: logPage.value,
      page_size: logPageSize.value
    })
    const data = res?.data || {}
    logs.value = data?.list || []
    logTotal.value = Number(data?.count || 0)
  } catch (e: any) {
    message.error(e?.message || '获取下发记录失败')
    logs.value = []
    logTotal.value = 0
  } finally {
    logsLoading.value = false
  }
}

async function requestFromDevice() {
  if (!props.deviceId) return
  try {
    await requestBatteryParamsFromDevice({ device_id: props.deviceId, keys: [] })
    message.success('已请求设备上报（稍后点刷新）')
  } catch (e: any) {
    message.error(e?.message || '请求设备上报失败')
  }
}

async function submit() {
  const payload: Record<string, any> = {}
  rows.value
    .filter(r => r.checked && isWritable(r.read_write_flag))
    .forEach(r => {
      if (!r.key) return
      const v = (r.inputValue ?? '').trim()
      if (!v) return
      // 允许用户输入 JSON（对象/数组/数字/布尔）或纯字符串
      try {
        payload[r.key] = JSON.parse(v)
      } catch {
        payload[r.key] = v
      }
    })

  const keys = Object.keys(payload)
  if (keys.length === 0) {
    message.warning('请勾选可写参数并填写要下发的新值')
    return
  }

  loading.value = true
  try {
    await putBatteryParams({
      device_id: props.deviceId,
      value: JSON.stringify(payload)
    })
    message.success('已下发参数（可在下发记录/或稍后刷新查看）')
    await fetchParams()
    logPage.value = 1
    await fetchLogs()
  } catch (e: any) {
    message.error(e?.message || '下发失败')
  } finally {
    loading.value = false
  }
}

function formatStatus(s: any) {
  switch (String(s)) {
    case '0':
      return '待回执'
    case '1':
      return '发送成功'
    case '2':
      return '发送失败'
    case '3':
      return '回执成功'
    case '4':
      return '回执失败'
    default:
      return String(s ?? '--')
  }
}

const columns = computed<DataTableColumns<ParamRow>>(() => [
  {
    key: 'checked',
    title: '',
    width: 50,
    render: r => (isWritable(r.read_write_flag) ? <input type="checkbox" checked={!!r.checked} onChange={(e: any) => (r.checked = e.target.checked)} /> : null)
  },
  { key: 'key', title: '参数标识', minWidth: 160 },
  { key: 'data_name', title: '参数名称', minWidth: 160, render: r => r.data_name || '--' },
  { key: 'value', title: '当前值', minWidth: 160, render: r => (r.value === null || r.value === undefined ? '--' : String(r.value)) },
  { key: 'unit', title: '单位', minWidth: 80, render: r => r.unit || '--' },
  {
    key: 'read_write_flag',
    title: '读写',
    minWidth: 90,
    render: r => <NTag type={isWritable(r.read_write_flag) ? 'success' : 'default'}>{isWritable(r.read_write_flag) ? '可写' : '只读'}</NTag>
  },
  {
    key: 'input',
    title: '下发新值(勾选可写项)',
    minWidth: 240,
    render: r =>
      isWritable(r.read_write_flag) ? (
        <NInput v-model:value={r.inputValue} placeholder="支持 JSON，例如：1 / true / {\"mode\":1}" />
      ) : (
        '--'
      )
  }
])

const logColumns = computed<DataTableColumns<any>>(() => [
  { key: 'created_at', title: '下发时间', minWidth: 170, render: r => (r.created_at ? String(r.created_at).replace('T', ' ').replace('Z', '') : '--') },
  { key: 'message_id', title: 'message_id', minWidth: 120 },
  { key: 'data', title: '发送内容', minWidth: 240, render: r => (r.data ? String(r.data) : '--') },
  { key: 'rsp_data', title: '回执内容', minWidth: 240, render: r => (r.rsp_data ? String(r.rsp_data) : '--') },
  { key: 'status', title: '状态', minWidth: 120, render: r => formatStatus(r.status) },
  { key: 'error_message', title: '错误信息', minWidth: 200, render: r => (r.error_message ? String(r.error_message) : '--') }
])

watch(
  () => props.show,
  v => {
    if (v) {
      activeTab.value = 'params'
      logPage.value = 1
      fetchParams()
      fetchLogs()
    }
  }
)
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="`参数远程查看与修改：${deviceNumber || ''}`" style="width: 1100px">
    <NTabs v-model:value="activeTab" type="line">
      <NTabPane name="params" tab="参数列表">
        <div class="mb-3 flex items-center justify-between">
          <div style="color: #999; font-size: 12px">说明：勾选“可写”参数并填写新值后下发；值可输入 JSON（数字/布尔/对象/数组）</div>
          <NSpace>
            <NButton @click="requestFromDevice">请求设备上报</NButton>
            <NButton @click="fetchParams" :loading="loading">刷新</NButton>
            <NButton type="primary" @click="submit" :loading="loading">下发修改</NButton>
          </NSpace>
        </div>
        <NDataTable :columns="columns" :data="rows" :loading="loading" :row-key="r => r.id" :scroll-x="1050" />
      </NTabPane>

      <NTabPane name="logs" tab="下发记录/回执">
        <div class="mb-3 flex items-center justify-end">
          <NSpace>
            <NButton @click="fetchLogs" :loading="logsLoading">刷新</NButton>
          </NSpace>
        </div>
        <NDataTable :columns="logColumns" :data="logs" :loading="logsLoading" :row-key="r => r.id" :scroll-x="1100" />
        <div class="mt-3 flex justify-end">
          <NPagination
            v-model:page="logPage"
            v-model:page-size="logPageSize"
            :item-count="logTotal"
            show-size-picker
            :page-sizes="[10, 20, 50, 100]"
            @update:page="fetchLogs"
            @update:page-size="
              () => {
                logPage = 1
                fetchLogs()
              }
            "
          />
        </div>
      </NTabPane>
    </NTabs>
  </NModal>
</template>

