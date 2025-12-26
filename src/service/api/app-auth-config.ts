import { request } from '../request'

export type AuthTemplateChannel = 'EMAIL' | 'SMS'
export type AuthTemplateScene = 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD' | 'BIND'

export interface AuthMessageTemplate {
  id: string
  tenant_id: string
  channel: AuthTemplateChannel
  scene: AuthTemplateScene
  subject?: string | null
  content?: string | null
  provider?: string | null
  provider_template_code?: string | null
  status: 'OPEN' | 'CLOSE'
  remark?: string | null
  created_at?: string
  updated_at?: string
}

export interface UpsertAuthMessageTemplateReq {
  channel: AuthTemplateChannel
  scene: AuthTemplateScene
  subject?: string
  content?: string
  provider?: string
  provider_template_code?: string
  status: 'OPEN' | 'CLOSE'
  remark?: string
}

export interface WxMpConfig {
  id: string
  tenant_id: string
  appid: string
  app_secret?: string
  status: 'OPEN' | 'CLOSE'
  remark?: string | null
}

export interface UpsertWxMpConfigReq {
  appid: string
  app_secret: string
  status: 'OPEN' | 'CLOSE'
  remark?: string
}

export async function fetchAuthMessageTemplates(tenantId?: string) {
  return request.get<AuthMessageTemplate[]>('/app/auth/config/templates', {
    params: tenantId ? { tenant_id: tenantId } : undefined
  })
}

export async function upsertAuthMessageTemplate(params: UpsertAuthMessageTemplateReq, tenantId?: string) {
  return request.post('/app/auth/config/templates', params, {
    params: tenantId ? { tenant_id: tenantId } : undefined
  })
}

export async function fetchWxMpConfig(tenantId?: string) {
  return request.get<WxMpConfig>('/app/auth/config/wxmp', {
    params: tenantId ? { tenant_id: tenantId } : undefined
  })
}

export async function upsertWxMpConfig(params: UpsertWxMpConfigReq, tenantId?: string) {
  return request.post('/app/auth/config/wxmp', params, {
    params: tenantId ? { tenant_id: tenantId } : undefined
  })
}
