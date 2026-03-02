<script setup lang="tsx">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NGrid,
  NGridItem,
  NInputNumber,
  NModal,
  NProgress,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NText,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import ChartComponent from '@/components/custom/ChartComponent.vue'
import { localStg } from '@/utils/storage'
import { getAppBatteryDetail } from '@/service/api/bms'
import { telemetryDataCurrentKeys, telemetryDataHistoryList, telemetryHistoryData } from '@/service/api/device'
import { fetchCurrentDeviceParamPermissions } from '@/service/api/org-type-permissions'
import {
  BmsClient,
  PARAM_DEF_BY_KEY,
  WebMqttSocketBmsTransport,
  getParamPermissionKey
} from '@/common/lib/bms-protocol'
import type { BmsStatus } from '@/common/lib/bms-protocol'

const props = defineProps<{
  id: string
}>()

type AppBatteryDetail = {
  device_id: string
  device_number: string
  device_name?: string | null
  battery_model_id?: string | null
  battery_model_name?: string | null
  item_uuid?: string | null
  ble_mac?: string | null
  comm_chip_id?: string | null
  soc?: number | null
  soh?: number | null
  is_online?: number | null
  fw_version?: string | null
  remark?: string | null
  updated_at?: string | null
}

type SnapshotHistoryRow = {
  ts: number
  summary: string
  raw: string
}

const CLOUD_KEYS = [
  'soc',
  'soh',
  'vPackV',
  'currentA',
  'avgCellVoltageMv',
  'highestCellVoltageMv',
  'lowestCellVoltageMv',
  'maxCellVoltageDiffMv',
  'chargeMosC',
  'dischargeMosC',
  'ambientC',
  'cycleCount',
  'chargeRemainingMin',
  'dischargeRemainingMin',
  'chargeFetOn',
  'dischargeFetOn',
  'charging',
  'discharging',
  'balancingOn',
  'protectOn',
  'alarmCount',
  'protectCount',
  'faultCount',
  'seriesCount',
  'bms.snapshot'
]

const message = useMessage()

const loading = ref(false)
const battery = ref<AppBatteryDetail | null>(null)

const cloudLoading = ref(false)
const cloudCurrent = reactive<Record<string, unknown>>({})
const cloudLastUpdateAt = ref<number | null>(null)
const cloudWsState = ref<'closed' | 'connecting' | 'open' | 'error'>('closed')
const historyLoading = ref(false)
const historyChartData = reactive<Record<string, Array<[number, number]>>>({
  soc: [],
  soh: [],
  vPackV: [],
  currentA: []
})
const snapshotHistoryRows = ref<SnapshotHistoryRow[]>([])

const deviceParamPerm = reactive({
  allowAll: true,
  keys: [] as string[]
})
const deviceParamPermSet = computed(() => new Set(deviceParamPerm.keys))

const connType = ref<'mqtt' | 'offline'>('offline')
const connecting = ref(false)
const status = ref<BmsStatus | null>(null)

let pollTimer: number | null = null
let transport: WebMqttSocketBmsTransport | null = null
let client: BmsClient | null = null

let cloudWs: WebSocket | null = null
let cloudHeartbeatTimer: number | null = null

const canUse4G = computed(() => {
  const v = String(battery.value?.comm_chip_id || '').trim()
  return v.length > 0
})

const connText = computed(() => (connType.value === 'mqtt' ? 'MQTT透传' : '离线'))

const cloudStatusText = computed(() => {
  if (cloudWsState.value === 'open') return '云端实时已连接'
  if (cloudWsState.value === 'connecting') return '云端实时连接中'
  if (cloudWsState.value === 'error') return '云端实时连接失败'
  return '云端实时未连接'
})

const cloudStatusType = computed(() => {
  if (cloudWsState.value === 'open') return 'success'
  if (cloudWsState.value === 'connecting') return 'info'
  if (cloudWsState.value === 'error') return 'error'
  return 'default'
})

const cloudUpdateText = computed(() => formatTime(cloudLastUpdateAt.value))

const cloudSnapshot = computed<BmsStatus | null>(() => {
  const raw = cloudCurrent['bms.snapshot']
  if (!raw) return null
  if (typeof raw === 'object') return raw as BmsStatus
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as BmsStatus
  } catch {
    return null
  }
})

const displayStatus = computed(() => cloudSnapshot.value || status.value)

const buildWsUrl = (path: string) => {
  const origin = window.location.origin
  if (origin.startsWith('https://')) return `wss://${origin.slice('https://'.length)}${path}`
  if (origin.startsWith('http://')) return `ws://${origin.slice('http://'.length)}${path}`
  return `${origin}${path}`
}

function stopPolling() {
  if (pollTimer != null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function closeCloudWs() {
  if (cloudHeartbeatTimer != null) {
    window.clearInterval(cloudHeartbeatTimer)
    cloudHeartbeatTimer = null
  }
  if (cloudWs) {
    cloudWs.close()
    cloudWs = null
  }
  cloudWsState.value = 'closed'
}

function mergeCloudCurrent(patch: Record<string, unknown>, tsMs?: number | null) {
  Object.entries(patch).forEach(([k, v]) => {
    cloudCurrent[k] = v
  })
  if (Object.keys(patch).length > 0) {
    cloudLastUpdateAt.value = tsMs ?? Date.now()
  }
}

function parseTsToMs(ts: unknown): number | null {
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    if (ts > 1e12) return ts
    if (ts > 1e9) return ts * 1000
    return null
  }
  if (typeof ts === 'string' && ts) {
    const n = Date.parse(ts)
    if (!Number.isNaN(n)) return n
  }
  return null
}

function formatTime(ms: number | null): string {
  if (!ms) return '-'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(
    d.getSeconds()
  )}`
}

function summarizeSnapshot(raw: string): string {
  try {
    const s = JSON.parse(raw) as BmsStatus
    const soc = s?.energy?.socPct
    const soh = s?.energy?.sohPct
    const vPack = s?.electrical?.vPackV
    const current = s?.electrical?.currentA
    return `SOC:${Number(soc ?? 0).toFixed(1)}%, SOH:${Number(soh ?? 0).toFixed(1)}%, V:${Number(vPack ?? 0).toFixed(
      2
    )}V, I:${Number(current ?? 0).toFixed(2)}A`
  } catch {
    return '快照解析失败'
  }
}

async function loadCloudCurrent() {
  if (!props.id) return
  cloudLoading.value = true
  try {
    const res: any = await telemetryDataCurrentKeys({ device_id: props.id, keys: CLOUD_KEYS })
    const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
    const patch: Record<string, unknown> = {}
    let latestTs: number | null = null
    rows.forEach((row: any) => {
      const key = String(row?.key || '').trim()
      if (!key) return
      patch[key] = row?.value
      const ts = parseTsToMs(row?.ts)
      if (ts && (!latestTs || ts > latestTs)) latestTs = ts
    })
    mergeCloudCurrent(patch, latestTs)
  } catch (e: any) {
    message.warning(e?.message || '加载云端实时数据失败')
  } finally {
    cloudLoading.value = false
  }
}

function openCloudWs() {
  closeCloudWs()
  if (!props.id) return
  const token = String(localStg.get('token') || '').trim()
  if (!token) return

  cloudWsState.value = 'connecting'
  const ws = new WebSocket(buildWsUrl('/api/v1/telemetry/datas/current/keys/ws'))
  cloudWs = ws

  ws.onopen = () => {
    cloudWsState.value = 'open'
    ws.send(
      JSON.stringify({
        device_id: props.id,
        keys: CLOUD_KEYS,
        token
      })
    )
    cloudHeartbeatTimer = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 15000)
  }

  ws.onmessage = (event) => {
    if (!event.data || event.data === 'pong') return
    try {
      const payload = JSON.parse(String(event.data))
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        mergeCloudCurrent(payload as Record<string, unknown>)
      }
    } catch {
      // ignore malformed realtime payload
    }
  }

  ws.onerror = () => {
    cloudWsState.value = 'error'
  }

  ws.onclose = () => {
    if (cloudWs === ws) {
      cloudWs = null
      cloudWsState.value = cloudWsState.value === 'error' ? 'error' : 'closed'
      if (cloudHeartbeatTimer != null) {
        window.clearInterval(cloudHeartbeatTimer)
        cloudHeartbeatTimer = null
      }
    }
  }
}

async function loadHistory() {
  if (!props.id) return
  historyLoading.value = true
  try {
    const metricKeys = ['soc', 'soh', 'vPackV', 'currentA']
    const chartResults = await Promise.all(
      metricKeys.map(async (key) => {
        const rsp: any = await telemetryDataHistoryList({
          device_id: props.id,
          key,
          time_range: 'last_1h',
          aggregate_window: '30s',
          aggregate_function: 'avg'
        })
        const points = Array.isArray(rsp?.data) ? rsp.data : Array.isArray(rsp) ? rsp : []
        return { key, points }
      })
    )
    metricKeys.forEach((key) => {
      historyChartData[key] = []
    })
    chartResults.forEach((item) => {
      historyChartData[item.key] = item.points
        .filter((p: any) => typeof p?.x === 'number' && typeof p?.y === 'number')
        .map((p: any) => [p.x, p.y] as [number, number])
        .sort((a: [number, number], b: [number, number]) => a[0] - b[0])
    })

    const endTime = Date.now()
    const startTime = endTime - 24 * 60 * 60 * 1000
    const snapshots: any = await telemetryHistoryData({
      device_id: props.id,
      key: 'bms.snapshot',
      start_time: startTime,
      end_time: endTime,
      page: 1,
      page_size: 20
    })
    const list = Array.isArray(snapshots?.data?.list)
      ? snapshots.data.list
      : Array.isArray(snapshots?.list)
        ? snapshots.list
        : []
    snapshotHistoryRows.value = list
      .map((row: any) => {
        const ts = Number(row?.ts || 0)
        const raw = typeof row?.value === 'string' ? row.value : JSON.stringify(row?.value || '')
        return {
          ts,
          raw,
          summary: summarizeSnapshot(raw)
        } as SnapshotHistoryRow
      })
      .sort((a, b) => b.ts - a.ts)
  } catch (e: any) {
    message.warning(e?.message || '加载历史数据失败')
  } finally {
    historyLoading.value = false
  }
}

const historyChartOption = computed<EChartsCoreOption>(() => {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['SOC(%)', 'SOH(%)', 'Pack电压(V)', '电流(A)'] },
    grid: { left: 48, right: 24, top: 36, bottom: 36 },
    xAxis: { type: 'time' },
    yAxis: [
      { type: 'value', name: '%', position: 'left' },
      { type: 'value', name: 'V/A', position: 'right' }
    ],
    series: [
      { name: 'SOC(%)', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 0, data: historyChartData.soc },
      { name: 'SOH(%)', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 0, data: historyChartData.soh },
      {
        name: 'Pack电压(V)',
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 1,
        data: historyChartData.vPackV
      },
      { name: '电流(A)', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: historyChartData.currentA }
    ]
  }
})

const snapshotColumns: DataTableColumns<SnapshotHistoryRow> = [
  {
    key: 'ts',
    title: '时间',
    width: 180,
    render: (row) => formatTime(row.ts)
  },
  {
    key: 'summary',
    title: '快照摘要',
    minWidth: 380
  }
]

function startPolling() {
  stopPolling()
  const run = async () => {
    if (!client) return
    try {
      status.value = await client.readAllStatus()
    } catch {
      // ignore polling errors (connection may recover)
    }
  }
  run()
  pollTimer = window.setInterval(run, 2000)
}

async function disconnect() {
  stopPolling()
  status.value = null
  connType.value = 'offline'
  client = null
  try {
    await transport?.disconnect()
  } catch {
    // ignore
  }
  transport = null
}

async function connectMqtt() {
  if (!props.id || connecting.value) return
  if (!canUse4G.value) return
  connecting.value = true
  try {
    await disconnect()
    const token = String(localStg.get('token') || '').trim()
    if (!token) throw new Error('token missing')
    transport = new WebMqttSocketBmsTransport({
      wsUrl: buildWsUrl('/api/v1/app/battery/socket/ws'),
      deviceId: props.id,
      token
    })
    await transport.connect()
    client = new BmsClient({ transport })
    connType.value = 'mqtt'
    startPolling()
  } catch (e: any) {
    await disconnect()
    message.error(e?.message || '连接失败')
  } finally {
    connecting.value = false
  }
}

async function load() {
  if (!props.id) return
  loading.value = true
  try {
    const res: any = await getAppBatteryDetail(props.id)
    battery.value = res?.data || res || null
    // 仅对具备 4G 的电池尝试连接
    if (canUse4G.value) {
      connectMqtt()
    }
  } catch (e: any) {
    battery.value = null
    message.error(e?.message || '获取电池信息失败')
  } finally {
    loading.value = false
  }

  await Promise.all([loadCloudCurrent(), loadHistory()])
  openCloudWs()
}

async function loadDeviceParamPermissions() {
  try {
    const resp: any = await fetchCurrentDeviceParamPermissions()
    const data = resp?.data ?? resp ?? {}
    deviceParamPerm.allowAll = data?.allow_all ?? true
    deviceParamPerm.keys = Array.isArray(data?.device_param_permissions) ? data.device_param_permissions : []
  } catch {
    deviceParamPerm.allowAll = true
    deviceParamPerm.keys = []
  }
}

watch(
  () => props.id,
  () => {
    Object.keys(cloudCurrent).forEach((k) => {
      delete cloudCurrent[k]
    })
    cloudLastUpdateAt.value = null
    load()
  }
)

onMounted(() => {
  loadDeviceParamPermissions()
  load()
})
onBeforeUnmount(() => {
  disconnect()
  closeCloudWs()
})

const socPct = computed(() => {
  const v = displayStatus.value?.energy?.socPct ?? cloudCurrent.soc ?? battery.value?.soc
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
})

const sohPct = computed(() => {
  const v = displayStatus.value?.energy?.sohPct ?? cloudCurrent.soh ?? battery.value?.soh
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
})

const cellCount = computed(() => Number(displayStatus.value?.meta?.seriesCount || cloudCurrent.seriesCount || 0))
const packVoltageText = computed(() => {
  const v = displayStatus.value?.electrical?.vPackV ?? cloudCurrent.vPackV
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-'
  return `${v.toFixed(1)}V`
})

const highestIdx = computed(() => Number(displayStatus.value?.electrical?.cellVoltageIndex?.highest || 0))
const cellVoltageRows = computed(() => {
  const list = displayStatus.value?.cell?.voltagesMv || []
  return list.map((mv, i) => {
    const v = Number(mv || 0) / 1000
    return {
      index: i + 1,
      voltage: Number.isFinite(v) ? v : null,
      voltageText: Number.isFinite(v) ? `${v.toFixed(2)}V` : '-',
      isHighest: i + 1 === highestIdx.value
    }
  })
})

const cellColumns: DataTableColumns<any> = [
  { key: 'index', title: '电芯', width: 80 },
  {
    key: 'voltageText',
    title: '电压',
    minWidth: 120,
    render: (row) =>
      row.isHighest ? <span style="color:#d03050;font-weight:600">{row.voltageText}</span> : row.voltageText
  }
]

// 参数设置（从移动端移植：分组 + 读写）
type ParamItem = { key: string; label: string; unit: string; valueText: string; value: unknown }
const paramValues = reactive<Record<string, unknown>>({})

function labelOf(key: string) {
  return PARAM_DEF_BY_KEY[key]?.label || key
}
function unitOf(key: string) {
  return String(PARAM_DEF_BY_KEY[key]?.unit || '')
}
function formatValue(v: unknown, unit: string) {
  if (v == null || v === '') return '-'
  if (typeof v === 'string') return v
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return '-'
  if (unit === 'V') return `${n.toFixed(2)}V`
  if (unit === 'A') return `${n.toFixed(1)}A`
  if (unit === '°C') return `${n.toFixed(0)}°C`
  if (unit.toLowerCase() === 's') return `${n.toFixed(0)}S`
  if (unit.toLowerCase() === 'min') return `${n.toFixed(0)}MIN`
  return `${n}${unit}`
}

function canAccessParamKey(paramKey: string) {
  if (deviceParamPerm.allowAll) return true
  const permKey = getParamPermissionKey(paramKey)
  if (!permKey) return true
  return deviceParamPermSet.value.has(permKey)
}

const filterParamKeys = (keys: string[]) => keys.filter((key) => canAccessParamKey(key))

const SINGLE_KEYS = [
  'CELL_OV_ALARM_V',
  'CELL_OC_PROTECT_V',
  'CELL_OC_ALARM_DELAY_S',
  'CELL_OC_PROTECT_DELAY_S',
  'CELL_OV_PROTECT_RELEASE_V',
  'CELL_OC_ALARM_RELEASE_DELTA_V',
  'CELL_OV_ALARM_RELEASE_DELAY_S',
  'CELL_OV_PROTECT_RELEASE_DELAY_S',
  'NORMAL_CELL_UV_ALARM_V',
  'NORMAL_CELL_UV_PROTECT_V',
  'CELL_UV_ALARM_DELAY_S',
  'CELL_UV_PROTECT_DELAY_S'
]
const VOLTAGE_KEYS = [
  'PACK_OV_ALARM_V',
  'PACK_OV_PROTECT_V',
  'PACK_OV_ALARM_DELAY_S',
  'PACK_OV_PROTECT_DELAY_S',
  'PACK_UV_ALARM_DELAY_S',
  'PACK_UV_PROTECT_DELAY_S'
]
const CURRENT_KEYS = [
  'CHARGE_OC_PROTECT_SMALL_A',
  'CHARGE_OC_PROTECT_LARGE_A',
  'CHARGE_OC_ALARM_DELAY_S',
  'DISCHARGE_OC_ALARM_A',
  'DISCHARGE_OC_PROTECT_SMALL_A',
  'DISCHARGE_OC_PROTECT_LARGE_A'
]
const TEMP_KEYS = [
  'CELL_OVER_TEMP_PROTECT_C',
  'CELL_OVER_TEMP_RELEASE_C',
  'CELL_UNDER_TEMP_PROTECT_C',
  'CELL_UNDER_TEMP_RELEASE_C'
]

const mkItems = (keys: string[]): ParamItem[] =>
  filterParamKeys(keys).map((key) => {
    const unit = unitOf(key)
    const value = paramValues[key]
    return { key, label: labelOf(key), unit, value, valueText: formatValue(value, unit) }
  })

const singleItems = computed(() => mkItems(SINGLE_KEYS))
const voltageItems = computed(() => mkItems(VOLTAGE_KEYS))
const currentItems = computed(() => mkItems(CURRENT_KEYS))
const temperatureItems = computed(() => mkItems(TEMP_KEYS))

async function loadKeys(keys: string[]) {
  if (!client || connType.value === 'offline') return
  const allowedKeys = filterParamKeys(keys)
  for (const k of allowedKeys) {
    try {
      // eslint-disable-next-line no-await-in-loop
      paramValues[k] = await client.readParam(k)
    } catch {
      paramValues[k] = null
    }
  }
}

const editState = reactive({
  show: false,
  key: '',
  title: '',
  unit: '',
  input: null as number | null
})

function openEdit(item: ParamItem) {
  if (!client || connType.value === 'offline') {
    message.warning('当前离线，无法设置参数')
    return
  }
  if (!canAccessParamKey(item.key)) {
    message.warning('当前账号无权限操作该参数')
    return
  }
  editState.key = item.key
  editState.title = item.label
  editState.unit = item.unit
  const n = typeof item.value === 'number' ? item.value : Number(item.value)
  editState.input = Number.isFinite(n) ? n : null
  editState.show = true
}

async function confirmEdit() {
  if (!client) return
  const v = editState.input
  if (v == null || !Number.isFinite(Number(v))) {
    message.warning('请输入有效数值')
    return
  }
  try {
    await client.writeParam(editState.key, Number(v))
    paramValues[editState.key] = await client.readParam(editState.key)
    editState.show = false
    message.success('已保存')
  } catch (e: any) {
    editState.show = false
    message.error(e?.message || '保存失败')
  }
}

const paramColumns: DataTableColumns<ParamItem> = [
  { key: 'label', title: '参数', minWidth: 220 },
  { key: 'valueText', title: '值', minWidth: 160 },
  { key: 'unit', title: '单位', width: 90 },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    render: (row) => (
      <NButton size="small" tertiary type="primary" onClick={() => openEdit(row)}>
        设置
      </NButton>
    )
  }
]
</script>

<template>
  <div class="bms-panel">
    <NSpin :show="loading || cloudLoading">
      <NCard size="small" :bordered="false">
        <NSpace align="center" justify="space-between">
          <NSpace align="center">
            <NText strong>连接：</NText>
            <NTag :type="connType === 'mqtt' ? 'success' : 'default'">{{ connText }}</NTag>
            <NTag v-if="battery?.comm_chip_id" type="info">4G卡ID：{{ battery.comm_chip_id }}</NTag>
            <NTag :type="cloudStatusType">{{ cloudStatusText }}</NTag>
            <NTag type="default">云端更新时间：{{ cloudUpdateText }}</NTag>
          </NSpace>
          <NSpace>
            <NButton size="small" :disabled="!canUse4G || connecting" @click="connectMqtt">连接</NButton>
            <NButton size="small" :disabled="connecting" @click="disconnect">断开</NButton>
            <NButton size="small" @click="loadCloudCurrent">刷新云端</NButton>
          </NSpace>
        </NSpace>
      </NCard>

      <div class="panel-body">
        <div v-if="!canUse4G" class="disabled-mask">
          <div class="disabled-mask__content">
            <NAlert type="warning" :show-icon="false" title="BMS面板已禁用">
              该设备未配置 4G 通讯卡ID（comm_chip_id），无法进行 MQTT 透传通讯。
            </NAlert>
          </div>
        </div>

        <NTabs type="line" animated>
          <NTabPane name="dashboard" tab="仪表">
            <NGrid :cols="24" :x-gap="12" :y-gap="12">
              <NGridItem :span="8">
                <NCard size="small" title="SOC" :bordered="false">
                  <NProgress type="circle" :percentage="socPct" :height="120" />
                </NCard>
              </NGridItem>
              <NGridItem :span="8">
                <NCard size="small" title="SOH" :bordered="false">
                  <NProgress type="circle" :percentage="sohPct" :height="120" />
                </NCard>
              </NGridItem>
              <NGridItem :span="8">
                <NCard size="small" title="Pack电压" :bordered="false">
                  <div class="metric-big">{{ packVoltageText }}</div>
                  <div class="metric-sub">电芯串数：{{ cellCount || '-' }}</div>
                </NCard>
              </NGridItem>

              <NGridItem :span="24">
                <NCard size="small" title="设备信息" :bordered="false">
                  <NDescriptions :columns="3" size="small" label-placement="left">
                    <NDescriptionsItem label="设备名称">{{ battery?.device_name || '-' }}</NDescriptionsItem>
                    <NDescriptionsItem label="设备编号">{{ battery?.device_number || '-' }}</NDescriptionsItem>
                    <NDescriptionsItem label="型号">{{ battery?.battery_model_name || '-' }}</NDescriptionsItem>
                    <NDescriptionsItem label="固件版本">{{ battery?.fw_version || '-' }}</NDescriptionsItem>
                    <NDescriptionsItem label="蓝牙Mac">{{ battery?.ble_mac || '-' }}</NDescriptionsItem>
                    <NDescriptionsItem label="更新时间">{{ battery?.updated_at || '-' }}</NDescriptionsItem>
                  </NDescriptions>
                </NCard>
              </NGridItem>
            </NGrid>
          </NTabPane>

          <NTabPane name="cells" tab="电芯">
            <NCard size="small" :bordered="false">
              <NSpace align="center" justify="space-between" class="mb-10px">
                <NTag type="info">Pack：{{ packVoltageText }}</NTag>
                <NTag type="default">电芯串数：{{ cellCount || '-' }}</NTag>
              </NSpace>
              <NDataTable :columns="cellColumns" :data="cellVoltageRows" :bordered="false" :max-height="420" />
            </NCard>
          </NTabPane>

          <NTabPane name="history" tab="历史记录">
            <NSpin :show="historyLoading">
              <NCard size="small" :bordered="false" title="近1小时核心指标曲线（云端）">
                <div class="history-chart">
                  <ChartComponent :initial-options="historyChartOption" />
                </div>
              </NCard>

              <NCard size="small" :bordered="false" class="mt-12px" title="最近快照时间线（近24小时）">
                <template #header-extra>
                  <NButton size="small" @click="loadHistory">刷新</NButton>
                </template>
                <NDataTable
                  v-if="snapshotHistoryRows.length > 0"
                  :columns="snapshotColumns"
                  :data="snapshotHistoryRows"
                  :bordered="false"
                  :max-height="320"
                />
                <NEmpty v-else description="暂无快照历史数据" />
              </NCard>
            </NSpin>
          </NTabPane>

          <NTabPane name="params" tab="参数设置">
            <NAlert class="mb-12px" type="info" :show-icon="false">
              仅在“MQTT透传”连接成功后可读写参数；写入参数请谨慎操作。
            </NAlert>
            <NGrid :cols="24" :x-gap="12" :y-gap="12">
              <NGridItem :span="12">
                <NCard size="small" title="单体保护" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton size="small" :disabled="connType === 'offline'" @click="loadKeys(SINGLE_KEYS)">
                      刷新
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="singleItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem :span="12">
                <NCard size="small" title="电压保护" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton size="small" :disabled="connType === 'offline'" @click="loadKeys(VOLTAGE_KEYS)">
                      刷新
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="voltageItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem :span="12">
                <NCard size="small" title="电流保护" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton size="small" :disabled="connType === 'offline'" @click="loadKeys(CURRENT_KEYS)">
                      刷新
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="currentItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem :span="12">
                <NCard size="small" title="温度保护" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton size="small" :disabled="connType === 'offline'" @click="loadKeys(TEMP_KEYS)">刷新</NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="temperatureItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
            </NGrid>
          </NTabPane>
        </NTabs>
      </div>
    </NSpin>

    <NModal v-model:show="editState.show" preset="card" style="width: 520px" :title="`设置：${editState.title}`">
      <NSpace vertical size="large">
        <NText depth="3">单位：{{ editState.unit || '-' }}</NText>
        <NInputNumber v-model:value="editState.input" placeholder="请输入数值" :show-button="false" />
        <NSpace justify="end">
          <NButton @click="editState.show = false">取消</NButton>
          <NButton type="primary" @click="confirmEdit">保存</NButton>
        </NSpace>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.bms-panel {
  position: relative;
}
.panel-body {
  position: relative;
  margin-top: 12px;
}
.disabled-mask {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(1px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.disabled-mask__content {
  width: min(720px, 100%);
}
.metric-big {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}
.metric-sub {
  margin-top: 8px;
  color: rgba(55, 65, 81, 0.7);
  font-size: 12px;
}
.history-chart {
  width: 100%;
  height: 320px;
}
.mb-10px {
  margin-bottom: 10px;
}
.mb-12px {
  margin-bottom: 12px;
}
.mt-12px {
  margin-top: 12px;
}
</style>
