<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { NButton, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { getBmsHistoryDeviceList, getBmsHistoryData, createBmsHistoryExportJob } from '@/service/api/bms'
import type { BmsHistoryWideColumn } from '@/service/api/bms'
import { ensureUiPermissionState, hasUiPermission } from '@/utils/common/ui-permission'
import { ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'

type DeviceItem = {
  device_id: string
  device_number: string
  device_name?: string
  item_uuid?: string
  bms_comm_type?: number
  ble_mac?: string
  comm_chip_id?: string
}

const message = useMessage()
const maxRangeMs = 31 * 24 * 60 * 60 * 1000

const panelCollapsed = ref(false)

const deviceKeyword = ref('')
const deviceLoading = ref(false)
const deviceList = ref<DeviceItem[]>([])
const selectedDeviceId = ref<string | null>(null)
const devicePagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0
})

const dateRange = ref<[number, number] | null>([
  dayjs().subtract(1, 'day').startOf('day').valueOf(),
  dayjs().endOf('day').valueOf()
])
const viewMode = ref<'long' | 'wide'>('long')
const historyLoading = ref(false)
const historyRows = ref<Record<string, any>[]>([])
const wideColumns = ref<BmsHistoryWideColumn[]>([])
const tableMaxHeight = ref(320)
const historyContentRef = ref<HTMLElement | null>(null)
const historyToolbarRef = ref<HTMLElement | null>(null)
const historyAlertRef = ref<HTMLElement | null>(null)
const historyPaginationRef = ref<HTMLElement | null>(null)
const historyTableWrapRef = ref<HTMLElement | null>(null)

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0
})

let keywordTimer: number | null = null

const canExport = computed(() => hasUiPermission('bms_battery_history_export'))

function unwrapApiPayload<T = any>(raw: any): T {
  const level1 = raw?.data ?? raw
  return (level1?.data ?? level1 ?? {}) as T
}

const wideIdentifierLabelMap: Record<string, string> = {
  cycleCount: '循环次数',
  faultCount: '故障数量',
  charging: '充电状态',
  discharging: '放电状态',
  chargeFetOn: '充电MOS状态',
  dischargeFetOn: '放电MOS状态',
  chargeMosC: '充电MOS温度(°C)',
  dischargeMosC: '放电MOS温度(°C)',
  highestCellVoltageMv: '最高单体电压(mV)',
  lowestCellVoltageMv: '最低单体电压(mV)',
  avgCellVoltageMv: '平均单体电压(mV)',
  totalVoltageMv: '总电压(mV)',
  totalCurrentMa: '总电流(mA)',
  remainCapacityMah: '剩余容量(mAh)',
  nominalCapacityMah: '额定容量(mAh)',
  soc: 'SOC(%)',
  soh: 'SOH(%)'
}

const wideIdentifierTokenMap: Record<string, string> = {
  highest: '最高',
  lowest: '最低',
  avg: '平均',
  average: '平均',
  max: '最大',
  min: '最小',
  cell: '单体',
  total: '总',
  remain: '剩余',
  remaining: '剩余',
  nominal: '额定',
  voltage: '电压',
  current: '电流',
  capacity: '容量',
  count: '数量',
  status: '状态',
  fault: '故障',
  charge: '充电',
  discharge: '放电',
  charging: '充电',
  discharging: '放电',
  mos: 'MOS',
  fet: 'MOS',
  temp: '温度',
  temperature: '温度',
  cycle: '循环',
  balance: '均衡',
  protection: '保护',
  alarm: '告警',
  state: '状态',
  power: '功率',
  energy: '能量',
  percentage: '百分比'
}

const wideIdentifierUnitMap: Record<string, string> = {
  mv: 'mV',
  ma: 'mA',
  mah: 'mAh',
  ah: 'Ah',
  v: 'V',
  a: 'A',
  c: '°C',
  pct: '%',
  percent: '%'
}

function splitIdentifier(identifier: string): string[] {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_./-]+/g, ' ')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function translateWideIdentifier(identifier: string): string {
  const raw = String(identifier || '').trim()
  if (!raw) return raw
  if (wideIdentifierLabelMap[raw]) return wideIdentifierLabelMap[raw]

  const parts = splitIdentifier(raw)
  if (parts.length === 0) return raw

  let unit = ''
  let mappedCount = 0
  const translated = parts.map(part => {
    const key = part.toLowerCase()
    if (wideIdentifierUnitMap[key]) {
      unit = wideIdentifierUnitMap[key]
      mappedCount += 1
      return ''
    }
    if (wideIdentifierTokenMap[key]) {
      mappedCount += 1
      return wideIdentifierTokenMap[key]
    }
    if (/^\d+$/.test(key)) return part
    return part
  })

  if (mappedCount === 0) return raw

  const label = translated.join('')
  if (!label) return raw
  if (unit) return `${label}(${unit})`
  return label
}

function getWideColumnTitle(col: BmsHistoryWideColumn): string {
  const identifier = String(col.identifier || '').trim()
  const dataName = String(col.data_name || '').trim()
  if (dataName && dataName !== identifier) {
    return `${dataName} (${identifier})`
  }
  const zhLabel = translateWideIdentifier(identifier)
  if (!zhLabel || zhLabel === identifier) return identifier
  return `${zhLabel} (${identifier})`
}

function recalcTableHeight() {
  const contentEl = historyContentRef.value
  const tableWrapEl = historyTableWrapRef.value
  if (!contentEl || !tableWrapEl) return
  const toolbarHeight = historyToolbarRef.value?.offsetHeight || 0
  const alertHeight = !selectedDeviceId.value ? historyAlertRef.value?.offsetHeight || 0 : 0
  const paginationHeight = historyPaginationRef.value?.offsetHeight || 0
  const contentGap = !selectedDeviceId.value ? 28 : 16
  const available = contentEl.clientHeight - toolbarHeight - alertHeight - paginationHeight - contentGap
  tableMaxHeight.value = Math.max(available, 220)
}

const tableColumns = computed<DataTableColumns<Record<string, any>>>(() => {
  const timeColumn = {
    title: '时间',
    key: 'time',
    width: 180,
    render: (row: Record<string, any>) => row.time || dayjs(Number(row.ts || 0)).format('YYYY-MM-DD HH:mm:ss')
  }

  if (viewMode.value === 'long') {
    return [
      timeColumn,
      {
        title: '数据类型',
        key: 'data_type',
        width: 100,
        render: (row: Record<string, any>) =>
          row.data_type === 'attribute'
            ? h(NTag, { type: 'warning', size: 'small' }, () => 'attribute')
            : h(NTag, { type: 'info', size: 'small' }, () => 'telemetry')
      },
      { title: '标识符', key: 'identifier', width: 180 },
      { title: '数据名称', key: 'data_name', width: 180, ellipsis: { tooltip: true } },
      { title: '值', key: 'value', minWidth: 200, ellipsis: { tooltip: true } }
    ]
  }

  const dynamicColumns = wideColumns.value.map(col => {
    const title = getWideColumnTitle(col)
    return {
      title,
      key: col.key,
      minWidth: 160,
      ellipsis: { tooltip: true },
      render: (row: Record<string, any>) => row[col.key] || '-'
    }
  })

  return [timeColumn, ...dynamicColumns]
})

function mapCommType(type?: number) {
  if (type === 1) return '蓝牙'
  if (type === 2) return '4G'
  if (type === 3) return '蓝牙+4G'
  return '--'
}

function isDateRangeValid(range: [number, number] | null) {
  if (!range) return false
  const [start, end] = range
  if (!start || !end || end < start) return false
  if (end - start > maxRangeMs) return false
  return true
}

async function loadDevices(reset = false) {
  if (deviceLoading.value) return
  if (reset) {
    devicePagination.page = 1
  }

  deviceLoading.value = true
  try {
    const resp: any = await getBmsHistoryDeviceList({
      page: devicePagination.page,
      page_size: devicePagination.pageSize,
      keyword: deviceKeyword.value || undefined
    })
    const data = unwrapApiPayload<any>(resp)
    const list = Array.isArray(data?.list) ? data.list : []
    deviceList.value = list
    devicePagination.itemCount = Number(data?.total || 0)

    if (list.length === 0) {
      selectedDeviceId.value = null
      historyRows.value = []
      wideColumns.value = []
      pagination.itemCount = 0
      return
    }

    const existed = selectedDeviceId.value && list.some(item => item.device_id === selectedDeviceId.value)
    if (!existed) {
      selectedDeviceId.value = list[0].device_id
      await queryHistory(true)
    }
  } catch (error: any) {
    message.error(error?.message || '加载设备失败')
  } finally {
    deviceLoading.value = false
  }
}

function handleKeywordUpdate(value: string) {
  deviceKeyword.value = value
  if (keywordTimer != null) {
    window.clearTimeout(keywordTimer)
  }
  keywordTimer = window.setTimeout(() => {
    void loadDevices(true)
  }, 350)
}

async function loadMoreDevices() {
  if (deviceLoading.value) return
  await loadDevices()
}

async function handleDevicePageChange(page: number) {
  if (page === devicePagination.page) return
  devicePagination.page = page
  await loadMoreDevices()
}

async function handleSelectDevice(deviceId: string) {
  selectedDeviceId.value = deviceId
  pagination.page = 1
  await queryHistory(true)
}

async function queryHistory(resetPage = false) {
  if (!selectedDeviceId.value) return
  if (!isDateRangeValid(dateRange.value)) {
    message.warning('请选择不超过31天的时间范围')
    return
  }
  if (!dateRange.value) return

  const [startTime, endTime] = dateRange.value
  if (resetPage) {
    pagination.page = 1
  }

  await nextTick()
  recalcTableHeight()
  historyLoading.value = true
  try {
    const resp: any = await getBmsHistoryData({
      device_id: selectedDeviceId.value,
      view_mode: viewMode.value,
      start_time: startTime,
      end_time: endTime,
      page: pagination.page,
      page_size: pagination.pageSize
    })
    const data = unwrapApiPayload<any>(resp)
    historyRows.value = Array.isArray(data?.list) ? data.list : []
    wideColumns.value = Array.isArray(data?.columns) ? data.columns : []
    pagination.itemCount = Number(data?.total || 0)
  } catch (error: any) {
    historyRows.value = []
    pagination.itemCount = 0
    message.error(error?.message || '查询历史数据失败')
  } finally {
    historyLoading.value = false
    await nextTick()
    recalcTableHeight()
  }
}

async function handleDateRangeChange(value: [number, number] | null) {
  dateRange.value = value
  if (!isDateRangeValid(value)) {
    message.warning('查询时间范围不能超过31天')
    return
  }
  pagination.page = 1
  await queryHistory(true)
}

async function handleViewModeChange(mode: 'long' | 'wide') {
  viewMode.value = mode
  pagination.page = 1
  await queryHistory(true)
}

async function handleExport() {
  if (!selectedDeviceId.value) {
    message.warning('请先选择设备')
    return
  }
  if (!isDateRangeValid(dateRange.value) || !dateRange.value) {
    message.warning('请先选择有效时间范围（31天内）')
    return
  }

  const [startTime, endTime] = dateRange.value
  try {
    await createBmsHistoryExportJob({
      device_id: selectedDeviceId.value,
      view_mode: viewMode.value,
      start_time: startTime,
      end_time: endTime
    })
    message.success('导出任务已生成，完成后将在右上角消息中心提醒')
  } catch (error: any) {
    message.error(error?.message || '创建导出任务失败')
  }
}

function togglePanel() {
  panelCollapsed.value = !panelCollapsed.value
}

onMounted(async () => {
  window.addEventListener('resize', recalcTableHeight)
  await ensureUiPermissionState()
  await loadDevices(true)
  await nextTick()
  recalcTableHeight()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', recalcTableHeight)
})

watch(
  () => [panelCollapsed.value, selectedDeviceId.value, viewMode.value, pagination.pageSize],
  async () => {
    await nextTick()
    recalcTableHeight()
  }
)
</script>

<template>
  <div class="h-full p-16px">
    <div class="history-layout">
      <div class="left-panel" :class="{ collapsed: panelCollapsed }">
        <NCard title="设备筛选" size="small" :bordered="true" class="h-full device-filter-card">
          <NInput
            :value="deviceKeyword"
            placeholder="按设备编号/名称搜索"
            clearable
            @update:value="handleKeywordUpdate"
          />
          <div class="device-list-wrap">
            <NSpin :show="deviceLoading" class="device-list-spin">
              <NScrollbar class="device-list-scroll pr-6px">
                <div
                  v-for="item in deviceList"
                  :key="item.device_id"
                  class="device-item"
                  :class="{ active: selectedDeviceId === item.device_id }"
                  @click="handleSelectDevice(item.device_id)"
                >
                  <div class="device-title">{{ item.device_name || item.device_number }}</div>
                  <div class="device-subtitle">SN: {{ item.device_number }}</div>
                  <div class="device-subtitle">通讯: {{ mapCommType(item.bms_comm_type) }}</div>
                </div>
                <NEmpty v-if="!deviceLoading && deviceList.length === 0" description="暂无设备" class="mt-20px" />
              </NScrollbar>
            </NSpin>
          </div>
          <div class="device-pagination">
            <NPagination
              :page="devicePagination.page"
              :page-size="devicePagination.pageSize"
              :item-count="devicePagination.itemCount"
              size="small"
              simple
              @update:page="handleDevicePageChange"
            />
          </div>
        </NCard>
      </div>

      <div class="collapse-trigger">
        <NButton circle quaternary size="tiny" class="collapse-toggle-btn" @click="togglePanel">
          <template #icon>
            <NIcon>
              <ChevronForwardOutline v-if="panelCollapsed" />
              <ChevronBackOutline v-else />
            </NIcon>
          </template>
        </NButton>
      </div>

      <div class="right-panel">
        <NCard class="h-full history-query-card" title="历史数据查询">
          <div ref="historyContentRef" class="history-content">
            <div ref="historyToolbarRef" class="toolbar">
              <NSpace align="center" wrap>
                <NDatePicker
                  :value="dateRange"
                  type="datetimerange"
                  format="yyyy-MM-dd HH:mm:ss"
                  clearable
                  @update:value="handleDateRangeChange"
                />
                <NRadioGroup :value="viewMode" @update:value="handleViewModeChange">
                  <NRadioButton value="long">长表</NRadioButton>
                  <NRadioButton value="wide">宽表</NRadioButton>
                </NRadioGroup>
                <NButton type="primary" :disabled="!canExport || !selectedDeviceId" @click="handleExport">导出</NButton>
              </NSpace>
            </div>

            <div v-if="!selectedDeviceId" ref="historyAlertRef" class="mb-12px">
              <NAlert type="info">请先在左侧选择设备，再进行历史数据查询。</NAlert>
            </div>

            <div ref="historyTableWrapRef" class="history-table-wrap">
              <NDataTable
                :loading="historyLoading"
                :columns="tableColumns"
                :data="historyRows"
                size="small"
                :max-height="tableMaxHeight"
              />
            </div>

            <div ref="historyPaginationRef" class="history-pagination">
              <NPagination
                v-model:page="pagination.page"
                v-model:page-size="pagination.pageSize"
                :item-count="pagination.itemCount"
                :page-sizes="[10, 20, 50, 100]"
                show-size-picker
                @update:page="queryHistory()"
                @update:page-size="queryHistory(true)"
              />
            </div>
          </div>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.history-layout {
  display: flex;
  height: 100%;
  min-height: 0;
}

.left-panel {
  width: 300px;
  min-width: 300px;
  display: flex;
  min-height: 0;
  transition:
    width 0.2s ease,
    min-width 0.2s ease,
    opacity 0.2s ease;
  overflow: hidden;
}

.left-panel.collapsed {
  width: 0;
  min-width: 0;
  opacity: 0;
}

.left-panel > .n-card {
  flex: 1;
  min-height: 0;
}

.collapse-trigger {
  width: 8px;
  min-width: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  position: relative;
}

.collapse-toggle-btn {
  width: 12px;
  height: 56px;
  min-width: 12px;
  border-radius: 999px;
  padding: 0;
  border: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(246, 248, 252, 0.98));
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.22),
    0 6px 18px rgba(15, 23, 42, 0.08);
  color: #64748b;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease,
    background 0.18s ease;

  :deep(.n-button__icon) {
    font-size: 10px;
    transform: scale(0.9);
  }

  &:hover {
    color: var(--n-color-target);
    background: linear-gradient(180deg, rgba(255, 255, 255, 1), rgba(240, 249, 255, 0.98));
    box-shadow:
      0 0 0 1px rgba(99, 102, 241, 0.18),
      0 8px 20px rgba(99, 102, 241, 0.12);
    transform: translateX(-1px);
  }

  &:active {
    transform: translateX(0);
  }
}

.right-panel {
  flex: 1;
  min-width: 0;
  display: flex;
}

.right-panel > .n-card {
  flex: 1;
  min-height: 0;
}

.toolbar {
  margin-bottom: 12px;
}

.history-content {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.history-query-card {
  :deep(.n-card__content) {
    height: calc(100% - 52px);
    min-height: 0;
  }
}

.history-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.history-pagination {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  margin-top: 10px;
  padding-top: 4px;
}

.device-filter-card {
  :deep(.n-card__content) {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: calc(100% - 52px);
    overflow: hidden;
  }
}

.device-list-wrap {
  margin-top: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.device-list-spin {
  height: 100%;
  min-height: 0;

  :deep(.n-spin-container) {
    height: 100%;
    min-height: 0;
  }

  :deep(.n-spin-content) {
    height: 100%;
    min-height: 0;
  }
}

.device-list-scroll {
  height: 100%;
}

.device-pagination {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  margin-top: 8px;
  padding-top: 4px;
}

.device-item {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.device-item:hover {
  border-color: var(--n-color-target);
  background: rgba(24, 160, 88, 0.05);
}

.device-item.active {
  border-color: var(--n-color-target);
  background: rgba(24, 160, 88, 0.08);
}

.device-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.device-subtitle {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}
</style>
