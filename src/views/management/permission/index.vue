<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { RefreshOutline, SaveOutline } from '@vicons/ionicons5'
import { $t } from '@/locales'
import { useAuthStore } from '@/store/modules/auth'
import { fetchUIElementList } from '@/service/api/route'
import { fetchUserList } from '@/service/api/auth'
import {
  fetchDeviceParamPermissionOptions,
  fetchOrgTypePermissions,
  type DeviceParamNode,
  upsertOrgTypePermission,
  type OrgTypePermissionItem
} from '@/service/api/org-type-permissions'

const authStore = useAuthStore()
const message = useMessage()

const isSysAdmin = computed(() => authStore.userInfo.authority === 'SYS_ADMIN')
const tenantIdInput = ref<string | null>(null)
const effectiveTenantId = computed(() => {
  if (isSysAdmin.value) return (tenantIdInput.value || '').trim()
  return (authStore.userInfo.tenant_id as string) || ''
})

const orgTypes = [
  { key: 'PACK_FACTORY', label: 'PACK厂家' },
  { key: 'DEALER', label: '经销商' },
  { key: 'STORE', label: '门店' },
  { key: 'APP_USER', label: 'APP 用户' }
] as const
type OrgTypeKey = (typeof orgTypes)[number]['key']
type PermissionTreeOption = {
  key: string
  label: string
  children?: PermissionTreeOption[]
}
type DeviceParamTreeOption = DeviceParamNode & { key: string; children?: DeviceParamTreeOption[] }

const MOBILE_PERMISSION_ROOT = 'app_mobile_permissions'

const activeOrgType = ref<OrgTypeKey>('PACK_FACTORY')
const activeTab = ref<'menu' | 'mobile' | 'device'>('menu')

const loading = ref(false)
const saving = ref(false)
const tenantLoading = ref(false)

const menuTreeData = ref<PermissionTreeOption[]>([])
const mobileTreeData = ref<PermissionTreeOption[]>([])
const deviceParamTreeData = ref<DeviceParamTreeOption[]>([])
const tenantOptions = ref<{ label: string; value: string }[]>([])
const mobilePermissionCodeSet = ref<Set<string>>(new Set())

const state = reactive<Record<OrgTypeKey, { menuUiCodes: string[]; mobileUiCodes: string[]; deviceParams: string[] }>>({
  PACK_FACTORY: { menuUiCodes: [], mobileUiCodes: [], deviceParams: [] },
  DEALER: { menuUiCodes: [], mobileUiCodes: [], deviceParams: [] },
  STORE: { menuUiCodes: [], mobileUiCodes: [], deviceParams: [] },
  APP_USER: { menuUiCodes: [], mobileUiCodes: [], deviceParams: [] }
})

function renderDeviceParamLabel({ option }: { option: Record<string, any> }) {
  const registerAddress = String(option.register_address || option.registerAddress || '').trim()
  const keyNames = (option.param_keys || option.paramKeys || []).filter(Boolean).join(' / ')

  if (!registerAddress && !keyNames) return option.label

  const metaParts: string[] = []
  if (registerAddress) metaParts.push(`寄存器: ${registerAddress}`)
  if (keyNames) metaParts.push(`KEY: ${keyNames}`)

  return h('span', { class: 'device-param-label' }, [
    h('span', option.label),
    h(
      'span',
      {
        class: 'device-param-label__meta',
        style: {
          marginLeft: '6px',
          color: '#999',
          fontSize: '12px'
        }
      },
      `（${metaParts.join(' / ')}）`
    )
  ])
}

function toDeviceParamTreeData(nodes: DeviceParamNode[]): DeviceParamTreeOption[] {
  return (nodes || []).map(node => ({
    ...node,
    key: String(node.value || '').trim(),
    children: node.children?.length ? toDeviceParamTreeData(node.children) : undefined
  }))
}

function toTreeData(nodes: any[]): PermissionTreeOption[] {
  return (nodes || []).map(n => ({
    key: String(n.element_code || '').trim(),
    label: n.description || n.element_code || n.id,
    children: n.children?.length ? toTreeData(n.children) : undefined
  }))
}

function collectTreeKeys(nodes: PermissionTreeOption[]): string[] {
  const keys: string[] = []

  const walk = (items: PermissionTreeOption[]) => {
    for (const item of items || []) {
      const key = String(item.key || '').trim()
      if (key) keys.push(key)
      if (item.children?.length) walk(item.children)
    }
  }

  walk(nodes)
  return normalizeCheckedUICodes(keys)
}

function findTreeNode(nodes: PermissionTreeOption[], targetKey: string): PermissionTreeOption | null {
  for (const node of nodes || []) {
    if (node.key === targetKey) return node
    if (node.children?.length) {
      const matched = findTreeNode(node.children, targetKey)
      if (matched) return matched
    }
  }
  return null
}

function removeTreeNode(nodes: PermissionTreeOption[], targetKey: string): PermissionTreeOption[] {
  return (nodes || [])
    .filter(node => node.key !== targetKey)
    .map(node => ({
      ...node,
      children: node.children?.length ? removeTreeNode(node.children, targetKey) : undefined
    }))
}

function splitUiCodes(codes: string[]): { menuUiCodes: string[]; mobileUiCodes: string[] } {
  const menuUiCodes: string[] = []
  const mobileUiCodes: string[] = []

  for (const code of normalizeCheckedUICodes(codes)) {
    if (mobilePermissionCodeSet.value.has(code)) {
      mobileUiCodes.push(code)
      continue
    }
    menuUiCodes.push(code)
  }

  return { menuUiCodes, mobileUiCodes }
}

function normalizeCheckedUICodes(codes: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of codes || []) {
    const code = String(raw || '').trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    normalized.push(code)
  }

  return normalized
}

async function loadTenants() {
  if (!isSysAdmin.value) return
  tenantLoading.value = true
  try {
    const resp: any = await fetchUserList({ page: 1, page_size: 1000 })
    const list = resp?.data?.list || []
    tenantOptions.value = (list as any[])
      .map(u => {
        const tenantId = (u?.tenant_id as string) || (u?.tenantId as string) || ''
        const labelName = (u?.name as string) || (u?.email as string) || tenantId
        if (!tenantId) return null
        return { label: `${labelName} (${tenantId})`, value: tenantId }
      })
      .filter((item): item is { label: string; value: string } => item !== null)

    if (!tenantIdInput.value && tenantOptions.value.length > 0) {
      tenantIdInput.value = tenantOptions.value[0].value
    }
  } finally {
    tenantLoading.value = false
  }
}

async function loadAll() {
  if (isSysAdmin.value && !effectiveTenantId.value) {
    message.warning('请选择租户后再加载')
    return
  }

  loading.value = true
  try {
    const ui = toTreeData((await fetchUIElementList()) || [])
    const mobileRoot = findTreeNode(ui, MOBILE_PERMISSION_ROOT)
    mobileTreeData.value = mobileRoot ? [mobileRoot] : []
    menuTreeData.value = removeTreeNode(ui, MOBILE_PERMISSION_ROOT)
    mobilePermissionCodeSet.value = new Set(collectTreeKeys(mobileTreeData.value))

    const deviceResp: any = await fetchDeviceParamPermissionOptions()
    deviceParamTreeData.value = toDeviceParamTreeData((deviceResp?.data || deviceResp || []) as DeviceParamNode[])

    const permResp = await fetchOrgTypePermissions(
      isSysAdmin.value ? { tenant_id: effectiveTenantId.value } : undefined
    )
    const list: OrgTypePermissionItem[] = (permResp as any)?.data || []

    for (const ot of orgTypes) {
      state[ot.key].menuUiCodes = []
      state[ot.key].mobileUiCodes = []
      state[ot.key].deviceParams = []
    }

    for (const item of list) {
      const key = item.org_type as OrgTypeKey
      if (!(key in state)) continue
      const { menuUiCodes, mobileUiCodes } = splitUiCodes(item.ui_codes || [])
      state[key].menuUiCodes = menuUiCodes
      state[key].mobileUiCodes = mobileUiCodes
      const raw = (item.device_param_permissions || '').trim()
      state[key].deviceParams = raw
        ? raw
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []
    }
  } finally {
    loading.value = false
  }
}

async function saveCurrent() {
  if (isSysAdmin.value && !effectiveTenantId.value) {
    message.warning('请选择租户后再保存')
    return
  }

  saving.value = true
  try {
    const key = activeOrgType.value
    const payload = {
      ui_codes: normalizeCheckedUICodes([...(state[key].menuUiCodes || []), ...(state[key].mobileUiCodes || [])]),
      device_param_permissions: (state[key].deviceParams || []).join(',')
    }
    await upsertOrgTypePermission(key, payload, isSysAdmin.value ? { tenant_id: effectiveTenantId.value } : undefined)
    message.success($t('common.operationSuccess'))
    await loadAll()
  } finally {
    saving.value = false
  }
}

loadTenants()
if (!isSysAdmin.value) {
  loadAll()
}
watch(
  () => tenantIdInput.value,
  () => {
    if (!isSysAdmin.value) return
    if (!effectiveTenantId.value) return
    loadAll()
  }
)
</script>

<template>
  <div class="overflow-hidden">
    <NCard :bordered="false" class="h-full rounded-8px shadow-sm">
      <div class="h-full flex flex-col gap-16px">
        <div class="flex items-center justify-between gap-12px">
          <div class="flex items-center gap-12px">
            <div v-if="isSysAdmin" class="w-260px">
              <NSelect
                v-model:value="tenantIdInput"
                filterable
                clearable
                :loading="tenantLoading"
                :options="tenantOptions"
                placeholder="请选择租户"
              />
            </div>
            <NButton type="primary" :loading="loading" @click="loadAll">
              <template #icon>
                <NIcon><RefreshOutline /></NIcon>
              </template>
              {{ $t('common.refresh') }}
            </NButton>
          </div>
          <NButton type="primary" :loading="saving" @click="saveCurrent">
            <template #icon>
              <NIcon><SaveOutline /></NIcon>
            </template>
            {{ $t('common.save') }}
          </NButton>
        </div>

        <NTabs v-model:value="activeOrgType" type="segment" animated>
          <NTabPane v-for="ot in orgTypes" :key="ot.key" :name="ot.key" :tab="ot.label" />
        </NTabs>

        <div class="flex-1 min-h-0">
          <NSpin :show="loading" class="h-full">
            <NTabs v-model:value="activeTab" type="line" animated class="h-full flex flex-col">
              <NTabPane name="menu" tab="菜单权限" class="flex-1" style="height: 580px">
                <NScrollbar class="h-full">
                  <div class="pr-12px">
                    <NTree
                      block-line
                      checkable
                      default-expand-all
                      :data="menuTreeData"
                      :checked-keys="state[activeOrgType].menuUiCodes"
                      @update:checked-keys="keys => (state[activeOrgType].menuUiCodes = keys as string[])"
                    />
                  </div>
                </NScrollbar>
              </NTabPane>
              <NTabPane name="mobile" tab="移动端权限" class="flex-1" style="height: 580px">
                <NScrollbar class="h-full">
                  <div class="pr-12px">
                    <NTree
                      block-line
                      checkable
                      default-expand-all
                      :data="mobileTreeData"
                      :checked-keys="state[activeOrgType].mobileUiCodes"
                      @update:checked-keys="keys => (state[activeOrgType].mobileUiCodes = keys as string[])"
                    />
                  </div>
                </NScrollbar>
              </NTabPane>
              <NTabPane name="device" tab="设备参数权限" class="flex-1" style="height: 580px">
                <NScrollbar class="h-full">
                  <div class="pr-12px">
                    <NTree
                      block-line
                      checkable
                      cascade
                      check-strategy="child"
                      default-expand-all
                      :data="deviceParamTreeData"
                      :render-label="renderDeviceParamLabel"
                      :checked-keys="state[activeOrgType].deviceParams"
                      @update:checked-keys="keys => (state[activeOrgType].deviceParams = keys as string[])"
                    />
                  </div>
                </NScrollbar>
              </NTabPane>
            </NTabs>
          </NSpin>
        </div>
      </div>
    </NCard>
  </div>
</template>
