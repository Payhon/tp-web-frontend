import { request } from '../request';

// 经销商相关接口
// 注意：request 的 baseURL 已包含 /api/v1，路径中不要再写 /api/v1 前缀
export const getDealerList = (params: any) => {
  return request.get('/dealer', { params });
};

export const getDealerDetail = (id: string) => {
  return request.get(`/dealer/${id}`);
};

export const createDealer = (data: any) => {
  return request.post('/dealer', data);
};

export const updateDealer = (id: string, data: any) => {
  return request.put(`/dealer/${id}`, data);
};

export const deleteDealer = (id: string) => {
  return request.delete(`/dealer/${id}`);
};

export const getDealerOverview = (id: string) => {
  return request.get(`/dealer/${id}/overview`);
};

// 经销商权限模板（基础/高级）
export const getDealerPermissionTemplate = (id: string) => {
  return request.get(`/dealer/${id}/permission_template`);
};

export const setDealerPermissionTemplate = (id: string, data: { template: 'BASIC' | 'ADVANCED' }) => {
  return request.put(`/dealer/${id}/permission_template`, data);
};

// 激活日志（从操作日志派生）
export const getActivationLogList = (params: {
  page: number;
  page_size: number;
  device_number?: string;
  user_phone?: string;
  start_time?: string;
  end_time?: string;
  method?: 'APP' | 'WEB';
}) => {
  return request.get('/activation_logs', { params });
};

// 操作记录（复用后端 operation_logs）
export const getOperationLogList = (params: {
  page: number;
  page_size: number;
  username?: string;
  ip?: string;
  start_time?: string;
  end_time?: string;
  method?: string;
  module?: string;
  op_type?: string;
}) => {
  return request.get('/operation_logs', { params });
};

// 电池型号相关接口
export const getBatteryModelList = (params: any) => {
  return request.get('/battery/model', { params });
};

export const getBatteryModelDetail = (id: string) => {
  return request.get(`/battery/model/${id}`);
};

export const createBatteryModel = (data: any) => {
  return request.post('/battery/model', data);
};

export const updateBatteryModel = (id: string, data: any) => {
  return request.put(`/battery/model/${id}`, data);
};

export const deleteBatteryModel = (id: string) => {
  return request.delete(`/battery/model/${id}`);
};

// 设备转移相关接口
export const transferDevices = (data: any) => {
  return request.post('/device/transfer', data);
};

export const getTransferHistory = (params: any) => {
  return request.get('/device/transfer/history', { params });
};

// 维保相关接口
export const getWarrantyList = (params: any) => {
  return request.get('/warranty', { params });
};

export const getWarrantyDetail = (id: string) => {
  return request.get(`/warranty/${id}`);
};

export const createWarranty = (data: any) => {
  return request.post('/warranty', data);
};

export const updateWarrantyStatus = (id: string, data: any) => {
  return request.put(`/warranty/${id}`, data);
};

// 电池维保记录（手动）
export const getBatteryMaintenanceList = (params: any) => {
  return request.get('/battery_maintenance', { params });
};

export const createBatteryMaintenance = (data: any) => {
  return request.post('/battery_maintenance', data);
};

export const getBatteryMaintenanceDetail = (id: string) => {
  return request.get(`/battery_maintenance/${id}`);
};

// 电池列表（设备电池）相关接口
export const getBatteryList = (params: any) => {
  return request.get('/battery', { params });
};

// 导出电池列表
export const exportBatteryList = (params: any) => {
  return request.get('/battery/export', { params, responseType: 'blob' });
};

// 获取导入模板
export const getBatteryImportTemplate = () => {
  return request.get('/battery/import/template', { responseType: 'blob' });
};

// 导入电池列表
export const importBatteryList = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/battery/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

// 批量分配经销商
export const batchAssignDealer = (data: { device_ids: string[]; dealer_id: string }) => {
  return request.post('/battery/batch-assign-dealer', data);
};

// 电池标签
export const getBatteryTagList = (params: any) => {
  return request.get('/battery/tags', { params });
};

export const createBatteryTag = (data: any) => {
  return request.post('/battery/tags', data);
};

export const updateBatteryTag = (id: string, data: any) => {
  return request.put(`/battery/tags/${id}`, data);
};

export const deleteBatteryTag = (id: string) => {
  return request.delete(`/battery/tags/${id}`);
};

export const assignBatteryTags = (data: { device_ids: string[]; tag_ids: string[]; mode?: 'REPLACE' | 'APPEND' }) => {
  return request.post('/battery/tags/assign', data);
};

// 离线指令
export const getOfflineCommandList = (params: any) => {
  return request.get('/battery/offline-commands', { params });
};

export const createOfflineCommand = (data: {
  device_id: string;
  command_type: string;
  identify: string;
  value?: string;
}) => {
  return request.post('/battery/offline-commands', data);
};

export const getOfflineCommandDetail = (id: string) => {
  return request.get(`/battery/offline-commands/${id}`);
};

export const cancelOfflineCommand = (id: string) => {
  return request.delete(`/battery/offline-commands/${id}`);
};

// 批量下发指令（在线设备）
export const batchSendBatteryCommand = (data: {
  device_ids: string[];
  command_type: string;
  identify: string;
  value?: string;
}) => {
  return request.post('/battery/batch-command', data);
};

// OTA：获取升级包列表（复用系统接口）
export const getOtaUpgradePackageList = (params: any) => {
  return request.get('/ota/package', { params });
};

// OTA：上传升级包固件（返回可用于 package_url 的 path）
export const uploadOtaUpgradePackageFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'upgradePackage');
  return request.post('/file/up', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

// OTA：批量推送（BMS封装）
export const batchPushOta = (data: { device_ids: string[]; ota_upgrade_package_id: string; name?: string; description?: string; remark?: string }) => {
  return request.post('/battery/batch-ota', data);
};

// OTA：任务详情（复用系统接口）
export const getOtaTaskDetailByPage = (params: any) => {
  return request.get('/ota/task/detail', { params });
};

// OTA：任务列表（需传 ota_upgrade_package_id）
export const getOtaTaskList = (params: any) => {
  return request.get('/ota/task', { params });
};

// OTA：更新任务详情状态（取消/重新升级）
export const updateOtaTaskDetailStatus = (data: { id: string; action: 1 | 6 }) => {
  return request.put('/ota/task/detail', data);
};

// 参数远程查看/修改（BMS）
export const getBatteryParams = (deviceId: string) => {
  return request.get(`/battery/params/${deviceId}`);
};

export const requestBatteryParamsFromDevice = (data: { device_id: string; keys?: string[] }) => {
  return request.post('/battery/params/get', data);
};

export const putBatteryParams = (data: { device_id: string; value: string }) => {
  return request.post('/battery/params/pub', data);
};

// BMS Dashboard
export const getBmsDashboardKpi = () => {
  return request.get('/dashboard/kpi');
};

export const getBmsDashboardAlarmOverview = (params?: { days?: number }) => {
  return request.get('/dashboard/alarm/overview', { params });
};

export const getBmsDashboardOnlineTrend = () => {
  return request.get('/dashboard/trend/online');
};

// 终端用户（BMS穿透）
export const getEndUserList = (params: any) => {
  return request.get('/end_user', { params });
};

export const getEndUserDevices = (params: any) => {
  return request.get('/end_user/devices', { params });
};

export const forceUnbindEndUserDevice = (data: { binding_id: string }) => {
  return request.post('/end_user/force_unbind', data);
};
