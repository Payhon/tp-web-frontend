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

// 电池列表（设备电池）相关接口
export const getBatteryList = (params: any) => {
  return request.get('/battery', { params });
};
