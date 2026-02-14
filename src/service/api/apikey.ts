import { request } from '../request'

/** 获取keys列表 */
export const fetchKeyList = async (params: Api.UserManagement.KeyQuery) => {
  const data = await request.get<Api.UserManagement.KeyData | null>('/open/keys', {
    params
  })
  return data
}

/** 添加key */
export const addKey = async (params: Api.UserManagement.KeyCreateReq) => {
  const data = await request.post<Api.BaseApi.Data>('/open/keys', params)
  return data
}

/** 更新key */
export const updateKey = async (params: Api.UserManagement.KeyUpdateReq) => {
  const data = await request.put<Api.BaseApi.Data>('/open/keys', params)
  return data
}
/** 删除key */
export const apiKeyDel = async (id: string) => {
  return await request.delete<Api.BaseApi.Data | any>(`/open/keys/${id}`)
}
