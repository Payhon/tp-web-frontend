<script setup lang="tsx">
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
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
import { getOtaUpgradePackageList } from '@/service/api/bms'
import { deviceConfig } from '@/service/api/device'
import { request } from '@/service/request'
import FilePicker from '@/components/business/file-picker/index.vue'

type DeviceKind = 1 | 2

interface OtaPackageItem {
  id: string
  name: string
  version: string
  target_version?: string | null
  device_config_id?: string | null
  device_config_name?: string | null
  module?: string | null
  package_type?: number | null
  signature_type?: string | null
  package_url?: string | null
  created_at?: string | null
  remark?: string | null
  description?: string | null
  additional_info?: string | null
  device_kind?: DeviceKind | null
}

const DEVICE_KIND_BMS: DeviceKind = 1
const DEVICE_KIND_METER: DeviceKind = 2

const message = useMessage()
const activeTab = ref<DeviceKind>(DEVICE_KIND_BMS)
const isBmsTab = computed(() => activeTab.value === DEVICE_KIND_BMS)

const searchForm = ref({
  name: '',
  device_config_id: ''
})

const deviceConfigOptions = ref<Array<{ label: string; value: string }>>([])

async function loadDeviceConfigs() {
  try {
    const res: any = await deviceConfig({ page: 1, page_size: 1000 })
    const list = (res?.data?.list || []) as Array<{ id: string; name: string }>
    deviceConfigOptions.value = list.map(i => ({ label: i.name, value: i.id }))
  } catch {
    deviceConfigOptions.value = []
  }
}

function packageTypeLabel(v?: number | null) {
  if (v === 1) return '差分'
  if (v === 2) return '整包'
  return '--'
}

function createColumns(): DataTableColumns<OtaPackageItem> {
  if (isBmsTab.value) {
    return [
      { key: 'name', title: '升级包名称', minWidth: 180 },
      { key: 'version', title: '版本号', minWidth: 120 },
      { key: 'target_version', title: '目标版本', minWidth: 120, render: r => r.target_version || '--' },
      { key: 'device_config_name', title: '设备配置', minWidth: 160, render: r => r.device_config_name || '--' },
      { key: 'module', title: '模块', minWidth: 100, render: r => r.module || '--' },
      { key: 'package_type', title: '类型', minWidth: 90, render: r => packageTypeLabel(r.package_type) },
      { key: 'signature_type', title: '签名算法', minWidth: 100, render: r => r.signature_type || '--' },
      { key: 'created_at', title: '创建时间', minWidth: 160, render: r => r.created_at || '--' },
      {
        key: 'actions',
        title: '操作',
        minWidth: 240,
        fixed: 'right',
        render: r => renderActions(r)
      }
    ]
  }

  return [
    { key: 'name', title: '升级包名称', minWidth: 220 },
    { key: 'description', title: '说明', minWidth: 300, render: r => r.description || '--' },
    { key: 'package_url', title: '固件文件', minWidth: 260, render: r => r.package_url || '--' },
    { key: 'created_at', title: '创建时间', minWidth: 160, render: r => r.created_at || '--' },
    {
      key: 'actions',
      title: '操作',
      minWidth: 220,
      fixed: 'right',
      render: r => renderActions(r)
    }
  ]
}

function renderActions(row: OtaPackageItem) {
  return (
    <NSpace>
      <NButton size="small" type="primary" onClick={() => openEdit(row)}>
        编辑
      </NButton>
      <NPopconfirm onPositiveClick={() => doDelete(row)}>
        {{
          default: () => '确认删除该升级包？',
          trigger: () => (
            <NButton size="small" type="error">
              删除
            </NButton>
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
    device_config_id: isBmsTab.value ? searchForm.value.device_config_id || undefined : undefined,
    device_kind: activeTab.value
  })
}

function handleSearch() {
  syncQuery(1)
  getData()
}

function handleReset() {
  searchForm.value = { name: '', device_config_id: '' }
  handleSearch()
}

watch(
  activeTab,
  () => {
    searchForm.value = { name: '', device_config_id: '' }
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
  device_config_id: '',
  module: '',
  package_type: 2 as 1 | 2,
  signature_type: 'SHA256' as 'MD5' | 'SHA256',
  package_url: '',
  additional_info: '{}' as string,
  description: '',
  remark: '',
  device_kind: DEVICE_KIND_BMS as DeviceKind
})

const modalTitle = computed(() => {
  const prefix = modalType.value === 'create' ? '新增' : '编辑'
  return `${prefix}${isBmsTab.value ? 'BMS' : '仪表'}升级包`
})

function resetForm(kind: DeviceKind) {
  form.value = {
    id: '',
    name: '',
    version: '',
    target_version: '',
    device_config_id: '',
    module: '',
    package_type: 2,
    signature_type: 'SHA256',
    package_url: '',
    additional_info: '{}',
    description: '',
    remark: '',
    device_kind: kind
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
    device_config_id: row.device_config_id || '',
    module: row.module || '',
    package_type: (row.package_type as 1 | 2) || 2,
    signature_type: (row.signature_type as 'MD5' | 'SHA256') || 'SHA256',
    package_url: row.package_url || '',
    additional_info: row.additional_info || '{}',
    description: row.description || '',
    remark: row.remark || '',
    device_kind: (row.device_kind as DeviceKind) || activeTab.value
  }
  showModal.value = true
}

async function submit() {
  if (!form.value.name.trim()) {
    message.warning('请填写升级包名称')
    return
  }
  if (!form.value.package_url.trim()) {
    message.warning('请上传升级包固件')
    return
  }
  if (form.value.device_kind === DEVICE_KIND_BMS) {
    if (!form.value.version.trim() || !form.value.device_config_id) {
      message.warning('请填写：升级包名称/版本号/设备配置')
      return
    }
  }

  saving.value = true
  try {
    const payload: any = {
      name: form.value.name.trim(),
      package_url: form.value.package_url.trim(),
      description: form.value.description.trim() ? form.value.description.trim() : undefined,
      device_kind: form.value.device_kind
    }

    if (form.value.device_kind === DEVICE_KIND_BMS) {
      Object.assign(payload, {
        version: form.value.version.trim(),
        target_version: form.value.target_version.trim() ? form.value.target_version.trim() : undefined,
        device_config_id: form.value.device_config_id,
        module: form.value.module.trim() ? form.value.module.trim() : undefined,
        package_type: form.value.package_type,
        signature_type: form.value.signature_type,
        additional_info: form.value.additional_info?.trim() ? form.value.additional_info.trim() : '{}',
        remark: form.value.remark.trim() ? form.value.remark.trim() : undefined
      })
    }

    if (modalType.value === 'create') {
      await request.post('/ota/package', payload)
      message.success('创建成功')
    } else {
      await request.put('/ota/package', { ...payload, id: form.value.id })
      message.success('更新成功')
    }
    showModal.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function doDelete(row: OtaPackageItem) {
  try {
    await request.delete(`/ota/package/${row.id}`)
    message.success('删除成功')
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

loadDeviceConfigs()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="OTA升级包管理" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane :name="1" tab="BMS升级包" />
        <NTabPane :name="2" tab="仪表升级包" />
      </NTabs>

      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem label="升级包名称">
          <NInput v-model:value="searchForm.name" placeholder="支持模糊搜索" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem v-if="isBmsTab" label="设备配置">
          <NSelect
            v-model:value="searchForm.device_config_id"
            :options="deviceConfigOptions"
            clearable
            filterable
            style="width: 260px"
          />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
            <NButton type="success" @click="openCreate">新增升级包</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="isBmsTab ? 1200 : 980"
      />
    </NCard>

    <NModal
      v-model:show="showModal"
      preset="card"
      :title="modalTitle"
      :style="{ width: form.device_kind === DEVICE_KIND_BMS ? '920px' : '720px' }"
    >
      <NForm label-placement="left" label-width="120" :model="form">
        <NFormItem label="升级包名称" required>
          <NInput v-model:value="form.name" />
        </NFormItem>
        <template v-if="form.device_kind === DEVICE_KIND_BMS">
          <NFormItem label="版本号" required>
            <NInput v-model:value="form.version" placeholder="例如：1.0.1" />
          </NFormItem>
          <NFormItem label="目标版本">
            <NInput v-model:value="form.target_version" placeholder="可选" />
          </NFormItem>
          <NFormItem label="设备配置" required>
            <NSelect v-model:value="form.device_config_id" :options="deviceConfigOptions" filterable />
          </NFormItem>
          <NFormItem label="模块">
            <NInput v-model:value="form.module" placeholder="可选" />
          </NFormItem>
          <NFormItem label="包类型" required>
            <NSelect
              v-model:value="form.package_type"
              :options="[
                { label: '差分', value: 1 },
                { label: '整包', value: 2 }
              ]"
            />
          </NFormItem>
          <NFormItem label="签名算法" required>
            <NSelect
              v-model:value="form.signature_type"
              :options="[
                { label: 'MD5', value: 'MD5' },
                { label: 'SHA256', value: 'SHA256' }
              ]"
            />
          </NFormItem>
        </template>
        <NFormItem label="升级包固件" required>
          <FilePicker
            v-model="form.package_url"
            biz-type="upgradePackage"
            :allowed-extensions="['bin', 'tar', 'gz', 'zip', 'gzip', 'apk', 'dav', 'pack']"
            accept=".bin,.tar,.gz,.zip,.gzip,.apk,.dav,.pack"
            value-mode="url"
          />
          <div style="color: #999; font-size: 12px; margin-top: 6px">
            支持扩展名：.bin/.tar/.gz/.zip/.gzip/.apk/.dav/.pack
          </div>
        </NFormItem>
        <template v-if="form.device_kind === DEVICE_KIND_BMS">
          <NFormItem label="附加信息(JSON)">
            <NInput v-model:value="form.additional_info" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" />
          </NFormItem>
        </template>
        <NFormItem label="说明">
          <NInput v-model:value="form.description" :type="form.device_kind === DEVICE_KIND_METER ? 'textarea' : 'text'" />
        </NFormItem>
        <template v-if="form.device_kind === DEVICE_KIND_BMS">
          <NFormItem label="备注">
            <NInput v-model:value="form.remark" />
          </NFormItem>
        </template>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="submit">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
