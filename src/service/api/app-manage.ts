import { request } from '../request'

export type AppListParams = {
  page: number
  page_size: number
  keyword?: string
}

export type AppListItem = {
  id: string
  appid: string
  app_type: number
  name: string
  description?: string | null
  remark?: string | null
  created_at: string
}

export type AppListResp = {
  list: AppListItem[]
  total: number
  page: number
  page_size: number
}

export type AppDetail = {
  id: string
  appid: string
  app_type: number
  name: string
  description?: string | null
  icon_url?: string | null
  introduction?: string | null
  screenshot?: string[]
  app_android?: any
  app_ios?: any
  app_harmony?: any
  h5?: any
  quickapp?: any
  store_list?: any
  remark?: string | null
  created_at: string
  updated_at: string
}

export const fetchAppList = (params: AppListParams) => {
  return request.get<AppListResp>('/apps', { params })
}

export const fetchAppDetail = (id: string) => {
  return request.get<AppDetail>(`/apps/${id}`)
}

export const createApp = (data: any) => {
  return request.post<{ id: string }>('/apps', data)
}

export const updateApp = (id: string, data: any) => {
  return request.put('/apps/' + id, data)
}

export const deleteApp = (id: string) => {
  return request.delete('/apps/' + id)
}

export const batchDeleteApps = (ids: string[]) => {
  return request.post('/apps/batch_delete', { ids })
}

export type AppVersionListParams = {
  page: number
  page_size: number
  app_id?: string
  keyword?: string
  type?: 'native_app' | 'wgt'
}

export type AppVersionListItem = {
  id: string
  appid: string
  name: string
  title?: string | null
  type: 'native_app' | 'wgt'
  platform: string[]
  version: string
  stable_publish: boolean
  create_date: string
}

export type AppVersionListResp = {
  list: AppVersionListItem[]
  total: number
  page: number
  page_size: number
}

export const fetchAppVersionList = (params: AppVersionListParams) => {
  return request.get<AppVersionListResp>('/app_versions', { params })
}

export const fetchAppVersionDetail = (id: string) => {
  return request.get(`/app_versions/${id}`)
}

export const createAppVersion = (data: any) => {
  return request.post<{ id: string }>('/app_versions', data)
}

export const updateAppVersion = (id: string, data: any) => {
  return request.put(`/app_versions/${id}`, data)
}

export const deleteAppVersion = (id: string) => {
  return request.delete(`/app_versions/${id}`)
}

export const batchDeleteAppVersions = (ids: string[]) => {
  return request.post('/app_versions/batch_delete', { ids })
}

// ---------------------------------------------------------------------------
// APP内容管理（单页/FAQ/用户反馈）
// ---------------------------------------------------------------------------

export type ContentKey = 'user_policy' | 'privacy_policy'

export type AdminContentPageResp = {
  app_id: string
  content_key: ContentKey
  published: boolean
  published_at?: string | null
  lang: string
  title: string
  content_markdown: string
  content_html: string
  updated_at: string
}

export const fetchAdminContentPage = (contentKey: ContentKey, params: { app_id: string; lang?: string }) => {
  return request.get<AdminContentPageResp>(`/app_content/pages/${contentKey}`, { params })
}

export const upsertAdminContentPage = (contentKey: ContentKey, data: { app_id: string; lang: string; title: string; content_markdown: string }) => {
  return request.put(`/app_content/pages/${contentKey}`, data)
}

export const publishAdminContentPage = (contentKey: ContentKey, data: { app_id: string }) => {
  return request.post(`/app_content/pages/${contentKey}/publish`, data)
}

export const unpublishAdminContentPage = (contentKey: ContentKey, data: { app_id: string }) => {
  return request.post(`/app_content/pages/${contentKey}/unpublish`, data)
}

export type AdminFaqListParams = {
  page: number
  page_size: number
  app_id: string
  lang?: string
  keyword?: string
  published?: boolean
}

export type AdminFaqListItem = {
  id: string
  question: string
  is_pinned: boolean
  sort: number
  published: boolean
  updated_at: string
}

export type AdminFaqListResp = {
  list: AdminFaqListItem[]
  total: number
  page: number
  page_size: number
}

export const fetchAdminFaqList = (params: AdminFaqListParams) => {
  return request.get<AdminFaqListResp>('/app_content/faqs', { params })
}

export type AdminFaqDetailResp = {
  id: string
  app_id: string
  is_pinned: boolean
  sort: number
  published: boolean
  i18n: Record<
    string,
    {
      question: string
      answer_markdown: string
    }
  >
  updated_at: string
}

export const fetchAdminFaqDetail = (id: string) => {
  return request.get<AdminFaqDetailResp>(`/app_content/faqs/${id}`)
}

export const createAdminFaq = (data: {
  app_id: string
  is_pinned: boolean
  sort: number
  published: boolean
  i18n: Record<string, { question: string; answer_markdown: string }>
}) => {
  return request.post<{ id: string }>('/app_content/faqs', data)
}

export const updateAdminFaq = (
  id: string,
  data: {
    is_pinned?: boolean
    sort?: number
    published?: boolean
    i18n?: Record<string, { question: string; answer_markdown: string }>
  }
) => {
  return request.put(`/app_content/faqs/${id}`, data)
}

export const deleteAdminFaq = (id: string) => {
  return request.delete(`/app_content/faqs/${id}`)
}

export const batchDeleteAdminFaqs = (ids: string[]) => {
  return request.post('/app_content/faqs/batch_delete', { ids })
}

export type AdminFeedbackStatus = 'NEW' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'

export type AdminFeedbackListParams = {
  page: number
  page_size: number
  app_id: string
  status?: AdminFeedbackStatus
  keyword?: string
}

export type AdminFeedbackListItem = {
  id: string
  user_id?: string | null
  phone?: string | null
  email?: string | null
  content: string
  image_cnt: number
  status: AdminFeedbackStatus
  reply?: string | null
  created_at: string
  updated_at: string
}

export type AdminFeedbackListResp = {
  list: AdminFeedbackListItem[]
  total: number
  page: number
  page_size: number
}

export const fetchAdminFeedbackList = (params: AdminFeedbackListParams) => {
  return request.get<AdminFeedbackListResp>('/app_content/feedback', { params })
}

export type AdminFeedbackDetailResp = {
  id: string
  app_id: string
  appid: string
  user_id?: string | null
  phone?: string | null
  email?: string | null
  content: string
  images: string[]
  platform?: string | null
  app_version?: string | null
  device_model?: string | null
  os_version?: string | null
  status: AdminFeedbackStatus
  reply?: string | null
  replied_at?: string | null
  handle_note?: string | null
  created_at: string
  updated_at: string
}

export const fetchAdminFeedbackDetail = (id: string) => {
  return request.get<AdminFeedbackDetailResp>(`/app_content/feedback/${id}`)
}

export const updateAdminFeedback = (
  id: string,
  data: { status?: AdminFeedbackStatus; reply?: string; handle_note?: string }
) => {
  return request.put(`/app_content/feedback/${id}`, data)
}
