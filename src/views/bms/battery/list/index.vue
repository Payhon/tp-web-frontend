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
  NPagination,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NTag,
  useDialog,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { useTable } from '@/hooks/common/table'
import { useRouterPush } from '@/hooks/common/router'
import { useAuthStore } from '@/store/modules/auth'
import { ensureUiPermissionState, hasUiPermission } from '@/utils/common/ui-permission'
import { commandDataById } from '@/service/api/device'
import ParamsModal from '@/views/bms/battery/modules/params-modal.vue'
import BatteryImportModal from '@/views/bms/battery/modules/battery-import-modal.vue'
import BatterySingleModal from '@/views/bms/battery/modules/battery-single-modal.vue'
import EndUserSelect from '@/components/EndUserSelect.vue'
import BatteryModelSelect from '@/components/bms/BatteryModelSelect.vue'
import {
  getBatteryList,
  getBatteryBmsModelList,
  getCellBrandList,
  getDealerList,
  exportBatteryList,
  createSingleBattery,
  deleteBattery,
  factoryOutBattery,
  transferBattery,
  activateBattery,
  completeBatteryInfo,
  getOrgScopeOptions,
  batchAssignDealer,
  assignBatteryTags,
  getBatteryTagList,
  createOfflineCommand,
  batchSendBatteryCommand,
  batchPushOta,
  getOtaUpgradePackageList,
  getOtaTaskDetailByPage,
  getAppBatteryDetail,
  updateSingleBattery
} from '@/service/api/bms'
import {
  CheckmarkCircleOutline,
  CreateOutline,
  CubeOutline,
  CloudDownloadOutline,
  CloudUploadOutline,
  DownloadOutline,
  EllipsisHorizontal,
  EyeOutline,
  FlashOutline,
  ListOutline,
  SwapHorizontalOutline,
  SettingsOutline,
  PricetagsOutline,
  StorefrontOutline,
  TrashOutline
} from '@vicons/ionicons5'

interface BatteryItem {
  [key: string]: any
  device_id: string
  device_number: string
  device_name?: string | null
  battery_model_id?: string | null
  battery_model_name?: string | null
  cell_brand_seq_no?: number | null
  cell_brand_name?: string | null
  battery_model_seq_no?: number | null
  pack_battery_model_name?: string | null
  item_uuid?: string | null
  batch_number?: string | null
  product_spec?: string | null
  ble_mac?: string | null
  comm_chip_id?: string | null
  production_date?: string | null
  warranty_expire_date?: string | null
  owner_org_id?: string | null
  owner_org_name?: string | null
  owner_org_type?: string | null
  pack_factory_org_id?: string | null
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
const dialog = useDialog()
const authStore = useAuthStore()

const dealerOptions = ref<Array<{ label: string; value: string }>>([])
const bmsModelOptions = ref<Array<{ label: string; value: string }>>([])
const cellBrandOptions = ref<Array<{ label: string; value: number }>>([])
const ownerOrgOptions = ref<Array<{ label: string; value: string }>>([])

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
const singleModalMode = ref<'add' | 'edit'>('add')
const singleEditData = ref<Record<string, any> | null>(null)

// 生命周期操作：出厂/调拨/激活
const showFactoryModal = ref(false)
const showTransferModal = ref(false)
const showActivateModal = ref(false)
const showCompleteInfoModal = ref(false)
const factoryLoading = ref(false)
const transferLoading = ref(false)
const activateLoading = ref(false)
const completeInfoLoading = ref(false)

const factoryForm = ref({
  device_id: '',
  device_number: '',
  to_org_type: 'PACK_FACTORY' as 'PACK_FACTORY' | 'DEALER',
  to_org_id: null as string | null,
  remark: ''
})
const transferForm = ref({
  device_id: '',
  device_number: '',
  from_org_name: '',
  from_org_type: '',
  to_org_type: 'DEALER' as 'PACK_FACTORY' | 'DEALER' | 'STORE',
  to_org_id: null as string | null,
  remark: ''
})
const activateForm = ref({
  device_id: '',
  device_number: '',
  user_id: null as string | null,
  remark: ''
})
const activateCurrent = ref({
  status: '' as string,
  user_phone: '' as string,
  user_name: '' as string,
  activation_date: '' as string
})
const completeInfoForm = ref({
  device_ids: [] as string[],
  cell_brand_seq_no: null as number | null,
  battery_model_seq_no: null as number | null
})
const completeInfoRows = ref<BatteryItem[]>([])

const packOrgOptions = ref<Array<{ label: string; value: string }>>([])
const dealerOrgOptions = ref<Array<{ label: string; value: string }>>([])
const storeOrgOptions = ref<Array<{ label: string; value: string }>>([])

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

function currentStatusLabel(row: BatteryItem) {
  const parts = [activationLabel(row.activation_status)]
  parts.push(row.is_online === 1 ? '在线' : '离线')
  return parts.join(' / ')
}

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

function filterMenuOptions(options: any[]): any[] {
  const filtered = options
    .filter(option => !option.permissionKey || hasUiPermission(option.permissionKey))
    .map(option => {
      if (option.children?.length) {
        const children = filterMenuOptions(option.children)
        if (!children.length) return null
        return { ...option, children }
      }
      return option
    })
    .filter(Boolean)

  return filtered.filter((item, index, arr) => {
    if (item?.type !== 'divider') return true
    if (index === 0 || index === arr.length - 1) return false
    return arr[index - 1]?.type !== 'divider' && arr[index + 1]?.type !== 'divider'
  })
}

function getActionOptions() {
  return filterMenuOptions([
    {
      label: '查看详情',
      key: 'detail',
      icon: renderIcon(EyeOutline),
      permissionKey: 'bms_battery_list_detail'
    },
    {
      label: '参数',
      key: 'params',
      icon: renderIcon(SettingsOutline),
      permissionKey: 'bms_battery_list_action_params'
    },
    {
      label: '离线指令',
      key: 'offline',
      icon: renderIcon(FlashOutline),
      permissionKey: 'bms_battery_list_action_offline_command'
    },
    {
      label: '编辑 BMS 信息',
      key: 'edit',
      icon: renderIcon(CreateOutline),
      permissionKey: 'bms_battery_list_action_edit_bms_info'
    },
    {
      label: '删除',
      key: 'delete',
      icon: renderIcon(TrashOutline),
      permissionKey: 'bms_battery_list_action_delete'
    },
    {
      type: 'divider',
      key: 'divider-1'
    },
    {
      label: '生命周期',
      key: 'lifecycle',
      icon: renderIcon(ListOutline),
      children: [
        {
          label: '出厂',
          key: 'lifecycle.factory',
          icon: renderIcon(CubeOutline),
          permissionKey: 'bms_battery_list_action_lifecycle_factory'
        },
        {
          label: '信息补全',
          key: 'lifecycle.infoComplete',
          icon: renderIcon(ListOutline),
          permissionKey: 'bms_battery_list_action_lifecycle_info_complete'
        },
        {
          label: '激活',
          key: 'lifecycle.activate',
          icon: renderIcon(CheckmarkCircleOutline),
          permissionKey: 'bms_battery_list_action_lifecycle_activate'
        },
        {
          label: '调拨',
          key: 'lifecycle.transfer',
          icon: renderIcon(SwapHorizontalOutline),
          permissionKey: 'bms_battery_list_action_lifecycle_transfer'
        }
      ]
    }
  ])
}

function getBatchActionOptions() {
  return filterMenuOptions([
    {
      label: `电池信息补全(${selectedRowKeys.value.length})`,
      key: 'batch.infoComplete',
      icon: renderIcon(ListOutline),
      permissionKey: 'bms_battery_list_batch_info_complete'
    },
    {
      label: `批量分配经销商(${selectedRowKeys.value.length})`,
      key: 'batch.assignDealer',
      icon: renderIcon(StorefrontOutline),
      permissionKey: 'bms_battery_list_batch_assign_dealer'
    },
    {
      label: `批量设置标签(${selectedRowKeys.value.length})`,
      key: 'batch.tag',
      icon: renderIcon(PricetagsOutline),
      permissionKey: 'bms_battery_list_batch_tag'
    },
    {
      label: `批量下发指令(${selectedRowKeys.value.length})`,
      key: 'batch.command',
      icon: renderIcon(FlashOutline),
      permissionKey: 'bms_battery_list_batch_command'
    },
    {
      label: `批量OTA推送(${selectedRowKeys.value.length})`,
      key: 'batch.ota',
      icon: renderIcon(CloudUploadOutline),
      permissionKey: 'bms_battery_list_batch_ota'
    }
  ])
}

function handleActionSelect(key: string, row: BatteryItem) {
  if (key === 'detail') goDeviceDetail(row)
  if (key === 'params') openParams(row)
  if (key === 'offline') openOfflineCmd(row)
  if (key === 'edit') openEditSingleModal(row)
  if (key === 'delete') handleDeleteBattery(row)
  if (key === 'lifecycle.factory') openFactoryModal(row)
  if (key === 'lifecycle.infoComplete') openCompleteInfoModal([row])
  if (key === 'lifecycle.transfer') openTransferModal(row)
  if (key === 'lifecycle.activate') openActivateModal(row)
}

function handleBatchActionSelect(key: string) {
  if (key === 'batch.infoComplete') handleBatchCompleteInfo()
  if (key === 'batch.assignDealer') handleBatchAssign()
  if (key === 'batch.tag') handleBatchTag()
  if (key === 'batch.command') handleBatchCommand()
  if (key === 'batch.ota') handleBatchOta()
}

const searchForm = ref<{
  search_field: 'device_number' | 'batch_number' | 'battery_model_name' | 'product_spec' | 'ble_mac' | 'comm_chip_id'
  search_value: string
  device_number: string
  battery_model_id: string | null
  cell_brand_seq_no: number | null
  battery_model_seq_no: number | null
  owner_org_type: string | null
  owner_org_id: string | null
  is_online: number | null
  activation_status: string | null
  production_range: [number, number] | null
  warranty_status: string | null
}>({
  search_field: 'device_number',
  search_value: '',
  device_number: '',
  battery_model_id: null,
  cell_brand_seq_no: null,
  battery_model_seq_no: null,
  owner_org_type: null,
  owner_org_id: null,
  is_online: null,
  activation_status: null,
  production_range: null,
  warranty_status: null
})
const showAdvancedSearch = ref(false)

const textSearchFieldOptions = [
  { label: '序列号', value: 'device_number' },
  { label: '批号', value: 'batch_number' },
  { label: 'BMS型号', value: 'battery_model_name' },
  { label: '产品规格', value: 'product_spec' },
  { label: '蓝牙MAC', value: 'ble_mac' },
  { label: '4G卡ID', value: 'comm_chip_id' }
] as const

const textSearchPlaceholder = computed(() => {
  const current = textSearchFieldOptions.find(item => item.value === searchForm.value.search_field)
  return current ? `请输入${current.label}` : '请输入搜索内容'
})

const userOrgType = computed(() => String((authStore.userInfo as any)?.org_type || '').toUpperCase())
const userAuthority = computed(() => String((authStore.userInfo as any)?.authority || '').toUpperCase())

const ownerOrgTypeOptions = computed(() => {
  const types: string[] = []
  if (
    userAuthority.value === 'TENANT_ADMIN' ||
    userAuthority.value === 'SYS_ADMIN' ||
    userOrgType.value === 'BMS_FACTORY' ||
    !userOrgType.value
  ) {
    types.push('PACK_FACTORY', 'DEALER', 'STORE')
  } else if (userOrgType.value === 'PACK_FACTORY') {
    types.push('DEALER', 'STORE')
  } else if (userOrgType.value === 'DEALER') {
    types.push('STORE')
  }
  return types.map(type => ({
    label: type === 'PACK_FACTORY' ? 'PACK厂' : type === 'DEALER' ? '经销商' : '门店',
    value: type
  }))
})

const canFilterByOrgType = computed(() => ownerOrgTypeOptions.value.length > 0)

async function loadOwnerOrgOptions(type: string | null) {
  ownerOrgOptions.value = []
  if (!type) return
  try {
    const res: any = await getOrgScopeOptions({ org_type: type })
    const list = (res?.data || []) as Array<{ id: string; name: string }>
    ownerOrgOptions.value = list.map(i => ({ label: i.name, value: i.id }))
  } catch {
    ownerOrgOptions.value = []
  }
}

async function handleOwnerOrgTypeChange(type: string | null) {
  searchForm.value.owner_org_id = null
  await loadOwnerOrgOptions(type)
}

const createColumns = (): DataTableColumns<BatteryItem> => [
  {
    type: 'selection',
    multiple: true,
    fixed: 'left'
  },
  { key: 'device_number', title: '序列号', minWidth: 150, fixed: 'left' },
  { key: 'batch_number', title: '批号', minWidth: 140, render: row => row.batch_number || '--' },
  { key: 'battery_model_name', title: 'BMS型号', minWidth: 140, render: row => row.battery_model_name || '--' },
  { key: 'product_spec', title: '产品规格', minWidth: 140, render: row => row.product_spec || '--' },
  { key: 'cell_brand_name', title: '电芯品牌', minWidth: 140, render: row => row.cell_brand_name || '--' },
  {
    key: 'pack_battery_model_name',
    title: '电池型号',
    minWidth: 160,
    render: row => row.pack_battery_model_name || '--'
  },
  { key: 'ble_mac', title: '蓝牙Mac', minWidth: 160, render: row => row.ble_mac || '--' },
  { key: 'comm_chip_id', title: '4G卡ID', minWidth: 160, render: row => row.comm_chip_id || '--' },
  { key: 'production_date', title: '出厂日期', minWidth: 120, render: row => row.production_date || '--' },
  {
    key: 'owner_org_name',
    title: '归属机构',
    minWidth: 160,
    render: row => row.owner_org_name || row.dealer_name || <NTag type="info">厂家库存</NTag>
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
    render: row => {
      const options = getActionOptions() as any[]
      if (!options.length) return null

      return (
        <NDropdown options={options as any} trigger="click" onSelect={(key: string) => handleActionSelect(key, row)}>
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
  }
]

const { data, loading, columns, pagination, getData, updateSearchParams, reloadColumns } = useTable<
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

const activeAdvancedFilterCount = computed(() => {
  let count = 0
  if (searchForm.value.owner_org_type) count += 1
  if (searchForm.value.owner_org_id) count += 1
  if (searchForm.value.cell_brand_seq_no !== null) count += 1
  if (searchForm.value.battery_model_seq_no !== null) count += 1
  if (searchForm.value.is_online !== null) count += 1
  if (searchForm.value.activation_status) count += 1
  if (searchForm.value.production_range?.length) count += 1
  if (searchForm.value.warranty_status) count += 1
  return count
})

// 导出
async function handleExport() {
  try {
    const [start, end] = searchForm.value.production_range || []
    const params: any = {
      search_field: searchForm.value.search_value ? searchForm.value.search_field : undefined,
      search_value: searchForm.value.search_value || undefined,
      device_number: searchForm.value.device_number || undefined,
      battery_model_id: searchForm.value.battery_model_id || undefined,
      cell_brand_seq_no: searchForm.value.cell_brand_seq_no ?? undefined,
      battery_model_seq_no: searchForm.value.battery_model_seq_no ?? undefined,
      owner_org_id: searchForm.value.owner_org_id || undefined,
      owner_org_type: searchForm.value.owner_org_type || undefined,
      is_online: searchForm.value.is_online ?? undefined,
      activation_status: searchForm.value.activation_status || undefined,
      warranty_status: searchForm.value.warranty_status || undefined,
      production_date_start: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
      production_date_end: end ? dayjs(end).format('YYYY-MM-DD') : undefined
    }

    const response = await exportBatteryList(params)
    const blob = new Blob([response.data ?? ''], {
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
  singleModalMode.value = 'add'
  singleEditData.value = null
  showSingleModal.value = true
}

async function openEditSingleModal(row: BatteryItem) {
  try {
    const res: any = await getAppBatteryDetail(row.device_id)
    singleModalMode.value = 'edit'
    singleEditData.value = res?.data || null
    showSingleModal.value = true
  } catch (e: any) {
    message.error(e?.message || '加载 BMS 信息失败')
  }
}

async function handleSingleSubmit(form: any) {
  try {
    const payload = {
      item_uuid: String(form.item_uuid || '').trim(),
      batch_number: String(form.batch_number || '').trim(),
      product_spec: String(form.product_spec || '').trim(),
      order_number: String(form.order_number || '').trim(),
      bms_comm_type: Number(form.bms_comm_type),
      battery_model_id: form.battery_model_id || undefined,
      ble_mac: String(form.ble_mac || '').trim() || undefined,
      comm_chip_id: String(form.comm_chip_id || '').trim() || undefined,
      production_date: form.production_date ? dayjs(form.production_date).format('YYYY-MM-DD') : undefined,
      warranty_expire_date: form.warranty_expire_date
        ? dayjs(form.warranty_expire_date).format('YYYY-MM-DD')
        : undefined,
      remark: String(form.remark || '').trim() || undefined
    }
    if (singleModalMode.value === 'edit' && singleEditData.value?.device_id) {
      await updateSingleBattery(singleEditData.value.device_id, payload)
      message.success('编辑成功')
    } else {
      await createSingleBattery(payload)
      message.success('添加成功')
    }
    showSingleModal.value = false
    singleEditData.value = null
    getData()
  } catch (e: any) {
    message.error(e?.message || (singleModalMode.value === 'edit' ? '编辑失败' : '添加失败'))
  }
}

function handleDeleteBattery(row: BatteryItem) {
  dialog.warning({
    title: '确认删除电池',
    content: `删除后该电池及其关联业务数据都会被删除，且不可恢复。是否继续删除「${row.device_number || '--'}」？`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteBattery(row.device_id)
        message.success('删除成功')
        if (selectedRowKeys.value.includes(row.device_id)) {
          selectedRowKeys.value = selectedRowKeys.value.filter(id => id !== row.device_id)
        }
        getData()
      } catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    }
  })
}

const factoryTargetOptions = computed(() =>
  factoryForm.value.to_org_type === 'PACK_FACTORY' ? packOrgOptions.value : dealerOrgOptions.value
)

const transferTargetOptions = computed(() => {
  if (transferForm.value.to_org_type === 'PACK_FACTORY') return packOrgOptions.value
  if (transferForm.value.to_org_type === 'STORE') return storeOrgOptions.value
  return dealerOrgOptions.value
})

const transferOrgTypeOptions = computed(() => {
  const types: Array<'PACK_FACTORY' | 'DEALER' | 'STORE'> = []

  if (
    userAuthority.value === 'TENANT_ADMIN' ||
    userAuthority.value === 'SYS_ADMIN' ||
    userOrgType.value === 'BMS_FACTORY' ||
    !userOrgType.value
  ) {
    types.push('PACK_FACTORY', 'DEALER')
  } else if (userOrgType.value === 'PACK_FACTORY') {
    types.push('DEALER', 'STORE')
  } else if (userOrgType.value === 'DEALER') {
    types.push('PACK_FACTORY', 'STORE')
  } else if (userOrgType.value === 'STORE') {
    types.push('DEALER')
  }

  return types.map(type => ({
    label: type === 'PACK_FACTORY' ? 'PACK厂' : type === 'DEALER' ? '经销商' : '门店',
    value: type
  }))
})

async function ensureOrgOptions(type: 'PACK_FACTORY' | 'DEALER' | 'STORE') {
  const map: Record<string, typeof packOrgOptions> = {
    PACK_FACTORY: packOrgOptions,
    DEALER: dealerOrgOptions,
    STORE: storeOrgOptions
  }
  const target = map[type]
  if (target.value.length > 0) return
  try {
    const res: any = await getOrgScopeOptions({ org_type: type })
    const list = (res?.data || []) as Array<{ id: string; name: string }>
    target.value = list.map(i => ({ label: i.name, value: i.id }))
  } catch {
    target.value = []
  }
}

async function handleFactoryOrgTypeChange(v: 'PACK_FACTORY' | 'DEALER') {
  factoryForm.value.to_org_id = null
  await ensureOrgOptions(v)
}

async function handleTransferOrgTypeChange(v: 'PACK_FACTORY' | 'DEALER' | 'STORE') {
  transferForm.value.to_org_id = null
  await ensureOrgOptions(v)
}

async function openFactoryModal(row: BatteryItem) {
  factoryForm.value = {
    device_id: row.device_id,
    device_number: row.device_number,
    to_org_type: 'PACK_FACTORY',
    to_org_id: null,
    remark: ''
  }
  showFactoryModal.value = true
  await ensureOrgOptions('PACK_FACTORY')
}

async function openTransferModal(row: BatteryItem) {
  const defaultTargetType = (transferOrgTypeOptions.value[0]?.value || 'DEALER') as 'PACK_FACTORY' | 'DEALER' | 'STORE'
  transferForm.value = {
    device_id: row.device_id,
    device_number: row.device_number,
    from_org_name: row.owner_org_name || row.dealer_name || '厂家',
    from_org_type: row.owner_org_type || '',
    to_org_type: defaultTargetType,
    to_org_id: null,
    remark: ''
  }
  showTransferModal.value = true
  await ensureOrgOptions(defaultTargetType)
}

function openActivateModal(row: BatteryItem) {
  activateForm.value = {
    device_id: row.device_id,
    device_number: row.device_number,
    user_id: null,
    remark: ''
  }
  activateCurrent.value = {
    status: row.activation_status || '',
    user_phone: row.user_phone || '',
    user_name: row.user_name || '',
    activation_date: row.activation_date || ''
  }
  showActivateModal.value = true
}

function openCompleteInfoModal(rows: BatteryItem[]) {
  if (!rows.length) {
    message.warning('请先选择要补全的电池')
    return
  }
  completeInfoRows.value = rows
  completeInfoForm.value = {
    device_ids: rows.map(item => item.device_id),
    cell_brand_seq_no: null,
    battery_model_seq_no: null
  }
  showCompleteInfoModal.value = true
}

async function confirmFactoryOut() {
  if (!factoryForm.value.to_org_id) {
    message.warning('请选择出厂目标')
    return
  }
  factoryLoading.value = true
  try {
    await factoryOutBattery({
      device_id: factoryForm.value.device_id,
      to_org_id: factoryForm.value.to_org_id,
      remark: factoryForm.value.remark?.trim() ? factoryForm.value.remark.trim() : undefined
    })
    message.success('出厂成功')
    showFactoryModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || '出厂失败')
  } finally {
    factoryLoading.value = false
  }
}

async function confirmTransfer() {
  if (!transferForm.value.to_org_id) {
    message.warning('请选择调拨目标')
    return
  }
  transferLoading.value = true
  try {
    await transferBattery({
      device_id: transferForm.value.device_id,
      to_org_id: transferForm.value.to_org_id,
      remark: transferForm.value.remark?.trim() ? transferForm.value.remark.trim() : undefined
    })
    message.success('调拨成功')
    showTransferModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || '调拨失败')
  } finally {
    transferLoading.value = false
  }
}

async function confirmActivate() {
  if (!activateForm.value.user_id) {
    message.warning('请选择要绑定的APP用户')
    return
  }
  activateLoading.value = true
  try {
    await activateBattery({
      device_id: activateForm.value.device_id,
      user_id: activateForm.value.user_id,
      remark: activateForm.value.remark?.trim() ? activateForm.value.remark.trim() : undefined
    })
    message.success('激活成功')
    showActivateModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || '激活失败')
  } finally {
    activateLoading.value = false
  }
}

function handleBatchCompleteInfo() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要补全的电池')
    return
  }
  const rows = data.value.filter(item => selectedRowKeys.value.includes(item.device_id))
  openCompleteInfoModal(rows)
}

async function confirmCompleteInfo() {
  if (!completeInfoForm.value.cell_brand_seq_no) {
    message.warning('请选择电芯品牌')
    return
  }
  if (!completeInfoForm.value.battery_model_seq_no) {
    message.warning('请选择电池型号')
    return
  }

  completeInfoLoading.value = true
  try {
    await completeBatteryInfo({
      device_ids: completeInfoForm.value.device_ids,
      cell_brand_seq_no: completeInfoForm.value.cell_brand_seq_no,
      battery_model_seq_no: completeInfoForm.value.battery_model_seq_no
    })
    message.success('电池信息补全成功')
    showCompleteInfoModal.value = false
    selectedRowKeys.value = []
    getData()
  } catch (error: any) {
    message.error(error?.message || '电池信息补全失败')
  } finally {
    completeInfoLoading.value = false
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
    search_field: searchForm.value.search_value ? searchForm.value.search_field : undefined,
    search_value: searchForm.value.search_value || undefined,
    device_number: searchForm.value.device_number || undefined,
    battery_model_id: searchForm.value.battery_model_id || undefined,
    cell_brand_seq_no: searchForm.value.cell_brand_seq_no ?? undefined,
    battery_model_seq_no: searchForm.value.battery_model_seq_no ?? undefined,
    owner_org_id: searchForm.value.owner_org_id || undefined,
    owner_org_type: searchForm.value.owner_org_type || undefined,
    is_online: searchForm.value.is_online ?? undefined,
    activation_status: searchForm.value.activation_status || undefined,
    warranty_status: searchForm.value.warranty_status || undefined,
    production_date_start: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
    production_date_end: end ? dayjs(end).format('YYYY-MM-DD') : undefined
  })
  getData()
}

function handlePageChange(page: number) {
  pagination.page = page
  updateSearchParams({
    page,
    page_size: pagination.pageSize
  })
  getData()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  updateSearchParams({
    page: 1,
    page_size: pageSize
  })
  getData()
}

function handleReset() {
  searchForm.value = {
    search_field: 'device_number',
    search_value: '',
    device_number: '',
    battery_model_id: null,
    cell_brand_seq_no: null,
    battery_model_seq_no: null,
    owner_org_type: null,
    owner_org_id: null,
    is_online: null,
    activation_status: null,
    production_range: null,
    warranty_status: null
  }
  ownerOrgOptions.value = []
  handleSearch()
}

function goDeviceDetail(row: BatteryItem) {
  routerPushByKey('device_details', {
    query: {
      d_id: row.device_id,
      bms: '1'
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
    const brandRes: any = await getCellBrandList()
    const list = (brandRes?.data?.list || []) as Array<{ seq_no: number; name: string }>
    cellBrandOptions.value = list.map(i => ({ label: i.name, value: i.seq_no }))
  } catch {
    cellBrandOptions.value = []
  }

  try {
    const bmsModelRes: any = await getBatteryBmsModelList({ page: 1, page_size: 1000 })
    const list = (bmsModelRes?.data?.list || []) as Array<{ id: string; name: string }>
    bmsModelOptions.value = list.map(i => ({ label: i.name, value: i.id }))
  } catch {
    bmsModelOptions.value = []
  }
}

const scrollX = computed(() => 2200)

onMounted(async () => {
  // 等待权限加载后刷新列，确保“操作”菜单按权限过滤
  await ensureUiPermissionState()
  reloadColumns()
  initSelectOptions()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="电池列表" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <div class="battery-list-layout">
        <div class="battery-list-toolbar">
          <NForm :model="searchForm" label-placement="left" label-width="auto" class="battery-search-panel">
            <div class="battery-search-main">
              <NFormItem path="search_value" class="battery-search-item">
                <template #label>
                  <NSelect
                    v-model:value="searchForm.search_field"
                    :options="textSearchFieldOptions"
                    class="battery-search-label-select"
                  />
                </template>
                <NInput
                  v-model:value="searchForm.search_value"
                  :placeholder="textSearchPlaceholder"
                  class="battery-search-control"
                  clearable
                />
              </NFormItem>

              <NFormItem label="BMS型号" path="battery_model_id" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.battery_model_id"
                  :options="bmsModelOptions"
                  placeholder="请选择BMS型号"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>

              <div class="battery-search-actions">
                <NButton type="primary" @click="handleSearch">查询</NButton>
                <NButton @click="handleReset">重置</NButton>
                <NButton text type="primary" @click="showAdvancedSearch = !showAdvancedSearch">
                  {{
                    showAdvancedSearch
                      ? '收起高级'
                      : `高级筛选${activeAdvancedFilterCount ? `(${activeAdvancedFilterCount})` : ''}`
                  }}
                </NButton>
              </div>
            </div>

            <div v-show="showAdvancedSearch" class="battery-search-advanced">
              <NFormItem v-if="canFilterByOrgType" label="机构类型" path="owner_org_type" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.owner_org_type"
                  :options="ownerOrgTypeOptions"
                  placeholder="请选择类型"
                  clearable
                  class="battery-search-control"
                  @update:value="handleOwnerOrgTypeChange"
                />
              </NFormItem>

              <NFormItem v-if="canFilterByOrgType" label="归属机构" path="owner_org_id" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.owner_org_id"
                  :options="ownerOrgOptions"
                  placeholder="请选择机构"
                  clearable
                  class="battery-search-control battery-search-control-wide"
                />
              </NFormItem>

              <NFormItem label="电芯品牌" path="cell_brand_seq_no" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.cell_brand_seq_no"
                  :options="cellBrandOptions"
                  placeholder="请选择电芯品牌"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>

              <NFormItem label="电池型号" path="battery_model_seq_no" class="battery-search-item">
                <BatteryModelSelect
                  v-model="searchForm.battery_model_seq_no"
                  :allow-create="false"
                  class="battery-search-control battery-search-control-wide"
                  placeholder="请选择电池型号"
                />
              </NFormItem>

              <NFormItem label="在线状态" path="is_online" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.is_online"
                  :options="onlineOptions"
                  placeholder="请选择"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>

              <NFormItem label="激活状态" path="activation_status" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.activation_status"
                  :options="activationOptions"
                  placeholder="请选择"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>

              <NFormItem label="出厂日期" path="production_range" class="battery-search-item">
                <NDatePicker
                  v-model:value="searchForm.production_range"
                  type="daterange"
                  clearable
                  class="battery-search-control battery-search-control-wide"
                />
              </NFormItem>

              <NFormItem label="质保状态" path="warranty_status" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.warranty_status"
                  :options="warrantyOptions"
                  placeholder="请选择"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>
            </div>
          </NForm>

          <NSpace class="battery-action-bar" justify="space-between">
            <NSpace wrap>
              <NButton v-ui-permission="'bms_battery_list_export'" type="primary" @click="handleExport">
                <template #icon>
                  <NIcon><DownloadOutline /></NIcon>
                </template>
                导出
              </NButton>
              <NButton v-ui-permission="'bms_battery_list_add'" type="primary" @click="openSingleModal">
                + 新增 BMS
              </NButton>
              <NButton v-ui-permission="'bms_battery_list_import'" @click="openImportModal">
                <template #icon>
                  <NIcon><CloudDownloadOutline /></NIcon>
                </template>
                导入
              </NButton>
            </NSpace>

            <NDropdown
              v-if="getBatchActionOptions().length"
              :options="getBatchActionOptions()"
              trigger="click"
              @select="handleBatchActionSelect"
            >
              <NButton :disabled="selectedRowKeys.length === 0">
                <template #icon>
                  <NIcon><ListOutline /></NIcon>
                </template>
                {{ `批量操作${selectedRowKeys.length ? `(${selectedRowKeys.length})` : ''}` }}
              </NButton>
            </NDropdown>
          </NSpace>
        </div>

        <div class="battery-table-shell">
          <div class="battery-table-scroll">
            <NDataTable
              v-model:checked-row-keys="selectedRowKeys"
              :columns="columns"
              :data="data"
              class="battery-data-table"
              flex-height
              :loading="loading"
              :pagination="false"
              :row-key="row => row.device_id"
              :scroll-x="scrollX"
            />
          </div>

          <div class="battery-pagination-bar">
            <NPagination
              :page="pagination.page"
              :page-size="pagination.pageSize"
              :item-count="pagination.itemCount"
              :page-sizes="pagination.pageSizes"
              :show-size-picker="pagination.showSizePicker"
              @update:page="handlePageChange"
              @update:page-size="handlePageSizeChange"
            />
          </div>
        </div>
      </div>
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
      v-model:show="showFactoryModal"
      preset="dialog"
      title="电池出厂"
      positive-text="确认出厂"
      negative-text="取消"
      :loading="factoryLoading"
      @positive-click="confirmFactoryOut"
    >
      <NForm :model="factoryForm" label-placement="left" label-width="100px">
        <NFormItem label="电池编号">
          <NInput v-model:value="factoryForm.device_number" disabled />
        </NFormItem>
        <NFormItem label="出厂到" path="to_org_type" required>
          <NRadioGroup v-model:value="factoryForm.to_org_type" @update:value="handleFactoryOrgTypeChange">
            <NRadioButton value="PACK_FACTORY">PACK厂</NRadioButton>
            <NRadioButton value="DEALER">经销商</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="目标机构" path="to_org_id" required>
          <NSelect
            v-model:value="factoryForm.to_org_id"
            :options="factoryTargetOptions"
            placeholder="请选择目标机构"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="factoryForm.remark" placeholder="可选" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showTransferModal"
      preset="dialog"
      title="电池调拨"
      positive-text="确认调拨"
      negative-text="取消"
      :loading="transferLoading"
      @positive-click="confirmTransfer"
    >
      <NForm :model="transferForm" label-placement="left" label-width="100px">
        <NFormItem label="电池编号">
          <NInput v-model:value="transferForm.device_number" disabled />
        </NFormItem>
        <NFormItem label="当前机构">
          <NInput v-model:value="transferForm.from_org_name" disabled />
        </NFormItem>
        <NFormItem label="调拨到" path="to_org_type" required>
          <NRadioGroup v-model:value="transferForm.to_org_type" @update:value="handleTransferOrgTypeChange">
            <NRadioButton v-for="item in transferOrgTypeOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="目标机构" path="to_org_id" required>
          <NSelect
            v-model:value="transferForm.to_org_id"
            :options="transferTargetOptions"
            placeholder="请选择目标机构"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="transferForm.remark" placeholder="可选" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showActivateModal"
      preset="dialog"
      title="电池激活"
      positive-text="确认激活"
      negative-text="取消"
      :loading="activateLoading"
      @positive-click="confirmActivate"
    >
      <NForm :model="activateForm" label-placement="left" label-width="100px">
        <NFormItem label="电池编号">
          <NInput v-model:value="activateForm.device_number" disabled />
        </NFormItem>
        <NFormItem label="当前状态">
          <div class="flex items-center gap-8px">
            <NTag type="info">{{ activationLabel(activateCurrent.status) }}</NTag>
            <span v-if="activateCurrent.status === 'ACTIVE'" style="color: #666; font-size: 12px">
              {{ activateCurrent.user_phone }}
              <span v-if="activateCurrent.user_name">（{{ activateCurrent.user_name }}）</span>
              <span v-if="activateCurrent.activation_date">· {{ activateCurrent.activation_date }}</span>
            </span>
          </div>
        </NFormItem>
        <NFormItem label="绑定用户" path="user_id" required>
          <EndUserSelect v-model="activateForm.user_id" />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="activateForm.remark" placeholder="可选" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showCompleteInfoModal"
      preset="dialog"
      title="电池信息补全"
      positive-text="确认补全"
      negative-text="取消"
      :loading="completeInfoLoading"
      @positive-click="confirmCompleteInfo"
    >
      <NForm :model="completeInfoForm" label-placement="left" label-width="100px">
        <NFormItem label="已选电池">
          <div style="color: #666">{{ completeInfoRows.length }} 台</div>
        </NFormItem>
        <NFormItem label="基础信息">
          <div class="complete-info-summary">
            <div v-for="item in completeInfoRows" :key="item.device_id" class="complete-info-row">
              <div>序列号：{{ item.device_number }}</div>
              <div>MAC地址：{{ item.ble_mac || '--' }}</div>
              <div>出厂日期：{{ item.production_date || '--' }}</div>
              <div>当前状态：{{ currentStatusLabel(item) }}</div>
            </div>
          </div>
        </NFormItem>
        <NFormItem label="电芯品牌" path="cell_brand_seq_no" required>
          <NSelect
            v-model:value="completeInfoForm.cell_brand_seq_no"
            :options="cellBrandOptions"
            placeholder="请选择电芯品牌"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="电池型号" path="battery_model_seq_no" required>
          <BatteryModelSelect
            v-model="completeInfoForm.battery_model_seq_no"
            :allow-create="true"
            placeholder="请选择电池型号"
          />
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

    <BatterySingleModal
      v-model:visible="showSingleModal"
      :mode="singleModalMode"
      :edit-data="singleEditData"
      :bms-model-options="bmsModelOptions"
      @submit="handleSingleSubmit"
    />
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}

.battery-list-layout {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.battery-list-toolbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.battery-search-panel {
  padding: 14px 16px;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  background: var(--n-color-embedded);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.battery-search-main {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: flex-end;
}

.battery-search-advanced {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--n-border-color);
}

.battery-search-item {
  margin-bottom: 0;
}

.battery-search-control {
  width: 220px;
}

.battery-search-label-select {
  width: 120px;
}

.battery-search-control-wide {
  width: 260px;
}

.battery-search-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-left: auto;
}

.battery-action-bar {
  flex-shrink: 0;
}

.battery-table-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  background: var(--n-color);
}

.battery-table-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 8px 8px 0;
}

.battery-pagination-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--n-border-color);
  background: var(--n-color);
}

.battery-data-table {
  height: 100%;
}

.complete-info-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
  width: 100%;
}

.complete-info-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
  padding: 8px 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color-embedded);
  color: #666;
  font-size: 12px;
}

@media (max-width: 768px) {
  .battery-search-control,
  .battery-search-control-wide,
  .battery-search-label-select {
    width: 100%;
  }

  .battery-search-item {
    width: 100%;
  }

  .battery-search-actions {
    width: 100%;
    margin-left: 0;
  }

  .battery-pagination-bar {
    justify-content: center;
    overflow-x: auto;
  }

  .complete-info-row {
    grid-template-columns: 1fr;
  }
}
</style>
