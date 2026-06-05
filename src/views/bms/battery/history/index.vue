<script setup lang="ts">
import { bt } from '@/views/bms/_shared/i18n'
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
  cycleCount: bt('auto.s_2dbd74ad4f'),
  faultCount: bt('auto.s_0331c1fd79'),
  charging: bt('auto.s_18ad5763ed'),
  discharging: bt('auto.s_4aabfe04bc'),
  chargeFetOn: bt('auto.s_bf89014857'),
  dischargeFetOn: bt('auto.s_83f24734d9'),
  chargeMosC: bt('auto.s_2791571ac5'),
  dischargeMosC: bt('auto.s_4df18c6903'),
  highestCellVoltageMv: bt('auto.s_d3cc94d1fd'),
  lowestCellVoltageMv: bt('auto.s_cb65bc97ee'),
  avgCellVoltageMv: bt('auto.s_e08ac67141'),
  totalVoltageMv: bt('auto.s_ace4c80be1'),
  totalCurrentMa: bt('auto.s_8873466bd6'),
  remainCapacityMah: bt('auto.s_0fc03fb8c4'),
  nominalCapacityMah: bt('auto.s_3199571031'),
  soc: 'SOC(%)',
  soh: 'SOH(%)'
}

const wideIdentifierTokenMap: Record<string, string> = {
  highest: bt('auto.s_9b53e2a02d'),
  lowest: bt('auto.s_1c73433cc8'),
  avg: bt('auto.s_33875c8660'),
  average: bt('auto.s_33875c8660'),
  max: bt('auto.s_f98b9af13a'),
  min: bt('auto.s_5e02aac448'),
  cell: bt('auto.s_97ae793259'),
  total: bt('auto.s_a246f63060'),
  remain: bt('auto.s_43b510edc7'),
  remaining: bt('auto.s_43b510edc7'),
  nominal: bt('auto.s_c66c1538c6'),
  voltage: bt('auto.s_b42583eaa2'),
  current: bt('auto.s_5ecd057a1c'),
  capacity: bt('auto.s_fe7d74278a'),
  count: bt('auto.s_0bf60b32f9'),
  status: bt('auto.s_3fea7ca76c'),
  fault: bt('auto.s_4af58f243b'),
  charge: bt('auto.s_2cd11ef34e'),
  discharge: bt('auto.s_418102ac77'),
  charging: bt('auto.s_2cd11ef34e'),
  discharging: bt('auto.s_418102ac77'),
  mos: 'MOS',
  fet: 'MOS',
  temp: bt('auto.s_c9bf0b889a'),
  temperature: bt('auto.s_c9bf0b889a'),
  cycle: bt('auto.s_69bdc66bb8'),
  balance: bt('auto.s_f07d8f755e'),
  protection: bt('auto.s_c6b95eef2e'),
  alarm: bt('auto.s_aa0eab9dba'),
  state: bt('auto.s_3fea7ca76c'),
  power: bt('auto.s_93b57ce379'),
  energy: bt('auto.s_ba7bd2a730'),
  percentage: bt('auto.s_81522afdfe')
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
    title: bt('auto.s_19fcb9eb25'),
    key: 'time',
    width: 180,
    fixed: viewMode.value === 'wide' ? 'left' : undefined,
    render: (row: Record<string, any>) => row.time || dayjs(Number(row.ts || 0)).format('YYYY-MM-DD HH:mm:ss')
  }

  if (viewMode.value === 'long') {
    return [
      timeColumn,
      {
        title: bt('auto.s_185f7bf647'),
        key: 'data_type',
        width: 100,
        render: (row: Record<string, any>) =>
          row.data_type === 'attribute'
            ? h(NTag, { type: 'warning', size: 'small' }, () => 'attribute')
            : h(NTag, { type: 'info', size: 'small' }, () => 'telemetry')
      },
      { title: bt('auto.s_f3c00c7e55'), key: 'identifier', width: 180 },
      { title: bt('auto.s_5a1419b7a2'), key: 'data_name', width: 180, ellipsis: { tooltip: true } },
      { title: bt('auto.s_fe7509e0ed'), key: 'value', minWidth: 200, ellipsis: { tooltip: true } }
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

const tableScrollX = computed(() => {
  if (viewMode.value !== 'wide') return undefined
  const dynamicWidth = wideColumns.value.length * 160
  return 180 + dynamicWidth
})

function mapCommType(type?: number) {
  if (type === 1) return bt('auto.s_0a4e486218')
  if (type === 2) return '4G'
  if (type === 3) return bt('auto.s_59b8ad21d6')
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
    message.error(error?.message || bt('auto.s_6aa80d09ea'))
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
    message.warning(bt('auto.s_6cae0d1345'))
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
    message.error(error?.message || bt('auto.s_5d3d1c8f69'))
  } finally {
    historyLoading.value = false
    await nextTick()
    recalcTableHeight()
  }
}

async function handleDateRangeChange(value: [number, number] | null) {
  dateRange.value = value
  if (!isDateRangeValid(value)) {
    message.warning(bt('auto.s_6bd57aa2d0'))
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
    message.warning(bt('auto.s_7b0db2a0de'))
    return
  }
  if (!isDateRangeValid(dateRange.value) || !dateRange.value) {
    message.warning(bt('auto.s_69ef79e700'))
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
    message.success(bt('auto.s_c57ea55af2'))
  } catch (error: any) {
    message.error(error?.message || bt('auto.s_bde8ed56dd'))
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
        <NCard :title="bt('auto.s_9005a51540')" size="small" :bordered="true" class="h-full device-filter-card">
          <NInput
            :value="deviceKeyword"
            :placeholder="bt('auto.s_cc07b0e567')"
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
                  <div class="device-subtitle">{{ bt('pages.history.communication', { value: mapCommType(item.bms_comm_type) }) }}</div>
                </div>
                <NEmpty v-if="!deviceLoading && deviceList.length === 0" :description="bt('auto.s_bcc241e075')" class="mt-20px" />
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
        <NCard class="h-full history-query-card" :title="bt('auto.s_36b9e682ef')">
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
                  <NRadioButton value="long">{{ bt('auto.s_ad02f7e9d6') }}</NRadioButton>
                  <NRadioButton value="wide">{{ bt('auto.s_f921f12d83') }}</NRadioButton>
                </NRadioGroup>
                <NButton type="primary" :disabled="!canExport || !selectedDeviceId" @click="handleExport">{{ bt('auto.s_55405ea6ff') }}</NButton>
              </NSpace>
            </div>

            <div v-if="!selectedDeviceId" ref="historyAlertRef" class="mb-12px">
              <NAlert type="info">{{ bt('auto.s_1f4dd546ca') }}</NAlert>
            </div>

            <div ref="historyTableWrapRef" class="history-table-wrap">
              <NDataTable
                :loading="historyLoading"
                :columns="tableColumns"
                :data="historyRows"
                size="small"
                :max-height="tableMaxHeight"
                :scroll-x="tableScrollX"
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
