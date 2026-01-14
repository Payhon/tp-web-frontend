import { fetchDictEnum, fetchDictValueLabel } from '@/service/api/dict'

type DictCacheKey = string

const dictCache = new Map<DictCacheKey, Map<string, string>>()

function buildCacheKey(dictCode: string, languageCode?: string) {
  return `${dictCode}__${languageCode ?? ''}`
}

export async function preloadDict(dictCode: string, languageCode?: string) {
  const key = buildCacheKey(dictCode, languageCode)
  if (dictCache.has(key)) return

  const list = await fetchDictEnum({ dict_code: dictCode, language_code: languageCode })
  const map = new Map<string, string>()
  list.forEach(item => map.set(item.dict_value, item.translation || item.dict_value))
  dictCache.set(key, map)
}

export async function getDictLabel(dictCode: string, dictValue: string, languageCode?: string) {
  const key = buildCacheKey(dictCode, languageCode)
  const cached = dictCache.get(key)
  if (cached?.has(dictValue)) return cached.get(dictValue) as string

  // 优先走后端单值接口（避免拉整表）
  const label = await fetchDictValueLabel({ dict_code: dictCode, dict_value: dictValue, language_code: languageCode })
  if (!dictCache.has(key)) dictCache.set(key, new Map())
  dictCache.get(key)?.set(dictValue, label || dictValue)
  return label || dictValue
}

export function clearDictCache() {
  dictCache.clear()
}
