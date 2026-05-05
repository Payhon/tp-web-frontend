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
  if (!canUse4G.value) return '非4G上报设备'
  return mqttReportOnline.value ? 'MQTT上报在线' : 'MQTT上报离线'
})
const mqttReportType = computed(() => {
  if (!canUse4G.value) return 'default'
  return mqttReportOnline.value ? 'success' : 'default'
})
const connText = computed(() => {
  if (connType.value === 'mqtt' && status.value) return 'MQTT透传实时'
  if (hasCloudTelemetry.value) return '主动上报兜底'
  return '离线/无数据'
})
const connTagType = computed(() => {
  if (connType.value === 'mqtt' && status.value) return 'success'
  if (hasCloudTelemetry.value) return 'warning'
  return 'default'
})
const paramLinkText = computed(() => {
  if (connType.value === 'mqtt') return '参数通道：MQTT透传可用'
  if (relayReady.value) return '参数通道：APP蓝牙中继可用'
  if (canUseRelay.value) return '参数通道：等待APP蓝牙连接设备'
  return '参数通道：未连接'
})
const paramLinkType = computed(() => {
  if (connType.value === 'mqtt') return 'success'
  if (relayReady.value) return 'info'
  if (canUseRelay.value) return 'warning'
  return 'default'
})

const cloudStatusText = computed(() => {
  if (cloudWsState.value === 'open' && cloudLastUpdateAt.value) return '云端订阅已连接（有实时数据）'
  if (cloudWsState.value === 'open') return '云端订阅已连接（暂无实时数据）'
  if (cloudWsState.value === 'connecting') return '云端实时连接中'
  if (cloudWsState.value === 'error') return '云端实时连接异常，正在重连'
  return '云端订阅未连接'
})

const cloudStatusType = computed(() => {
  if (cloudWsState.value === 'open' && cloudLastUpdateAt.value) return 'success'
  if (cloudWsState.value === 'open') return 'warning'
  if (cloudWsState.value === 'connecting') return 'info'
  if (cloudWsState.value === 'error') return 'error'
  return 'default'
})

const cloudUpdateText = computed(() => formatTime(cloudLastUpdateAt.value))
const paramConnectButtonText = computed(() => (canUse4G.value ? '重新连接MQTT透传' : '连接APP中继'))

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
    return '快照解析失败'
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
      message.warning(e?.message || '获取APP中继状态失败')
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
  if (!data || !data.status) throw new Error('中继命令返回无效')
  if (data.status !== 'SUCCESS') {
    throw new Error(data.error_message || `中继命令执行失败(${data.status})`)
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
        data: historyChartData.packCellSumVoltageV
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
    render: row => formatTime(row.ts)
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
  message.success('已断开参数通道')
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
    message.success('已连接APP蓝牙中继通道')
  } else {
    message.info('请先在手机APP中蓝牙连接该设备，WEB端将自动使用中继参数通道')
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
      message.error(e?.message || '连接失败')
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
    message.error(e?.message || '获取电池信息失败')
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
const cloudCellTempsC = computed(() => nullableNumberArray(cloudCurrent['temperature.cellTempsC'] ?? cloudCurrent.cellTempsC))
const cellCount = computed(() =>
  Number(displayStatus.value?.meta?.seriesCount || cloudCurrent.seriesCount || cloudCurrent['meta.seriesCount'] || cloudCellVoltagesMv.value.length || 0)
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
  return `${Number(v || 0)}次`
}

function formatMinuteText(v: unknown) {
  if (isInvalidU16(v)) return '-'
  return `${Number(v || 0)}分钟`
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
  Number(displayStatus.value?.electrical?.cellVoltageIndex?.highest || cloudCurrent['electrical.cellVoltageIndex.highest'] || cloudCurrent.cellVoltageHighestIndex || 0)
)
const lowestIdx = computed(() =>
  Number(displayStatus.value?.electrical?.cellVoltageIndex?.lowest || cloudCurrent['electrical.cellVoltageIndex.lowest'] || cloudCurrent.cellVoltageLowestIndex || 0)
)

const STATUS_LABELS: Record<string, string> = {
  cellOverVoltageProtectionLv1: '单体过压一级保护',
  cellUnderVoltageProtectionLv1: '单体过放一级保护',
  preDischargeShortCircuitProtection: '预放电短路保护',
  chargeMosFault: '充电MOS故障',
  dischargeMosFault: '放电MOS故障',
  poleTempOverTempProtection: '极柱过温保护',
  antiReverseMosFault: '防反MOS故障',
  chargeOverCurrentProtectionLv1: '充电过流保护',
  dischargeOverCurrentProtectionLv1: '放电过流保护',
  shortCircuitProtection: '短路保护',
  insulationProtection: '绝缘保护',
  cellOverVoltageProtectionLv2: '电芯过压保护',
  cellUnderVoltageProtectionLv2: '电芯欠压保护',
  chargeOverCurrentProtectionLv2: '充电过流二级保护',
  dischargeOverCurrentProtectionLv2: '放电过流二级保护',
  afeOverTempProtection: 'AFE高温保护',
  ambientUnderTempProtection: '环境低温保护',
  ambientOverTempProtection: '环境高温保护',
  chargeHighTempProtectionCell: '充电高温保护',
  dischargeHighTempProtectionCell: '放电高温保护',
  prechargeMosFault: '预充MOS故障',
  heatingMosFault: '加热MOS故障',
  cellSamplingOpenCircuitFault: '电芯采样断线故障',
  rtcOrCellUltraLowVoltageChargeDisableFault: 'RTC失效/电芯超低压禁充失效',
  fuseBlownFault: 'FUSE熔断故障',
  voltageSamplingFault: '电压采样故障',
  currentSamplingFault: '电流采样故障',
  cellAbnormalOverTempFault: '电芯异常高温故障',
  afeCommunicationFault: 'AFE通讯故障',
  cellNtcInvalid: '电芯NTC异常',
  ambientNtcInvalid: '环境温度NTC异常',
  mosNtcInvalid: 'MOS NTC异常',
  chargeLowTempProtectionCell: '充电低温保护',
  dischargeLowTempProtectionCell: '放电低温保护',
  cellUnderTempProtection: '电芯低温保护',
  cellOverTempProtection: '电芯高温保护',
  dischargeMosOverTempProtection: '放电MOS过温保护',
  chargeMosOverTempProtection: '充电MOS过温保护',
  fullChargeProtection: '满充保护',
  deltaVProtection: '压差保护',
  tempDiffProtection: '温差保护',
  heatingFilmTempProtection: '加热膜温度保护',
  packUnderVoltageProtection: '电池包欠压保护',
  packOverVoltageProtection: '电池包过压保护',
  chargeHighTempAlarmCell: '充电高温告警',
  dischargeOrIdleHighTempAlarmCell: '放电/静置高温告警',
  chargeLowTempAlarmCell: '充电低温告警',
  dischargeOrIdleLowTempAlarmCell: '放电/静置低温告警',
  thermalRunawayAlarm: '热失控告警',
  ambientHighTempAlarm: '环境高温告警',
  ambientLowTempAlarm: '环境低温告警',
  dischargeMosHighTempAlarm: '放电MOS高温告警',
  chargeMosHighTempAlarm: '充电MOS高温告警',
  lowSocAlarm: 'SOC低告警',
  cellOverVoltageAlarm: '电芯过压告警',
  cellUnderVoltageAlarm: '电芯欠压告警',
  packOverVoltageAlarm: '电池包过压告警',
  packUnderVoltageAlarm: '电池包欠压告警',
  chargeOverCurrentAlarm: '充电过流告警',
  dischargeOverCurrentAlarm: '放电过流告警',
  deltaVAlarm: '压差告警',
  tempDiffAlarm: '温差告警',
  insulationAlarm: '绝缘告警'
}

function labelForStatus(key: string) {
  return STATUS_LABELS[key] || key
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
    items.push({ type: 'fault', label: '故障', count: faultStatusItems.value.length, className: 'status-flag-web--danger' })
  }
  if (alarmStatusItems.value.length) {
    items.push({ type: 'alarm', label: '告警', count: alarmStatusItems.value.length, className: 'status-flag-web--warn' })
  }
  if (protectStatusItems.value.length) {
    items.push({ type: 'protect', label: '保护', count: protectStatusItems.value.length, className: 'status-flag-web--guard' })
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
    fault: { title: '故障', items: faultStatusItems.value },
    alarm: { title: '告警', items: alarmStatusItems.value },
    protect: { title: '保护', items: protectStatusItems.value }
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
  protectStatusItems.value.length ? `${protectStatusItems.value.length}项保护` : '无'
)
function toggleProtectPanel() {
  protectPanelExpanded.value = !protectPanelExpanded.value
}

const cellVoltageRows = computed(() => {
  const list = displayStatus.value?.cell?.voltagesMv || cloudCellVoltagesMv.value
  const balancingList = displayStatus.value?.cell?.balancing || []
  return list.map((mv, i) => {
    const v = Number(mv || 0) / 1000
    return {
      index: i + 1,
      voltage: Number.isFinite(v) ? v : null,
      voltageText: Number.isFinite(v) ? `${v.toFixed(3)}V` : '-',
      voltageLabel: Number.isFinite(v) ? v.toFixed(3) : '-',
      fillPercent: Number.isFinite(v) ? Math.max(0, Math.min(100, (v / 5) * 100)) : 0,
      isHighest: i + 1 === highestIdx.value,
      isLowest: i + 1 === lowestIdx.value,
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
  { label: '默认保留', value: 0x00 },
  { label: '磷酸铁锂', value: 0x01 },
  { label: '锰酸锂', value: 0x02 },
  { label: '三元锂', value: 0x03 },
  { label: '钴酸锂', value: 0x04 },
  { label: '聚合锂', value: 0x05 },
  { label: '钛酸锂', value: 0x06 },
  { label: '铅酸', value: 0x07 },
  { label: '镍氢', value: 0x08 },
  { label: '钠离子', value: 0x09 }
] as const

const paramValues = reactive<Record<string, unknown>>({})
const TEMP_DISPLAY_LABELS: Record<string, string> = {
  CELL_OVER_TEMP_PROTECT_C: 'MOS高温保护温度',
  CELL_OVER_TEMP_RELEASE_C: 'MOS高温保护解除温度',
  MOS_OVER_TEMP_PROTECT_DELAY_S: 'MOS高温保护延时',
  MOS_OVER_TEMP_RELEASE_DELAY_S: 'MOS高温保护解除延时',
  CELL_UNDER_TEMP_PROTECT_C: '充电低温保护温度',
  CELL_UNDER_TEMP_RELEASE_C: '充电低温保护解除温度',
  CHARGE_OVER_TEMP_PROTECT_C: '充电高温保护温度',
  CHARGE_OVER_TEMP_RELEASE_C: '充电高温保护解除温度',
  CHARGE_OVER_TEMP_PROTECT_DELAY_S: '充电高低温保护延时',
  CHARGE_OVER_TEMP_RELEASE_DELAY_S: '充电高低温保护解除延时',
  DISCHARGE_UNDER_TEMP_PROTECT_C: '放电低温保护温度',
  DISCHARGE_UNDER_TEMP_RELEASE_C: '放电低温保护解除温度',
  DISCHARGE_OVER_TEMP_PROTECT_C: '放电高温保护温度',
  DISCHARGE_OVER_TEMP_RELEASE_C: '放电高温保护解除温度',
  DISCHARGE_OVER_TEMP_PROTECT_DELAY_S: '放电高低温保护延时',
  DISCHARGE_OVER_TEMP_RELEASE_DELAY_S: '放电高低温保护解除延时'
}
const FACTORY_ACTION_LABELS: Record<string, string> = {
  enterTestMode: '进入测试模式',
  exitTestMode: '退出测试模式',
  balanceAllOn: '开启全均衡',
  balanceAllOff: '关闭全均衡',
  function1On: '功能1打开',
  function1Off: '功能1关闭',
  function2On: '功能2打开',
  function2Off: '功能2关闭',
  function3On: '功能3打开',
  function3Off: '功能3关闭',
  function4On: '功能4打开',
  function4Off: '功能4关闭',
  resetProtectionBoard: '复位保护板',
  mcuProtectionOn: 'MCU进入保护',
  mcuProtectionOff: 'MCU退出保护',
  manualChargeDischargeOn: '手动打开充放电管',
  manualChargeDischargeOff: '手动关闭充放电管',
  manualHeatingOn: '手动打开加热',
  manualHeatingOff: '手动关闭加热',
  gpsPowerOn: 'GPS电源打开',
  gpsPowerOff: 'GPS电源关闭',
  sleep: '进入休眠',
  powerOff: '关机'
}

function resolveParamEntry(entry: ParamEntry) {
  if (typeof entry === 'string') return { key: entry, actualKey: entry }
  return { key: entry.displayKey, actualKey: entry.actualKey }
}

function labelOf(key: string, actualKey?: string) {
  if (TEMP_DISPLAY_LABELS[key]) return TEMP_DISPLAY_LABELS[key]
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
  return BATTERY_TYPE_OPTIONS.find(item => item.value === n)?.label || `未知类型(${Math.trunc(n)})`
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
    label: FACTORY_ACTION_LABELS[item.key] || item.key
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
    enabled: functionConfigFlags.value[item.key],
    statusText: functionConfigFlags.value[item.key] ? item.enabledLabel : item.disabledLabel
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
    message.warning('当前离线，无法设置参数')
    return
  }
  if (!canAccessParamKey(item.actualKey)) {
    message.warning('当前账号无权限操作该参数')
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
        message.warning('请选择电池类型')
        return
      }
      await writeParamValue(editState.key, editState.selectValue)
    } else if (editState.valueType === 'str') {
      await writeParamValue(editState.key, editState.inputText)
    } else {
      const raw = editState.inputText.trim()
      const v = Number(raw)
      if (!raw || !Number.isFinite(v)) {
        message.warning('请输入有效数值')
        return
      }
      await writeParamValue(editState.key, v)
    }
    editState.show = false
    message.success('已保存')
  } catch (e: any) {
    editState.show = false
    message.error(e?.message || '保存失败')
  }
}

async function openAdvancedSettings() {
  if ((!client || connType.value === 'offline') && !relayReady.value) {
    message.warning('当前离线，无法读取高级参数')
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
    message.warning('当前离线，无法设置功能配置')
    return
  }
  if (!canAccessFunctionControl(key)) {
    message.warning('当前账号无权限操作功能配置')
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
    message.success('功能配置已更新')
  } catch (e: any) {
    message.error(e?.message || '功能配置更新失败')
  }
}

async function runFactoryAction(item: FactoryAction) {
  const useDirect = !!client && connType.value !== 'offline'
  const useRelay = !useDirect && relayReady.value
  if (!useDirect && !useRelay) {
    message.warning('当前离线，无法执行工厂命令')
    return
  }
  if (!canAccessFactoryAction(item.key)) {
    message.warning('当前账号无权限执行工厂命令')
    return
  }
  if (item.confirm) {
    const ok = window.confirm('执行工厂命令可能影响设备运行，是否继续？')
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
    message.success('工厂命令已发送')
  } catch (e: any) {
    message.error(e?.message || '工厂命令执行失败')
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
    render: row => (
      <NButton size="small" tertiary type="primary" onClick={() => openEdit(row)}>
        设置
      </NButton>
    )
  }
]
const factoryColumns: DataTableColumns<FactoryAction> = [
  { key: 'label', title: '工厂命令', minWidth: 260 },
  {
    key: 'raw',
    title: '命令字',
    width: 140,
    render: row => `0x${row.raw.toString(16).toUpperCase().padStart(8, '0')}`
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    render: row => (
      <NButton size="small" tertiary type="warning" onClick={() => runFactoryAction(row)}>
        执行
      </NButton>
    )
  }
]
const functionColumns: DataTableColumns<FunctionControlRow> = [
  { key: 'label', title: '功能项', minWidth: 220 },
  {
    key: 'status',
    title: '当前状态',
    width: 120,
    render: row => <NTag type={row.enabled ? 'success' : 'default'}>{row.statusText}</NTag>
  },
  {
    key: 'actions',
    title: '开关',
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
            <NText strong>通讯：</NText>
            <NTag :type="mqttReportType">{{ mqttReportText }}</NTag>
            <NTag :type="connTagType">{{ connText }}</NTag>
            <NTag v-if="battery?.comm_chip_id" type="info">4G卡ID：{{ battery.comm_chip_id }}</NTag>
            <NTag :type="cloudStatusType">{{ cloudStatusText }}</NTag>
            <NTag type="default">最近云端数据时间：{{ cloudUpdateText }}</NTag>
            <NTag :type="paramLinkType">{{ paramLinkText }}</NTag>
          </NSpace>
          <NSpace>
            <NButton size="small" :disabled="connecting" @click="connectRealtime">{{ paramConnectButtonText }}</NButton>
            <NButton size="small" :disabled="connecting" @click="handleDisconnect">断开参数通道</NButton>
            <NButton size="small" @click="refreshCloudData">刷新云端</NButton>
          </NSpace>
        </NSpace>
      </NCard>

      <div class="panel-body">
        <NAlert v-if="canUse4G" class="mb-12px" type="info" :show-icon="false" title="4G设备数据链路">
          仪表和电芯数据默认使用 MQTT Socket 透传实时读取；透传失败时保留云端主动上报数据作为兜底。
        </NAlert>
        <NAlert v-if="!canUse4G" class="mb-12px" type="warning" :show-icon="false" title="当前设备未配置4G通讯卡ID">
          已切换为云端数据展示模式；参数读写需手机 APP 蓝牙连接设备后通过中继通道完成。
        </NAlert>

        <NTabs type="line" animated>
          <NTabPane name="dashboard" tab="仪表">
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
                <NCard size="small" title="Pack电压" :bordered="false">
                  <div class="metric-big">{{ packVoltageText }}</div>
                  <div class="metric-sub">电芯串数：{{ cellCount || '-' }}</div>
                </NCard>
              </NGridItem>

              <NGridItem :span="8">
                <NCard size="small" title="循环次数" :bordered="false">
                  <div class="metric-big">{{ cycleCountText }}</div>
                </NCard>
              </NGridItem>
              <NGridItem :span="8">
                <NCard size="small" title="充电时间" :bordered="false">
                  <div class="metric-big">{{ chargeTimeText }}</div>
                </NCard>
              </NGridItem>
              <NGridItem :span="8">
                <NCard size="small" title="充放电电流" :bordered="false">
                  <div class="metric-big">{{ currentText }}</div>
                </NCard>
              </NGridItem>

              <NGridItem :span="12">
                <NCard size="small" title="开关状态" :bordered="false">
                  <div class="switch-grid">
                    <div class="switch-item">
                      <span class="switch-item__label">充电开关</span>
                      <NSwitch :value="chargeSwitchOn" disabled />
                    </div>
                    <div class="switch-item">
                      <span class="switch-item__label">放电开关</span>
                      <NSwitch :value="dischargeSwitchOn" disabled />
                    </div>
                    <div class="switch-item">
                      <span class="switch-item__label">均衡状态</span>
                      <NSwitch :value="balancingOn" disabled />
                    </div>
                  </div>
                </NCard>
              </NGridItem>

              <NGridItem :span="12">
                <NCard size="small" title="电压信息" :bordered="false">
                  <div class="temp-list">
                    <div class="temp-row">
                      <span class="temp-label">平均电压</span>
                      <span>{{ avgVoltageText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">最高电压</span>
                      <span>{{ highestVoltageText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">最低电压</span>
                      <span>{{ lowestVoltageText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">电压差</span>
                      <span>{{ diffVoltageText }}</span>
                    </div>
                  </div>
                </NCard>
              </NGridItem>

              <NGridItem :span="12">
                <NCard size="small" title="温度信息" :bordered="false">
                  <div class="temp-list">
                    <div class="temp-row">
                      <span class="temp-label">MOS温度</span>
                      <span>{{ mosTempText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">T1：环境温度</span>
                      <span>{{ ambientTempText }}</span>
                    </div>
                    <div class="temp-row">
                      <span class="temp-label">T2：电芯温度</span>
                      <span>{{ cellTempText }}</span>
                    </div>
                  </div>
                </NCard>
              </NGridItem>

              <NGridItem :span="12">
                <NCard size="small" title="BMS保护状态" :bordered="false">
                  <template #header-extra>
                    <NButton text type="primary" @click="toggleProtectPanel">
                      {{ protectPanelExpanded ? '收起' : '展开' }}
                    </NButton>
                  </template>
                  <div class="metric-sub mb-12px">{{ protectSummaryText }}</div>
                  <div v-if="protectPanelExpanded" class="protect-list-web">
                    <div v-for="item in protectStatusRows" :key="item.key" class="protect-row-web">
                      <span class="protect-row-web__label">{{ item.label }}</span>
                      <span class="protect-row-web__value" :class="{ 'protect-row-web__value--on': item.enabled }">
                        {{ item.enabled ? '开启' : '关闭' }}
                      </span>
                    </div>
                  </div>
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
              <div v-if="cellVoltageRows.length > 0" class="cell-panel">
                <div class="cell-panel-summary">
                  <div class="cell-summary-list">
                    <div class="cell-summary-item cell-summary-item--highest">
                      <span class="cell-summary-dot"></span>
                      <span>最大({{ highestCellRow?.index || '-' }}) {{ highestCellRow?.voltageText || '-' }}</span>
                    </div>
                    <div class="cell-summary-item cell-summary-item--lowest">
                      <span class="cell-summary-dot"></span>
                      <span>最小({{ lowestCellRow?.index || '-' }}) {{ lowestCellRow?.voltageText || '-' }}</span>
                    </div>
                    <div class="cell-summary-item cell-summary-item--balancing">
                      <span class="cell-summary-dot"></span>
                      <span>均衡 {{ balancingCellCount }}</span>
                    </div>
                  </div>

                  <div class="cell-summary-meta">
                    <span>Pack：{{ packVoltageText }}</span>
                    <span>串数：{{ cellCount || '-' }}</span>
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
              <NEmpty v-else description="暂无电芯数据" />
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
              参数读写支持两种通道：4G设备可手动连接 MQTT 参数直连，BLE设备走“APP蓝牙中继”；该通道状态不影响仪表/电芯云端数据显示。
            </NAlert>
            <NSpace v-if="hasAdvancedSections" class="mb-12px" justify="end">
              <NButton size="small" :disabled="connType === 'offline' && !relayReady" @click="openAdvancedSettings">
                高级设置
              </NButton>
            </NSpace>
            <NGrid :cols="24" :x-gap="12" :y-gap="12">
              <NGridItem v-if="hasSingleItems" :span="12">
                <NCard size="small" title="单体设置" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton
                      size="small"
                      :disabled="connType === 'offline' && !relayReady"
                      @click="loadKeys(SINGLE_KEYS)"
                    >
                      刷新
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="singleItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem v-if="hasVoltageItems" :span="12">
                <NCard size="small" title="总压设置" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton
                      size="small"
                      :disabled="connType === 'offline' && !relayReady"
                      @click="loadKeys(VOLTAGE_KEYS)"
                    >
                      刷新
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="voltageItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem v-if="hasCurrentItems" :span="12">
                <NCard size="small" title="电流设置" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton
                      size="small"
                      :disabled="connType === 'offline' && !relayReady"
                      @click="loadKeys(CURRENT_KEYS)"
                    >
                      刷新
                    </NButton>
                  </NSpace>
                  <NDataTable :columns="paramColumns" :data="currentItems" :bordered="false" :max-height="260" />
                </NCard>
              </NGridItem>
              <NGridItem v-if="hasTemperatureItems" :span="12">
                <NCard size="small" title="温度设置" :bordered="false">
                  <NSpace justify="space-between" class="mb-10px">
                    <NButton
                      size="small"
                      :disabled="connType === 'offline' && !relayReady"
                      @click="loadKeys(TEMP_KEYS)"
                    >
                      刷新
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
        <div v-for="(item, idx) in statusFlagModal.items" :key="`${statusFlagModal.title}-${idx}`" class="status-modal-row">
          <span class="status-modal-row__idx">{{ idx + 1 }}.</span>
          <span>{{ item }}</span>
        </div>
      </div>
    </NModal>

    <NModal v-model:show="editState.show" preset="card" style="width: 520px" :title="`设置：${editState.title}`">
      <NSpace vertical size="large">
        <NText depth="3">单位：{{ editState.unit || '-' }}</NText>
        <NSelect
          v-if="editState.key === BMS_PARAM.BATTERY_TYPE"
          v-model:value="editState.selectValue"
          :options="BATTERY_TYPE_OPTIONS"
          placeholder="请选择电池类型"
        />
        <NInput
          v-else
          v-model:value="editState.inputText"
          :placeholder="editState.valueType === 'str' ? '请输入文本值' : '请输入数值'"
          type="text"
        />
        <NSpace justify="end">
          <NButton @click="editState.show = false">取消</NButton>
          <NButton type="primary" @click="confirmEdit">保存</NButton>
        </NSpace>
      </NSpace>
    </NModal>

    <NModal v-model:show="advancedState.show" preset="card" style="width: min(1100px, 95vw)" title="高级设置">
      <NSpin :show="advancedState.loading">
        <NTabs type="line" animated>
          <NTabPane v-if="hasOtherItems" name="advanced-config" tab="高级配置">
            <NDataTable :columns="paramColumns" :data="otherItems" :bordered="false" :max-height="420" />
          </NTabPane>
          <NTabPane v-if="hasNumberingItems" name="numbering-config" tab="编号配置">
            <NDataTable :columns="paramColumns" :data="numberingItems" :bordered="false" :max-height="420" />
          </NTabPane>
          <NTabPane v-if="hasSystemSection" name="system-config" tab="系统配置">
            <NSpace vertical size="large">
              <NCard v-if="hasFunctionControlRows" size="small" title="功能控制" :bordered="false">
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
          <NTabPane v-if="hasFactoryItems" name="factory-config" tab="工厂配置">
            <NDataTable :columns="factoryColumns" :data="factoryItems" :bordered="false" :max-height="420" />
          </NTabPane>
        </NTabs>
      </NSpin>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="advancedState.show = false">关闭</NButton>
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
  margin-top: 10px;
  color: rgba(71, 85, 105, 0.88);
  font-size: 12px;
  font-weight: 600;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
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
