<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref, watch } from 'vue'
import { NButton, NDataTable, NInput, NModal, NPagination, NSpace, NTabPane, NTabs, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  getBatteryParamSetLogs,
  getBatteryParams,
  putBatteryParams,
  requestBatteryParamsFromDevice
} from '@/service/api/bms'

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
      inputValue:
        r.value === null || r.value === undefined ? '' : typeof r.value === 'string' ? r.value : JSON.stringify(r.value)
    }))
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_a6044dd7c7'))
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
    message.error(e?.message || bt('auto.s_121fb46b12'))
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
    message.success(bt('auto.s_611ec461a8'))
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_0d212cff2e'))
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
    message.warning(bt('auto.s_277482cbfa'))
    return
  }

  loading.value = true
  try {
    await putBatteryParams({
      device_id: props.deviceId,
      value: JSON.stringify(payload)
    })
    message.success(bt('auto.s_1264da38bb'))
    await fetchParams()
    logPage.value = 1
    await fetchLogs()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_c4a86b6037'))
  } finally {
    loading.value = false
  }
}

function formatStatus(s: any) {
  switch (String(s)) {
    case '0':
      return bt('auto.s_39130199d9')
    case '1':
      return bt('auto.s_9db9a7e394')
    case '2':
      return bt('auto.s_9ca6a3440e')
    case '3':
      return bt('auto.s_05dfc392d5')
    case '4':
      return bt('auto.s_36ff4235f6')
    default:
      return String(s ?? '--')
  }
}

const columns = computed<DataTableColumns<ParamRow>>(() => [
  {
    key: 'checked',
    title: '',
    width: 50,
    render: r =>
      isWritable(r.read_write_flag) ? (
        <input type="checkbox" checked={!!r.checked} onChange={(e: any) => (r.checked = e.target.checked)} />
      ) : null
  },
  { key: 'key', title: bt('auto.s_8b5aee58d6'), minWidth: 160 },
  { key: 'data_name', title: bt('auto.s_5f49be98ad'), minWidth: 160, render: r => r.data_name || '--' },
  {
    key: 'value',
    title: bt('auto.s_e52c2701b6'),
    minWidth: 160,
    render: r => (r.value === null || r.value === undefined ? '--' : String(r.value))
  },
  { key: 'unit', title: bt('auto.s_f2996845b6'), minWidth: 80, render: r => r.unit || '--' },
  {
    key: 'read_write_flag',
    title: bt('auto.s_2300ad28b8'),
    minWidth: 90,
    render: r => (
      <NTag type={isWritable(r.read_write_flag) ? 'success' : 'default'}>
        {isWritable(r.read_write_flag) ? bt('auto.s_a5230ad612') : bt('auto.s_85541bd9f7')}
      </NTag>
    )
  },
  {
    key: 'input',
    title: bt('auto.s_3a024fdf49'),
    minWidth: 240,
    render: r =>
      isWritable(r.read_write_flag) ? (
        <NInput v-model:value={r.inputValue} placeholder={bt('auto.s_13de5d70d8')} />
      ) : (
        '--'
      )
  }
])

const logColumns = computed<DataTableColumns<any>>(() => [
  {
    key: 'created_at',
    title: bt('auto.s_e8c30dca69'),
    minWidth: 170,
    render: r => (r.created_at ? String(r.created_at).replace('T', ' ').replace('Z', '') : '--')
  },
  { key: 'message_id', title: 'message_id', minWidth: 120 },
  { key: 'data', title: bt('auto.s_51c25db89d'), minWidth: 240, render: r => (r.data ? String(r.data) : '--') },
  { key: 'rsp_data', title: bt('auto.s_727e92f70c'), minWidth: 240, render: r => (r.rsp_data ? String(r.rsp_data) : '--') },
  { key: 'status', title: bt('auto.s_3fea7ca76c'), minWidth: 120, render: r => formatStatus(r.status) },
  {
    key: 'error_message',
    title: bt('auto.s_4604d50234'),
    minWidth: 200,
    render: r => (r.error_message ? String(r.error_message) : '--')
  }
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
  <NModal
    v-model:show="visible"
    preset="card"
    :title="bt('pages.params.title', { device: deviceNumber || '' })"
    style="width: 1100px"
  >
    <NTabs v-model:value="activeTab" type="line">
      <NTabPane name="params" :tab="bt('auto.s_cba8744406')">
        <div class="mb-3 flex items-center justify-between">
          <div style="color: #999; font-size: 12px">
            {{ bt('pages.params.hint') }}
          </div>
          <NSpace>
            <NButton @click="requestFromDevice">{{ bt('auto.s_deacfe81ab') }}</NButton>
            <NButton :loading="loading" @click="fetchParams">{{ bt('auto.s_694fc5efa9') }}</NButton>
            <NButton type="primary" :loading="loading" @click="submit">{{ bt('auto.s_dbe5068959') }}</NButton>
          </NSpace>
        </div>
        <NDataTable :columns="columns" :data="rows" :loading="loading" :row-key="r => r.id" :scroll-x="1050" />
      </NTabPane>

      <NTabPane name="logs" :tab="bt('auto.s_1d80cdcf14')">
        <div class="mb-3 flex items-center justify-end">
          <NSpace>
            <NButton :loading="logsLoading" @click="fetchLogs">{{ bt('auto.s_694fc5efa9') }}</NButton>
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
