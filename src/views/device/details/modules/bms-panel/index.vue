<script setup lang="tsx">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
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
import { localStg } from '@/utils/storage'
import { getAppBatteryDetail } from '@/service/api/bms'
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

const message = useMessage()

const loading = ref(false)
const battery = ref<AppBatteryDetail | null>(null)

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

const canUse4G = computed(() => {
  const v = String(battery.value?.comm_chip_id || '').trim()
  return v.length > 0
})

const connText = computed(() => (connType.value === 'mqtt' ? 'MQTT透传' : '离线'))

function buildWsUrl() {
  const origin = window.location.origin
  if (origin.startsWith('https://')) return `wss://${origin.slice('https://'.length)}/api/v1/app/battery/socket/ws`
  if (origin.startsWith('http://')) return `ws://${origin.slice('http://'.length)}/api/v1/app/battery/socket/ws`
  return `${origin}/api/v1/app/battery/socket/ws`
}

function stopPolling() {
  if (pollTimer != null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

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
    transport = new WebMqttSocketBmsTransport({ wsUrl: buildWsUrl(), deviceId: props.id, token })
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
    load()
  }
)

onMounted(() => {
  loadDeviceParamPermissions()
  load()
})
onBeforeUnmount(() => disconnect())

const socPct = computed(() => {
  const v = status.value?.energy?.socPct ?? battery.value?.soc
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
})

const sohPct = computed(() => {
  const v = status.value?.energy?.sohPct ?? battery.value?.soh
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
})

const cellCount = computed(() => Number(status.value?.meta?.seriesCount || 0))
const packVoltageText = computed(() => {
  const v = status.value?.electrical?.vPackV
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-'
  return `${v.toFixed(1)}V`
})

const highestIdx = computed(() => Number(status.value?.electrical?.cellVoltageIndex?.highest || 0))
const cellVoltageRows = computed(() => {
  const list = status.value?.cell?.voltagesMv || []
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
    render: row =>
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

const filterParamKeys = (keys: string[]) => keys.filter(key => canAccessParamKey(key))

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
  filterParamKeys(keys).map(key => {
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
    render: row => (
      <NButton size="small" tertiary type="primary" onClick={() => openEdit(row)}>
        设置
      </NButton>
    )
  }
]
</script>

<template>
  <div class="bms-panel">
    <NSpin :show="loading">
      <NCard size="small" :bordered="false">
        <NSpace align="center" justify="space-between">
          <NSpace align="center">
            <NText strong>连接：</NText>
            <NTag :type="connType === 'mqtt' ? 'success' : 'default'">{{ connText }}</NTag>
            <NTag v-if="battery?.comm_chip_id" type="info">4G卡ID：{{ battery.comm_chip_id }}</NTag>
          </NSpace>
          <NSpace>
            <NButton size="small" :disabled="!canUse4G || connecting" @click="connectMqtt">连接</NButton>
            <NButton size="small" :disabled="connecting" @click="disconnect">断开</NButton>
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
.mb-10px {
  margin-bottom: 10px;
}
.mb-12px {
  margin-bottom: 12px;
}
</style>
