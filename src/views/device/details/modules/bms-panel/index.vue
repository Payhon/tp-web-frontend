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
  NInput,
  NModal,
  NProgress,
  NSelect,
  NSpace,
  NSwitch,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NText,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import ChartComponent from '@/components/custom/ChartComponent.vue'
import { $t } from '@/locales'
import { localStg } from '@/utils/storage'
import {
  getAppBatteryDetail,
  getBatteryRelayStatus,
  sendBatteryRelayCommand,
  type BatteryRelayCommandResp,
  type BatteryRelayStatus
} from '@/service/api/bms'
import { telemetryDataCurrentKeys, telemetryDataHistoryList, telemetryHistoryData } from '@/service/api/device'
import { fetchCurrentDeviceParamPermissions } from '@/service/api/org-type-permissions'
import {
  BMS_PARAM,
  BmsClient,
  FUNCTION_CONFIG_ITEMS,
  PARAM_CATEGORIES,
  PARAM_DEF_BY_KEY,
  WebMqttSocketBmsTransport,
  getFactoryPermissionKey,
  getFunctionPermissionKey,
  getParamPermissionKey,
  listParamsByCategory,
  parseFunctionConfigFlags,
  setFunctionConfigFlag,
  type FunctionConfigFlagKey
} from '@/common/lib/bms-protocol'
import type { BmsStatus } from '@/common/lib/bms-protocol'
import { selectDisplayCellVoltagesMv } from './cell-voltage'

const props = defineProps<{
  id: string
}>()

type AppBatteryDetail = {
  device_id: string
  device_number: string
  device_name?: string | null
  bms_comm_type?: number | null
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
  'packCellSumVoltageV',
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
  'meta.seriesCount',
  'cell.voltagesMv',
  'cellVoltagesMv',
  'temperature.cellTempsC',
  'cellTempsC',
  'electrical.cellVoltageIndex.highest',
  'electrical.cellVoltageIndex.lowest',
  'cellVoltageHighestIndex',
  'cellVoltageLowestIndex',
  'electrical.packCellSumVoltageV',
  'electrical.avgCellVoltageMv',
  'bms.snapshot'
]

const message = useMessage()

function tr(key: string, params?: Record<string, unknown>, fallback?: string) {
  const text = params ? $t(key, params) : $t(key)
  return text === key ? fallback || key : text
}

function tb(key: string, params?: Record<string, unknown>, fallback?: string) {
  return tr(`bms.${key}`, params, fallback)
}

const loading = ref(false)
const battery = ref<AppBatteryDetail | null>(null)

const cloudLoading = ref(false)
const cloudCurrent = reactive<Record<string, unknown>>({})
const cloudLastUpdateAt = ref<number | null>(null)
const cloudWsState = ref<'closed' | 'connecting' | 'open' | 'error'>('closed')
const relayState = reactive<{
  loading: boolean
  ownerOnline: boolean
  sessionId: string
  platform: string
  connType: string
  lastSeenTs: number | null
}>({
  loading: false,
  ownerOnline: false,
  sessionId: '',
  platform: '',
  connType: '',
  lastSeenTs: null
})
const historyLoading = ref(false)
const historyChartData = reactive<Record<string, Array<[number, number]>>>({
  soc: [],
  soh: [],
  packCellSumVoltageV: [],
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
let cloudReconnectTimer: number | null = null
let cloudWsShouldReconnect = false
let relayStatusTimer: number | null = null

const canUse4G = computed(() => {
  const v = String(battery.value?.comm_chip_id || '').trim()
  return Number(battery.value?.bms_comm_type || 0) === 2 || v.length > 0
})
const canUseRelay = computed(() => !canUse4G.value)
const relayReady = computed(() => canUseRelay.value && relayState.ownerOnline)

const hasCloudTelemetry = computed(() => !!cloudLastUpdateAt.value)
const mqttReportOnline = computed(() => Number(battery.value?.is_online || 0) === 1 || hasCloudTelemetry.value)
const mqttReportText = computed(() => {
  if (!canUse4G.value) return tb('detail.telemetry.non4g')
  return mqttReportOnline.value ? tb('detail.telemetry.mqttOnline') : tb('detail.telemetry.mqttOffline')
})
const mqttReportType = computed(() => {
  if (!canUse4G.value) return 'default'
  return mqttReportOnline.value ? 'success' : 'default'
})
const connText = computed(() => {
  if (connType.value === 'mqtt' && status.value) return tb('detail.telemetry.mqttRealtime')
  if (hasCloudTelemetry.value) return tb('detail.telemetry.activeReportFallback')
  return tb('detail.telemetry.offlineNoData')
})
const connTagType = computed(() => {
  if (connType.value === 'mqtt' && status.value) return 'success'
  if (hasCloudTelemetry.value) return 'warning'
  return 'default'
})
const paramLinkText = computed(() => {
  if (connType.value === 'mqtt') return tb('detail.telemetry.paramMqtt')
  if (relayReady.value) return tb('detail.telemetry.paramRelay')
  if (canUseRelay.value) return tb('detail.telemetry.paramRelayWaiting')
  return tb('detail.telemetry.paramDisconnected')
})
const paramLinkType = computed(() => {
  if (connType.value === 'mqtt') return 'success'
  if (relayReady.value) return 'info'
  if (canUseRelay.value) return 'warning'
  return 'default'
})

const cloudStatusText = computed(() => {
  if (cloudWsState.value === 'open' && cloudLastUpdateAt.value) return tb('detail.telemetry.cloudConnectedLive')
  if (cloudWsState.value === 'open') return tb('detail.telemetry.cloudConnectedNoLive')
  if (cloudWsState.value === 'connecting') return tb('detail.telemetry.cloudConnecting')
  if (cloudWsState.value === 'error') return tb('detail.telemetry.cloudError')
  return tb('detail.telemetry.cloudDisconnected')
})

const cloudStatusType = computed(() => {
  if (cloudWsState.value === 'open' && cloudLastUpdateAt.value) return 'success'
  if (cloudWsState.value === 'open') return 'warning'
  if (cloudWsState.value === 'connecting') return 'info'
  if (cloudWsState.value === 'error') return 'error'
  return 'default'
})

const cloudUpdateText = computed(() => formatTime(cloudLastUpdateAt.value))
const paramConnectButtonText = computed(() =>
  canUse4G.value ? tb('detail.telemetry.reconnectMqtt') : tb('detail.telemetry.connectRelay')
)

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

const displayStatus = computed(() => status.value || cloudSnapshot.value)

function parseJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return []
  const text = raw.trim()
  if (!text.startsWith('[')) return []
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function numberArray(raw: unknown): number[] {
  return parseJsonArray(raw)
    .map(item => Number(item))
    .filter(item => Number.isFinite(item))
}

function nullableNumberArray(raw: unknown): Array<number | null> {
  return parseJsonArray(raw).map(item => {
    if (item == null) return null
    const n = Number(item)
    return Number.isFinite(n) ? n : null
  })
}

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

function clearCloudReconnectTimer() {
  if (cloudReconnectTimer != null) {
    window.clearTimeout(cloudReconnectTimer)
    cloudReconnectTimer = null
  }
}

function scheduleCloudReconnect() {
  if (!cloudWsShouldReconnect || cloudReconnectTimer != null || !props.id) return
  cloudReconnectTimer = window.setTimeout(() => {
    cloudReconnectTimer = null
    if (cloudWsShouldReconnect) openCloudWs()
  }, 3000)
}

function closeCloudWs({ reconnect = false }: { reconnect?: boolean } = {}) {
  cloudWsShouldReconnect = reconnect
  if (!reconnect) clearCloudReconnectTimer()
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

function stopRelayStatusTimer() {
  if (relayStatusTimer != null) {
    window.clearInterval(relayStatusTimer)
    relayStatusTimer = null
  }
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

function parseNumberToMs(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
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
    const vPack = s?.electrical?.packCellSumVoltageV
    const current = s?.electrical?.currentA
    return `SOC:${Number(soc ?? 0).toFixed(1)}%, SOH:${Number(soh ?? 0).toFixed(1)}%, V:${Number(vPack ?? 0).toFixed(
      2
    )}V, I:${Number(current ?? 0).toFixed(2)}A`
  } catch {
    return tb('detail.history.snapshotParseFailed')
  }
}

function applyRelayStatus(raw: BatteryRelayStatus | null | undefined) {
  relayState.ownerOnline = !!raw?.owner_online
  relayState.sessionId = String(raw?.session_id || '')
  relayState.platform = String(raw?.platform || '')
  relayState.connType = String(raw?.conn_type || '')
  relayState.lastSeenTs = parseNumberToMs(raw?.last_seen_ts)
}

async function loadRelayStatus({ silent = false }: { silent?: boolean } = {}) {
  if (!props.id) return
  if (!canUseRelay.value) {
    applyRelayStatus(null)
    return
  }
  relayState.loading = !silent
  try {
    const rsp: any = await getBatteryRelayStatus(props.id)
    const data = (rsp?.data || rsp || {}) as BatteryRelayStatus
    applyRelayStatus(data)
  } catch (e: any) {
    applyRelayStatus(null)
    if (!silent) {
      message.warning(e?.message || tb('messages.relayStatusFailed'))
    }
  } finally {
    relayState.loading = false
  }
}

function startRelayStatusTimer() {
  stopRelayStatusTimer()
  if (!canUseRelay.value) return
  relayStatusTimer = window.setInterval(() => {
    void loadRelayStatus({ silent: true })
  }, 5000)
}

async function runRelayCommand(payload: Record<string, unknown>): Promise<BatteryRelayCommandResp> {
  const req: any = {
    device_id: props.id,
    wait_ms: 15000,
    ...payload
  }
  const rsp: any = await sendBatteryRelayCommand(req)
  const data = (rsp?.data || rsp || {}) as BatteryRelayCommandResp
  if (!data || !data.status) throw new Error(tb('messages.invalidRelayResponse'))
  if (data.status !== 'SUCCESS') {
    throw new Error(data.error_message || tb('messages.relayCommandFailed', { status: data.status }))
  }
  return data
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
    message.warning(e?.message || tb('messages.cloudLoadFailed'))
  } finally {
    cloudLoading.value = false
  }
}

function openCloudWs() {
  closeCloudWs()
  if (!props.id) return
  const token = String(localStg.get('token') || '').trim()
  if (!token) return

  cloudWsShouldReconnect = true
  clearCloudReconnectTimer()
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

  ws.onmessage = event => {
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
    scheduleCloudReconnect()
  }

  ws.onclose = () => {
    if (cloudWs === ws) {
      cloudWs = null
      cloudWsState.value = cloudWsState.value === 'error' ? 'error' : 'closed'
      if (cloudHeartbeatTimer != null) {
        window.clearInterval(cloudHeartbeatTimer)
        cloudHeartbeatTimer = null
      }
      scheduleCloudReconnect()
    }
  }
}

async function loadHistory() {
  if (!props.id) return
  historyLoading.value = true
  try {
    const metricKeys = ['soc', 'soh', 'packCellSumVoltageV', 'currentA']
    const chartResults = await Promise.all(
      metricKeys.map(async key => {
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
    metricKeys.forEach(key => {
      historyChartData[key] = []
    })
    chartResults.forEach(item => {
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
    message.warning(e?.message || tb('messages.historyLoadFailed'))
  } finally {
    historyLoading.value = false
  }
}

const historyChartOption = computed<EChartsCoreOption>(() => {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['SOC(%)', 'SOH(%)', tb('detail.history.packVoltageSeries'), tb('detail.history.currentSeries')] },
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
        name: tb('detail.history.packVoltageSeries'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 1,
        data: historyChartData.packCellSumVoltageV
      },
      {
        name: tb('detail.history.currentSeries'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 1,
        data: historyChartData.currentA
      }
    ]
  }
})

const snapshotColumns: DataTableColumns<SnapshotHistoryRow> = [
  {
    key: 'ts',
    title: tb('detail.history.time'),
    width: 180,
    render: row => formatTime(row.ts)
  },
  {
    key: 'summary',
    title: tb('detail.history.snapshotSummary'),
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

async function disconnectMqtt() {
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

async function disconnectAllConnections() {
  await disconnectMqtt()
  closeCloudWs()
  stopRelayStatusTimer()
  applyRelayStatus(null)
}

async function handleDisconnect() {
  await disconnectMqtt()
  if (canUseRelay.value) {
    stopRelayStatusTimer()
    applyRelayStatus(null)
  }
  message.success(tb('messages.disconnected'))
}

async function connectRealtime() {
  if (connecting.value) return
  openCloudWs()
  if (canUse4G.value) {
    await connectMqtt()
    return
  }
  await loadRelayStatus()
  startRelayStatusTimer()
  if (relayReady.value) {
    message.success(tb('messages.relayConnected'))
  } else {
    message.info(tb('messages.relayHint'))
  }
}

async function connectMqtt(options: { silent?: boolean } = {}) {
  if (!props.id || connecting.value) return
  if (!canUse4G.value) return
  connecting.value = true
  try {
    await disconnectMqtt()
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
    await disconnectMqtt()
    if (!options.silent) {
      message.error(e?.message || tb('messages.connectFailed'))
    }
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
    if (!canUse4G.value) {
      await loadRelayStatus({ silent: true })
      startRelayStatusTimer()
    }
  } catch (e: any) {
    battery.value = null
    message.error(e?.message || tb('messages.batteryLoadFailed'))
  } finally {
    loading.value = false
  }

  await Promise.all([loadCloudCurrent(), loadHistory()])
  openCloudWs()
  if (canUse4G.value) {
    void connectMqtt({ silent: true })
  }
}

async function refreshCloudData() {
  if (!props.id) return
  const [detailRes] = await Promise.allSettled([getAppBatteryDetail(props.id), loadCloudCurrent(), loadHistory()])
  if (detailRes.status === 'fulfilled') {
    const res: any = detailRes.value
    battery.value = res?.data || res || battery.value
  }
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
    Object.keys(cloudCurrent).forEach(k => {
      delete cloudCurrent[k]
    })
    cloudLastUpdateAt.value = null
    stopRelayStatusTimer()
    applyRelayStatus(null)
    void disconnectMqtt()
    load()
  }
)

onMounted(() => {
  loadDeviceParamPermissions()
  load()
})
onBeforeUnmount(() => {
  stopRelayStatusTimer()
  disconnectAllConnections()
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

const cloudCellVoltagesMv = computed(() => numberArray(cloudCurrent['cell.voltagesMv'] ?? cloudCurrent.cellVoltagesMv))
const cloudCellTempsC = computed(() =>
  nullableNumberArray(cloudCurrent['temperature.cellTempsC'] ?? cloudCurrent.cellTempsC)
)
const cellCount = computed(() =>
  Number(
    displayStatus.value?.meta?.seriesCount ||
      cloudCurrent.seriesCount ||
      cloudCurrent['meta.seriesCount'] ||
      cloudCellVoltagesMv.value.length ||
      0
  )
)
const indicatorStatus = computed(() => displayStatus.value?.status?.indicatorStatus || {})
const protectionStatus = computed(() => displayStatus.value?.status?.protectionStatus || {})
const failureStatus = computed(() => displayStatus.value?.status?.failureStatus || {})
const alarmStatusBits = computed(() => displayStatus.value?.status?.alarmStatus || {})
const chargeSwitchOn = computed(() => Boolean(indicatorStatus.value.chargeFetOn))
const dischargeSwitchOn = computed(() => Boolean(indicatorStatus.value.dischargeFetOn))
const balancingOn = computed(() => Boolean((displayStatus.value?.cell?.balancing || []).some(item => item)))
const protectPanelExpanded = ref(true)
const packVoltageText = computed(() => {
  const v = displayStatus.value?.electrical?.packCellSumVoltageV ?? cloudCurrent.packCellSumVoltageV
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-'
  if (v >= 1000 || v >= 0xffff) return '-'
  return `${v.toFixed(1)}V`
})

function formatSignedCurrent(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return '-'
  const normalized = Math.abs(n) < 0.005 ? 0 : n
  const sign = normalized > 0 ? '+' : ''
  const text = normalized.toFixed(2).replace(/\.?0+$/u, '')
  return `${sign}${text}A`
}

function isInvalidU16(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v)
  return !Number.isFinite(n) || n >= 0xffff
}

function formatCountText(v: unknown) {
  if (isInvalidU16(v)) return '-'
  return `${Number(v || 0)}${tb('common.times')}`
}

function formatMinuteText(v: unknown) {
  if (isInvalidU16(v)) return '-'
  return `${Number(v || 0)}${tb('common.minutes')}`
}

function cToFText(c: number | null | undefined) {
  if (typeof c !== 'number' || !Number.isFinite(c)) return '-'
  const f = c * (9 / 5) + 32
  return `${c.toFixed(0)}℃/${f.toFixed(0)}°F`
}

const currentText = computed(() =>
  formatSignedCurrent(displayStatus.value?.electrical?.currentA ?? cloudCurrent.currentA)
)
const cycleCountText = computed(() =>
  formatCountText(displayStatus.value?.energy?.cycleCount ?? cloudCurrent.cycleCount)
)
const chargeTimeText = computed(() =>
  formatMinuteText(displayStatus.value?.timing?.chargeRemainingMin ?? cloudCurrent.chargeRemainingMin)
)
const mosTempText = computed(() =>
  cToFText(displayStatus.value?.temperature?.chargeMosC ?? (cloudCurrent.chargeMosC as number | null | undefined))
)
const ambientTempText = computed(() =>
  cToFText(displayStatus.value?.temperature?.ambientC ?? (cloudCurrent.ambientC as number | null | undefined))
)
const cellTempText = computed(() => {
  const cellTemps = displayStatus.value?.temperature?.cellTempsC || cloudCellTempsC.value
  const v =
    cellTemps.length > 0
      ? cellTemps[0]
      : (displayStatus.value?.temperature?.highestTemp?.valueC ?? displayStatus.value?.temperature?.poleC ?? null)
  return cToFText(v)
})
const avgVoltageText = computed(() => {
  const v = displayStatus.value?.electrical?.avgCellVoltageMv ?? cloudCurrent.avgCellVoltageMv
  const n = Number(v)
  if (!Number.isFinite(n) || n >= 0xffff) return '-'
  return `${formatDisplayNumber(n / 1000, 2)}V`
})
const highestVoltageText = computed(() => {
  const v = displayStatus.value?.electrical?.highestCellVoltageMv ?? cloudCurrent.highestCellVoltageMv
  const n = Number(v)
  if (!Number.isFinite(n) || n >= 0xffff) return '-'
  return `${formatDisplayNumber(n / 1000, 2)}V`
})
const lowestVoltageText = computed(() => {
  const v = displayStatus.value?.electrical?.lowestCellVoltageMv ?? cloudCurrent.lowestCellVoltageMv
  const n = Number(v)
  if (!Number.isFinite(n) || n >= 0xffff) return '-'
  return `${formatDisplayNumber(n / 1000, 2)}V`
})
const diffVoltageText = computed(() => {
  const v = displayStatus.value?.electrical?.maxCellVoltageDiffMv ?? cloudCurrent.maxCellVoltageDiffMv
  const n = Number(v)
  if (!Number.isFinite(n) || n >= 0xffff) return '-'
  return `${formatDisplayNumber(n, 0)}mV`
})

const highestIdx = computed(() =>
  Number(
    displayStatus.value?.electrical?.cellVoltageIndex?.highest ||
      cloudCurrent['electrical.cellVoltageIndex.highest'] ||
      cloudCurrent.cellVoltageHighestIndex ||
      0
  )
)
const lowestIdx = computed(() =>
  Number(
    displayStatus.value?.electrical?.cellVoltageIndex?.lowest ||
      cloudCurrent['electrical.cellVoltageIndex.lowest'] ||
      cloudCurrent.cellVoltageLowestIndex ||
      0
  )
)

const STATUS_LABELS: Record<string, string> = {}

function labelForStatus(key: string) {
  return tr(`bms.status.flags.${key}`, undefined, STATUS_LABELS[key] || key)
}

function activeStatusItems(obj: Record<string, boolean>) {
  return Object.keys(obj)
    .filter(key => obj[key])
    .map(labelForStatus)
}

type StatusFlagType = 'fault' | 'alarm' | 'protect'

const faultStatusItems = computed(() => activeStatusItems(failureStatus.value))
const alarmStatusItems = computed(() => activeStatusItems(alarmStatusBits.value))
const protectStatusItems = computed(() => activeStatusItems(protectionStatus.value))

const statusFlags = computed(() => {
  const items: Array<{ type: StatusFlagType; label: string; count: number; className: string }> = []
  if (faultStatusItems.value.length) {
    items.push({
      type: 'fault',
      label: tb('status.fault'),
      count: faultStatusItems.value.length,
      className: 'status-flag-web--danger'
    })
  }
  if (alarmStatusItems.value.length) {
    items.push({
      type: 'alarm',
      label: tb('status.alarm'),
      count: alarmStatusItems.value.length,
      className: 'status-flag-web--warn'
    })
  }
  if (protectStatusItems.value.length) {
    items.push({
      type: 'protect',
      label: tb('status.protect'),
      count: protectStatusItems.value.length,
      className: 'status-flag-web--guard'
    })
  }
  return items
})
const hasStatusFlags = computed(() => statusFlags.value.length > 0)

const statusFlagModal = reactive({
  show: false,
  title: '',
  items: [] as string[]
})

function openStatusFlag(type: StatusFlagType) {
  const config = {
    fault: { title: tb('status.fault'), items: faultStatusItems.value },
    alarm: { title: tb('status.alarm'), items: alarmStatusItems.value },
    protect: { title: tb('status.protect'), items: protectStatusItems.value }
  }[type]
  if (!config.items.length) return
  statusFlagModal.title = config.title
  statusFlagModal.items = config.items
  statusFlagModal.show = true
}

const protectStatusRows = computed(() =>
  Object.keys(protectionStatus.value).map(key => ({
    key,
    label: labelForStatus(key),
    enabled: Boolean(protectionStatus.value[key])
  }))
)
const protectSummaryText = computed(() =>
  protectStatusItems.value.length
    ? tb('detail.dashboard.protections', { count: protectStatusItems.value.length })
    : tb('detail.dashboard.none')
)
function toggleProtectPanel() {
  protectPanelExpanded.value = !protectPanelExpanded.value
}

const cellVoltageRows = computed(() => {
  const list = selectDisplayCellVoltagesMv(displayStatus.value?.cell?.voltagesMv, cloudCellVoltagesMv.value)
  const balancingList = displayStatus.value?.cell?.balancing || []
  return list.map((mv, i) => {
    const v = mv == null ? null : mv / 1000
    const valid = v != null && Number.isFinite(v)
    return {
      index: i + 1,
      voltage: valid ? v : null,
      voltageText: valid ? `${v.toFixed(3)}V` : '-',
      voltageLabel: valid ? v.toFixed(3) : '-',
      fillPercent: valid ? Math.max(0, Math.min(100, (v / 5) * 100)) : 0,
      isHighest: valid && i + 1 === highestIdx.value,
      isLowest: valid && i + 1 === lowestIdx.value,
      isBalancing: Boolean(balancingList[i])
    }
  })
})

const highestCellRow = computed(() => cellVoltageRows.value.find(item => item.isHighest) || null)
const lowestCellRow = computed(() => cellVoltageRows.value.find(item => item.isLowest) || null)
const balancingCellCount = computed(() => cellVoltageRows.value.filter(item => item.isBalancing).length)

// 参数设置（与移动端对齐）
type ParamEntry = string | { displayKey: string; actualKey: string }
type ParamItem = {
  key: string
  actualKey: string
  label: string
  unit: string
  valueText: string
  value: unknown
  valueType: string
}
type FactoryAction = { key: string; raw: number; confirm: boolean; label: string }
type FunctionControlRow = (typeof FUNCTION_CONFIG_ITEMS)[number] & { enabled: boolean; statusText: string }

const BATTERY_TYPE_OPTIONS = [
  { labelKey: 'batteryType.reserved', value: 0x00 },
  { labelKey: 'batteryType.lfp', value: 0x01 },
  { labelKey: 'batteryType.lmo', value: 0x02 },
  { labelKey: 'batteryType.ncm', value: 0x03 },
  { labelKey: 'batteryType.lco', value: 0x04 },
  { labelKey: 'batteryType.polymer', value: 0x05 },
  { labelKey: 'batteryType.lto', value: 0x06 },
  { labelKey: 'batteryType.leadAcid', value: 0x07 },
  { labelKey: 'batteryType.nimh', value: 0x08 },
  { labelKey: 'batteryType.sodiumIon', value: 0x09 }
] as const
const batteryTypeSelectOptions = computed(() =>
  BATTERY_TYPE_OPTIONS.map(item => ({
    label: tb(item.labelKey),
    value: item.value
  }))
)

const paramValues = reactive<Record<string, unknown>>({})
const TEMP_DISPLAY_LABELS: Record<string, string> = {
  CELL_OVER_TEMP_PROTECT_C: 'CELL_OVER_TEMP_PROTECT_C',
  CELL_OVER_TEMP_RELEASE_C: 'CELL_OVER_TEMP_RELEASE_C',
  MOS_OVER_TEMP_PROTECT_DELAY_S: 'MOS_OVER_TEMP_PROTECT_DELAY_S',
  MOS_OVER_TEMP_RELEASE_DELAY_S: 'MOS_OVER_TEMP_RELEASE_DELAY_S',
  CELL_UNDER_TEMP_PROTECT_C: 'CELL_UNDER_TEMP_PROTECT_C',
  CELL_UNDER_TEMP_RELEASE_C: 'CELL_UNDER_TEMP_RELEASE_C',
  CHARGE_OVER_TEMP_PROTECT_C: 'CHARGE_OVER_TEMP_PROTECT_C',
  CHARGE_OVER_TEMP_RELEASE_C: 'CHARGE_OVER_TEMP_RELEASE_C',
  CHARGE_OVER_TEMP_PROTECT_DELAY_S: 'CHARGE_OVER_TEMP_PROTECT_DELAY_S',
  CHARGE_OVER_TEMP_RELEASE_DELAY_S: 'CHARGE_OVER_TEMP_RELEASE_DELAY_S',
  DISCHARGE_UNDER_TEMP_PROTECT_C: 'DISCHARGE_UNDER_TEMP_PROTECT_C',
  DISCHARGE_UNDER_TEMP_RELEASE_C: 'DISCHARGE_UNDER_TEMP_RELEASE_C',
  DISCHARGE_OVER_TEMP_PROTECT_C: 'DISCHARGE_OVER_TEMP_PROTECT_C',
  DISCHARGE_OVER_TEMP_RELEASE_C: 'DISCHARGE_OVER_TEMP_RELEASE_C',
  DISCHARGE_OVER_TEMP_PROTECT_DELAY_S: 'DISCHARGE_OVER_TEMP_PROTECT_DELAY_S',
  DISCHARGE_OVER_TEMP_RELEASE_DELAY_S: 'DISCHARGE_OVER_TEMP_RELEASE_DELAY_S'
}
const FACTORY_ACTION_LABELS: Record<string, string> = {}

function resolveParamEntry(entry: ParamEntry) {
  if (typeof entry === 'string') return { key: entry, actualKey: entry }
  return { key: entry.displayKey, actualKey: entry.actualKey }
}

function labelOf(key: string, actualKey?: string) {
  const displayText = tr(`bms.param.${key}`, undefined, TEMP_DISPLAY_LABELS[key])
  if (displayText !== `bms.param.${key}`) return displayText
  if (TEMP_DISPLAY_LABELS[key]) return TEMP_DISPLAY_LABELS[key]
  if (actualKey) {
    const actualText = tr(`bms.param.${actualKey}`, undefined)
    if (actualText !== `bms.param.${actualKey}`) return actualText
  }
  if (PARAM_DEF_BY_KEY[key]?.label) return PARAM_DEF_BY_KEY[key]?.label || key
  if (actualKey && PARAM_DEF_BY_KEY[actualKey]?.label) return PARAM_DEF_BY_KEY[actualKey]?.label || key
  return key
}
function unitOf(key: string) {
  return String(PARAM_DEF_BY_KEY[key]?.unit || '')
}

function isBatteryTypeKey(key: string) {
  return key === BMS_PARAM.BATTERY_TYPE
}

function getScaleDecimals(scale?: number) {
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return 0
  const text = scale.toString()
  if (!text.includes('.')) return 0
  return text.split('.')[1]?.length || 0
}

function normalizeEditableNumber(value: number, decimals: number) {
  if (!Number.isFinite(value)) return ''
  if (decimals <= 0) return String(Math.round(value))
  return value
    .toFixed(decimals)
    .replace(/(\.\d*?[1-9])0+$/u, '$1')
    .replace(/\.0+$/u, '')
}

function formatDisplayNumber(value: number, decimals: number) {
  if (!Number.isFinite(value)) return '-'
  if (decimals <= 0) return String(Math.round(value))
  const factor = 10 ** decimals
  const normalized = Math.round((value + Number.EPSILON) * factor) / factor
  return normalized
    .toFixed(decimals)
    .replace(/(\.\d*?[1-9])0+$/u, '$1')
    .replace(/\.0+$/u, '')
}

function getBatteryTypeLabel(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '-'
  const item = BATTERY_TYPE_OPTIONS.find(option => option.value === n)
  return item ? tb(item.labelKey) : tb('common.unknownType', { value: Math.trunc(n) })
}

function formatEditableValue(key: string, value: unknown) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return ''
  const def = PARAM_DEF_BY_KEY[key] as any
  return normalizeEditableNumber(n, getScaleDecimals(def?.scale))
}

function formatParamValue(key: string, value: unknown) {
  if (isBatteryTypeKey(key)) return getBatteryTypeLabel(value)
  if (value == null || value === '') return '-'
  if (typeof value === 'string') return value
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '-'
  const def = PARAM_DEF_BY_KEY[key] as any
  const unit = String(def?.unit || '')
  const text = formatDisplayNumber(n, getScaleDecimals(def?.scale))
  return unit ? `${text}${unit}` : text
}

function canAccessParamKey(paramKey: string) {
  if (deviceParamPerm.allowAll) return true
  const permKey = getParamPermissionKey(paramKey)
  if (!permKey) return true
  return deviceParamPermSet.value.has(permKey)
}

function canAccessPermissionKey(permissionKey: string) {
  if (deviceParamPerm.allowAll) return true
  return deviceParamPermSet.value.has(permissionKey)
}

function canAccessFunctionControl(flagKey: FunctionConfigFlagKey) {
  return canAccessPermissionKey(getFunctionPermissionKey(flagKey))
}

function canAccessFactoryAction(actionKey: string) {
  return canAccessPermissionKey(getFactoryPermissionKey(actionKey))
}

const filterParamEntries = (entries: ParamEntry[]) =>
  entries.filter(entry => canAccessParamKey(resolveParamEntry(entry).actualKey))

const SINGLE_KEYS = [
  'CELL_OV_ALARM_V',
  'CELL_OC_PROTECT_V',
  'CELL_OC_ALARM_DELAY_S',
  'CELL_OC_PROTECT_DELAY_S',
  'FEEDBACK_OC_PROTECT_DELAY_S',
  'CELL_OV_PROTECT_RELEASE_V',
  'CELL_OC_ALARM_RELEASE_DELTA_V',
  'CELL_OV_ALARM_RELEASE_DELAY_S',
  'CELL_OV_PROTECT_RELEASE_DELAY_S',
  'NORMAL_CELL_UV_ALARM_V',
  'NORMAL_CELL_UV_PROTECT_V',
  'CELL_UV_ALARM_DELAY_S',
  'CELL_UV_PROTECT_DELAY_S',
  'CELL_UV_ALARM_RELEASE_V',
  'CELL_UV_PROTECT_RELEASE_V',
  'CELL_UV_ALARM_RELEASE_DELAY_S',
  'CELL_UV_PROTECT_RELEASE_DELAY_S'
]
const VOLTAGE_KEYS = [
  'PACK_OV_ALARM_V',
  'PACK_OV_PROTECT_V',
  'PACK_OV_ALARM_DELAY_S',
  'PACK_OV_PROTECT_DELAY_S',
  'PACK_OV_ALARM_RELEASE_V',
  'PACK_OV_PROTECT_RELEASE_V',
  'PACK_OV_ALARM_RELEASE_DELAY_S',
  'PACK_OV_PROTECT_RELEASE_DELAY_S',
  'NORMAL_PACK_UV_ALARM_V',
  'NORMAL_PACK_UV_PROTECT_V',
  'LOW_TEMP_PACK_UV_ALARM_V',
  'LOW_TEMP_PACK_UV_PROTECT_V',
  'PACK_UV_ALARM_DELAY_S',
  'PACK_UV_PROTECT_DELAY_S',
  'PACK_UV_ALARM_RELEASE_V',
  'PACK_UV_PROTECT_RELEASE_V',
  'PACK_UV_ALARM_RELEASE_DELAY_S',
  'PACK_UV_PROTECT_RELEASE_DELAY_S'
]
const CURRENT_KEYS = [
  'CHARGE_OC_ALARM_A',
  'CHARGE_OC_PROTECT_SMALL_A',
  'CHARGE_OC_PROTECT_LARGE_A',
  'CHARGE_OC_ALARM_DELAY_S',
  'CHARGE_OC_PROTECT_SMALL_DELAY_S',
  'CHARGE_OC_PROTECT_LARGE_DELAY_S',
  'DISCHARGE_OC_ALARM_A',
  'DISCHARGE_OC_PROTECT_SMALL_A',
  'DISCHARGE_OC_PROTECT_LARGE_A',
  'DISCHARGE_OC_ALARM_DELAY_S',
  'DISCHARGE_OC_PROTECT_SMALL_DELAY_S',
  'DISCHARGE_OC_PROTECT_LARGE_DELAY_S'
]
const TEMP_KEYS = [
  { displayKey: 'CELL_OVER_TEMP_PROTECT_C', actualKey: 'MOS_OT_PROTECT_C' },
  { displayKey: 'CELL_OVER_TEMP_RELEASE_C', actualKey: 'MOS_OT_PROTECT_RELEASE_C' },
  { displayKey: 'MOS_OVER_TEMP_PROTECT_DELAY_S', actualKey: 'MOS_OT_PROTECT_DELAY_S' },
  { displayKey: 'MOS_OVER_TEMP_RELEASE_DELAY_S', actualKey: 'MOS_OT_PROTECT_RELEASE_DELAY_S' },
  { displayKey: 'CELL_UNDER_TEMP_PROTECT_C', actualKey: 'CHARGE_UT_PROTECT_C' },
  { displayKey: 'CELL_UNDER_TEMP_RELEASE_C', actualKey: 'CHARGE_UT_PROTECT_RELEASE_C' },
  { displayKey: 'CHARGE_OVER_TEMP_PROTECT_C', actualKey: 'CHARGE_OT_PROTECT_C' },
  { displayKey: 'CHARGE_OVER_TEMP_RELEASE_C', actualKey: 'CHARGE_OT_PROTECT_RELEASE_C' },
  { displayKey: 'CHARGE_OVER_TEMP_PROTECT_DELAY_S', actualKey: 'CHARGE_OT_PROTECT_DELAY_S' },
  { displayKey: 'CHARGE_OVER_TEMP_RELEASE_DELAY_S', actualKey: 'CHARGE_OT_PROTECT_RELEASE_DELAY_S' },
  { displayKey: 'DISCHARGE_UNDER_TEMP_PROTECT_C', actualKey: 'DISCHARGE_UT_PROTECT_C' },
  { displayKey: 'DISCHARGE_UNDER_TEMP_RELEASE_C', actualKey: 'DISCHARGE_UT_PROTECT_RELEASE_C' },
  { displayKey: 'DISCHARGE_OVER_TEMP_PROTECT_C', actualKey: 'DISCHARGE_OT_PROTECT_C' },
  { displayKey: 'DISCHARGE_OVER_TEMP_RELEASE_C', actualKey: 'DISCHARGE_OT_PROTECT_RELEASE_C' },
  { displayKey: 'DISCHARGE_OVER_TEMP_PROTECT_DELAY_S', actualKey: 'DISCHARGE_OT_PROTECT_DELAY_S' },
  { displayKey: 'DISCHARGE_OVER_TEMP_RELEASE_DELAY_S', actualKey: 'DISCHARGE_OT_PROTECT_RELEASE_DELAY_S' },
  'CELL_OT_ALARM_C',
  'CELL_OT_ALARM_RELEASE_C',
  'CELL_OT_ALARM_DELAY_S',
  'CELL_OT_ALARM_RELEASE_DELAY_S',
  'HEAT_CELL_ON_C',
  'HEAT_CELL_OFF_C',
  'HEAT_FILM_PROTECT_C',
  'HEAT_FILM_PROTECT_RELEASE_C',
  'HEAT_ON_DELAY_S',
  'HEAT_OFF_DELAY_S',
  'POLE_TEMP_PROTECT_C',
  'POLE_TEMP_PROTECT_RELEASE_C'
]
const OTHER_KEYS = listParamsByCategory(PARAM_CATEGORIES.OTHER)
const NUMBERING_KEYS = listParamsByCategory(PARAM_CATEGORIES.STRING)
const SYSTEM_KEYS = listParamsByCategory(PARAM_CATEGORIES.SYSTEM).filter(key => key !== BMS_PARAM.FUNCTION_CONFIG)
const SYSTEM_LOAD_KEYS = [...SYSTEM_KEYS, BMS_PARAM.FUNCTION_CONFIG]
const FACTORY_ACTIONS: Array<Omit<FactoryAction, 'label'>> = [
  { key: 'enterTestMode', raw: 0x00000400, confirm: true },
  { key: 'exitTestMode', raw: 0x00000800, confirm: true },
  { key: 'balanceAllOn', raw: 0x00001000, confirm: true },
  { key: 'balanceAllOff', raw: 0x00002000, confirm: true },
  { key: 'function1On', raw: 0x00400000, confirm: true },
  { key: 'function1Off', raw: 0x00800000, confirm: true },
  { key: 'function2On', raw: 0x01000000, confirm: true },
  { key: 'function2Off', raw: 0x02000000, confirm: true },
  { key: 'function3On', raw: 0x04000000, confirm: true },
  { key: 'function3Off', raw: 0x08000000, confirm: true },
  { key: 'function4On', raw: 0x10000000, confirm: true },
  { key: 'function4Off', raw: 0x20000000, confirm: true },
  { key: 'resetProtectionBoard', raw: 0x00200000, confirm: true },
  { key: 'mcuProtectionOn', raw: 0x00004000, confirm: true },
  { key: 'mcuProtectionOff', raw: 0x00008000, confirm: true },
  { key: 'manualChargeDischargeOn', raw: 0x00000100, confirm: true },
  { key: 'manualChargeDischargeOff', raw: 0x00000200, confirm: true },
  { key: 'disableCharge', raw: 0x80000000, confirm: true },
  { key: 'disableDischarge', raw: 0x40000000, confirm: true },
  { key: 'allowChargeDischarge', raw: 0x00000000, confirm: true },
  { key: 'manualHeatingOn', raw: 0x00000040, confirm: true },
  { key: 'manualHeatingOff', raw: 0x00000080, confirm: true },
  { key: 'gpsPowerOn', raw: 0x00000010, confirm: true },
  { key: 'gpsPowerOff', raw: 0x00000020, confirm: true },
  { key: 'sleep', raw: 0x00000004, confirm: true },
  { key: 'powerOff', raw: 0x00000001, confirm: true }
]
const factoryItems = computed<FactoryAction[]>(() =>
  FACTORY_ACTIONS.filter(item => canAccessFactoryAction(item.key)).map(item => ({
    ...item,
    label: tb(`factory.${item.key}`, undefined, FACTORY_ACTION_LABELS[item.key] || item.key)
  }))
)

const mkItems = (entries: ParamEntry[]): ParamItem[] =>
  filterParamEntries(entries).map(entry => {
    const { key, actualKey } = resolveParamEntry(entry)
    const unit = unitOf(actualKey)
    const value = paramValues[actualKey]
    return {
      key,
      actualKey,
      label: labelOf(key, actualKey),
      unit,
      value,
      valueType: PARAM_DEF_BY_KEY[actualKey]?.valueType || 'u16',
      valueText: formatParamValue(actualKey, value)
    }
  })

const singleItems = computed(() => mkItems(SINGLE_KEYS))
const voltageItems = computed(() => mkItems(VOLTAGE_KEYS))
const currentItems = computed(() => mkItems(CURRENT_KEYS))
const temperatureItems = computed(() => mkItems(TEMP_KEYS))
const hasSingleItems = computed(() => singleItems.value.length > 0)
const hasVoltageItems = computed(() => voltageItems.value.length > 0)
const hasCurrentItems = computed(() => currentItems.value.length > 0)
const hasTemperatureItems = computed(() => temperatureItems.value.length > 0)
const otherItems = computed(() => mkItems(OTHER_KEYS))
const numberingItems = computed(() => mkItems(NUMBERING_KEYS))
const systemItems = computed(() => mkItems(SYSTEM_KEYS))
const hasOtherItems = computed(() => otherItems.value.length > 0)
const hasNumberingItems = computed(() => numberingItems.value.length > 0)
const hasSystemItems = computed(() => systemItems.value.length > 0)
const functionConfigFlags = computed(() => parseFunctionConfigFlags(paramValues[BMS_PARAM.FUNCTION_CONFIG]))
const functionControlRows = computed<FunctionControlRow[]>(() =>
  FUNCTION_CONFIG_ITEMS.filter(item => canAccessFunctionControl(item.key)).map(item => ({
    ...item,
    label: tb(`functionConfig.${item.key}`, undefined, item.label),
    enabled: functionConfigFlags.value[item.key],
    statusText: functionConfigFlags.value[item.key]
      ? tb(
          item.key === 'chargeAllowed' || item.key === 'dischargeAllowed'
            ? 'functionConfig.allowed'
            : 'functionConfig.enabled',
          undefined,
          item.enabledLabel
        )
      : tb(
          item.key === 'chargeAllowed' || item.key === 'dischargeAllowed'
            ? 'functionConfig.forbidden'
            : 'functionConfig.disabled',
          undefined,
          item.disabledLabel
        )
  }))
)
const hasFunctionControlRows = computed(() => functionControlRows.value.length > 0)
const hasSystemSection = computed(() => hasSystemItems.value || hasFunctionControlRows.value)
const hasFactoryItems = computed(() => factoryItems.value.length > 0)
const hasAdvancedSections = computed(
  () => hasOtherItems.value || hasNumberingItems.value || hasSystemSection.value || hasFactoryItems.value
)

async function loadKeys(entries: ParamEntry[]) {
  const useDirect = !!client && connType.value !== 'offline'
  const useRelay = !useDirect && relayReady.value
  if (!useDirect && !useRelay) return
  const allowedEntries = filterParamEntries(entries)
  if (useDirect && client) {
    const actualKeys = allowedEntries.map(entry => resolveParamEntry(entry).actualKey)
    if (!actualKeys.length) return
    const values = await client.readParamsByKeys(actualKeys)
    for (const actualKey of actualKeys) {
      paramValues[actualKey] = Object.prototype.hasOwnProperty.call(values, actualKey) ? values[actualKey] : null
    }
    return
  }
  for (const entry of allowedEntries) {
    const { actualKey } = resolveParamEntry(entry)
    try {
      // eslint-disable-next-line no-await-in-loop
      const resp = await runRelayCommand({
        command_type: 'read_param',
        param_key: actualKey
      })
      paramValues[actualKey] = (resp?.result as any)?.value
    } catch {
      paramValues[actualKey] = null
    }
  }
}

watch(
  () => [connType.value, relayReady.value, !!client],
  ([currentConnType, currentRelayReady, hasClient]) => {
    if ((currentConnType !== 'offline' && hasClient) || currentRelayReady) {
      void loadKeys([BMS_PARAM.FUNCTION_CONFIG])
    }
  },
  { immediate: true }
)

const editState = reactive({
  show: false,
  key: '',
  title: '',
  unit: '',
  valueType: 'u16',
  inputText: '',
  selectValue: null as number | null
})
const advancedState = reactive({
  show: false,
  loading: false
})

function openEdit(item: ParamItem) {
  if ((!client || connType.value === 'offline') && !relayReady.value) {
    message.warning(tb('messages.offlineSet'))
    return
  }
  if (!canAccessParamKey(item.actualKey)) {
    message.warning(tb('messages.noParamPermission'))
    return
  }
  editState.key = item.actualKey
  editState.title = item.label
  editState.unit = item.unit
  editState.valueType = item.valueType || 'u16'
  if (isBatteryTypeKey(editState.key)) {
    const current = typeof item.value === 'number' ? item.value : Number(item.value)
    editState.selectValue = Number.isFinite(current) ? current : null
    editState.inputText = ''
  } else if (editState.valueType === 'str') {
    editState.inputText = item.value == null ? '' : String(item.value)
    editState.selectValue = null
  } else {
    editState.inputText = formatEditableValue(editState.key, item.value)
    editState.selectValue = null
  }
  editState.show = true
}

async function writeParamValue(key: string, value: string | number) {
  const useDirect = !!client && connType.value !== 'offline'
  const useRelay = !useDirect && relayReady.value
  if (!useDirect && !useRelay) return
  if (useDirect && client) {
    await client.writeParam(key, value)
    paramValues[key] = await client.readParam(key)
    return
  }
  await runRelayCommand({
    command_type: 'write_param',
    param_key: key,
    value
  })
  const after = await runRelayCommand({
    command_type: 'read_param',
    param_key: key
  })
  paramValues[key] = (after?.result as any)?.value
}

async function confirmEdit() {
  const useDirect = !!client && connType.value !== 'offline'
  const useRelay = !useDirect && relayReady.value
  if (!useDirect && !useRelay) return
  try {
    if (isBatteryTypeKey(editState.key)) {
      if (editState.selectValue == null || !Number.isFinite(editState.selectValue)) {
        message.warning(tb('messages.selectBatteryType'))
        return
      }
      await writeParamValue(editState.key, editState.selectValue)
    } else if (editState.valueType === 'str') {
      await writeParamValue(editState.key, editState.inputText)
    } else {
      const raw = editState.inputText.trim()
      const v = Number(raw)
      if (!raw || !Number.isFinite(v)) {
        message.warning(tb('messages.invalidNumber'))
        return
      }
      await writeParamValue(editState.key, v)
    }
    editState.show = false
    message.success(tb('messages.saved'))
  } catch (e: any) {
    editState.show = false
    message.error(e?.message || tb('messages.saveFailed'))
  }
}

async function openAdvancedSettings() {
  if ((!client || connType.value === 'offline') && !relayReady.value) {
    message.warning(tb('messages.offlineReadAdvanced'))
    return
  }
  advancedState.show = true
  advancedState.loading = true
  try {
    await Promise.all([loadKeys(OTHER_KEYS), loadKeys(NUMBERING_KEYS), loadKeys(SYSTEM_LOAD_KEYS)])
  } finally {
    advancedState.loading = false
  }
}

async function setFunctionControl(key: FunctionConfigFlagKey, enabled: boolean) {
  const useDirect = !!client && connType.value !== 'offline'
  const useRelay = !useDirect && relayReady.value
  if (!useDirect && !useRelay) {
    message.warning(tb('messages.offlineFunction'))
    return
  }
  if (!canAccessFunctionControl(key)) {
    message.warning(tb('messages.noFunctionPermission'))
    return
  }
  const nextWord = setFunctionConfigFlag(paramValues[BMS_PARAM.FUNCTION_CONFIG], key, enabled)
  try {
    if (useDirect && client) {
      await client.writeParam(BMS_PARAM.FUNCTION_CONFIG, nextWord)
      paramValues[BMS_PARAM.FUNCTION_CONFIG] = await client.readParam(BMS_PARAM.FUNCTION_CONFIG)
    } else {
      await runRelayCommand({
        command_type: 'write_param',
        param_key: BMS_PARAM.FUNCTION_CONFIG,
        value: nextWord
      })
      const after = await runRelayCommand({
        command_type: 'read_param',
        param_key: BMS_PARAM.FUNCTION_CONFIG
      })
      paramValues[BMS_PARAM.FUNCTION_CONFIG] = (after?.result as any)?.value
    }
    message.success(tb('messages.functionUpdated'))
  } catch (e: any) {
    message.error(e?.message || tb('messages.functionUpdateFailed'))
  }
}

async function runFactoryAction(item: FactoryAction) {
  const useDirect = !!client && connType.value !== 'offline'
  const useRelay = !useDirect && relayReady.value
  if (!useDirect && !useRelay) {
    message.warning(tb('messages.offlineFactory'))
    return
  }
  if (!canAccessFactoryAction(item.key)) {
    message.warning(tb('messages.noFactoryPermission'))
    return
  }
  if (item.confirm) {
    const ok = window.confirm(tb('messages.factoryConfirm'))
    if (!ok) return
  }
  try {
    const hi = (item.raw >>> 16) & 0xffff
    const lo = item.raw & 0xffff
    if (useDirect && client) {
      await client.writeRegisters(0x57a, new Uint16Array([hi, lo]))
    } else {
      await runRelayCommand({
        command_type: 'write_registers',
        start_address: 0x57a,
        register_values: [hi, lo]
      })
    }
    message.success(tb('messages.factorySent'))
  } catch (e: any) {
    message.error(e?.message || tb('messages.factoryFailed'))
  }
}

const paramColumns: DataTableColumns<ParamItem> = [
  { key: 'label', title: () => tb('detail.params.parameter'), minWidth: 220 },
  { key: 'valueText', title: () => tb('detail.params.value'), minWidth: 160 },
  { key: 'unit', title: () => tb('detail.params.unit'), width: 90 },
  {
    key: 'actions',
    title: () => tb('detail.params.action'),
    width: 120,
    render: row => (
      <NButton size="small" tertiary type="primary" onClick={() => openEdit(row)}>
        {tb('common.set')}
      </NButton>
    )
  }
]
const factoryColumns: DataTableColumns<FactoryAction> = [
  { key: 'label', title: () => tb('detail.params.factoryCommand'), minWidth: 260 },
  {
    key: 'raw',
    title: () => tb('detail.params.commandWord'),
    width: 140,
    render: row => `0x${row.raw.toString(16).toUpperCase().padStart(8, '0')}`
  },
  {
    key: 'actions',
    title: () => tb('detail.params.action'),
    width: 120,
    render: row => (
      <NButton size="small" tertiary type="warning" onClick={() => runFactoryAction(row)}>
        {tb('common.execute')}
      </NButton>
    )
  }
]
const functionColumns: DataTableColumns<FunctionControlRow> = [
  { key: 'label', title: () => tb('detail.params.functionItem'), minWidth: 220 },
  {
    key: 'status',
    title: () => tb('detail.params.currentStatus'),
    width: 120,
    render: row => <NTag type={row.enabled ? 'success' : 'default'}>{row.statusText}</NTag>
  },
  {
    key: 'actions',
    title: () => tb('detail.params.switch'),
    width: 100,
    render: row => <NSwitch value={row.enabled} onUpdateValue={value => setFunctionControl(row.key, value)} />
  }
]
</script>

<template>
  <div class="bms-panel">
    <NSpin :show="loading || cloudLoading">
      <NCard size="small" :bordered="false">
        <NSpace align="center" justify="space-between">
          <NSpace align="center">
            <NText strong>{{ $t('bms.common.communication') }}</NText>
            <NTag :type="mqttReportType">{{ mqttReportText }}</NTag>
            <NTag :type="connTagType">{{ connText }}</NTag>
            <NTag v-if="battery?.comm_chip_id" type="info">
              {{ $t('bms.basicInfo.commChipId') }}: {{ battery.comm_chip_id }}
            </NTag>
            <NTag :type="cloudStatusType">{{ cloudStatusText }}</NTag>
            <NTag type="default">{{ $t('bms.detail.dashboard.updatedAt') }}: {{ cloudUpdateText }}</NTag>
            <NTag :type="paramLinkType">{{ paramLinkText }}</NTag>
          </NSpace>
          <NSpace>
            <NButton size="small" :disabled="connecting" @click="connectRealtime">{{ paramConnectButtonText }}</NButton>
            <NButton size="small" :disabled="connecting" @click="handleDisconnect">
              {{ $t('bms.detail.telemetry.disconnectParam') }}
            </NButton>
            <NButton size="small" @click="refreshCloudData">{{ $t('bms.detail.telemetry.refreshCloud') }}</NButton>
          </NSpace>
        </NSpace>
      </NCard>

      <div class="panel-body">
        <NAlert
          v-if="canUse4G"
          class="mb-12px"
          type="info"
          :show-icon="false"
          :title="$t('bms.detail.telemetry.card4gTitle')"
        >
          {{ $t('bms.detail.telemetry.card4gDesc') }}
        </NAlert>
        <NAlert
          v-if="!canUse4G"
          class="mb-12px"
          type="warning"
          :show-icon="false"
          :title="$t('bms.detail.telemetry.no4gTitle')"
        >
          {{ $t('bms.detail.telemetry.no4gDesc') }}
        </NAlert>

        <NTabs type="line" animated>
          <NTabPane name="dashboard" :tab="$t('bms.detail.dashboard.tab')">
            <NGrid :cols="24" :x-gap="12" :y-gap="12">
              <NGridItem v-if="hasStatusFlags" :span="24">
                <div class="status-flags-web">
                  <button
                    v-for="item in statusFlags"
                    :key="item.type"
                    type="button"
                    class="status-flag-web"
                    :class="item.className"
                    @click="openStatusFlag(item.type)"
                  >
                    <span class="status-flag-web__dot"></span>
                    <span class="status-flag-web__text">{{ item.label }}</span>
                    <span class="status-flag-web__count">{{ item.count }}</span>
                  </button>
                </div>
              </NGridItem>

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
                <NCard size="small" :title="$t('bms.detail.dashboard.packVoltage')" :bordered="false">
                  <div class="metric-big">{{ packVoltageText }}</div>
                  <div class="metric-sub">{{ $t('bms.detail.dashboard.cellSeries') }}: {{ cellCount || '-' }}</div>
                </NCard>
              </NGridItem>

              <NGridItem :span="8">
                <NCard size="small" :title="$t('bms.detail.dashboard.cycleCount')" :bordered="false">
                  <div class="metric-big">{{ cycleCountText }}</div>
                </NCard>
              </NGridItem>
              <NGridItem :span="8">
                <NCard size="small" :title="$t('bms.detail.dashboard.chargeTime')" :bordered="false">
                  <div class="metric-big">{{ chargeTimeText }}</div>
                </NCard>
              </NGridItem>
              <NGridItem :span="8">
                <NCard size="small" :title="$t('bms.detail.dashboard.chargeDischargeCurrent')" :bordered="false">
                  <div class="metric-big">{{ currentText }}</div>
                </NCard>
              </NGridItem>

              <NGridItem :span="12">
                <NCard size="small" :title="$t('bms.detail.dashboard.switchStatus')" :bordered="false">
                  <div class="switch-grid">
                    <div class="switch-item">
                      <span class="switch-item__label">{{ $t('bms.detail.dashboard.chargeSwitch') }}</span>
                      <NSwitch :value="chargeSwitchOn" disabled />
                    </div>
                    <div class="switch-item">
                      <span class="switch-item__label">{{ $t('bms.detail.dashboard.dischargeSwitch') }}</span>
                      <NSwitch :value="dischargeSwitchOn" disabled />
                    </div>
                    <div class="switch-item">
                      <span class="switch-item__label">{{ $t('bms.detail.dashboard.balanceStatus') }}</span>
                      <NSwitch :value="balancingOn" disabled />
                    </div>
                  </div>
                </NCard>
              </NGridItem>

              <NGridItem :span="12">
                <NCard size="small" :title="$t('bms.detail.dashboard.voltageInfo')" :bordered="false">
                  <div class="temp-list">
                    <div class="temp-row">
                      <span class="temp-label">{{ $t('bms.detail.dashboard.avgVoltage') }}</span>
                      <span>{{ avgVoltageText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">{{ $t('bms.detail.dashboard.highestVoltage') }}</span>
                      <span>{{ highestVoltageText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">{{ $t('bms.detail.dashboard.lowestVoltage') }}</span>
                      <span>{{ lowestVoltageText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">{{ $t('bms.detail.dashboard.voltageDiff') }}</span>
                      <span>{{ diffVoltageText }}</span>
                    </div>
                  </div>
                </NCard>
              </NGridItem>

              <NGridItem :span="12">
                <NCard size="small" :title="$t('bms.detail.dashboard.temperatureInfo')" :bordered="false">
                  <div class="temp-list">
                    <div class="temp-row">
                      <span class="temp-label">{{ $t('bms.detail.dashboard.mosTemp') }}</span>
                      <span>{{ mosTempText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">{{ $t('bms.detail.dashboard.ambientTemp') }}</span>
                      <span>{{ ambientTempText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">{{ $t('bms.detail.dashboard.cellTemp') }}</span>
                      <span>{{ cellTempText }}</span>
                    </div>
                  </div>
                </NCard>
              </NGridItem>

              <NGridItem :span="12">
                <NCard size="small" :title="$t('bms.detail.dashboard.protectStatus')" :bordered="false">
                  <template #header-extra>
                    <NButton text type="primary" @click="toggleProtectPanel">
                      {{
                        protectPanelExpanded ? $t('bms.detail.dashboard.collapse') : $t('bms.detail.dashboard.expand')
                      }}
                    </NButton>
                  </template>
                  <div class="metric-sub mb-12px">{{ protectSummaryText }}</div>
                  <div v-if="protectPanelExpanded" class="protect-list-web">
                    <div v-for="item in protectStatusRows" :key="item.key" class="protect-row-web">
                      <span class="protect-row-web__label">{{ item.label }}</span>
                      <span class="protect-row-web__value" :class="{ 'protect-row-web__value--on': item.enabled }">
                        {{ item.enabled ? $t('bms.status.on') : $t('bms.status.off') }}
                      </span>
                    </div>
                  </div>
                </NCard>
              </NGridItem>

              <NGridItem :span="24">
                <NCard size="small" :title="$t('bms.detail.dashboard.deviceInfo')" :bordered="false">
                  <NDescriptions :columns="3" size="small" label-placement="left">
                    <NDescriptionsItem :label="$t('bms.detail.dashboard.deviceName')">
                      {{ battery?.device_name || '-' }}
                    </NDescriptionsItem>
                    <NDescriptionsItem :label="$t('bms.detail.dashboard.deviceNumber')">
                      {{ battery?.device_number || '-' }}
                    </NDescriptionsItem>
                    <NDescriptionsItem :label="$t('bms.detail.dashboard.model')">
                      {{ battery?.battery_model_name || '-' }}
                    </NDescriptionsItem>
                    <NDescriptionsItem :label="$t('bms.detail.dashboard.firmwareVersion')">
                      {{ battery?.fw_version || '-' }}
                    </NDescriptionsItem>
                    <NDescriptionsItem :label="$t('bms.detail.dashboard.bleMac')">
                      {{ battery?.ble_mac || '-' }}
                    </NDescriptionsItem>
                    <NDescriptionsItem :label="$t('bms.detail.dashboard.updatedAt')">
                      {{ battery?.updated_at || '-' }}
                    </NDescriptionsItem>
                  </NDescriptions>
                </NCard>
              </NGridItem>
            </NGrid>
          </NTabPane>

          <NTabPane name="cells" :tab="$t('bms.detail.cells.tab')">
            <NCard size="small" :bordered="false">
              <div v-if="cellVoltageRows.length > 0" class="cell-panel">
                <div class="cell-panel-summary">
                  <div class="cell-summary-list">
                    <div class="cell-summary-item cell-summary-item--highest">
                      <span class="cell-summary-dot"></span>
                      <span>
                        {{ $t('bms.detail.cells.max') }}({{ highestCellRow?.index || '-' }})
                        {{ highestCellRow?.voltageText || '-' }}
                      </span>
                    </div>
                    <div class="cell-summary-item cell-summary-item--lowest">
                      <span class="cell-summary-dot"></span>
                      <span>
                        {{ $t('bms.detail.cells.min') }}({{ lowestCellRow?.index || '-' }})
                        {{ lowestCellRow?.voltageText || '-' }}
                      </span>
                    </div>
                    <div class="cell-summary-item cell-summary-item--balancing">
                      <span class="cell-summary-dot"></span>
                      <span>{{ $t('bms.detail.cells.balancing') }} {{ balancingCellCount }}</span>
                    </div>
                  </div>

                  <div class="cell-summary-meta">
                    <span>{{ $t('bms.detail.cells.pack') }}: {{ packVoltageText }}</span>
                    <span>{{ $t('bms.detail.cells.series') }}: {{ cellCount || '-' }}</span>
                  </div>
                </div>

                <div class="cell-board-scroll">
                  <div class="cell-board-axis">
                    <span>5V</span>
                    <span>0V</span>
                  </div>

                  <div class="cell-board-list">
                    <div
                      v-for="item in cellVoltageRows"
                      :key="item.index"
                      class="cell-battery-item"
                      :class="{
                        'cell-battery-item--highest': item.isHighest,
                        'cell-battery-item--lowest': item.isLowest,
                        'cell-battery-item--balancing': item.isBalancing
                      }"
                    >
                      <div class="cell-battery-top"></div>
                      <div class="cell-battery-body">
                        <div class="cell-battery-fill" :style="{ height: `${item.fillPercent}%` }"></div>
                        <div class="cell-battery-index">{{ item.index }}</div>
                      </div>
                      <div class="cell-battery-voltage">{{ item.voltageLabel }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <NEmpty v-else :description="$t('bms.detail.cells.empty')" />
            </NCard>
          </NTabPane>

          <NTabPane name="history" :tab="$t('bms.detail.history.tab')">
            <NSpin :show="historyLoading">
              <NCard size="small" :bordered="false" :title="$t('bms.detail.history.coreChartTitle')">
                <div class="history-chart">
                  <ChartComponent :initial-options="historyChartOption" />
                </div>
              </NCard>

              <NCard
                size="small"
                :bordered="false"
                class="mt-12px"
                :title="$t('bms.detail.history.snapshotTimelineTitle')"
              >
                <template #header-extra>
                  <NButton size="small" @click="loadHistory">{{ $t('bms.common.refresh') }}</NButton>
                </template>
                <NDataTable
                  v-if="snapshotHistoryRows.length > 0"
                  :columns="snapshotColumns"
                  :data="snapshotHistoryRows"
                  :bordered="false"
                  :max-height="320"
                />
                <NEmpty v-else :description="$t('bms.detail.history.snapshotEmpty')" />
              </NCard>
            </NSpin>
          </NTabPane>

          <NTabPane name="params" :tab="$t('bms.detail.params.tab')">
            <NAlert class="mb-12px" type="info" :show-icon="false">
              {{ $t('bms.detail.params.channelHint') }}
            </NAlert>
            <NSpace v-if="hasAdvancedSections" class="mb-12px" justify="end">
              <NButton size="small" :disabled="connType === 'offline' && !relayReady" @click="openAdvancedSettings">
                {{ $t('bms.detail.params.advancedSettings') }}
              </NButton>
            </NSpace>
            <NGrid :cols="24" :x-gap="12" :y-gap="12">
              <NGridItem v-if="hasSingleItems" :span="12">
                <NCard size="small" :title="$t('bms.detail.params.singleSettings')" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton
                      size="small"
                      :disabled="connType === 'offline' && !relayReady"
                      @click="loadKeys(SINGLE_KEYS)"
                    >
                      {{ $t('bms.common.refresh') }}
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="singleItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem v-if="hasVoltageItems" :span="12">
                <NCard size="small" :title="$t('bms.detail.params.voltageSettings')" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton
                      size="small"
                      :disabled="connType === 'offline' && !relayReady"
                      @click="loadKeys(VOLTAGE_KEYS)"
                    >
                      {{ $t('bms.common.refresh') }}
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="voltageItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem v-if="hasCurrentItems" :span="12">
                <NCard size="small" :title="$t('bms.detail.params.currentSettings')" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton
                      size="small"
                      :disabled="connType === 'offline' && !relayReady"
                      @click="loadKeys(CURRENT_KEYS)"
                    >
                      {{ $t('bms.common.refresh') }}
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="currentItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem v-if="hasTemperatureItems" :span="12">
                <NCard size="small" :title="$t('bms.detail.params.temperatureSettings')" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton
                      size="small"
                      :disabled="connType === 'offline' && !relayReady"
                      @click="loadKeys(TEMP_KEYS)"
                    >
                      {{ $t('bms.common.refresh') }}
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="temperatureItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
            </NGrid>
          </NTabPane>
        </NTabs>
      </div>
    </NSpin>

    <NModal v-model:show="statusFlagModal.show" preset="card" :title="statusFlagModal.title" style="width: 420px">
      <div class="status-modal-list">
        <div
          v-for="(item, idx) in statusFlagModal.items"
          :key="`${statusFlagModal.title}-${idx}`"
          class="status-modal-row"
        >
          <span class="status-modal-row__idx">{{ idx + 1 }}.</span>
          <span>{{ item }}</span>
        </div>
      </div>
    </NModal>

    <NModal
      v-model:show="editState.show"
      preset="card"
      style="width: 520px"
      :title="$t('bms.detail.params.setTitle', { title: editState.title })"
    >
      <NSpace vertical size="large">
        <NText depth="3">{{ $t('bms.detail.params.unitLabel', { unit: editState.unit || '-' }) }}</NText>
        <NSelect
          v-if="editState.key === BMS_PARAM.BATTERY_TYPE"
          v-model:value="editState.selectValue"
          :options="batteryTypeSelectOptions"
          :placeholder="$t('bms.detail.params.selectBatteryType')"
        />
        <NInput
          v-else
          v-model:value="editState.inputText"
          :placeholder="
            editState.valueType === 'str' ? $t('bms.detail.params.inputText') : $t('bms.detail.params.inputNumber')
          "
          type="text"
        />
        <NSpace justify="end">
          <NButton @click="editState.show = false">{{ $t('bms.common.cancel') }}</NButton>
          <NButton type="primary" @click="confirmEdit">{{ $t('bms.common.save') }}</NButton>
        </NSpace>
      </NSpace>
    </NModal>

    <NModal
      v-model:show="advancedState.show"
      preset="card"
      style="width: min(1100px, 95vw)"
      :title="$t('bms.detail.params.advancedSettings')"
    >
      <NSpin :show="advancedState.loading">
        <NTabs type="line" animated>
          <NTabPane v-if="hasOtherItems" name="advanced-config" :tab="$t('bms.detail.params.advancedConfig')">
            <NDataTable :columns="paramColumns" :data="otherItems" :bordered="false" :max-height="420" />
          </NTabPane>
          <NTabPane v-if="hasNumberingItems" name="numbering-config" :tab="$t('bms.detail.params.numberingConfig')">
            <NDataTable :columns="paramColumns" :data="numberingItems" :bordered="false" :max-height="420" />
          </NTabPane>
          <NTabPane v-if="hasSystemSection" name="system-config" :tab="$t('bms.detail.params.systemConfig')">
            <NSpace vertical size="large">
              <NCard
                v-if="hasFunctionControlRows"
                size="small"
                :title="$t('bms.detail.params.functionControl')"
                :bordered="false"
              >
                <NDataTable
                  :columns="functionColumns"
                  :data="functionControlRows"
                  :bordered="false"
                  :max-height="240"
                />
              </NCard>
              <NDataTable
                v-if="hasSystemItems"
                :columns="paramColumns"
                :data="systemItems"
                :bordered="false"
                :max-height="420"
              />
            </NSpace>
          </NTabPane>
          <NTabPane v-if="hasFactoryItems" name="factory-config" :tab="$t('bms.detail.params.factoryConfig')">
            <NDataTable :columns="factoryColumns" :data="factoryItems" :bordered="false" :max-height="420" />
          </NTabPane>
        </NTabs>
      </NSpin>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="advancedState.show = false">{{ $t('bms.common.close') }}</NButton>
        </NSpace>
      </template>
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
.temp-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.temp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.temp-label {
  color: rgba(55, 65, 81, 0.7);
}
.status-flags-web {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.status-flag-web {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.04);
  color: rgba(55, 65, 81, 0.84);
  cursor: pointer;
}
.status-flag-web__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.status-flag-web__text {
  font-size: 14px;
}
.status-flag-web__count {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}
.status-flag-web--danger {
  border-color: rgba(220, 38, 38, 0.18);
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
}
.status-flag-web--warn {
  border-color: rgba(217, 119, 6, 0.2);
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}
.status-flag-web--guard {
  border-color: rgba(37, 99, 235, 0.18);
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}
.status-modal-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.status-modal-row {
  display: flex;
  gap: 8px;
  color: rgba(55, 65, 81, 0.9);
  font-size: 14px;
}
.status-modal-row__idx {
  color: rgba(55, 65, 81, 0.45);
}
.switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}
.switch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.03);
}
.switch-item__label {
  color: rgba(55, 65, 81, 0.82);
  font-size: 14px;
}
.protect-list-web {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.protect-row-web {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.03);
}
.protect-row-web__label {
  color: rgba(55, 65, 81, 0.82);
  font-size: 14px;
}
.protect-row-web__value {
  color: rgba(55, 65, 81, 0.55);
  font-size: 13px;
}
.protect-row-web__value--on {
  color: #d97706;
  font-weight: 600;
}
.history-chart {
  width: 100%;
  height: 320px;
}
.cell-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cell-panel-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  padding-bottom: 10px;
}
.cell-summary-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  align-items: center;
}
.cell-summary-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
}
.cell-summary-dot {
  width: 10px;
  height: 18px;
  border-radius: 999px;
  background: #4ade80;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.12);
}
.cell-summary-item--highest .cell-summary-dot {
  background: #ec4899;
  box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.14);
}
.cell-summary-item--lowest .cell-summary-dot {
  background: #facc15;
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.18);
}
.cell-summary-item--balancing .cell-summary-dot {
  background: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.14);
}
.cell-summary-meta {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
}
.cell-board-scroll {
  display: flex;
  align-items: stretch;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 10px;
}
.cell-board-axis {
  display: flex;
  min-width: 34px;
  flex-direction: column;
  justify-content: space-between;
  padding-top: 8px;
  padding-bottom: 54px;
  color: rgba(71, 85, 105, 0.72);
  font-size: 14px;
  font-weight: 600;
}
.cell-board-list {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  min-width: max-content;
}
.cell-battery-item {
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 0 0 auto;
}
.cell-battery-top {
  width: 32px;
  height: 8px;
  margin-bottom: 6px;
  border-radius: 4px 4px 0 0;
  background: #4ade80;
}
.cell-battery-body {
  position: relative;
  width: 48px;
  height: 176px;
  overflow: hidden;
  border: 3px solid #86efac;
  border-radius: 8px 8px 4px 4px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55);
}
.cell-battery-fill {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  background: linear-gradient(180deg, #7cf17f 0%, #58dd6a 100%);
}
.cell-battery-index {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(71, 85, 105, 0.9);
  font-size: 14px;
  font-weight: 700;
}
.cell-battery-voltage {
  width: 100%;
  margin-top: 10px;
  color: rgba(71, 85, 105, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  white-space: nowrap;
}
.cell-battery-item--highest .cell-battery-top {
  background: #ec4899;
}
.cell-battery-item--highest .cell-battery-body {
  border-color: #f472b6;
}
.cell-battery-item--highest .cell-battery-fill {
  background: linear-gradient(180deg, #f472b6 0%, #ec4899 100%);
}
.cell-battery-item--lowest .cell-battery-top {
  background: #facc15;
}
.cell-battery-item--lowest .cell-battery-body {
  border-color: #fde047;
}
.cell-battery-item--lowest .cell-battery-fill {
  background: linear-gradient(180deg, #fde047 0%, #facc15 100%);
}
.cell-battery-item--balancing .cell-battery-body::after {
  content: '';
  position: absolute;
  top: 8px;
  right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
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
