import { request } from '../request'

export type OrgTypePermissionItem = {
  org_type: string
  ui_codes: string[]
  device_param_permissions: string
}

export type DeviceParamNode = {
  label: string
  value: string
  children?: DeviceParamNode[]
}

export type DeviceParamPermissionResp = {
  org_type: string
  allow_all: boolean
  device_param_permissions: string[]
}

export const fetchOrgTypePermissions = (params?: { tenant_id?: string }) => {
  return request.get<OrgTypePermissionItem[]>('/org_type_permissions', { params })
}

export const upsertOrgTypePermission = (
  orgType: string,
  data: { ui_codes: string[]; device_param_permissions: string },
  params?: { tenant_id?: string }
) => {
  return request.put<OrgTypePermissionItem>(`/org_type_permissions/${orgType}`, data, { params })
}

export const fetchDeviceParamPermissionOptions = () => {
  return request.get<DeviceParamNode[]>('/org_type_permissions/device_param_options')
}

export const fetchCurrentDeviceParamPermissions = () => {
  return request.get<DeviceParamPermissionResp>('/org_type_permissions/device_param_permissions/me')
}
