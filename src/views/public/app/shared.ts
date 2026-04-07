import { resolveFileUrl } from '@/utils/common/tool'

export type PublicLang = 'zh-CN' | 'en-US'

export function normalizePublicLang(value: unknown): PublicLang {
  const lang = String(value || '').trim().toLowerCase()
  if (lang === 'en' || lang === 'en-us') return 'en-US'
  return 'zh-CN'
}

export function isIOSUserAgent(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent)
}

export function isAndroidUserAgent(userAgent: string) {
  return /android/i.test(userAgent)
}

export function toPublicFileUrl(path?: string | null) {
  return path ? resolveFileUrl(path) : ''
}

export function getNestedUrl(source: any): string {
  return String(source?.url || '').trim()
}

export function getNestedName(source: any): string {
  return String(source?.name || '').trim()
}

