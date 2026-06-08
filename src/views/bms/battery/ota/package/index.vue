<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NEllipsis,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { getBatteryBmsModelList, getOtaUpgradePackageList } from '@/service/api/bms'
import { request } from '@/service/request'
import SvgIcon from '@/components/custom/svg-icon.vue'
import FilePicker from '@/components/business/file-picker/index.vue'

type DeviceKind = 1 | 2 | 3

interface OtaPackageItem {
  id: string
  name: string
  version: string
  target_version?: string | null
  device_config_id?: string | null
  device_config_name?: string | null
  battery_model_id?: string | null
  battery_model_name?: string | null
  batch_number?: string | null
  item_uuid?: string | null
  module?: string | null
  package_type?: number | null
  signature_type?: string | null
  package_url?: string | null
  created_at?: string | null
  remark?: string | null
  description?: string | null
  additional_info?: string | null
  device_kind?: DeviceKind | null
  is_latest?: boolean | null
}

const DEVICE_KIND_BMS: DeviceKind = 1
const DEVICE_KIND_METER: DeviceKind = 2
const DEVICE_KIND_4G_MODULE: DeviceKind = 3

const message = useMessage()
const activeTab = ref<DeviceKind>(DEVICE_KIND_BMS)
const isBmsTab = computed(() => activeTab.value === DEVICE_KIND_BMS)
const is4GModuleTab = computed(() => activeTab.value === DEVICE_KIND_4G_MODULE)

const searchForm = ref({
  name: ''
})

const bmsModelOptions = ref<Array<{ label: string; value: string }>>([])

async function loadBmsModels() {
  try {
    const res: any = await getBatteryBmsModelList({ page: 1, page_size: 1000 })
    const list = (res?.data?.list || []) as Array<{ id: string; name: string }>
    bmsModelOptions.value = list.map(i => ({ label: i.name, value: i.id }))
  } catch {
    bmsModelOptions.value = []
  }
}

function packageTypeLabel(v?: number | null) {
  if (v === 1) return bt('auto.s_db45871e79')
  if (v === 2) return bt('auto.s_82e6566781')
  return '--'
}

async function copyText(text?: string | null) {
  const value = text?.trim()
  if (!value) {
    message.warning(bt('auto.s_0e7ab0fb76'))
    return
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    message.success(bt('auto.s_b3e98deb76'))
  } catch {
    message.error(bt('auto.s_5154ae17da'))
  }
}

function renderFirmwareUrl(row: OtaPackageItem) {
  if (!row.package_url) return '--'
  return (
    <NSpace align="center" size={6} wrap={false}>
      <NEllipsis style="max-width: 360px">{row.package_url}</NEllipsis>
      <NButton size="tiny" text title={bt('auto.s_52129e059c')} onClick={() => copyText(row.package_url)}>
        <SvgIcon icon="material-symbols:content-copy-outline" class="text-16px" />
      </NButton>
    </NSpace>
  )
}

function createColumns(): DataTableColumns<OtaPackageItem> {
  if (isBmsTab.value) {
    return [
      { key: 'name', title: bt('auto.s_9d9540e486'), minWidth: 180 },
      { key: 'version', title: bt('auto.s_d0b2958432'), minWidth: 120 },
      { key: 'target_version', title: bt('auto.s_bc15bf0b06'), minWidth: 120, render: r => r.target_version || '--' },
      { key: 'battery_model_name', title: bt('auto.s_e96355e54a'), minWidth: 160, render: r => r.battery_model_name || '--' },
      { key: 'batch_number', title: bt('auto.s_3546dde727'), minWidth: 150, render: r => r.batch_number || '--' },
      { key: 'item_uuid', title: bt('auto.s_f461d11622'), minWidth: 220, render: r => r.item_uuid || '--' },
      { key: 'module', title: bt('auto.s_fac54c3430'), minWidth: 100, render: r => r.module || '--' },
      { key: 'package_type', title: bt('auto.s_226b091218'), minWidth: 90, render: r => packageTypeLabel(r.package_type) },
      { key: 'signature_type', title: bt('auto.s_a82af18739'), minWidth: 100, render: r => r.signature_type || '--' },
      { key: 'package_url', title: bt('auto.s_dc16922c1d'), minWidth: 430, render: r => renderFirmwareUrl(r) },
      { key: 'created_at', title: bt('auto.s_eca37cb072'), minWidth: 160, render: r => r.created_at || '--' },
      {
        key: 'actions',
        title: bt('auto.s_2b6bc0f293'),
        minWidth: 240,
        fixed: 'right',
        render: r => renderActions(r)
      }
    ]
  }

  if (is4GModuleTab.value) {
    return [
      { key: 'name', title: bt('auto.s_9d9540e486'), minWidth: 200 },
      { key: 'version', title: bt('auto.s_d0b2958432'), minWidth: 120 },
      { key: 'package_url', title: bt('auto.s_dc16922c1d'), minWidth: 430, render: r => renderFirmwareUrl(r) },
      { key: 'is_latest', title: bt('auto.s_71ba0bc268'), minWidth: 130, render: r => (r.is_latest ? bt('auto.s_0a60ac8f02') : bt('auto.s_c9744f45e7')) },
      { key: 'description', title: bt('auto.s_f411d0f1f9'), minWidth: 260, render: r => r.description || '--' },
      { key: 'created_at', title: bt('auto.s_eca37cb072'), minWidth: 160, render: r => r.created_at || '--' },
      {
        key: 'actions',
        title: bt('auto.s_2b6bc0f293'),
        minWidth: 220,
        fixed: 'right',
        render: r => renderActions(r)
      }
    ]
  }

  return [
    { key: 'name', title: bt('auto.s_9d9540e486'), minWidth: 220 },
    { key: 'description', title: bt('auto.s_f411d0f1f9'), minWidth: 300, render: r => r.description || '--' },
    { key: 'package_url', title: bt('auto.s_dc16922c1d'), minWidth: 430, render: r => renderFirmwareUrl(r) },
    { key: 'created_at', title: bt('auto.s_eca37cb072'), minWidth: 160, render: r => r.created_at || '--' },
    {
      key: 'actions',
      title: bt('auto.s_2b6bc0f293'),
      minWidth: 220,
      fixed: 'right',
      render: r => renderActions(r)
    }
  ]
}

function renderActions(row: OtaPackageItem) {
  return (
    <NSpace>
      <NButton size="small" type="primary" onClick={() => openEdit(row)}>{bt('auto.s_95b351c862')}</NButton>
      <NPopconfirm onPositiveClick={() => doDelete(row)}>
        {{
          default: () => bt('auto.s_bf62fd3fbc'),
          trigger: () => (
            <NButton size="small" type="error">{bt('auto.s_2f4aaddde3')}</NButton>
          )
        }}
      </NPopconfirm>
    </NSpace>
  )
}

const { data, loading, pagination, columns, getData, updateSearchParams } = useTable<
  OtaPackageItem,
  typeof getOtaUpgradePackageList
>({
  apiFn: getOtaUpgradePackageList,
  apiParams: { page: 1, page_size: 10, device_kind: DEVICE_KIND_BMS },
  transformer: (res: any) => {
    const payload = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: () => createColumns()
})

function syncQuery(page = 1) {
  updateSearchParams({
    page,
    page_size: pagination.pageSize,
    name: searchForm.value.name || undefined,
    device_kind: activeTab.value
  })
}

function handleSearch() {
  syncQuery(1)
  getData()
}

function handleReset() {
  searchForm.value = { name: '' }
  handleSearch()
}

watch(
  activeTab,
  () => {
    searchForm.value = { name: '' }
    syncQuery(1)
    getData()
  },
  { immediate: true }
)

const showModal = ref(false)
const modalType = ref<'create' | 'edit'>('create')
const saving = ref(false)
const form = ref({
  id: '',
  name: '',
  version: '',
  target_version: '',
  battery_model_id: '',
  batch_number: '',
  item_uuid: '',
  module: '',
  package_type: 2 as 1 | 2,
  signature_type: 'SHA256' as 'MD5' | 'SHA256',
  package_url: '',
  additional_info: '{}' as string,
  description: '',
  remark: '',
  device_kind: DEVICE_KIND_BMS as DeviceKind,
  is_latest: false
})

const modalTitle = computed(() => {
  const prefix = modalType.value === 'create' ? bt('auto.s_66ab5e9f24') : bt('auto.s_95b351c862')
  if (isBmsTab.value) return bt('pages.ota.modalTitle', { prefix, kind: bt('auto.s_96b721c7f1') })
  if (is4GModuleTab.value) return bt('pages.ota.modalTitle', { prefix, kind: bt('auto.s_3751b81511') })
  return bt('pages.ota.modalTitle', { prefix, kind: bt('auto.s_0a0ca8d002') })
})

function resetForm(kind: DeviceKind) {
  form.value = {
    id: '',
    name: '',
    version: '',
    target_version: '',
    battery_model_id: '',
    batch_number: '',
    item_uuid: '',
    module: '',
    package_type: 2,
    signature_type: 'SHA256',
    package_url: '',
    additional_info: '{}',
    description: '',
    remark: '',
    device_kind: kind,
    is_latest: false
  }
}

function openCreate() {
  modalType.value = 'create'
  resetForm(activeTab.value)
  showModal.value = true
}

function openEdit(row: OtaPackageItem) {
  modalType.value = 'edit'
  form.value = {
    id: row.id,
    name: row.name || '',
    version: row.version || '',
    target_version: row.target_version || '',
    battery_model_id: row.battery_model_id || '',
    batch_number: row.batch_number || '',
    item_uuid: row.item_uuid || '',
    module: row.module || '',
    package_type: (row.package_type as 1 | 2) || 2,
    signature_type: (row.signature_type as 'MD5' | 'SHA256') || 'SHA256',
    package_url: row.package_url || '',
    additional_info: row.additional_info || '{}',
    description: row.description || '',
    remark: row.remark || '',
    device_kind: (row.device_kind as DeviceKind) || activeTab.value,
    is_latest: Boolean(row.is_latest)
  }
  showModal.value = true
}

async function submit() {
  if (!form.value.name.trim()) {
    message.warning(bt('auto.s_3f239874d7'))
    return
  }
  if (!form.value.package_url.trim()) {
    message.warning(bt('auto.s_f1bba9c2a5'))
    return
  }
  if (form.value.device_kind === DEVICE_KIND_BMS) {
    if (!form.value.version.trim()) {
      message.warning(bt('auto.s_18a9c8fb65'))
      return
    }
  }
  if (form.value.device_kind === DEVICE_KIND_4G_MODULE && !form.value.version.trim()) {
    message.warning(bt('auto.s_18a9c8fb65'))
    return
  }

  saving.value = true
  try {
    const payload: any = {
      name: form.value.name.trim(),
      package_url: form.value.package_url.trim(),
      device_kind: form.value.device_kind
    }

    if (form.value.device_kind === DEVICE_KIND_BMS) {
      Object.assign(payload, {
        version: form.value.version.trim(),
        target_version: form.value.target_version.trim(),
        battery_model_id: form.value.battery_model_id || '',
        batch_number: form.value.batch_number.trim(),
        item_uuid: form.value.item_uuid.trim(),
        module: form.value.module.trim() ? form.value.module.trim() : undefined,
        package_type: form.value.package_type,
        signature_type: form.value.signature_type,
        remark: form.value.remark.trim() ? form.value.remark.trim() : undefined
      })
    }
    if (form.value.device_kind === DEVICE_KIND_4G_MODULE) {
      Object.assign(payload, {
        version: form.value.version.trim(),
        description: form.value.description.trim() ? form.value.description.trim() : undefined,
        is_latest: form.value.is_latest
      })
    }
    if (form.value.device_kind === DEVICE_KIND_METER) {
      Object.assign(payload, {
        description: form.value.description.trim() ? form.value.description.trim() : undefined
      })
    }

    if (modalType.value === 'create') {
      await request.post('/ota/package', payload)
      message.success(bt('auto.s_04a691b377'))
    } else {
      await request.put('/ota/package', { ...payload, id: form.value.id })
      message.success(bt('auto.s_55aa6366c0'))
    }
    showModal.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_6de920b4e4'))
  } finally {
    saving.value = false
  }
}

async function doDelete(row: OtaPackageItem) {
  try {
    await request.delete(`/ota/package/${row.id}`)
    message.success(bt('auto.s_0007d170de'))
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_acf0664a54'))
  }
}

loadBmsModels()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard
      :title="bt('auto.s_d50a49fae4')"
      :bordered="false"
      size="small"
      class="sm:flex-1-hidden card-wrapper"
      content-style="height: 100%; min-height: 0; display: flex; flex-direction: column;"
    >
      <div class="ota-package-layout">
        <div class="ota-package-toolbar">
          <NTabs v-model:value="activeTab" type="line" animated>
            <NTabPane :name="DEVICE_KIND_BMS" :tab="bt('auto.s_96b721c7f1')" />
            <NTabPane :name="DEVICE_KIND_METER" :tab="bt('auto.s_0a0ca8d002')" />
            <NTabPane :name="DEVICE_KIND_4G_MODULE" :tab="bt('auto.s_3751b81511')" />
          </NTabs>

          <NForm
            inline
            :model="searchForm"
            label-placement="left"
            label-width="auto"
            class="ota-package-search"
          >
            <NFormItem :label="bt('auto.s_9d9540e486')">
              <NInput v-model:value="searchForm.name" :placeholder="bt('auto.s_f33cb868c8')" style="width: 220px" clearable />
            </NFormItem>
            <NFormItem>
              <NSpace>
                <NButton type="primary" @click="handleSearch">{{ bt('auto.s_bee912d79e') }}</NButton>
                <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
                <NButton type="success" @click="openCreate">{{ bt('auto.s_1e07bb77be') }}</NButton>
              </NSpace>
            </NFormItem>
          </NForm>
        </div>

        <NDataTable
          :columns="columns"
          :data="data"
          flex-height
          class="ota-package-table"
          :loading="loading"
          :pagination="pagination"
          :row-key="row => row.id"
          :scroll-x="isBmsTab ? 1900 : is4GModuleTab ? 1320 : 1180"
        />
      </div>
    </NCard>

    <NModal
      v-model:show="showModal"
      preset="card"
      :title="modalTitle"
      :style="{ width: form.device_kind === DEVICE_KIND_BMS ? '920px' : '720px' }"
    >
      <NForm label-placement="left" label-width="120" :model="form">
        <NFormItem :label="bt('auto.s_9d9540e486')" required>
          <NInput v-model:value="form.name" />
        </NFormItem>
        <template v-if="form.device_kind === DEVICE_KIND_BMS || form.device_kind === DEVICE_KIND_4G_MODULE">
          <NFormItem :label="bt('auto.s_d0b2958432')" required>
            <NInput v-model:value="form.version" :placeholder="bt('auto.s_5dca2568a4')" />
          </NFormItem>
        </template>
        <template v-if="form.device_kind === DEVICE_KIND_BMS">
          <NFormItem :label="bt('auto.s_bc15bf0b06')">
            <NInput v-model:value="form.target_version" :placeholder="bt('auto.s_c20cba8992')" />
          </NFormItem>
          <NFormItem :label="bt('auto.s_fac54c3430')">
            <NInput v-model:value="form.module" :placeholder="bt('auto.s_c20cba8992')" />
          </NFormItem>
          <NFormItem :label="bt('auto.s_52d9520ee1')" required>
            <NSelect
              v-model:value="form.package_type"
              :options="[
                { label: bt('auto.s_db45871e79'), value: 1 },
                { label: bt('auto.s_82e6566781'), value: 2 }
              ]"
            />
          </NFormItem>
          <NFormItem :label="bt('auto.s_a82af18739')" required>
            <NSelect
              v-model:value="form.signature_type"
              :options="[
                { label: 'MD5', value: 'MD5' },
                { label: 'SHA256', value: 'SHA256' }
              ]"
            />
          </NFormItem>
        </template>
        <NFormItem v-if="form.device_kind === DEVICE_KIND_4G_MODULE" :label="bt('auto.s_71ba0bc268')">
          <NCheckbox v-model:checked="form.is_latest">{{ bt('auto.s_0a60ac8f02') }}</NCheckbox>
        </NFormItem>
        <NFormItem :label="bt('auto.s_e92670f776')" required>
          <FilePicker
            v-model="form.package_url"
            biz-type="upgradePackage"
            :allowed-extensions="['bin', 'tar', 'gz', 'zip', 'gzip', 'apk', 'dav', 'pack']"
            accept=".bin,.tar,.gz,.zip,.gzip,.apk,.dav,.pack"
            value-mode="url"
          />
          <div style="color: #999; font-size: 12px; margin-top: 6px">
            {{ bt('pages.ota.extensionHint') }}
          </div>
        </NFormItem>
        <NFormItem v-if="form.device_kind !== DEVICE_KIND_BMS" :label="bt('auto.s_f411d0f1f9')">
          <NInput v-model:value="form.description" type="textarea" />
        </NFormItem>
        <template v-if="form.device_kind === DEVICE_KIND_BMS">
          <NFormItem :label="bt('auto.s_e96355e54a')">
            <NSelect
              v-model:value="form.battery_model_id"
              :options="bmsModelOptions"
              :placeholder="bt('auto.s_c20cba8992')"
              clearable
              filterable
            />
          </NFormItem>
          <NFormItem :label="bt('auto.s_3546dde727')">
            <NInput v-model:value="form.batch_number" :placeholder="bt('auto.s_9a15e5c82e')" />
          </NFormItem>
          <NFormItem :label="bt('auto.s_f461d11622')">
            <NInput v-model:value="form.item_uuid" :placeholder="bt('auto.s_32bd0453e4')" />
          </NFormItem>
          <NFormItem :label="bt('auto.s_2432b57515')">
            <NInput v-model:value="form.remark" />
          </NFormItem>
        </template>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="showModal = false">{{ bt('auto.s_625fb26b4b') }}</NButton>
          <NButton type="primary" :loading="saving" @click="submit">{{ bt('auto.s_be5fbbe34c') }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}

.ota-package-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 16px;
}

.ota-package-toolbar {
  flex-shrink: 0;
}

.ota-package-search {
  margin-bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
}

.ota-package-table {
  min-height: 0;
  flex: 1;
}
</style>
