import { request } from '../request'

export const fetchDictCategories = async (params?: {
  scope?: 'all' | 'global' | 'tenant'
  tenant_id?: string
}): Promise<DictManagement.DictCategory[]> => {
  return await request.get('/dict/categories', { params })
}

export const fetchDictList = async (params: {
  page: number
  page_size: number
  category?: string
  dict_code?: string
  dict_value?: string
  scope?: 'all' | 'global' | 'tenant'
  tenant_id?: string
}): Promise<{ total: number; list: DictManagement.DictItem[] }> => {
  return await request.get('/dict', { params })
}

export const createDictItem = async (data: {
  dict_code: string
  dict_value: string
  category: string
  tenant_id?: string
  remark?: string | null
}): Promise<void> => {
  return await request.post('/dict/column', data)
}

export const updateDictItem = async (
  id: string,
  data: Partial<{
    dict_code: string
    dict_value: string
    category: string
    remark: string | null
  }>
): Promise<void> => {
  return await request.put(`/dict/column/${id}`, data)
}

export const deleteDictItem = async (id: string): Promise<void> => {
  return await request.delete(`/dict/column/${id}`)
}

export const fetchDictLanguages = async (dictId: string): Promise<DictManagement.DictLanguage[]> => {
  return await request.get(`/dict/language/${dictId}`)
}

export const upsertDictLanguage = async (data: {
  dict_id: string
  language_code: string
  translation: string
}): Promise<void> => {
  return await request.put('/dict/language', data)
}

export const deleteDictLanguage = async (id: string): Promise<void> => {
  return await request.delete(`/dict/language/${id}`)
}

export const fetchDictEnum = async (params: {
  dict_code: string
  language_code?: string
}): Promise<DictManagement.DictEnumItem[]> => {
  return await request.get('/dict/enum', { params })
}

export const fetchDictValueLabel = async (params: {
  dict_code: string
  dict_value: string
  language_code?: string
}): Promise<string> => {
  return await request.get('/dict/value', { params })
}
