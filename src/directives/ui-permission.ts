import type { Directive, DirectiveBinding } from 'vue'
import { ensureUiPermissionState, hasUiPermission } from '@/utils/common/ui-permission'

type PermissionBinding =
  | string
  | string[]
  | {
      code?: string | string[]
      mode?: 'hide' | 'disable'
    }

type PermissionElement = HTMLElement & {
  __permDisplay?: string
  __permDisabled?: boolean
  __permPointerEvents?: string
  __permOpacity?: string
}

function isAdminBypass(): boolean {
  try {
    const raw = window.localStorage.getItem('userInfo')
    if (!raw) return false
    const info = JSON.parse(raw) as { authority?: string }
    const authority = String(info?.authority || '')
      .trim()
      .toUpperCase()
    return authority === 'SYS_ADMIN' || authority === 'TENANT_ADMIN'
  } catch {
    return false
  }
}

function resolveBinding(binding: DirectiveBinding<PermissionBinding>) {
  const defaultMode = binding.modifiers.disable ? 'disable' : 'hide'
  const value = binding.value

  if (typeof value === 'string' || Array.isArray(value)) {
    return { code: value, mode: defaultMode as 'hide' | 'disable' }
  }

  return {
    code: value?.code || '',
    mode: value?.mode || defaultMode
  }
}

function setDisabled(el: PermissionElement, disabled: boolean) {
  if (disabled) {
    if (typeof el.__permDisabled === 'undefined') {
      el.__permDisabled = el.hasAttribute('disabled')
    }
    if (typeof el.__permPointerEvents === 'undefined') {
      el.__permPointerEvents = el.style.pointerEvents
    }
    if (typeof el.__permOpacity === 'undefined') {
      el.__permOpacity = el.style.opacity
    }

    el.setAttribute('disabled', 'true')
    el.setAttribute('aria-disabled', 'true')
    el.style.pointerEvents = 'none'
    el.style.opacity = el.style.opacity || '0.6'
    return
  }

  if (!el.__permDisabled) {
    el.removeAttribute('disabled')
  }
  el.removeAttribute('aria-disabled')
  el.style.pointerEvents = el.__permPointerEvents || ''
  el.style.opacity = el.__permOpacity || ''
}

function applyPermission(el: PermissionElement, allowed: boolean, mode: 'hide' | 'disable') {
  if (typeof el.__permDisplay === 'undefined') {
    el.__permDisplay = el.style.display
  }

  if (allowed) {
    el.style.display = el.__permDisplay || ''
    setDisabled(el, false)
    return
  }

  if (mode === 'disable') {
    el.style.display = el.__permDisplay || ''
    setDisabled(el, true)
    return
  }

  setDisabled(el, false)
  el.style.display = 'none'
}

async function updatePermission(el: PermissionElement, binding: DirectiveBinding<PermissionBinding>) {
  const { code, mode } = resolveBinding(binding)
  if (!code) {
    applyPermission(el, true, mode)
    return
  }

  // 管理员账号直接放行，避免历史缓存/异步状态导致页面被误隐藏
  if (isAdminBypass()) {
    applyPermission(el, true, mode)
    return
  }

  // 避免权限接口返回前出现无权限元素闪现
  if (mode === 'disable') {
    setDisabled(el, true)
  } else {
    el.style.display = 'none'
  }

  await ensureUiPermissionState()
  applyPermission(el, hasUiPermission(code), mode)
}

export const uiPermissionDirective: Directive<PermissionElement, PermissionBinding> = {
  mounted(el, binding) {
    updatePermission(el, binding)
  },
  updated(el, binding) {
    updatePermission(el, binding)
  }
}
