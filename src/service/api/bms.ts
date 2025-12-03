import { request } from '../request';

// 经销商相关接口
export const getDealerList = (params: any) => {
  return request.get('/api/v1/dealer', { params });
};

export const getDealerDetail = (id: string) => {
  return request.get(`/api/v1/dealer/${id}`);
};

export const createDealer = (data: any) => {
  return request.post('/api/v1/dealer', data);
};

export const updateDealer = (id: string, data: any) => {
  return request.put(`/api/v1/dealer/${id}`, data);
};

export const deleteDealer = (id: string) => {
  return request.delete(`/api/v1/dealer/${id}`);
};

// 电池型号相关接口
export const getBatteryModelList = (params: any) => {
  return request.get('/api/v1/battery/model', { params });
};

export const getBatteryModelDetail = (id: string) => {
  return request.get(`/api/v1/battery/model/${id}`);
};

export const createBatteryModel = (data: any) => {
  return request.post('/api/v1/battery/model', data);
};

export const updateBatteryModel = (id: string, data: any) => {
  return request.put(`/api/v1/battery/model/${id}`, data);
};

export const deleteBatteryModel = (id: string) => {
  return request.delete(`/api/v1/battery/model/${id}`);
};

// 设备转移相关接口
export const transferDevices = (data: any) => {
  return request.post('/api/v1/device/transfer', data);
};

export const getTransferHistory = (params: any) => {
  return request.get('/api/v1/device/transfer/history', { params });
};

// 维保相关接口
export const getWarrantyList = (params: any) => {
  return request.get('/api/v1/warranty', { params });
};

export const getWarrantyDetail = (id: string) => {
  return request.get(`/api/v1/warranty/${id}`);
};

export const createWarranty = (data: any) => {
  return request.post('/api/v1/warranty', data);
};

export const updateWarrantyStatus = (id: string, data: any) => {
  return request.put(`/api/v1/warranty/${id}`, data);
};
