import { request } from '../request'

// 经销商相关接口
// 注意：request 的 baseURL 已包含 /api/v1，路径中不要再写 /api/v1 前缀
export const getDealerList = (params: any) => {
  return request.get('/dealer', { params })
}

export const getDealerDetail = (id: string) => {
  return request.get(`/dealer/${id}`)
}

export const createDealer = (data: any) => {
  return request.post('/dealer', data)
}

export const updateDealer = (id: string, data: any) => {
  return request.put(`/dealer/${id}`, data)
}

export const deleteDealer = (id: string) => {
  return request.delete(`/dealer/${id}`)
}

export const getDealerOverview = (id: string) => {
  return request.get(`/dealer/${id}/overview`)
}

// 经销商权限模板（基础/高级）
export const getDealerPermissionTemplate = (id: string) => {
  return request.get(`/dealer/${id}/permission_template`)
}

export const setDealerPermissionTemplate = (id: string, data: { template: 'BASIC' | 'ADVANCED' }) => {
  return request.put(`/dealer/${id}/permission_template`, data)
}

// 激活日志（从操作日志派生）
export const getActivationLogList = (params: {
  page: number
  page_size: number
  device_number?: string
  user_phone?: string
  start_time?: string
  end_time?: string
  method?: 'APP' | 'WEB'
}) => {
  return request.get('/activation_logs', { params })
}

// 操作记录（复用后端 operation_logs）
export const getOperationLogList = (params: {
  page: number
  page_size: number
  username?: string
  ip?: string
  start_time?: string
  end_time?: string
  method?: string
  module?: string
  op_type?: string
}) => {
  return request.get('/operation_logs', { params })
}

// 电池型号相关接口
export const getBatteryModelList = (params: any) => {
  return request.get('/battery/model', { params })
}

export const getBatteryModelDetail = (id: string) => {
  return request.get(`/battery/model/${id}`)
}

export const createBatteryModel = (data: any) => {
  return request.post('/battery/model', data)
}

export const updateBatteryModel = (id: string, data: any) => {
  return request.put(`/battery/model/${id}`, data)
}

export const deleteBatteryModel = (id: string) => {
  return request.delete(`/battery/model/${id}`)
}

// BMS型号相关接口（battery_bms_models）
export const getBatteryBmsModelList = (params: any) => {
  return request.get('/battery/bms-model', { params })
}

export const getBatteryBmsModelDetail = (id: string) => {
  return request.get(`/battery/bms-model/${id}`)
}

export const createBatteryBmsModel = (data: any) => {
  return request.post('/battery/bms-model', data)
}

export const updateBatteryBmsModel = (id: string, data: any) => {
  return request.put(`/battery/bms-model/${id}`, data)
}

export const deleteBatteryBmsModel = (id: string) => {
  return request.delete(`/battery/bms-model/${id}`)
}

// 电芯品牌相关接口
export const getCellBrandList = (params?: { name?: string }) => {
  return request.get('/battery/cell-brand', { params })
}

export const createCellBrand = (data: { seq_no: number; name: string }) => {
  return request.post('/battery/cell-brand', data)
}

export const updateCellBrand = (id: string, data: { seq_no?: number; name?: string }) => {
  return request.put(`/battery/cell-brand/${id}`, data)
}

export const deleteCellBrand = (id: string) => {
  return request.delete(`/battery/cell-brand/${id}`)
}

// 设备转移相关接口
export const transferDevices = (data: any) => {
  return request.post('/device/transfer', data)
}

export const getTransferHistory = (params: any) => {
  return request.get('/device/transfer/history', { params })
}

// 维保相关接口
export const getWarrantyList = (params: any) => {
  return request.get('/warranty', { params })
}

export const getWarrantyDetail = (id: string) => {
  return request.get(`/warranty/${id}`)
}

export const createWarranty = (data: any) => {
  return request.post('/warranty', data)
}

export const updateWarrantyStatus = (id: string, data: any) => {
  return request.put(`/warranty/${id}`, data)
}

// 电池维保记录（手动）
export const getBatteryMaintenanceList = (params: any) => {
  return request.get('/battery_maintenance', { params })
}

export const createBatteryMaintenance = (data: any) => {
  return request.post('/battery_maintenance', data)
}

export const getBatteryMaintenanceDetail = (id: string) => {
  return request.get(`/battery_maintenance/${id}`)
}

// 电池列表（设备电池）相关接口
export const getBatteryList = (params: any) => {
  return request.get('/battery', { params })
}

export type BmsHistoryDeviceParams = {
  page: number
  page_size: number
  keyword?: string
}

export type BmsHistoryQueryParams = {
  device_id: string
  view_mode: 'long' | 'wide'
  start_time: number
  end_time: number
  page: number
  page_size: number
}

export type BmsHistoryExportParams = {
  device_id: string
  view_mode: 'long' | 'wide'
  start_time: number
  end_time: number
}

export type BmsHistoryWideColumn = {
  key: string
  data_type: string
  identifier: string
  data_name: string
}

export type BmsHistoryPendingJob = {
  task_id: string
  device_id: string
  device_number: string
  view_mode: 'long' | 'wide' | string
  start_time: number
  end_time: number
  file_name: string
  download_url: string
  finished_at: string
}

export type BmsHistoryExportWSMessage = {
  type: string
  task_id: string
  device_id: string
  file_name: string
  download_url: string
  finished_at: number
}

export const getBmsHistoryDeviceList = (params: BmsHistoryDeviceParams) => {
  return request.get('/battery/history/devices', { params })
}

export const getBmsHistoryData = (params: BmsHistoryQueryParams) => {
  return request.get('/battery/history', { params })
}

export const createBmsHistoryExportJob = (data: BmsHistoryExportParams) => {
  return request.post('/battery/history/export', data)
}

export const getBmsHistoryPendingExportJobs = (params?: { limit?: number }) => {
  return request.get('/battery/history/export/jobs/pending', { params })
}

export const downloadBmsHistoryExport = (taskId: string) => {
  return request.get('/battery/history/export/download', {
    params: { task_id: taskId },
    responseType: 'blob'
  })
}

// 导出电池列表
export const exportBatteryList = (params: any) => {
  return request.get('/battery/export', { params, responseType: 'blob' })
}

// 获取导入模板
export const getBatteryImportTemplate = () => {
  return request.get('/battery/import/template', { responseType: 'blob' })
}

// 导入电池列表
export const importBatteryList = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/battery/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// 导入任务状态
export const getBatteryImportJobStatus = (jobId: string) => {
  return request.get(`/battery/import/jobs/${jobId}`)
}

// 导入任务日志（增量）
export const getBatteryImportJobLogs = (jobId: string, params?: { after_id?: number; limit?: number }) => {
  return request.get(`/battery/import/jobs/${jobId}/logs`, { params })
}

// 添加单个电池
export const createSingleBattery = (data: any) => {
  return request.post('/battery/single', data)
}

export const updateSingleBattery = (deviceId: string, data: any) => {
  return request.put(`/battery/single/${deviceId}`, data)
}

export const deleteBattery = (deviceId: string) => {
  return request.delete(`/battery/${deviceId}`)
}

// 运营管理：电池运营日志
export const getBatteryOperationLogList = (params: any) => {
  return request.get('/battery/operation_logs', { params })
}

// 电池生命周期操作
export const factoryOutBattery = (data: { device_id: string; to_org_id: string; remark?: string }) => {
  return request.post('/battery/factory_out', data)
}

export const batchFactoryOutBattery = (data: { device_ids: string[]; to_org_id: string; remark?: string }) => {
  return request.post('/battery/batch-factory-out', data)
}

export const transferBattery = (data: { device_id: string; to_org_id: string; remark?: string }) => {
  return request.post('/battery/transfer', data)
}

export const activateBattery = (data: { device_id: string; user_id: string; remark?: string }) => {
  return request.post('/battery/activate', data)
}

export const completeBatteryInfo = (data: {
  device_ids: string[]
  cell_brand_seq_no: number
  battery_model_seq_no: number
}) => {
  return request.post('/battery/complete-info', data)
}

// 批量分配经销商
export const batchAssignDealer = (data: { device_ids: string[]; dealer_id: string }) => {
  return request.post('/battery/batch-assign-dealer', data)
}

// 电池标签
export const getBatteryTagList = (params: any) => {
  return request.get('/battery/tags', { params })
}

export const createBatteryTag = (data: any) => {
  return request.post('/battery/tags', data)
}

export const updateBatteryTag = (id: string, data: any) => {
  return request.put(`/battery/tags/${id}`, data)
}

export const deleteBatteryTag = (id: string) => {
  return request.delete(`/battery/tags/${id}`)
}

export const assignBatteryTags = (data: { device_ids: string[]; tag_ids: string[]; mode?: 'REPLACE' | 'APPEND' }) => {
  return request.post('/battery/tags/assign', data)
}

// 离线指令
export const getOfflineCommandList = (params: any) => {
  return request.get('/battery/offline-commands', { params })
}

export const createOfflineCommand = (data: {
  device_id: string
  command_type: string
  identify: string
  value?: string
}) => {
  return request.post('/battery/offline-commands', data)
}

export const getOfflineCommandDetail = (id: string) => {
  return request.get(`/battery/offline-commands/${id}`)
}

export const cancelOfflineCommand = (id: string) => {
  return request.delete(`/battery/offline-commands/${id}`)
}

// 批量下发指令（在线设备）

// APP-Battery：电池设备详情（含 comm_chip_id / ble_mac 等基础信息）
export const getAppBatteryDetail = (deviceId: string) => {
  return request.get(`/app/battery/detail/${deviceId}`)
}

export type BatteryRelayStatus = {
  device_id: string
  owner_online: boolean
  session_id?: string | null
  platform?: string | null
  conn_type?: string | null
  last_seen_ts?: number | null
  expires_at_ts?: number | null
  owner_user_id?: string | null
  owner_tenant_id?: string | null
}

export type BatteryRelayCommandReq = {
  device_id: string
  command_type: 'read_param' | 'write_param' | 'write_registers'
  param_key?: string
  value?: unknown
  start_address?: number
  register_values?: number[]
  wait_ms?: number
}

export type BatteryRelayCommandResp = {
  command_id: string
  device_id: string
  command_type: string
  status: 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | string
  error_message?: string | null
  result?: unknown
  created_at_ts: number
  updated_at_ts: number
  finished_at_ts?: number | null
}

export const getBatteryRelayStatus = (deviceId: string) => {
  return request.get(`/battery/relay/status/${deviceId}`)
}

export const sendBatteryRelayCommand = (payload: BatteryRelayCommandReq) => {
  return request.post('/battery/relay/command', payload)
}

export const getBatteryRelayCommand = (commandId: string) => {
  return request.get(`/battery/relay/command/${commandId}`)
}

export const batchSendBatteryCommand = (data: {
  device_ids: string[]
  command_type: string
  identify: string
  value?: string
}) => {
  return request.post('/battery/batch-command', data)
}

// OTA：获取升级包列表（复用系统接口）
export const getOtaUpgradePackageList = (params: any) => {
  return request.get('/ota/package', { params })
}

// OTA：上传升级包固件（返回可用于 package_url 的 path）
export const uploadOtaUpgradePackageFile = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', 'upgradePackage')
  return request.post('/file/up', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// OTA：批量推送（BMS封装）
export const batchPushOta = (data: {
  device_ids: string[]
  ota_upgrade_package_id: string
  name?: string
  description?: string
  remark?: string
}) => {
  return request.post('/battery/batch-ota', data)
}

// OTA：任务详情（复用系统接口）
export const getOtaTaskDetailByPage = (params: any) => {
  return request.get('/ota/task/detail', { params })
}

// OTA：任务列表（需传 ota_upgrade_package_id）
export const getOtaTaskList = (params: any) => {
  return request.get('/ota/task', { params })
}

// OTA：更新任务详情状态（取消/重新升级）
export const updateOtaTaskDetailStatus = (data: { id: string; action: 1 | 6 }) => {
  return request.put('/ota/task/detail', data)
}

// 参数远程查看/修改（BMS）
export const getBatteryParams = (deviceId: string) => {
  return request.get(`/battery/params/${deviceId}`)
}

export const requestBatteryParamsFromDevice = (data: { device_id: string; keys?: string[] }) => {
  return request.post('/battery/params/get', data)
}

export const putBatteryParams = (data: { device_id: string; value: string }) => {
  return request.post('/battery/params/pub', data)
}

export const getBatteryParamSetLogs = (params: {
  device_id: string
  page: number
  page_size: number
  status?: string
  operation_type?: string
}) => {
  return request.get('/battery/params/set/logs', { params })
}

// BMS Dashboard
export const getBmsDashboardKpi = () => {
  return request.get('/dashboard/kpi')
}

export const getBmsDashboardAlarmOverview = (params?: { days?: number }) => {
  return request.get('/dashboard/alarm/overview', { params })
}

export const getBmsDashboardOnlineTrend = () => {
  return request.get('/dashboard/trend/online')
}

export type BmsActivationTrendPoint = {
  date: string
  count: number
}

export type BmsHomeSummaryResp = {
  user_kind: 'ORG_USER' | 'END_USER' | string
  org_type: string
  institution?: {
    battery_total: number
    online_count: number
    offline_count: number
    activated_count: number
    inactive_count: number
    activation_trend_week: BmsActivationTrendPoint[]
    activation_trend_month: BmsActivationTrendPoint[]
  }
  end_user?: {
    battery_total: number
  }
}

export type BmsHomeSummaryQuery = {
  view_as?: 'TENANT' | 'PACK_FACTORY' | 'DEALER' | 'STORE' | 'APP_USER'
}

export const getBmsHomeSummary = (params?: BmsHomeSummaryQuery) => {
  return request.get<BmsHomeSummaryResp>('/dashboard/home/summary', { params })
}

// 终端用户（BMS穿透）
export const getEndUserList = (params: any) => {
  return request.get('/end_user', { params })
}

export const getEndUserDevices = (params: any) => {
  return request.get('/end_user/devices', { params })
}

export const forceUnbindEndUserDevice = (data: { binding_id: string }) => {
  return request.post('/end_user/force_unbind', data)
}

// ============================================================================
// 组织管理（Org Tree - 多层级）
// ============================================================================

// 组织类型常量
export const OrgTypes = {
  BMS_FACTORY: 'BMS_FACTORY',
  PACK_FACTORY: 'PACK_FACTORY',
  DEALER: 'DEALER',
  STORE: 'STORE'
} as const

export const OrgTypeLabels: Record<string, string> = {
  BMS_FACTORY: 'BMS厂家',
  PACK_FACTORY: 'PACK厂家',
  DEALER: '经销商',
  STORE: '门店'
}

// 组织列表
export const getOrgList = (params: {
  page: number
  page_size: number
  org_type?: string
  name?: string
  status?: string
  parent_id?: string
}) => {
  return request.get('/org', { params })
}

// 组织选项（按当前账号权限范围）
export const getOrgScopeOptions = (params: { org_type: string }) => {
  return request.get('/app/org/options', { params })
}

// 组织详情
export const getOrgDetail = (id: string) => {
  return request.get(`/org/${id}`)
}

// 创建组织
export const createOrg = (data: {
  name: string
  org_type: string
  parent_id?: string
  contact_person?: string
  phone?: string
  email?: string
  province?: string
  city?: string
  district?: string
  address?: string
  remark?: string
  account?: {
    username: string
    password: string
  }
}) => {
  return request.post('/org', data)
}

// 更新组织
export const updateOrg = (
  id: string,
  data: {
    name?: string
    contact_person?: string
    phone?: string
    email?: string
    province?: string
    city?: string
    district?: string
    address?: string
    status?: string
    remark?: string
  }
) => {
  return request.put(`/org/${id}`, data)
}

// 删除组织
export const deleteOrg = (id: string) => {
  return request.delete(`/org/${id}`)
}

// 组织树
export const getOrgTree = (params?: { org_type?: string }) => {
  return request.get('/org/tree', { params })
}

// 重置组织账号密码
export const resetOrgAccountPassword = (id: string, data: { password: string }) => {
  return request.put(`/org/${id}/account/password`, data)
}

// 设备组织转移
export const transferDevicesToOrg = (data: { device_ids: string[]; to_org_id?: string; remark?: string }) => {
  return request.post('/device/transfer/org', data)
}

// 组织转移历史
export const getOrgTransferHistory = (params: {
  page: number
  page_size: number
  device_number?: string
  from_org_id?: string
  to_org_id?: string
  start_time?: string
  end_time?: string
}) => {
  return request.get('/device/transfer/org/history', { params })
}
