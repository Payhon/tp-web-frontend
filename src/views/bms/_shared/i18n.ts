import { $t } from '@/locales'

type TranslateParams = Record<string, string | number | boolean | null | undefined>

export function bt(key: string, params?: TranslateParams) {
  return $t(`bms.${key}`, params as any)
}
