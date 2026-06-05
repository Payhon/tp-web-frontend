<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NCode,
  NDataTable,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
  useMessage
} from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import moment from 'moment'
import { EventSourcePolyfill } from 'event-source-polyfill'
import { localStg } from '@/utils/storage'
import { getBaseServerUrl } from '@/utils/common/tool'
import { getBmsCommDebugLogList } from '@/service/api/bms-comm-debug'

type LogItem = {
  id: number
  occurred_at: string
  device_id: string
  device_number: string
  source: string
  access_mode: string
  event_type: string
  direction: string
  mqtt_topic?: string
  qos?: number
  message_id?: string
  payload_raw?: string
  payload_format?: string
  parsed_summary?: any
  status: string
  error_message?: string
}

const message = useMessage()

const eventTypeOptions = [
  { label: bt('auto.s_a8b0c20416'), value: '' },
  { label: bt('auto.s_b1164a8781'), value: 'uplink_raw' },
  { label: bt('auto.s_68ddc62b26'), value: 'uplink_decoded' },
  { label: bt('auto.s_4e6f32cf19'), value: 'uplink_parsed' },
  { label: bt('auto.s_f0dae6360d'), value: 'uplink_error' },
  { label: bt('auto.s_61e195171f'), value: 'downlink_publish' },
  { label: bt('auto.s_dcaef2c7f8'), value: 'downlink_error' }
]

const statusOptions = [
  { label: bt('auto.s_a8b0c20416'), value: '' },
  { label: bt('auto.s_330363dfc5'), value: 'success' },
  { label: bt('auto.s_acd5cb847a'), value: 'error' }
]

const range = ref<[number, number]>([moment().subtract(30, 'minutes').valueOf(), moment().valueOf()])
const queryParams = reactive({
  device_id: '',
  device_number: '',
  event_type: '',
  status: '',
  start_time: '',
  end_time: ''
})

const realtimeEnabled = ref(true)
const streamStatus = ref<'idle' | 'connecting' | 'connected' | 'error'>('idle')
const streamAfterId = ref(0)
const total = ref(0)
const tableData = ref<LogItem[]>([])
const detailVisible = ref(false)
const currentRow = ref<LogItem | null>(null)
let eventSource: EventSourcePolyfill | null = null

const pagination: PaginationProps = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 50],
  onChange: (page: number) => {
    pagination.page = page
    getTableData()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    getTableData()
  }
})

function pickerChange(value: [number, number] | null) {
  if (value && value.length === 2) {
    queryParams.start_time = moment(value[0]).format('YYYY-MM-DDTHH:mm:ssZ')
    queryParams.end_time = moment(value[1]).endOf('day').format('YYYY-MM-DDTHH:mm:ssZ')
  } else {
    queryParams.start_time = ''
    queryParams.end_time = ''
  }
}

const columns = computed<DataTableColumns<LogItem>>(() => [
  { key: 'occurred_at', title: bt('auto.s_19fcb9eb25'), minWidth: 160 },
  { key: 'device_id', title: bt('auto.s_9079376597'), minWidth: 220 },
  { key: 'device_number', title: bt('auto.s_cf05392308'), minWidth: 160 },
  {
    key: 'event_type',
    title: bt('auto.s_226b091218'),
    minWidth: 130,
    render: row => renderEventType(row.event_type)
  },
  {
    key: 'direction',
    title: bt('auto.s_a465db53b8'),
    minWidth: 90,
    render: row => renderDirection(row.direction)
  },
  {
    key: 'mqtt_topic',
    title: 'Topic',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render: row => row.mqtt_topic || '-'
  },
  {
    key: 'status',
    title: bt('auto.s_3fea7ca76c'),
    minWidth: 90,
    render: row => renderStatus(row.status)
  },
  {
    key: 'summary',
    title: bt('auto.s_3ae14696f8'),
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: row => row.error_message || row.message_id || row.payload_format || '-'
  },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    width: 100,
    render: row => (
      <NButton text type="primary" onClick={() => openDetail(row)}>{bt('auto.s_f26225bde6')}</NButton>
    )
  }
])

function renderEventType(type: string) {
  const labelMap: Record<string, string> = {
    uplink_raw: bt('auto.s_b1164a8781'),
    uplink_decoded: bt('auto.s_68ddc62b26'),
    uplink_parsed: bt('auto.s_4e6f32cf19'),
    uplink_error: bt('auto.s_f0dae6360d'),
    downlink_publish: bt('auto.s_61e195171f'),
    downlink_error: bt('auto.s_dcaef2c7f8')
  }
  return labelMap[type] || type || '-'
}

function renderDirection(direction: string) {
  const type = direction === 'outbound' ? 'warning' : 'info'
  const label = direction === 'outbound' ? bt('auto.s_3e5b698b4c') : direction === 'inbound' ? bt('auto.s_e18c94a248') : direction || '-'
  return (
    <NTag size="small" type={type}>
      {label}
    </NTag>
  )
}

function renderStatus(status: string) {
  const type = status === 'success' ? 'success' : status === 'error' ? 'error' : 'default'
  const label = status === 'success' ? bt('auto.s_330363dfc5') : status === 'error' ? bt('auto.s_acd5cb847a') : status || '-'
  return (
    <NTag size="small" type={type}>
      {label}
    </NTag>
  )
}

async function getTableData() {
  const params = {
    page: pagination.page || 1,
    page_size: pagination.pageSize || 10,
    device_id: queryParams.device_id || undefined,
    device_number: queryParams.device_number || undefined,
    event_type: queryParams.event_type || undefined,
    status: queryParams.status || undefined,
    start_time: queryParams.start_time || undefined,
    end_time: queryParams.end_time || undefined
  }
  try {
    const res: any = await getBmsCommDebugLogList(params)
    tableData.value = res?.data?.list || []
    total.value = res?.data?.total || 0
    streamAfterId.value = tableData.value.reduce((max, item) => Math.max(max, item.id || 0), 0)
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_65872bfc81'))
  }
}

function handleQuery() {
  pagination.page = 1
  getTableData().then(() => restartStream())
}

function handleReset() {
  queryParams.device_id = ''
  queryParams.device_number = ''
  queryParams.event_type = ''
  queryParams.status = ''
  queryParams.start_time = ''
  queryParams.end_time = ''
  range.value = [moment().subtract(30, 'minutes').valueOf(), moment().valueOf()]
  pagination.page = 1
  getTableData().then(() => restartStream())
}

function openDetail(row: LogItem) {
  currentRow.value = row
  detailVisible.value = true
}

function mergeRealtimeRows(rows: LogItem[]) {
  if (!rows.length) return
  const idSet = new Set(tableData.value.map(item => item.id))
  const freshRows = rows.filter(item => !idSet.has(item.id))
  if (!freshRows.length) return
  tableData.value = [...freshRows.reverse(), ...tableData.value].slice(0, 200)
  total.value += freshRows.length
  streamAfterId.value = Math.max(streamAfterId.value, ...freshRows.map(item => item.id))
}

function buildStreamUrl() {
  const baseURL = getBaseServerUrl()
  const url = new URL(`${baseURL}/bms/comm-debug/logs/stream`, window.location.origin)
  url.searchParams.set('after_id', String(streamAfterId.value || 0))
  if (queryParams.device_id) url.searchParams.set('device_id', queryParams.device_id)
  if (queryParams.event_type) url.searchParams.set('event_type', queryParams.event_type)
  return url.toString()
}

function stopStream() {
  streamStatus.value = 'idle'
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function startStream() {
  if (!realtimeEnabled.value) {
    stopStream()
    return
  }
  const token = localStg.get('token')
  if (!token) return

  stopStream()
  streamStatus.value = 'connecting'
  eventSource = new EventSourcePolyfill(buildStreamUrl(), {
    heartbeatTimeout: 3 * 60 * 1000,
    headers: {
      'x-token': token
    }
  })
  eventSource.onopen = () => {
    streamStatus.value = 'connected'
  }
  eventSource.onerror = () => {
    streamStatus.value = 'error'
  }
  eventSource.addEventListener('comm-debug', (event: MessageEvent) => {
    try {
      const rows = JSON.parse(event.data || '[]')
      mergeRealtimeRows(rows)
    } catch {
      streamStatus.value = 'error'
    }
  })
}

function restartStream() {
  if (!realtimeEnabled.value) return
  startStream()
}

watch(realtimeEnabled, enabled => {
  if (enabled) startStream()
  else stopStream()
})

onBeforeUnmount(() => {
  stopStream()
})

getTableData().then(() => {
  startStream()
})
</script>

<template>
  <NCard :title="bt('auto.s_52236a392e')">
    <NForm class="mb-12px" :inline="true" label-placement="left" :model="queryParams">
      <NFormItem :label="bt('auto.s_9079376597')">
        <NInput v-model:value="queryParams.device_id" class="w-260px" :placeholder="bt('auto.s_0b42c81a7d')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_cf05392308')">
        <NInput v-model:value="queryParams.device_number" class="w-220px" :placeholder="bt('auto.s_89113e653d')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_226b091218')">
        <NSelect v-model:value="queryParams.event_type" class="w-160px" :options="eventTypeOptions" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_3fea7ca76c')">
        <NSelect v-model:value="queryParams.status" class="w-140px" :options="statusOptions" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_cd649f76d4')">
        <NDatePicker v-model:value="range" type="datetimerange" clearable separator="-" @update:value="pickerChange" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_2843e2f690')">
        <NSpace align="center">
          <NSwitch v-model:value="realtimeEnabled" />
          <NTag
            size="small"
            :type="streamStatus === 'connected' ? 'success' : streamStatus === 'error' ? 'error' : 'default'"
          >
            {{
              streamStatus === 'connected'
                ? bt('auto.s_c5ea9c6a76')
                : streamStatus === 'connecting'
                  ? bt('auto.s_00135f0840')
                  : streamStatus === 'error'
                    ? bt('auto.s_c195df6308')
                    : bt('auto.s_ea4a363d8f')
            }}
          </NTag>
        </NSpace>
      </NFormItem>
      <NFormItem>
        <NButton type="primary" @click="handleQuery">{{ bt('auto.s_bee912d79e') }}</NButton>
      </NFormItem>
      <NFormItem>
        <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
      </NFormItem>
    </NForm>

    <NDataTable
      remote
      :columns="columns"
      :data="tableData"
      :pagination="{ ...pagination, itemCount: total }"
      :bordered="false"
      :scroll-x="1500"
    />

    <NDrawer v-model:show="detailVisible" :width="720">
      <NDrawerContent :title="bt('auto.s_e0d9b6f4a4')" closable>
        <template v-if="currentRow">
          <NDescriptions label-placement="left" :column="1" bordered class="mb-16px">
            <NDescriptionsItem :label="bt('auto.s_19fcb9eb25')">{{ currentRow.occurred_at }}</NDescriptionsItem>
            <NDescriptionsItem :label="bt('auto.s_9079376597')">{{ currentRow.device_id }}</NDescriptionsItem>
            <NDescriptionsItem :label="bt('auto.s_cf05392308')">{{ currentRow.device_number || '-' }}</NDescriptionsItem>
            <NDescriptionsItem :label="bt('auto.s_226b091218')">{{ renderEventType(currentRow.event_type) }}</NDescriptionsItem>
            <NDescriptionsItem :label="bt('auto.s_a465db53b8')">{{ currentRow.direction || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="Topic">{{ currentRow.mqtt_topic || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="QoS">{{ currentRow.qos ?? '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="Message ID">{{ currentRow.message_id || '-' }}</NDescriptionsItem>
            <NDescriptionsItem :label="bt('auto.s_3fea7ca76c')">{{ currentRow.status }}</NDescriptionsItem>
            <NDescriptionsItem :label="bt('auto.s_4604d50234')">{{ currentRow.error_message || '-' }}</NDescriptionsItem>
          </NDescriptions>

          <div class="mb-12px text-14px font-600">{{ bt('auto.s_d42db0111c') }}</div>
          <NCode
            :code="currentRow.payload_raw || '-'"
            language="json"
            show-line-numbers
            word-wrap
            class="mb-16px block max-h-260px overflow-auto"
          />

          <div class="mb-12px text-14px font-600">{{ bt('auto.s_d8cc4e5da1') }}</div>
          <NCode
            :code="currentRow.parsed_summary ? JSON.stringify(currentRow.parsed_summary, null, 2) : '-'"
            language="json"
            show-line-numbers
            word-wrap
            class="block max-h-320px overflow-auto"
          />
        </template>
      </NDrawerContent>
    </NDrawer>
  </NCard>
</template>
