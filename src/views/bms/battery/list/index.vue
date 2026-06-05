<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, h, onMounted, ref, watch } from 'vue'
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
  batchFactoryOutBattery,
  factoryRestoreBattery,
  transferBattery,
  getBatteryRollbackPreview,
  rollbackBattery,
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
  ReturnUpBackOutline,
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
  identity_ble_mac?: string | null
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
const selectedRowsMap = ref<Record<string, BatteryItem>>({})
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
const showFactoryRestoreModal = ref(false)
const showTransferModal = ref(false)
const showRollbackModal = ref(false)
const showActivateModal = ref(false)
const showCompleteInfoModal = ref(false)
const factoryLoading = ref(false)
const factoryRestoreLoading = ref(false)
const transferLoading = ref(false)
const rollbackLoading = ref(false)
const activateLoading = ref(false)
const completeInfoLoading = ref(false)
const factoryMode = ref<'single' | 'batch'>('single')

const factoryForm = ref({
  device_ids: [] as string[],
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
const factoryRestoreForm = ref({
  device_id: '',
  device_number: '',
  current_org_name: '',
  remark: ''
})
const rollbackForm = ref({
  device_id: '',
  device_number: '',
  current_org_name: '',
  rollback_to_org_id: null as string | null,
  rollback_to_org_name: '',
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
const selectedRows = computed(
  () => selectedRowKeys.value.map(id => selectedRowsMap.value[id]).filter(Boolean) as BatteryItem[]
)
const selectedCount = computed(() => selectedRowKeys.value.length)

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
    message.error(e?.message || bt('auto.s_ac4b94d896'))
    otaTaskDetailList.value = []
    otaTaskDetailStats.value = []
  } finally {
    otaTaskDetailLoading.value = false
  }
}

const onlineOptions = [
  { label: bt('auto.s_68905cf391'), value: 1 },
  { label: bt('auto.s_50d4a8502e'), value: 0 }
]

const activationOptions = [
  { label: bt('auto.s_f6ebf8f5e0'), value: 'ACTIVE' },
  { label: bt('auto.s_d70e9bdf18'), value: 'INACTIVE' }
]

const warrantyOptions = [
  { label: bt('auto.s_142f3c93b3'), value: 'IN' },
  { label: bt('auto.s_4362652257'), value: 'OVER' }
]

function onlineTagType(isOnline: number) {
  return isOnline === 1 ? 'success' : 'default'
}

function activationTagType(status?: string | null) {
  if (status === 'ACTIVE') return 'success'
  return 'warning'
}

function activationLabel(status?: string | null) {
  if (status === 'ACTIVE') return bt('auto.s_f6ebf8f5e0')
  if (status === 'INACTIVE') return bt('auto.s_d70e9bdf18')
  return '--'
}

function currentStatusLabel(row: BatteryItem) {
  const parts = [activationLabel(row.activation_status)]
  parts.push(row.is_online === 1 ? bt('auto.s_68905cf391') : bt('auto.s_50d4a8502e'))
  return parts.join(' / ')
}

function clearSelection() {
  selectedRowKeys.value = []
  selectedRowsMap.value = {}
}

function syncSelectedRowsFromCurrentPage(rows: BatteryItem[]) {
  const nextMap = { ...selectedRowsMap.value }
  const selectedKeySet = new Set(selectedRowKeys.value)
  const currentPageKeySet = new Set(rows.map(item => item.device_id))

  rows.forEach(item => {
    if (selectedKeySet.has(item.device_id)) {
      nextMap[item.device_id] = item
    }
  })

  currentPageKeySet.forEach(deviceID => {
    if (!selectedKeySet.has(deviceID)) {
      delete nextMap[deviceID]
    }
  })

  selectedRowsMap.value = nextMap
}

function handleSelectionChange(keys: Array<string | number>) {
  selectedRowKeys.value = keys.map(key => String(key))
  syncSelectedRowsFromCurrentPage(data.value)
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

function canShowRollbackAction(row: BatteryItem) {
  const ownerOrgType = String(row.owner_org_type || '').toUpperCase()
  return (userOrgType.value === 'DEALER' || userOrgType.value === 'STORE') && ownerOrgType === userOrgType.value
}

function canShowFactoryRestoreAction(row: BatteryItem) {
  const ownerOrgID = String(row.owner_org_id || '').trim()
  return (
    (userOrgType.value === 'BMS_FACTORY' ||
      userAuthority.value === 'TENANT_ADMIN' ||
      userAuthority.value === 'SYS_ADMIN') &&
    ownerOrgID !== ''
  )
}

function getActionOptions(row: BatteryItem) {
  return filterMenuOptions([
    {
      label: bt('auto.s_5b48dbb8dc'),
      key: 'detail',
      icon: renderIcon(EyeOutline),
      permissionKey: 'bms_battery_list_detail'
    },
    {
      label: bt('auto.s_3d0a2df9ec'),
      key: 'params',
      icon: renderIcon(SettingsOutline),
      permissionKey: 'bms_battery_list_action_params'
    },
    {
      label: bt('auto.s_d3f156bcf0'),
      key: 'offline',
      icon: renderIcon(FlashOutline),
      permissionKey: 'bms_battery_list_action_offline_command'
    },
    {
      label: bt('auto.s_a14612b388'),
      key: 'edit',
      icon: renderIcon(CreateOutline),
      permissionKey: 'bms_battery_list_action_edit_bms_info'
    },
    {
      label: bt('auto.s_2f4aaddde3'),
      key: 'delete',
      icon: renderIcon(TrashOutline),
      permissionKey: 'bms_battery_list_action_delete'
    },
    {
      type: 'divider',
      key: 'divider-1'
    },
    {
      label: bt('auto.s_176808a1b5'),
      key: 'lifecycle',
      icon: renderIcon(ListOutline),
      children: [
        {
          label: bt('auto.s_539d3e5db4'),
          key: 'lifecycle.factory',
          icon: renderIcon(CubeOutline),
          permissionKey: 'bms_battery_list_action_lifecycle_factory'
        },
        ...(canShowFactoryRestoreAction(row)
          ? [
              {
                label: bt('auto.s_2f6f278e3c'),
                key: 'lifecycle.factoryRestore',
                icon: renderIcon(ReturnUpBackOutline),
                permissionKey: 'bms_battery_list_action_lifecycle_factory_restore'
              }
            ]
          : []),
        {
          label: bt('auto.s_bf7b2d5361'),
          key: 'lifecycle.infoComplete',
          icon: renderIcon(ListOutline),
          permissionKey: 'bms_battery_list_action_lifecycle_info_complete'
        },
        {
          label: bt('auto.s_83a991d77c'),
          key: 'lifecycle.activate',
          icon: renderIcon(CheckmarkCircleOutline),
          permissionKey: 'bms_battery_list_action_lifecycle_activate'
        },
        {
          label: bt('auto.s_59ab62ddae'),
          key: 'lifecycle.transfer',
          icon: renderIcon(SwapHorizontalOutline),
          permissionKey: 'bms_battery_list_action_lifecycle_transfer',
          disabled: isStoreOrgUser.value
        },
        ...(canShowRollbackAction(row)
          ? [
              {
                label: bt('auto.s_c3cb48b69a'),
                key: 'lifecycle.rollback',
                icon: renderIcon(ReturnUpBackOutline),
                permissionKey: 'bms_battery_list_action_lifecycle_rollback'
              }
            ]
          : [])
      ]
    }
  ])
}

function getBatchActionOptions() {
  return filterMenuOptions([
    {
      label: `${bt('auto.s_51af1c7e1e')}(${selectedCount.value})`,
      key: 'batch.factory',
      icon: renderIcon(CubeOutline),
      permissionKey: 'bms_battery_list_batch_factory_out'
    },
    {
      label: `${bt('auto.s_c9c2396d84')}(${selectedCount.value})`,
      key: 'batch.infoComplete',
      icon: renderIcon(ListOutline),
      permissionKey: 'bms_battery_list_batch_info_complete'
    },
    {
      label: `${bt('auto.s_3886905b9c')}(${selectedCount.value})`,
      key: 'batch.assignDealer',
      icon: renderIcon(StorefrontOutline),
      permissionKey: 'bms_battery_list_batch_assign_dealer'
    },
    {
      label: `${bt('auto.s_e6fae0e464')}(${selectedCount.value})`,
      key: 'batch.tag',
      icon: renderIcon(PricetagsOutline),
      permissionKey: 'bms_battery_list_batch_tag'
    },
    {
      label: `${bt('auto.s_4d46ae103d')}(${selectedCount.value})`,
      key: 'batch.command',
      icon: renderIcon(FlashOutline),
      permissionKey: 'bms_battery_list_batch_command'
    },
    {
      label: `${bt('auto.s_26e6fda3e4')}(${selectedCount.value})`,
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
  if (key === 'lifecycle.factoryRestore') openFactoryRestoreModal(row)
  if (key === 'lifecycle.infoComplete') openCompleteInfoModal([row])
  if (key === 'lifecycle.transfer') {
    if (isStoreOrgUser.value) {
      message.warning(bt('auto.s_dad74257ab'))
      return
    }
    openTransferModal(row)
  }
  if (key === 'lifecycle.rollback') openRollbackModal(row)
  if (key === 'lifecycle.activate') openActivateModal(row)
}

function handleBatchActionSelect(key: string) {
  if (key === 'batch.factory') handleBatchFactory()
  if (key === 'batch.infoComplete') handleBatchCompleteInfo()
  if (key === 'batch.assignDealer') handleBatchAssign()
  if (key === 'batch.tag') handleBatchTag()
  if (key === 'batch.command') handleBatchCommand()
  if (key === 'batch.ota') handleBatchOta()
}

const searchForm = ref<{
  search_field:
    | 'device_number'
    | 'batch_number'
    | 'battery_model_name'
    | 'product_spec'
    | 'ble_mac'
    | 'identity_ble_mac'
    | 'comm_chip_id'
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

const textSearchFieldOptions: Array<{ label: string; value: typeof searchForm.value.search_field }> = [
  { label: bt('auto.s_7079d2e6c4'), value: 'device_number' },
  { label: bt('auto.s_b09f4ca805'), value: 'batch_number' },
  { label: bt('auto.s_c44c1028d5'), value: 'battery_model_name' },
  { label: bt('auto.s_2b4784210d'), value: 'product_spec' },
  { label: bt('auto.s_7342dbc8fd'), value: 'ble_mac' },
  { label: bt('auto.s_5542d0a58d'), value: 'identity_ble_mac' },
  { label: bt('auto.s_1978e7fc85'), value: 'comm_chip_id' }
]

const textSearchPlaceholder = computed(() => {
  const current = textSearchFieldOptions.find(item => item.value === searchForm.value.search_field)
  return current ? bt('pages.batteryList.inputCurrentLabel', { label: current.label }) : bt('auto.s_063e9a054a')
})

const userOrgType = computed(() => String((authStore.userInfo as any)?.org_type || '').toUpperCase())
const userAuthority = computed(() => String((authStore.userInfo as any)?.authority || '').toUpperCase())
const isStoreOrgUser = computed(() => userOrgType.value === 'STORE' && userAuthority.value === 'TENANT_USER')

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
    label: type === 'PACK_FACTORY' ? bt('auto.s_7b50c41556') : type === 'DEALER' ? bt('auto.s_9019dc8029') : bt('auto.s_a7da92344c'),
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
  { key: 'device_number', title: bt('auto.s_7079d2e6c4'), minWidth: 150, fixed: 'left' },
  { key: 'batch_number', title: bt('auto.s_b09f4ca805'), minWidth: 140, render: row => row.batch_number || '--' },
  { key: 'battery_model_name', title: bt('auto.s_c44c1028d5'), minWidth: 140, render: row => row.battery_model_name || '--' },
  { key: 'product_spec', title: bt('auto.s_2b4784210d'), minWidth: 140, render: row => row.product_spec || '--' },
  { key: 'cell_brand_name', title: bt('auto.s_b7f1936e90'), minWidth: 140, render: row => row.cell_brand_name || '--' },
  {
    key: 'pack_battery_model_name',
    title: bt('auto.s_ca62d89383'),
    minWidth: 160,
    render: row => row.pack_battery_model_name || '--'
  },
  { key: 'ble_mac', title: bt('auto.s_7342dbc8fd'), minWidth: 160, render: row => row.ble_mac || '--' },
  { key: 'identity_ble_mac', title: bt('auto.s_5542d0a58d'), minWidth: 160, render: row => row.identity_ble_mac || '--' },
  { key: 'comm_chip_id', title: bt('auto.s_1978e7fc85'), minWidth: 160, render: row => row.comm_chip_id || '--' },
  { key: 'production_date', title: bt('auto.s_fbe2fcd983'), minWidth: 120, render: row => row.production_date || '--' },
  {
    key: 'owner_org_name',
    title: bt('auto.s_6ce6f1493b'),
    minWidth: 160,
    render: row => row.owner_org_name || row.dealer_name || <NTag type="info">{bt('auto.s_a14d2ac1e0')}</NTag>
  },
  { key: 'user_phone', title: bt('auto.s_5ddfa01711'), minWidth: 140, render: row => row.user_phone || '--' },
  {
    key: 'activation_status',
    title: bt('auto.s_ffecc9f0be'),
    minWidth: 110,
    render: row => <NTag type={activationTagType(row.activation_status)}>{activationLabel(row.activation_status)}</NTag>
  },
  { key: 'activation_date', title: bt('auto.s_94d02ed943'), minWidth: 160, render: row => row.activation_date || '--' },
  {
    key: 'is_online',
    title: bt('auto.s_e639862a11'),
    minWidth: 110,
    render: row => <NTag type={onlineTagType(row.is_online)}>{row.is_online === 1 ? bt('auto.s_68905cf391') : bt('auto.s_50d4a8502e')}</NTag>
  },
  { key: 'soc', title: 'SOC(%)', minWidth: 100, render: row => row.soc ?? '--' },
  { key: 'soh', title: 'SOH(%)', minWidth: 100, render: row => row.soh ?? '--' },
  { key: 'warranty_expire_date', title: bt('auto.s_f65c27925f'), minWidth: 120, render: row => row.warranty_expire_date || '--' },
  { key: 'current_version', title: bt('auto.s_a81e282698'), minWidth: 120, render: row => row.current_version || '--' },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    minWidth: 140,
    fixed: 'right',
    render: row => {
      const options = getActionOptions(row) as any[]
      if (!options.length) return null

      return (
        <NDropdown options={options as any} trigger="click" onSelect={(key: string) => handleActionSelect(key, row)}>
          <NButton size="small" quaternary>
            {{
              default: () => bt('auto.s_2b6bc0f293'),
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
    link.download = bt('pages.batteryList.exportFileName', { time: dayjs().format('YYYYMMDDHHmmss') })
    link.click()
    window.URL.revokeObjectURL(url)
    message.success(bt('auto.s_105c8a51fe'))
  } catch (error: any) {
    message.error(error?.message || bt('auto.s_dd51ab5026'))
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
    message.error(e?.message || bt('auto.s_1a874c0598'))
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
      message.success(bt('auto.s_3bb47b6799'))
    } else {
      await createSingleBattery(payload)
      message.success(bt('auto.s_3fdaeadf0e'))
    }
    showSingleModal.value = false
    singleEditData.value = null
    getData()
  } catch (e: any) {
    message.error(e?.message || (singleModalMode.value === 'edit' ? bt('auto.s_9304e8f4c3') : bt('auto.s_6452a05591')))
  }
}

function handleDeleteBattery(row: BatteryItem) {
  dialog.warning({
    title: bt('auto.s_006da9f339'),
    content: bt('pages.batteryList.deleteContent', { device: row.device_number || '--' }),
    positiveText: bt('auto.s_631cd22018'),
    negativeText: bt('auto.s_625fb26b4b'),
    onPositiveClick: async () => {
      try {
        await deleteBattery(row.device_id)
        message.success(bt('auto.s_0007d170de'))
        if (selectedRowKeys.value.includes(row.device_id)) {
          selectedRowKeys.value = selectedRowKeys.value.filter(id => id !== row.device_id)
          delete selectedRowsMap.value[row.device_id]
        }
        getData()
      } catch (e: any) {
        message.error(e?.message || bt('auto.s_acf0664a54'))
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
    types.push('STORE')
  }

  return types.map(type => ({
    label: type === 'PACK_FACTORY' ? bt('auto.s_7b50c41556') : type === 'DEALER' ? bt('auto.s_9019dc8029') : bt('auto.s_a7da92344c'),
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
  factoryMode.value = 'single'
  factoryForm.value = {
    device_ids: [row.device_id],
    device_id: row.device_id,
    device_number: row.device_number,
    to_org_type: 'PACK_FACTORY',
    to_org_id: null,
    remark: ''
  }
  showFactoryModal.value = true
  await ensureOrgOptions('PACK_FACTORY')
}

async function handleBatchFactory() {
  if (selectedCount.value === 0) {
    message.warning(bt('auto.s_10c820a5d7'))
    return
  }
  factoryMode.value = 'batch'
  factoryForm.value = {
    device_ids: [...selectedRowKeys.value],
    device_id: '',
    device_number: '',
    to_org_type: 'PACK_FACTORY',
    to_org_id: null,
    remark: ''
  }
  showFactoryModal.value = true
  await ensureOrgOptions('PACK_FACTORY')
}

async function openTransferModal(row: BatteryItem) {
  const defaultTargetType = transferOrgTypeOptions.value[0]?.value as 'PACK_FACTORY' | 'DEALER' | 'STORE' | undefined
  if (!defaultTargetType) {
    message.warning(bt('auto.s_dad74257ab'))
    return
  }
  transferForm.value = {
    device_id: row.device_id,
    device_number: row.device_number,
    from_org_name: row.owner_org_name || row.dealer_name || bt('auto.s_8284e8dacc'),
    from_org_type: row.owner_org_type || '',
    to_org_type: defaultTargetType,
    to_org_id: null,
    remark: ''
  }
  showTransferModal.value = true
  await ensureOrgOptions(defaultTargetType)
}

function openFactoryRestoreModal(row: BatteryItem) {
  factoryRestoreForm.value = {
    device_id: row.device_id,
    device_number: row.device_number,
    current_org_name: row.owner_org_name || row.dealer_name || '--',
    remark: ''
  }
  showFactoryRestoreModal.value = true
}

async function openRollbackModal(row: BatteryItem) {
  rollbackLoading.value = true
  try {
    const res: any = await getBatteryRollbackPreview({ device_id: row.device_id })
    const preview = res?.data || {}
    if (!preview?.can_rollback) {
      message.warning(preview?.reason || bt('auto.s_aae649a243'))
      return
    }
    rollbackForm.value = {
      device_id: preview.device_id || row.device_id,
      device_number: preview.device_number || row.device_number,
      current_org_name: preview.current_org_name || row.owner_org_name || row.dealer_name || bt('auto.s_5b80f24aa3'),
      rollback_to_org_id: preview.rollback_to_org_id || null,
      rollback_to_org_name: preview.rollback_to_org_name || '',
      remark: ''
    }
    showRollbackModal.value = true
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_12f754509f'))
  } finally {
    rollbackLoading.value = false
  }
}

async function confirmFactoryRestore() {
  factoryRestoreLoading.value = true
  try {
    await factoryRestoreBattery({
      device_id: factoryRestoreForm.value.device_id,
      remark: factoryRestoreForm.value.remark?.trim() ? factoryRestoreForm.value.remark.trim() : undefined
    })
    message.success(bt('auto.s_a55835d018'))
    showFactoryRestoreModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_ffff0f93f9'))
  } finally {
    factoryRestoreLoading.value = false
  }
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
    message.warning(bt('auto.s_856fa04dd8'))
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
    message.warning(bt('auto.s_40ab475cea'))
    return
  }
  factoryLoading.value = true
  try {
    const remark = factoryForm.value.remark?.trim() ? factoryForm.value.remark.trim() : undefined
    if (factoryMode.value === 'batch') {
      const res: any = await batchFactoryOutBattery({
        device_ids: factoryForm.value.device_ids,
        to_org_id: factoryForm.value.to_org_id,
        remark
      })
      const r = res?.data
      if (r) {
        const msg = bt('pages.batteryList.batchFactoryResult', {
          total: r.total,
          success: r.success,
          failed: r.failed
        })
        if (r.failed > 0 && r.failures?.length) {
          const failures = r.failures.map((f: any) => `${f.device_number || f.device_id}：${f.message}`).join('\n')
          message.warning(`${msg}\n${bt('pages.batteryList.failureDetails', { details: failures })}`, { duration: 10000 })
        } else {
          message.success(msg)
        }
      } else {
        message.success(bt('auto.s_0a3906de02'))
      }
      clearSelection()
    } else {
      await factoryOutBattery({
        device_id: factoryForm.value.device_id,
        to_org_id: factoryForm.value.to_org_id,
        remark
      })
      message.success(bt('auto.s_61c37b955a'))
    }
    showFactoryModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || (factoryMode.value === 'batch' ? bt('auto.s_c7832b0f75') : bt('auto.s_016a41a45d')))
  } finally {
    factoryLoading.value = false
  }
}

async function confirmTransfer() {
  if (!transferForm.value.to_org_id) {
    message.warning(bt('auto.s_a52513d5c8'))
    return
  }
  transferLoading.value = true
  try {
    await transferBattery({
      device_id: transferForm.value.device_id,
      to_org_id: transferForm.value.to_org_id,
      remark: transferForm.value.remark?.trim() ? transferForm.value.remark.trim() : undefined
    })
    message.success(bt('auto.s_986d239b72'))
    showTransferModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_7ff235650d'))
  } finally {
    transferLoading.value = false
  }
}

async function confirmRollback() {
  if (!rollbackForm.value.rollback_to_org_id) {
    message.warning(bt('auto.s_5ca512db4f'))
    return
  }
  rollbackLoading.value = true
  try {
    await rollbackBattery({
      device_id: rollbackForm.value.device_id,
      remark: rollbackForm.value.remark?.trim() ? rollbackForm.value.remark.trim() : undefined
    })
    message.success(bt('auto.s_742b8fabf6'))
    showRollbackModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_7e80aa54b3'))
  } finally {
    rollbackLoading.value = false
  }
}

async function confirmActivate() {
  if (!activateForm.value.user_id) {
    message.warning(bt('auto.s_d5c7d7ec80'))
    return
  }
  activateLoading.value = true
  try {
    await activateBattery({
      device_id: activateForm.value.device_id,
      user_id: activateForm.value.user_id,
      remark: activateForm.value.remark?.trim() ? activateForm.value.remark.trim() : undefined
    })
    message.success(bt('auto.s_240dec1fb2'))
    showActivateModal.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_912efdba9d'))
  } finally {
    activateLoading.value = false
  }
}

function handleBatchCompleteInfo() {
  if (selectedCount.value === 0) {
    message.warning(bt('auto.s_856fa04dd8'))
    return
  }
  openCompleteInfoModal(selectedRows.value)
}

async function confirmCompleteInfo() {
  if (!completeInfoForm.value.cell_brand_seq_no) {
    message.warning(bt('auto.s_3cb8d707db'))
    return
  }
  if (!completeInfoForm.value.battery_model_seq_no) {
    message.warning(bt('auto.s_bb89a8596d'))
    return
  }

  completeInfoLoading.value = true
  try {
    await completeBatteryInfo({
      device_ids: completeInfoForm.value.device_ids,
      cell_brand_seq_no: completeInfoForm.value.cell_brand_seq_no,
      battery_model_seq_no: completeInfoForm.value.battery_model_seq_no
    })
    message.success(bt('auto.s_57cde3445b'))
    showCompleteInfoModal.value = false
    clearSelection()
    getData()
  } catch (error: any) {
    message.error(error?.message || bt('auto.s_9c5e959bb3'))
  } finally {
    completeInfoLoading.value = false
  }
}

// 批量分配经销商
function handleBatchAssign() {
  if (selectedCount.value === 0) {
    message.warning(bt('auto.s_696436339e'))
    return
  }
  showBatchAssignModal.value = true
}

async function handleBatchTag() {
  if (selectedCount.value === 0) {
    message.warning(bt('auto.s_06854285b0'))
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
  if (selectedCount.value === 0) {
    message.warning(bt('auto.s_84d89952cf'))
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
  if (selectedCount.value === 0) {
    message.warning(bt('auto.s_0107c5d1ee'))
    return
  }
  showBatchOtaModal.value = true
  batchOtaLoading.value = true
  batchOtaForm.value = { ota_upgrade_package_id: '', name: '' }
  lastOtaTaskId.value = ''
  try {
    const res: any = await getOtaUpgradePackageList({ page: 1, page_size: 1000, device_kind: 1 })
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
    message.warning(bt('auto.s_c9004a9e85'))
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
      const msg = bt('pages.batteryList.otaCreated', {
        taskId: r.task_id ? `(${r.task_id})` : '',
        total: r.total,
        accepted: r.accepted,
        rejected: r.rejected
      })
      if (r.rejected > 0 && r.failures?.length) {
        const failures = r.failures.map((f: any) => `${f.device_number || f.device_id}：${f.message}`).join('\n')
        message.warning(`${msg}\n${bt('pages.batteryList.rejectDetails', { details: failures })}`, { duration: 10000 })
      } else {
        message.success(msg)
      }
    } else {
      message.success(bt('auto.s_368a09b873'))
    }
    showBatchOtaModal.value = false
    // 不清空选择，方便继续操作；但多数情况下推送后清空更合理
    clearSelection()
    if (lastOtaTaskId.value) {
      openOtaTaskDetail(lastOtaTaskId.value)
    }
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_e7fce7fea2'))
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
    message.warning(bt('auto.s_48deaf43fe'))
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
      const msg = bt('pages.batteryList.commandResult', {
        total: r.total,
        success: r.success,
        failed: r.failed
      })
      if (r.failed > 0 && r.failures?.length) {
        const failures = r.failures.map((f: any) => `${f.device_number || f.device_id}：${f.message}`).join('\n')
        message.warning(`${msg}\n${bt('pages.batteryList.failureDetails', { details: failures })}`, { duration: 10000 })
      } else {
        message.success(msg)
      }
    } else {
      message.success(bt('auto.s_f083484dcb'))
    }
    showBatchCmdModal.value = false
    clearSelection()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_ea171450f9'))
  } finally {
    batchCmdLoading.value = false
  }
}

async function confirmBatchAssign() {
  if (!batchAssignForm.value.dealer_id) {
    message.warning(bt('auto.s_79a6bb6071'))
    return
  }

  batchAssignLoading.value = true
  try {
    await batchAssignDealer({
      device_ids: selectedRowKeys.value,
      dealer_id: batchAssignForm.value.dealer_id
    })
    message.success(bt('auto.s_ea98411a91'))
    showBatchAssignModal.value = false
    clearSelection()
    batchAssignForm.value.dealer_id = null
    getData()
  } catch (error: any) {
    message.error(error?.message || bt('auto.s_01290ebc65'))
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
    message.success(bt('auto.s_6fa72b2218'))
    showBatchTagModal.value = false
    clearSelection()
    batchTagForm.value.tag_ids = []
    batchTagForm.value.mode = 'REPLACE'
    getData()
  } catch (error: any) {
    message.error(error?.message || bt('auto.s_4a6bfa7adc'))
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
    message.warning(bt('auto.s_48deaf43fe'))
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
    message.success(bt('auto.s_73862d9201'))
    showOfflineCmdModal.value = false
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_8b01aee608'))
  } finally {
    offlineCmdLoading.value = false
  }
}

function handleSearch() {
  const [start, end] = searchForm.value.production_range || []
  clearSelection()

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
  clearSelection()
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

watch(
  data,
  rows => {
    syncSelectedRowsFromCurrentPage(rows)
  },
  { deep: true }
)

onMounted(async () => {
  // 等待权限加载后刷新列，确保“操作”菜单按权限过滤
  await ensureUiPermissionState()
  reloadColumns()
  initSelectOptions()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_120b88c907')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
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

              <NFormItem :label="bt('auto.s_c44c1028d5')" path="battery_model_id" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.battery_model_id"
                  :options="bmsModelOptions"
                  :placeholder="bt('auto.s_1d3a241383')"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>

              <div class="battery-search-actions">
                <NButton type="primary" @click="handleSearch">{{ bt('auto.s_bee912d79e') }}</NButton>
                <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
                <NButton text type="primary" @click="showAdvancedSearch = !showAdvancedSearch">
                  {{
                    showAdvancedSearch
                      ? bt('auto.s_5e0e0c6169')
                      : bt('pages.batteryList.advancedFilter', {
                          count: activeAdvancedFilterCount ? `(${activeAdvancedFilterCount})` : ''
                        })
                  }}
                </NButton>
              </div>
            </div>

            <div v-show="showAdvancedSearch" class="battery-search-advanced">
              <NFormItem v-if="canFilterByOrgType" :label="bt('auto.s_f835eef9e8')" path="owner_org_type" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.owner_org_type"
                  :options="ownerOrgTypeOptions"
                  :placeholder="bt('auto.s_95f11c5690')"
                  clearable
                  class="battery-search-control"
                  @update:value="handleOwnerOrgTypeChange"
                />
              </NFormItem>

              <NFormItem v-if="canFilterByOrgType" :label="bt('auto.s_6ce6f1493b')" path="owner_org_id" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.owner_org_id"
                  :options="ownerOrgOptions"
                  :placeholder="bt('auto.s_2c919d5bda')"
                  clearable
                  class="battery-search-control battery-search-control-wide"
                />
              </NFormItem>

              <NFormItem :label="bt('auto.s_b7f1936e90')" path="cell_brand_seq_no" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.cell_brand_seq_no"
                  :options="cellBrandOptions"
                  :placeholder="bt('auto.s_3cb8d707db')"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>

              <NFormItem :label="bt('auto.s_ca62d89383')" path="battery_model_seq_no" class="battery-search-item">
                <BatteryModelSelect
                  v-model="searchForm.battery_model_seq_no"
                  :allow-create="false"
                  class="battery-search-control battery-search-control-wide"
                  :placeholder="bt('auto.s_bb89a8596d')"
                />
              </NFormItem>

              <NFormItem :label="bt('auto.s_e639862a11')" path="is_online" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.is_online"
                  :options="onlineOptions"
                  :placeholder="bt('auto.s_708c9d6d2a')"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>

              <NFormItem :label="bt('auto.s_ffecc9f0be')" path="activation_status" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.activation_status"
                  :options="activationOptions"
                  :placeholder="bt('auto.s_708c9d6d2a')"
                  clearable
                  class="battery-search-control"
                />
              </NFormItem>

              <NFormItem :label="bt('auto.s_fbe2fcd983')" path="production_range" class="battery-search-item">
                <NDatePicker
                  v-model:value="searchForm.production_range"
                  type="daterange"
                  clearable
                  class="battery-search-control battery-search-control-wide"
                />
              </NFormItem>

              <NFormItem :label="bt('auto.s_0184fa443d')" path="warranty_status" class="battery-search-item">
                <NSelect
                  v-model:value="searchForm.warranty_status"
                  :options="warrantyOptions"
                  :placeholder="bt('auto.s_708c9d6d2a')"
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
                {{ bt('auto.s_55405ea6ff') }}
              </NButton>
              <NButton v-ui-permission="'bms_battery_list_add'" type="primary" @click="openSingleModal">
                {{ bt('common.addWithName', { name: 'BMS' }) }}
              </NButton>
              <NButton v-ui-permission="'bms_battery_list_import'" @click="openImportModal">
                <template #icon>
                  <NIcon><CloudDownloadOutline /></NIcon>
                </template>
                {{ bt('auto.s_8d9a071ee2') }}
              </NButton>
            </NSpace>

            <NDropdown
              v-if="getBatchActionOptions().length"
              :options="getBatchActionOptions()"
              trigger="click"
              @select="handleBatchActionSelect"
            >
              <NButton :disabled="selectedCount === 0">
                <template #icon>
                  <NIcon><ListOutline /></NIcon>
                </template>
                {{ bt('pages.batteryList.batchAction', { count: selectedCount ? `(${selectedCount})` : '' }) }}
              </NButton>
            </NDropdown>
          </NSpace>
        </div>

        <div class="battery-table-shell">
          <div class="battery-table-scroll">
            <NDataTable
              :checked-row-keys="selectedRowKeys"
              :columns="columns"
              :data="data"
              class="battery-data-table"
              flex-height
              :loading="loading"
              :pagination="false"
              :row-key="row => row.device_id"
              :scroll-x="scrollX"
              @update:checked-row-keys="handleSelectionChange"
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
      :title="bt('auto.s_3886905b9c')"
      :positive-text="bt('auto.s_e83a256e4f')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="batchAssignLoading"
      @positive-click="confirmBatchAssign"
    >
      <NForm :model="batchAssignForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_9019dc8029')" path="dealer_id" required>
          <NSelect
            v-model:value="batchAssignForm.dealer_id"
            :options="dealerOptions"
            :placeholder="bt('auto.s_79a6bb6071')"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            {{ bt('common.selectedBatteriesAssign', { count: selectedCount }) }}
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showBatchTagModal"
      preset="dialog"
      :title="bt('auto.s_e6fae0e464')"
      :positive-text="bt('auto.s_e83a256e4f')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="batchTagLoading"
      @positive-click="confirmBatchTag"
    >
      <NForm :model="batchTagForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_b2abcf3d39')" path="mode" required>
          <NSelect
            v-model:value="batchTagForm.mode"
            :options="[
              { label: bt('auto.s_87286a2f69'), value: 'REPLACE' },
              { label: bt('auto.s_40542181bf'), value: 'APPEND' }
            ]"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_14d342362f')" path="tag_ids">
          <NSelect
            v-model:value="batchTagForm.tag_ids"
            :options="tagOptions"
            :placeholder="bt('auto.s_00254e54a7')"
            multiple
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">{{ bt('common.selectedBatteries', { count: selectedCount }) }}</div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showFactoryModal"
      preset="dialog"
      :title="factoryMode === 'batch' ? bt('auto.s_51af1c7e1e') : bt('auto.s_736c321cf9')"
      :positive-text="bt('auto.s_d3d7ea5cd9')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="factoryLoading"
      @positive-click="confirmFactoryOut"
    >
      <NForm :model="factoryForm" label-placement="left" label-width="100px">
        <template v-if="factoryMode === 'batch'">
          <NFormItem :label="bt('auto.s_63843f5a90')">
            <div style="color: #666">{{ bt('common.unitCount', { count: factoryForm.device_ids.length }) }}</div>
          </NFormItem>
          <NFormItem :label="bt('auto.s_6ea1fe6baa')">
            <div class="complete-info-summary">
              <div v-for="item in selectedRows" :key="item.device_id" class="complete-info-row">
                <div>{{ bt('common.labelWithValue', { label: bt('auto.s_7079d2e6c4'), value: item.device_number }) }}</div>
                <div>
                  {{
                    bt('common.labelWithValue', {
                      label: bt('auto.s_6ce6f1493b'),
                      value: item.owner_org_name || item.dealer_name || bt('auto.s_a14d2ac1e0')
                    })
                  }}
                </div>
                <div>{{ bt('common.labelWithValue', { label: bt('auto.s_fbe2fcd983'), value: item.production_date || '--' }) }}</div>
                <div>{{ bt('common.labelWithValue', { label: bt('auto.s_6bf1f392c0'), value: currentStatusLabel(item) }) }}</div>
              </div>
            </div>
          </NFormItem>
        </template>
        <NFormItem v-else :label="bt('auto.s_90ccdfe522')">
          <NInput v-model:value="factoryForm.device_number" disabled />
        </NFormItem>
        <NFormItem :label="bt('auto.s_2a7d59e32b')" path="to_org_type" required>
          <NRadioGroup v-model:value="factoryForm.to_org_type" @update:value="handleFactoryOrgTypeChange">
            <NRadioButton value="PACK_FACTORY">{{ bt('auto.s_7b50c41556') }}</NRadioButton>
            <NRadioButton value="DEALER">{{ bt('auto.s_9019dc8029') }}</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="bt('auto.s_206ad5fbd2')" path="to_org_id" required>
          <NSelect
            v-model:value="factoryForm.to_org_id"
            :options="factoryTargetOptions"
            :placeholder="bt('auto.s_5933d0b01e')"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_2432b57515')">
          <NInput v-model:value="factoryForm.remark" :placeholder="bt('auto.s_c20cba8992')" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showTransferModal"
      preset="dialog"
      :title="bt('auto.s_0cccb8acdf')"
      :positive-text="bt('auto.s_16e2eab6ee')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="transferLoading"
      @positive-click="confirmTransfer"
    >
      <NForm :model="transferForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_90ccdfe522')">
          <NInput v-model:value="transferForm.device_number" disabled />
        </NFormItem>
        <NFormItem :label="bt('auto.s_5b80f24aa3')">
          <NInput v-model:value="transferForm.from_org_name" disabled />
        </NFormItem>
        <NFormItem :label="bt('auto.s_62a44be140')" path="to_org_type" required>
          <NRadioGroup v-model:value="transferForm.to_org_type" @update:value="handleTransferOrgTypeChange">
            <NRadioButton v-for="item in transferOrgTypeOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="bt('auto.s_206ad5fbd2')" path="to_org_id" required>
          <NSelect
            v-model:value="transferForm.to_org_id"
            :options="transferTargetOptions"
            :placeholder="bt('auto.s_5933d0b01e')"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_2432b57515')">
          <NInput v-model:value="transferForm.remark" :placeholder="bt('auto.s_c20cba8992')" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showFactoryRestoreModal"
      preset="dialog"
      :title="bt('auto.s_2f6f278e3c')"
      :positive-text="bt('auto.s_841e5e8912')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="factoryRestoreLoading"
      @positive-click="confirmFactoryRestore"
    >
      <NForm :model="factoryRestoreForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_90ccdfe522')">
          <NInput v-model:value="factoryRestoreForm.device_number" disabled />
        </NFormItem>
        <NFormItem :label="bt('auto.s_5b80f24aa3')">
          <NInput v-model:value="factoryRestoreForm.current_org_name" disabled />
        </NFormItem>
        <NFormItem :label="bt('auto.s_26e3fd57e7')">
          <NInput :value="bt('auto.s_a14d2ac1e0')" disabled />
        </NFormItem>
        <NFormItem>
          <div style="color: #666">{{ bt('auto.s_74632e9735') }}</div>
        </NFormItem>
        <NFormItem :label="bt('auto.s_2432b57515')">
          <NInput v-model:value="factoryRestoreForm.remark" :placeholder="bt('auto.s_c20cba8992')" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showRollbackModal"
      preset="dialog"
      :title="bt('auto.s_251cfcb39a')"
      :positive-text="bt('auto.s_6a793b2956')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="rollbackLoading"
      @positive-click="confirmRollback"
    >
      <NForm :model="rollbackForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_90ccdfe522')">
          <NInput v-model:value="rollbackForm.device_number" disabled />
        </NFormItem>
        <NFormItem :label="bt('auto.s_5b80f24aa3')">
          <NInput v-model:value="rollbackForm.current_org_name" disabled />
        </NFormItem>
        <NFormItem :label="bt('auto.s_a0713840dd')">
          <NInput v-model:value="rollbackForm.rollback_to_org_name" disabled />
        </NFormItem>
        <NFormItem>
          <div style="color: #666">{{ bt('auto.s_2a387bf218') }}</div>
        </NFormItem>
        <NFormItem :label="bt('auto.s_2432b57515')">
          <NInput v-model:value="rollbackForm.remark" :placeholder="bt('auto.s_c20cba8992')" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showActivateModal"
      preset="dialog"
      :title="bt('auto.s_90a738e2f3')"
      :positive-text="bt('auto.s_4366cd37a7')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="activateLoading"
      @positive-click="confirmActivate"
    >
      <NForm :model="activateForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_90ccdfe522')">
          <NInput v-model:value="activateForm.device_number" disabled />
        </NFormItem>
        <NFormItem :label="bt('auto.s_6bf1f392c0')">
          <div class="flex items-center gap-8px">
            <NTag type="info">{{ activationLabel(activateCurrent.status) }}</NTag>
            <span v-if="activateCurrent.status === 'ACTIVE'" style="color: #666; font-size: 12px">
              {{ activateCurrent.user_phone }}
              <span v-if="activateCurrent.user_name">（{{ activateCurrent.user_name }}）</span>
              <span v-if="activateCurrent.activation_date">· {{ activateCurrent.activation_date }}</span>
            </span>
          </div>
        </NFormItem>
        <NFormItem :label="bt('auto.s_951d19e263')" path="user_id" required>
          <EndUserSelect v-model="activateForm.user_id" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_2432b57515')">
          <NInput v-model:value="activateForm.remark" :placeholder="bt('auto.s_c20cba8992')" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showCompleteInfoModal"
      preset="dialog"
      :title="bt('auto.s_c9c2396d84')"
      :positive-text="bt('auto.s_e7513d9dcb')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="completeInfoLoading"
      @positive-click="confirmCompleteInfo"
    >
      <NForm :model="completeInfoForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_63843f5a90')">
          <div style="color: #666">{{ bt('common.unitCount', { count: completeInfoRows.length }) }}</div>
        </NFormItem>
        <NFormItem :label="bt('auto.s_6ea1fe6baa')">
          <div class="complete-info-summary">
            <div v-for="item in completeInfoRows" :key="item.device_id" class="complete-info-row">
              <div>{{ bt('common.labelWithValue', { label: bt('auto.s_7079d2e6c4'), value: item.device_number }) }}</div>
              <div>{{ bt('common.labelWithValue', { label: 'MAC', value: item.ble_mac || '--' }) }}</div>
              <div>{{ bt('common.labelWithValue', { label: bt('auto.s_fbe2fcd983'), value: item.production_date || '--' }) }}</div>
              <div>{{ bt('common.labelWithValue', { label: bt('auto.s_6bf1f392c0'), value: currentStatusLabel(item) }) }}</div>
            </div>
          </div>
        </NFormItem>
        <NFormItem :label="bt('auto.s_b7f1936e90')" path="cell_brand_seq_no" required>
          <NSelect
            v-model:value="completeInfoForm.cell_brand_seq_no"
            :options="cellBrandOptions"
            :placeholder="bt('auto.s_3cb8d707db')"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_ca62d89383')" path="battery_model_seq_no" required>
          <BatteryModelSelect
            v-model="completeInfoForm.battery_model_seq_no"
            :allow-create="true"
            :placeholder="bt('auto.s_bb89a8596d')"
          />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showOfflineCmdModal"
      preset="dialog"
      :title="bt('auto.s_a658b74e2b')"
      :positive-text="bt('auto.s_695b5e841a')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="offlineCmdLoading"
      @positive-click="confirmOfflineCmd"
    >
      <NForm :model="offlineCmdForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_eb18b1e89c')" path="identify" required>
          <NSelect
            v-model:value="offlineCmdForm.identify"
            :options="offlineCmdOptions"
            :placeholder="bt('auto.s_48deaf43fe')"
            clearable
            style="width: 100%"
            @update:value="handleOfflineCmdSelect"
          />
        </NFormItem>
        <NFormItem v-if="offlineCmdHint" :label="bt('auto.s_21f2fa80eb')">
          <div style="color: #999; font-size: 12px; white-space: pre-wrap">{{ offlineCmdHint }}</div>
        </NFormItem>
        <NFormItem :label="bt('auto.s_e19150f403')" path="value">
          <NInput
            v-model:value="offlineCmdForm.value"
            type="textarea"
            :placeholder="bt('auto.s_d01e1a05c7')"
            :autosize="{ minRows: 3, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            {{ bt('pages.batteryList.offlineHint') }}
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showBatchCmdModal"
      preset="dialog"
      :title="bt('auto.s_4d46ae103d')"
      :positive-text="bt('auto.s_35e127ec44')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="batchCmdLoading"
      @positive-click="confirmBatchCommand"
    >
      <NForm :model="batchCmdForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_eb18b1e89c')" path="identify" required>
          <NSelect
            v-model:value="batchCmdForm.identify"
            :options="batchCmdOptions"
            :placeholder="bt('auto.s_af0cef0028')"
            clearable
            style="width: 100%"
            @update:value="handleBatchCmdSelect"
          />
        </NFormItem>
        <NFormItem v-if="batchCmdHint" :label="bt('auto.s_21f2fa80eb')">
          <div style="color: #999; font-size: 12px; white-space: pre-wrap">{{ batchCmdHint }}</div>
        </NFormItem>
        <NFormItem :label="bt('auto.s_e19150f403')" path="value">
          <NInput
            v-model:value="batchCmdForm.value"
            type="textarea"
            :placeholder="bt('auto.s_d01e1a05c7')"
            :autosize="{ minRows: 3, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            {{ bt('pages.batteryList.batchCommandHint') }}
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showBatchOtaModal"
      preset="dialog"
      :title="bt('auto.s_26e6fda3e4')"
      :positive-text="bt('auto.s_03741bdd14')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="batchOtaLoading"
      @positive-click="confirmBatchOta"
    >
      <NForm :model="batchOtaForm" label-placement="left" label-width="100px">
        <NFormItem :label="bt('auto.s_d02bd59f32')" path="ota_upgrade_package_id" required>
          <NSelect
            v-model:value="batchOtaForm.ota_upgrade_package_id"
            :options="otaPkgOptions"
            :placeholder="bt('auto.s_c9004a9e85')"
            clearable
            filterable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_78caf7115c')">
          <NInput v-model:value="batchOtaForm.name" :placeholder="bt('auto.s_456639925f')" />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            {{ bt('pages.batteryList.batchOtaHint') }}
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal v-model:show="showOtaTaskDetailModal" preset="card" :title="bt('auto.s_aea34a08f5')" style="width: 980px">
      <template v-if="otaTaskDetailLoading">
        <div style="padding: 12px">{{ bt('auto.s_26b5bd4947') }}</div>
      </template>
      <template v-else>
        <div style="margin-bottom: 12px; color: #666; font-size: 12px">
          {{ bt('common.taskId', { id: lastOtaTaskId }) }}
          <NButton size="tiny" style="margin-left: 8px" @click="fetchOtaTaskDetail">{{ bt('auto.s_694fc5efa9') }}</NButton>
        </div>
        <div v-if="otaTaskDetailStats?.length" style="margin-bottom: 12px">
          <span
            v-for="s in otaTaskDetailStats"
            :key="s.status"
            style="margin-right: 12px; color: #666; font-size: 12px"
          >
            {{ bt('common.statusCount', { status: s.status, count: s.count }) }}
          </span>
        </div>
        <NDataTable
          :columns="[
            { key: 'device_number', title: bt('auto.s_7079d2e6c4'), minWidth: 140 },
            { key: 'name', title: bt('auto.s_9f694f603c'), minWidth: 140 },
            { key: 'current_version', title: bt('auto.s_9b601b8efa'), minWidth: 120 },
            { key: 'version', title: bt('auto.s_bc15bf0b06'), minWidth: 120 },
            { key: 'status', title: bt('auto.s_3fea7ca76c'), minWidth: 100 },
            { key: 'status_description', title: bt('auto.s_920f05031b'), minWidth: 180 },
            { key: 'updated_at', title: bt('auto.s_a001a226fd'), minWidth: 160 }
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
