<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { $t } from '@/locales'
import { useAuthStore } from '@/store/modules/auth'
import { fetchUIElementList } from '@/service/api/route'
import { fetchUserList } from '@/service/api/auth'
import {
  fetchDeviceParamPermissionOptions,
  fetchOrgTypePermissions,
  upsertOrgTypePermission,
  type DeviceParamNode,
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
  { key: 'STORE', label: '门店' }
] as const
type OrgTypeKey = (typeof orgTypes)[number]['key']

const activeOrgType = ref<OrgTypeKey>('PACK_FACTORY')
const activeTab = ref<'menu' | 'device'>('menu')

const loading = ref(false)
const saving = ref(false)
const tenantLoading = ref(false)

const menuTreeData = ref<any[]>([])
const deviceParamTreeData = ref<any[]>([])
const tenantOptions = ref<{ label: string; value: string }[]>([])

const state = reactive<Record<OrgTypeKey, { uiCodes: string[]; deviceParams: string[] }>>({
  PACK_FACTORY: { uiCodes: [], deviceParams: [] },
  DEALER: { uiCodes: [], deviceParams: [] },
  STORE: { uiCodes: [], deviceParams: [] }
})

function toTreeData(nodes: any[]): any[] {
  return (nodes || []).map(n => ({
    key: n.element_code,
    label: n.description || n.element_code || n.id,
    children: n.children?.length ? toTreeData(n.children) : undefined
  }))
}

function toDeviceParamTree(nodes: DeviceParamNode[]): any[] {
  return (nodes || []).map(n => ({
    key: n.value,
    label: n.label || n.value,
    children: n.children?.length ? toDeviceParamTree(n.children) : undefined
  }))
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
      .filter(Boolean)

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
    const ui = await fetchUIElementList()
    menuTreeData.value = toTreeData(ui || [])

    const optResp = await fetchDeviceParamPermissionOptions()
    const rawTree: DeviceParamNode[] = (optResp as any)?.data || []
    deviceParamTreeData.value = toDeviceParamTree(rawTree)

    const permResp = await fetchOrgTypePermissions(
      isSysAdmin.value ? { tenant_id: effectiveTenantId.value } : undefined
    )
    const list: OrgTypePermissionItem[] = (permResp as any)?.data || []

    for (const ot of orgTypes) {
      state[ot.key].uiCodes = []
      state[ot.key].deviceParams = []
    }

    for (const item of list) {
      const key = item.org_type as OrgTypeKey
      if (!(key in state)) continue
      state[key].uiCodes = item.ui_codes || []
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
      ui_codes: state[key].uiCodes || [],
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
            <NButton type="primary" :loading="loading" @click="loadAll">{{ $t('common.refresh') }}</NButton>
          </div>
          <NButton type="primary" :loading="saving" @click="saveCurrent">{{ $t('common.save') }}</NButton>
        </div>

        <NTabs v-model:value="activeOrgType" type="segment" animated>
          <NTabPane v-for="ot in orgTypes" :key="ot.key" :name="ot.key" :tab="ot.label" />
        </NTabs>

        <div class="flex-1 min-h-0">
          <NSpin :show="loading" class="h-full">
            <NTabs v-model:value="activeTab" type="line" animated class="h-full flex flex-col">
              <NTabPane name="menu" tab="菜单权限" class="flex-1 min-h-0">
                <NScrollbar class="h-full">
                  <div class="pr-12px">
                    <NTree
                      block-line
                      checkable
                      cascade
                      default-expand-all
                      :data="menuTreeData"
                      :checked-keys="state[activeOrgType].uiCodes"
                      @update:checked-keys="keys => (state[activeOrgType].uiCodes = keys as string[])"
                    />
                  </div>
                </NScrollbar>
              </NTabPane>
              <NTabPane name="device" tab="设备参数权限" class="flex-1 min-h-0">
                <NScrollbar class="h-full">
                  <div class="pr-12px">
                    <NTree
                      block-line
                      checkable
                      cascade
                      default-expand-all
                      :data="deviceParamTreeData"
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
