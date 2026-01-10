<script setup lang="tsx">
import { computed, h, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NDropdown,
  NForm,
  NFormItem,
  NInput,
  NIcon,
  NModal,
  NSelect,
  NSpace,
  NTag,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { useTable } from '@/hooks/common/table'
import { useRouterPush } from '@/hooks/common/router'
import { commandDataById } from '@/service/api/device'
import ParamsModal from '@/views/bms/battery/modules/params-modal.vue'
import BatteryImportModal from '@/views/bms/battery/modules/battery-import-modal.vue'
import BatterySingleModal from '@/views/bms/battery/modules/battery-single-modal.vue'
import {
  getBatteryList,
  getBatteryModelList,
  getDealerList,
  exportBatteryList,
  createSingleBattery,
  batchAssignDealer,
  assignBatteryTags,
  getBatteryTagList,
  createOfflineCommand,
  batchSendBatteryCommand,
  batchPushOta,
  getOtaUpgradePackageList,
  getOtaTaskDetailByPage
} from '@/service/api/bms'
import {
  ChevronDownOutline,
  CloudUploadOutline,
  EllipsisHorizontal,
  EyeOutline,
  FlashOutline,
  ListOutline,
  SettingsOutline
} from '@vicons/ionicons5'

interface BatteryItem {
  device_id: string
  device_number: string
  device_name?: string | null
  battery_model_id?: string | null
  battery_model_name?: string | null
  item_uuid?: string | null
  batch_number?: string | null
  ble_mac?: string | null
  comm_chip_id?: string | null
  production_date?: string | null
  warranty_expire_date?: string | null
  dealer_id?: string | null
  dealer_name?: string | null
  user_id?: string | null
  user_name?: string | null
  user_phone?: string | null
  activation_date?: string | null
  activation_status?: string | null
  is_online: number
  soc?: number | null
  soh?: number | null
  current_version?: string | null
  transfer_status?: string | null
}

interface ListResp<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

const { routerPushByKey } = useRouterPush()
const message = useMessage()

const dealerOptions = ref<Array<{ label: string; value: string }>>([])
const modelOptions = ref<Array<{ label: string; value: string }>>([])

// 批量选择
const selectedRowKeys = ref<string[]>([])
const showBatchAssignModal = ref(false)
const batchAssignForm = ref({
  dealer_id: null as string | null
})
const batchAssignLoading = ref(false)

// 导入 / 添加单个电池
const showImportModal = ref(false)
const showSingleModal = ref(false)

// 批量设置标签
const showBatchTagModal = ref(false)
const batchTagLoading = ref(false)
const tagOptions = ref<Array<{ label: string; value: string }>>([])
const batchTagForm = ref({
  tag_ids: [] as string[],
  mode: 'REPLACE' as 'REPLACE' | 'APPEND'
})

// 单设备：离线指令
type CmdOption = { label: string; value: string; params?: string; description?: string }
const showOfflineCmdModal = ref(false)
const offlineCmdLoading = ref(false)
const offlineCmdOptions = ref<CmdOption[]>([])
const offlineCmdForm = ref({
  device_id: '',
  identify: '' as string,
  command_type: '' as string,
  value: '' as string
})
const offlineCmdHint = ref<string>('')

// 参数远程查看/修改
const showParamsModal = ref(false)
const currentParamDeviceId = ref('')
const currentParamDeviceNumber = ref('')

// 批量下发指令（在线）
const showBatchCmdModal = ref(false)
const batchCmdLoading = ref(false)
const batchCmdOptions = ref<CmdOption[]>([])
const batchCmdForm = ref({
  identify: '' as string,
  command_type: '' as string,
  value: '' as string
})
const batchCmdHint = ref<string>('')

// 批量 OTA 推送
type OtaPkgOption = {
  label: string
  value: string
  version?: string
  target_version?: string | null
  device_config_id?: string
  device_config_name?: string
}
const showBatchOtaModal = ref(false)
const batchOtaLoading = ref(false)
const otaPkgOptions = ref<OtaPkgOption[]>([])
const batchOtaForm = ref({
  ota_upgrade_package_id: '' as string,
  name: '' as string
})
const lastOtaTaskId = ref<string>('')

// OTA 任务详情
const showOtaTaskDetailModal = ref(false)
const otaTaskDetailLoading = ref(false)
const otaTaskDetailList = ref<any[]>([])
const otaTaskDetailStats = ref<any[]>([])

function openOtaTaskDetail(taskId: string) {
  lastOtaTaskId.value = taskId
  showOtaTaskDetailModal.value = true
  fetchOtaTaskDetail()
}

async function fetchOtaTaskDetail() {
  if (!lastOtaTaskId.value) return
  otaTaskDetailLoading.value = true
  try {
    const res: any = await getOtaTaskDetailByPage({
      page: 1,
      page_size: 200,
      ota_upgrade_task_id: lastOtaTaskId.value
    })
    otaTaskDetailList.value = res?.data?.list || []
    otaTaskDetailStats.value = res?.data?.statistics || []
  } catch (e: any) {
    message.error(e?.message || '获取OTA任务详情失败')
    otaTaskDetailList.value = []
    otaTaskDetailStats.value = []
  } finally {
    otaTaskDetailLoading.value = false
  }
}

const onlineOptions = [
  { label: '在线', value: 1 },
  { label: '离线', value: 0 }
]

const activationOptions = [
  { label: '已激活', value: 'ACTIVE' },
  { label: '未激活', value: 'INACTIVE' }
]

const warrantyOptions = [
  { label: '在保', value: 'IN' },
  { label: '过保', value: 'OVER' }
]

function onlineTagType(isOnline: number) {
  return isOnline === 1 ? 'success' : 'default'
}

function activationTagType(status?: string | null) {
  if (status === 'ACTIVE') return 'success'
  return 'warning'
}

function activationLabel(status?: string | null) {
  if (status === 'ACTIVE') return '已激活'
  if (status === 'INACTIVE') return '未激活'
  return '--'
}

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

function filterMenuOptions(options: any[]): any[] {
  return options
    .filter(o => !o.permissionKey || true)
    .map(o => {
      if (o.children?.length) return { ...o, children: filterMenuOptions(o.children) }
      return o
    })
}

function getActionOptions(_row: BatteryItem) {
  return filterMenuOptions([
    {
      label: '查看详情',
      key: 'detail',
      icon: renderIcon(EyeOutline),
      permissionKey: 'battery.detail'
    },
    {
      label: '参数',
      key: 'params',
      icon: renderIcon(SettingsOutline),
      permissionKey: 'battery.params'
    },
    {
      label: '离线指令',
      key: 'offline',
      icon: renderIcon(FlashOutline),
      permissionKey: 'battery.offline_command'
    },
    {
      type: 'divider',
      key: 'divider-1'
    },
    {
      label: '生命周期（预留）',
      key: 'lifecycle',
      icon: renderIcon(ListOutline),
      children: [
        {
          label: '出厂',
          key: 'lifecycle.factory',
          disabled: true,
          icon: renderIcon(CloudUploadOutline),
          permissionKey: 'battery.lifecycle.factory'
        },
        {
          label: '激活',
          key: 'lifecycle.activate',
          disabled: true,
          icon: renderIcon(ChevronDownOutline),
          permissionKey: 'battery.lifecycle.activate'
        },
        {
          label: '调拨',
          key: 'lifecycle.transfer',
          disabled: true,
          icon: renderIcon(CloudUploadOutline),
          permissionKey: 'battery.lifecycle.transfer'
        }
      ]
    }
  ])
}

function handleActionSelect(key: string, row: BatteryItem) {
  if (key === 'detail') goDeviceDetail(row)
  if (key === 'params') openParams(row)
  if (key === 'offline') openOfflineCmd(row)
}

const searchForm = ref<{
  device_number: string
  battery_model_id: string | null
  dealer_id: string | null
  is_online: number | null
  activation_status: string | null
  production_range: [number, number] | null
  warranty_status: string | null
}>({
  device_number: '',
  battery_model_id: null,
  dealer_id: null,
  is_online: null,
  activation_status: null,
  production_range: null,
  warranty_status: null
})

const createColumns = (): DataTableColumns<BatteryItem> => [
  {
    type: 'selection',
    multiple: true
  },
  { key: 'device_number', title: '序列号', minWidth: 150 },
  { key: 'batch_number', title: '批号', minWidth: 140, render: row => row.batch_number || '--' },
  { key: 'battery_model_name', title: '型号', minWidth: 140, render: row => row.battery_model_name || '--' },
  { key: 'ble_mac', title: '蓝牙Mac', minWidth: 160, render: row => row.ble_mac || '--' },
  { key: 'comm_chip_id', title: '4G卡ID', minWidth: 160, render: row => row.comm_chip_id || '--' },
  { key: 'production_date', title: '出厂日期', minWidth: 120, render: row => row.production_date || '--' },
  {
    key: 'dealer_name',
    title: '经销商',
    minWidth: 140,
    render: row => row.dealer_name || <NTag type="info">厂家</NTag>
  },
  { key: 'user_phone', title: '终端用户', minWidth: 140, render: row => row.user_phone || '--' },
  {
    key: 'activation_status',
    title: '激活状态',
    minWidth: 110,
    render: row => <NTag type={activationTagType(row.activation_status)}>{activationLabel(row.activation_status)}</NTag>
  },
  { key: 'activation_date', title: '激活时间', minWidth: 160, render: row => row.activation_date || '--' },
  {
    key: 'is_online',
    title: '在线状态',
    minWidth: 110,
    render: row => <NTag type={onlineTagType(row.is_online)}>{row.is_online === 1 ? '在线' : '离线'}</NTag>
  },
  { key: 'soc', title: 'SOC(%)', minWidth: 100, render: row => row.soc ?? '--' },
  { key: 'soh', title: 'SOH(%)', minWidth: 100, render: row => row.soh ?? '--' },
  { key: 'warranty_expire_date', title: '质保到期', minWidth: 120, render: row => row.warranty_expire_date || '--' },
  { key: 'current_version', title: '固件版本', minWidth: 120, render: row => row.current_version || '--' },
  {
    key: 'actions',
    title: '操作',
    minWidth: 140,
    fixed: 'right',
    render: row => (
      <NDropdown
        options={getActionOptions(row) as any}
        trigger="click"
        onSelect={(key: string) => handleActionSelect(key, row)}
      >
        <NButton size="small" quaternary>
          {{
            default: () => '操作',
            icon: () => (
              <NIcon>
                <EllipsisHorizontal />
              </NIcon>
            )
          }}
        </NButton>
      </NDropdown>
    )
  }
]

const { data, loading, columns, pagination, getData, updateSearchParams } = useTable<
  BatteryItem,
  typeof getBatteryList
>({
  apiFn: getBatteryList,
  apiParams: {
    page: 1,
    page_size: 10
  },
  transformer: (res: any) => {
    const payload: ListResp<BatteryItem> | undefined = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): any => createColumns()
})

// 导出
async function handleExport() {
  try {
    const [start, end] = searchForm.value.production_range || []
    const params: any = {
      device_number: searchForm.value.device_number || undefined,
      battery_model_id: searchForm.value.battery_model_id || undefined,
      dealer_id: searchForm.value.dealer_id || undefined,
      is_online: searchForm.value.is_online ?? undefined,
      activation_status: searchForm.value.activation_status || undefined,
      warranty_status: searchForm.value.warranty_status || undefined,
      production_date_start: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
      production_date_end: end ? dayjs(end).format('YYYY-MM-DD') : undefined
    }

    const response = await exportBatteryList(params)
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `电池列表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (error: any) {
    message.error(error?.message || '导出失败')
  }
}

function openImportModal() {
  showImportModal.value = true
}

function openSingleModal() {
  showSingleModal.value = true
}

async function handleSingleSubmit(form: any) {
  try {
    const payload = {
      item_uuid: String(form.item_uuid || '').trim(),
      batch_number: String(form.batch_number || '').trim(),
      battery_model_id: form.battery_model_id || undefined,
      ble_mac: String(form.ble_mac || '').trim() || undefined,
      comm_chip_id: String(form.comm_chip_id || '').trim() || undefined,
      production_date: form.production_date ? dayjs(form.production_date).format('YYYY-MM-DD') : undefined,
      warranty_expire_date: form.warranty_expire_date
        ? dayjs(form.warranty_expire_date).format('YYYY-MM-DD')
        : undefined,
      remark: String(form.remark || '').trim() || undefined
    }
    await createSingleBattery(payload)
    message.success('添加成功')
    showSingleModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || '添加失败')
  }
}

// 批量分配经销商
function handleBatchAssign() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要分配的电池')
    return
  }
  showBatchAssignModal.value = true
}

async function handleBatchTag() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要设置标签的电池')
    return
  }
  // lazy load tags
  if (tagOptions.value.length === 0) {
    try {
      const res: any = await getBatteryTagList({ page: 1, page_size: 1000 })
      const list = (res?.data?.list || []) as Array<{ id: string; name: string }>
      tagOptions.value = list.map(i => ({ label: i.name, value: i.id }))
    } catch {
      tagOptions.value = []
    }
  }
  showBatchTagModal.value = true
}

async function handleBatchCommand() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要下发指令的电池')
    return
  }
  showBatchCmdModal.value = true
  batchCmdLoading.value = true
  batchCmdForm.value = { identify: '', command_type: '', value: '' }
  batchCmdHint.value = ''
  try {
    const firstDeviceID = selectedRowKeys.value[0]
    const res: any = await commandDataById(firstDeviceID)
    const list = (res?.data || []) as Array<{
      data_name: string
      data_identifier: string
      params: string
      description: string
    }>
    batchCmdOptions.value = list.map(i => ({
      label: i.data_name,
      value: i.data_identifier,
      params: i.params,
      description: i.description
    }))
  } catch {
    batchCmdOptions.value = []
  } finally {
    batchCmdLoading.value = false
  }
}

async function handleBatchOta() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要推送OTA的电池')
    return
  }
  showBatchOtaModal.value = true
  batchOtaLoading.value = true
  batchOtaForm.value = { ota_upgrade_package_id: '', name: '' }
  lastOtaTaskId.value = ''
  try {
    const res: any = await getOtaUpgradePackageList({ page: 1, page_size: 1000 })
    const list = (res?.data?.list || []) as any[]
    otaPkgOptions.value = list.map(i => ({
      label: `${i.name} / ${i.version}${i.target_version ? ` → ${i.target_version}` : ''}${i.device_config_name ? `（${i.device_config_name}）` : ''}`,
      value: i.id,
      version: i.version,
      target_version: i.target_version,
      device_config_id: i.device_config_id,
      device_config_name: i.device_config_name
    }))
  } catch {
    otaPkgOptions.value = []
  } finally {
    batchOtaLoading.value = false
  }
}

async function confirmBatchOta() {
  if (!batchOtaForm.value.ota_upgrade_package_id) {
    message.warning('请选择升级包')
    return
  }
  batchOtaLoading.value = true
  try {
    const res: any = await batchPushOta({
      device_ids: selectedRowKeys.value,
      ota_upgrade_package_id: batchOtaForm.value.ota_upgrade_package_id,
      name: batchOtaForm.value.name?.trim() ? batchOtaForm.value.name.trim() : undefined
    })
    const r = res?.data
    if (r) {
      lastOtaTaskId.value = r.task_id || ''
      const msg = `已创建OTA任务${r.task_id ? `（${r.task_id}）` : ''}：总计 ${r.total} 台，受理 ${r.accepted} 台，拒绝 ${r.rejected} 台`
      if (r.rejected > 0 && r.failures?.length) {
        const failures = r.failures.map((f: any) => `${f.device_number || f.device_id}：${f.message}`).join('\n')
        message.warning(msg + '\n拒绝明细：\n' + failures, { duration: 10000 })
      } else {
        message.success(msg)
      }
    } else {
      message.success('批量OTA推送已提交')
    }
    showBatchOtaModal.value = false
    // 不清空选择，方便继续操作；但多数情况下推送后清空更合理
    selectedRowKeys.value = []
    if (lastOtaTaskId.value) {
      openOtaTaskDetail(lastOtaTaskId.value)
    }
  } catch (e: any) {
    message.error(e?.message || '批量OTA推送失败')
  } finally {
    batchOtaLoading.value = false
  }
}

function handleBatchCmdSelect(v: string) {
  batchCmdForm.value.identify = v
  const opt = batchCmdOptions.value.find(i => i.value === v)
  batchCmdForm.value.command_type = opt?.label || v
  batchCmdHint.value = opt?.params || opt?.description || ''
}

async function confirmBatchCommand() {
  if (!batchCmdForm.value.identify) {
    message.warning('请选择指令')
    return
  }
  batchCmdLoading.value = true
  try {
    const res: any = await batchSendBatteryCommand({
      device_ids: selectedRowKeys.value,
      command_type: batchCmdForm.value.command_type || batchCmdForm.value.identify,
      identify: batchCmdForm.value.identify,
      value: batchCmdForm.value.value?.trim() ? batchCmdForm.value.value.trim() : undefined
    })
    const r = res?.data
    if (r) {
      const msg = `下发完成：总计 ${r.total} 台，成功 ${r.success} 台，失败 ${r.failed} 台`
      if (r.failed > 0 && r.failures?.length) {
        const failures = r.failures.map((f: any) => `${f.device_number || f.device_id}：${f.message}`).join('\n')
        message.warning(msg + '\n失败明细：\n' + failures, { duration: 10000 })
      } else {
        message.success(msg)
      }
    } else {
      message.success('批量下发成功')
    }
    showBatchCmdModal.value = false
    selectedRowKeys.value = []
  } catch (e: any) {
    message.error(e?.message || '批量下发失败')
  } finally {
    batchCmdLoading.value = false
  }
}

async function confirmBatchAssign() {
  if (!batchAssignForm.value.dealer_id) {
    message.warning('请选择经销商')
    return
  }

  batchAssignLoading.value = true
  try {
    await batchAssignDealer({
      device_ids: selectedRowKeys.value,
      dealer_id: batchAssignForm.value.dealer_id
    })
    message.success('批量分配成功')
    showBatchAssignModal.value = false
    selectedRowKeys.value = []
    batchAssignForm.value.dealer_id = null
    getData()
  } catch (error: any) {
    message.error(error?.message || '批量分配失败')
  } finally {
    batchAssignLoading.value = false
  }
}

async function confirmBatchTag() {
  batchTagLoading.value = true
  try {
    await assignBatteryTags({
      device_ids: selectedRowKeys.value,
      tag_ids: batchTagForm.value.tag_ids,
      mode: batchTagForm.value.mode
    })
    message.success('标签设置成功')
    showBatchTagModal.value = false
    selectedRowKeys.value = []
    batchTagForm.value.tag_ids = []
    batchTagForm.value.mode = 'REPLACE'
    getData()
  } catch (error: any) {
    message.error(error?.message || '标签设置失败')
  } finally {
    batchTagLoading.value = false
  }
}

async function openOfflineCmd(row: BatteryItem) {
  showOfflineCmdModal.value = true
  offlineCmdLoading.value = true
  offlineCmdForm.value = {
    device_id: row.device_id,
    identify: '',
    command_type: '',
    value: ''
  }
  offlineCmdHint.value = ''

  try {
    const res: any = await commandDataById(row.device_id)
    const list = (res?.data || []) as Array<{
      data_name: string
      data_identifier: string
      params: string
      description: string
    }>
    offlineCmdOptions.value = list.map(i => ({
      label: i.data_name,
      value: i.data_identifier,
      params: i.params,
      description: i.description
    }))
  } catch {
    offlineCmdOptions.value = []
  } finally {
    offlineCmdLoading.value = false
  }
}

function handleOfflineCmdSelect(v: string) {
  offlineCmdForm.value.identify = v
  const opt = offlineCmdOptions.value.find(i => i.value === v)
  offlineCmdForm.value.command_type = opt?.label || v
  offlineCmdHint.value = opt?.params || opt?.description || ''
}

async function confirmOfflineCmd() {
  if (!offlineCmdForm.value.device_id) return
  if (!offlineCmdForm.value.identify) {
    message.warning('请选择指令')
    return
  }
  offlineCmdLoading.value = true
  try {
    await createOfflineCommand({
      device_id: offlineCmdForm.value.device_id,
      command_type: offlineCmdForm.value.command_type || offlineCmdForm.value.identify,
      identify: offlineCmdForm.value.identify,
      value: offlineCmdForm.value.value?.trim() ? offlineCmdForm.value.value.trim() : undefined
    })
    message.success('离线指令已存储（设备上线后自动执行）')
    showOfflineCmdModal.value = false
  } catch (e: any) {
    message.error(e?.message || '存储失败')
  } finally {
    offlineCmdLoading.value = false
  }
}

function handleSearch() {
  const [start, end] = searchForm.value.production_range || []

  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    device_number: searchForm.value.device_number || undefined,
    battery_model_id: searchForm.value.battery_model_id || undefined,
    dealer_id: searchForm.value.dealer_id || undefined,
    is_online: searchForm.value.is_online ?? undefined,
    activation_status: searchForm.value.activation_status || undefined,
    warranty_status: searchForm.value.warranty_status || undefined,
    production_date_start: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
    production_date_end: end ? dayjs(end).format('YYYY-MM-DD') : undefined
  })
  getData()
}

function handleReset() {
  searchForm.value = {
    device_number: '',
    battery_model_id: null,
    dealer_id: null,
    is_online: null,
    activation_status: null,
    production_range: null,
    warranty_status: null
  }
  handleSearch()
}

function goDeviceDetail(row: BatteryItem) {
  routerPushByKey('device_details', {
    query: {
      d_id: row.device_id
    }
  })
}

function openParams(row: BatteryItem) {
  currentParamDeviceId.value = row.device_id
  currentParamDeviceNumber.value = row.device_number
  showParamsModal.value = true
}

async function initSelectOptions() {
  try {
    const dealerRes: any = await getDealerList({ page: 1, page_size: 1000 })
    const list = (dealerRes?.data?.list || []) as Array<{ id: string; name: string }>
    dealerOptions.value = list.map(i => ({ label: i.name, value: i.id }))
  } catch {
    dealerOptions.value = []
  }

  try {
    const modelRes: any = await getBatteryModelList({ page: 1, page_size: 1000 })
    const list = (modelRes?.data?.list || []) as Array<{ id: string; name: string }>
    modelOptions.value = list.map(i => ({ label: i.name, value: i.id }))
  } catch {
    modelOptions.value = []
  }
}

const scrollX = computed(() => 1800)

onMounted(() => {
  initSelectOptions()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="电池列表" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem label="序列号" path="device_number">
          <NInput v-model:value="searchForm.device_number" placeholder="请输入序列号" style="width: 220px" clearable />
        </NFormItem>

        <NFormItem label="电池型号" path="battery_model_id">
          <NSelect
            v-model:value="searchForm.battery_model_id"
            :options="modelOptions"
            placeholder="请选择型号"
            clearable
            style="width: 220px"
          />
        </NFormItem>

        <NFormItem label="经销商" path="dealer_id">
          <NSelect
            v-model:value="searchForm.dealer_id"
            :options="dealerOptions"
            placeholder="请选择经销商"
            clearable
            style="width: 220px"
          />
        </NFormItem>

        <NFormItem label="在线状态" path="is_online">
          <NSelect
            v-model:value="searchForm.is_online"
            :options="onlineOptions"
            placeholder="请选择"
            clearable
            style="width: 160px"
          />
        </NFormItem>

        <NFormItem label="激活状态" path="activation_status">
          <NSelect
            v-model:value="searchForm.activation_status"
            :options="activationOptions"
            placeholder="请选择"
            clearable
            style="width: 160px"
          />
        </NFormItem>

        <NFormItem label="出厂日期" path="production_range">
          <NDatePicker v-model:value="searchForm.production_range" type="daterange" clearable style="width: 260px" />
        </NFormItem>

        <NFormItem label="质保状态" path="warranty_status">
          <NSelect
            v-model:value="searchForm.warranty_status"
            :options="warrantyOptions"
            placeholder="请选择"
            clearable
            style="width: 160px"
          />
        </NFormItem>

        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NSpace class="mb-4" justify="space-between">
        <NSpace>
          <NButton type="primary" @click="handleExport">导出</NButton>
          <NButton type="primary" @click="openSingleModal">+ 添加电池</NButton>
          <NButton @click="openImportModal">导入</NButton>
          <NButton v-if="selectedRowKeys.length > 0" type="warning" @click="handleBatchAssign">
            批量分配经销商({{ selectedRowKeys.length }})
          </NButton>
          <NButton v-if="selectedRowKeys.length > 0" type="info" @click="handleBatchTag">
            批量设置标签({{ selectedRowKeys.length }})
          </NButton>
          <NButton v-if="selectedRowKeys.length > 0" type="primary" @click="handleBatchCommand">
            批量下发指令({{ selectedRowKeys.length }})
          </NButton>
          <NButton v-if="selectedRowKeys.length > 0" type="success" @click="handleBatchOta">
            批量OTA推送({{ selectedRowKeys.length }})
          </NButton>
        </NSpace>
      </NSpace>

      <NDataTable
        v-model:checked-row-keys="selectedRowKeys"
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.device_id"
        :scroll-x="scrollX"
      />
    </NCard>

    <NModal
      v-model:show="showBatchAssignModal"
      preset="dialog"
      title="批量分配经销商"
      positive-text="确认"
      negative-text="取消"
      :loading="batchAssignLoading"
      @positive-click="confirmBatchAssign"
    >
      <NForm :model="batchAssignForm" label-placement="left" label-width="100px">
        <NFormItem label="经销商" path="dealer_id" required>
          <NSelect
            v-model:value="batchAssignForm.dealer_id"
            :options="dealerOptions"
            placeholder="请选择经销商"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            已选择 {{ selectedRowKeys.length }} 个电池，将分配给选中的经销商
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showBatchTagModal"
      preset="dialog"
      title="批量设置标签"
      positive-text="确认"
      negative-text="取消"
      :loading="batchTagLoading"
      @positive-click="confirmBatchTag"
    >
      <NForm :model="batchTagForm" label-placement="left" label-width="100px">
        <NFormItem label="设置方式" path="mode" required>
          <NSelect
            v-model:value="batchTagForm.mode"
            :options="[
              { label: '覆盖（替换原标签）', value: 'REPLACE' },
              { label: '追加（保留原标签）', value: 'APPEND' }
            ]"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="标签" path="tag_ids">
          <NSelect
            v-model:value="batchTagForm.tag_ids"
            :options="tagOptions"
            placeholder="请选择标签（可多选；留空表示清空标签）"
            multiple
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">已选择 {{ selectedRowKeys.length }} 个电池</div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showOfflineCmdModal"
      preset="dialog"
      title="离线指令（设备离线时存储，上线后执行）"
      positive-text="确认存储"
      negative-text="取消"
      :loading="offlineCmdLoading"
      @positive-click="confirmOfflineCmd"
    >
      <NForm :model="offlineCmdForm" label-placement="left" label-width="100px">
        <NFormItem label="指令" path="identify" required>
          <NSelect
            v-model:value="offlineCmdForm.identify"
            :options="offlineCmdOptions"
            placeholder="请选择指令"
            clearable
            style="width: 100%"
            @update:value="handleOfflineCmdSelect"
          />
        </NFormItem>
        <NFormItem v-if="offlineCmdHint" label="参数说明">
          <div style="color: #999; font-size: 12px; white-space: pre-wrap">{{ offlineCmdHint }}</div>
        </NFormItem>
        <NFormItem label="参数(JSON)" path="value">
          <NInput
            v-model:value="offlineCmdForm.value"
            type="textarea"
            :placeholder="'可选：JSON 字符串，例如：{} 或 {&quot;mode&quot;:1}'"
            :autosize="{ minRows: 3, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            提示：离线指令仅用于设备离线时存储；上线后会自动执行并在“离线指令”页面查看结果。
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showBatchCmdModal"
      preset="dialog"
      title="批量下发指令（仅在线设备）"
      positive-text="确认下发"
      negative-text="取消"
      :loading="batchCmdLoading"
      @positive-click="confirmBatchCommand"
    >
      <NForm :model="batchCmdForm" label-placement="left" label-width="100px">
        <NFormItem label="指令" path="identify" required>
          <NSelect
            v-model:value="batchCmdForm.identify"
            :options="batchCmdOptions"
            placeholder="请选择指令（基于第一个设备加载物模型命令）"
            clearable
            style="width: 100%"
            @update:value="handleBatchCmdSelect"
          />
        </NFormItem>
        <NFormItem v-if="batchCmdHint" label="参数说明">
          <div style="color: #999; font-size: 12px; white-space: pre-wrap">{{ batchCmdHint }}</div>
        </NFormItem>
        <NFormItem label="参数(JSON)" path="value">
          <NInput
            v-model:value="batchCmdForm.value"
            type="textarea"
            :placeholder="'可选：JSON 字符串，例如：{} 或 {&quot;mode&quot;:1}'"
            :autosize="{ minRows: 3, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            提示：离线设备会被跳过并返回失败原因；如需离线执行请使用“离线指令”。
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showBatchOtaModal"
      preset="dialog"
      title="批量OTA推送"
      positive-text="确认推送"
      negative-text="取消"
      :loading="batchOtaLoading"
      @positive-click="confirmBatchOta"
    >
      <NForm :model="batchOtaForm" label-placement="left" label-width="100px">
        <NFormItem label="升级包" path="ota_upgrade_package_id" required>
          <NSelect
            v-model:value="batchOtaForm.ota_upgrade_package_id"
            :options="otaPkgOptions"
            placeholder="请选择升级包"
            clearable
            filterable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="任务名称">
          <NInput v-model:value="batchOtaForm.name" placeholder="可选：不填则自动生成" />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            提示：系统会为每台设备创建升级任务详情并立即推送；离线/升级中设备会在任务详情中显示失败原因。
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal v-model:show="showOtaTaskDetailModal" preset="card" title="OTA任务详情" style="width: 980px">
      <template v-if="otaTaskDetailLoading">
        <div style="padding: 12px">加载中...</div>
      </template>
      <template v-else>
        <div style="margin-bottom: 12px; color: #666; font-size: 12px">
          任务ID：{{ lastOtaTaskId }}
          <NButton size="tiny" style="margin-left: 8px" @click="fetchOtaTaskDetail">刷新</NButton>
        </div>
        <div v-if="otaTaskDetailStats?.length" style="margin-bottom: 12px">
          <span
            v-for="s in otaTaskDetailStats"
            :key="s.status"
            style="margin-right: 12px; color: #666; font-size: 12px"
          >
            状态{{ s.status }}：{{ s.count }}
          </span>
        </div>
        <NDataTable
          :columns="[
            { key: 'device_number', title: '序列号', minWidth: 140 },
            { key: 'name', title: '设备名称', minWidth: 140 },
            { key: 'current_version', title: '当前版本', minWidth: 120 },
            { key: 'version', title: '目标版本', minWidth: 120 },
            { key: 'status', title: '状态', minWidth: 100 },
            { key: 'status_description', title: '状态描述', minWidth: 180 },
            { key: 'updated_at', title: '更新时间', minWidth: 160 }
          ]"
          :data="otaTaskDetailList"
          :row-key="row => row.id"
          :scroll-x="920"
        />
      </template>
    </NModal>

    <ParamsModal
      v-model:show="showParamsModal"
      :device-id="currentParamDeviceId"
      :device-number="currentParamDeviceNumber"
    />

    <BatteryImportModal v-model:visible="showImportModal" @finished="getData" />

    <BatterySingleModal v-model:visible="showSingleModal" :model-options="modelOptions" @submit="handleSingleSubmit" />
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
