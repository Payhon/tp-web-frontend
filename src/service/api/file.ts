import { request } from '../request'

export const getFileListByPage = async (params: Api.File.ListReq) => {
  const data = await request.get<Api.File.ListRsp>('/file/list', { params })
  return data
}

export const registerCloudFile = async (params: Api.File.RegisterCloudReq) => {
  const data = await request.post<Api.File.UploadRsp>('/file/cloud/register', params)
  return data
}

export const createCloudUploadCredential = async (params: Api.File.CreateCloudCredentialReq) => {
  const data = await request.post<Api.File.CloudCredentialRsp>('/file/cloud/credential', params)
  return data
}
