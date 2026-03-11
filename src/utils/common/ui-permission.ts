import { reactive } from 'vue'
import { fetchCurrentUiPermissions } from '@/service/api/org-type-permissions'
import { localStg } from '@/utils/storage'

type PermissionCode = string | string[]

type UiPermissionState = {
  loaded: boolean
  loading: boolean
  allowAll: boolean
  codes: string[]
  version: number
}

export const uiPermissionState = reactive<UiPermissionState>({
  loaded: false,
  loading: false,
  allowAll: true,
  codes: [],
  version: 0
})

let loadPromise: Promise<void> | null = null

function normalizeCodes(codes: unknown): string[] {
  if (!Array.isArray(codes)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of codes) {
    const code = String(raw || '').trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    result.push(code)
  }
  return result
}

function isAdminAuthority(authority: string): boolean {
  const v = String(authority || '')
    .trim()
    .toUpperCase()
  return v === 'SYS_ADMIN' || v === 'TENANT_ADMIN'
}

function getCachedAuthority(): string {
  const info = (localStg.get('userInfo') || {}) as Record<string, unknown>
  return String(info.authority || '')
}

function setLoadedState(allowAll: boolean, codes: string[]) {
  uiPermissionState.allowAll = allowAll
  uiPermissionState.codes = codes
  uiPermissionState.loaded = true
  uiPermissionState.loading = false
  uiPermissionState.version += 1
}

export function resetUiPermissionState() {
  loadPromise = null
  uiPermissionState.loaded = false
  uiPermissionState.loading = false
  uiPermissionState.allowAll = true
  uiPermissionState.codes = []
  uiPermissionState.version += 1
}

export async function ensureUiPermissionState(force = false): Promise<void> {
  const token = localStg.get('token')
  if (!token) {
    setLoadedState(true, [])
    return
  }

  if (isAdminAuthority(getCachedAuthority())) {
    setLoadedState(true, [])
    return
  }

  if (uiPermissionState.loaded && !force) {
    return
  }

  if (loadPromise && !force) {
    return loadPromise
  }

  uiPermissionState.loading = true
  loadPromise = (async () => {
    try {
      const resp: any = await fetchCurrentUiPermissions()
      // request 封装返回 data 字段；这里兼容少量旧调用场景
      const data = resp?.data ?? resp ?? {}
      const allowAll = Boolean(data.allow_all)
      const codes = normalizeCodes(data.ui_codes)
      setLoadedState(allowAll, codes)
    } catch {
      setLoadedState(true, [])
    } finally {
      loadPromise = null
    }
  })()

  return loadPromise
}

export function hasUiPermission(code: PermissionCode): boolean {
  // 双保险：管理员始终放行，避免历史缓存状态导致页面被误隐藏
  if (isAdminAuthority(getCachedAuthority())) return true

  if (uiPermissionState.allowAll) return true

  const list = Array.isArray(code) ? code : [code]
  if (list.length === 0) return true

  const codeSet = new Set(uiPermissionState.codes)
  return list.some(item => codeSet.has(String(item || '').trim()))
}
