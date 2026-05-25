<script setup lang="tsx">
import { onMounted, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import dayjs from 'dayjs'
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NImage,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  NTooltip,
  useMessage
} from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import { fetchUserList } from '@/service/api/auth'
import { deleteFile, getFileListByPage } from '@/service/api/file'
import { $t } from '@/locales'
import { formatDateTime } from '@/utils/common/datetime'
import { getDemoServerUrl, resolveFileUrl } from '@/utils/common/tool'
import { localStg } from '@/utils/storage'

defineOptions({ name: 'ManagementAttachment' })

const message = useMessage()
const loading = ref(false)
const tableData = ref<Api.File.ListItem[]>([])
const uploaderDisplayMap = ref<Record<string, string>>({})
const userListLoaded = ref(false)
const previewVisible = ref(false)
const previewFile = ref<Api.File.ListItem | null>(null)
const uploadedRange = ref<[number, number] | null>(null)

const queryParams = reactive({
  keyword: '',
  biz_type: null as string | null,
  storage_location: null as Api.File.StorageLocation | null,
  page: 1,
  page_size: 10
})

const pagination: PaginationProps = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  itemCount: 0,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    pagination.page = page
    queryParams.page = page
    getTableData()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.page = 1
    pagination.pageSize = pageSize
    queryParams.page = 1
    queryParams.page_size = pageSize
    getTableData()
  }
})

const storageOptions = [
  { label: '本地', value: 'local' },
  { label: '阿里云 OSS', value: 'aliyun' },
  { label: '七牛云 Kodo', value: 'qiniu' }
]

const bizTypeOptions = [
  { label: '图片', value: 'image' },
  { label: 'APP 安装包', value: 'appPackage' },
  { label: 'WGT 热更新包', value: 'wgtPackage' },
  { label: 'OTA 升级包', value: 'upgradePackage' },
  { label: '批量导入文件', value: 'importBatch' },
  { label: '协议插件', value: 'd_plugin' }
]

function normalizePagedFiles(raw: any): { total: number; list: Api.File.ListItem[] } {
  if (!raw) return { total: 0, list: [] }
  if (raw?.data) return normalizePagedFiles(raw.data)
  if (Array.isArray(raw?.list)) {
    return {
      total: Number(raw.total ?? raw.list.length),
      list: raw.list
    }
  }
  return { total: 0, list: [] }
}

function normalizeUsers(raw: any): Api.UserManagement.User[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (raw?.data) return normalizeUsers(raw.data)
  if (Array.isArray(raw?.list)) return raw.list
  return []
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const size = bytes / Math.pow(1024, idx)
  return `${size.toFixed(1)} ${units[idx]}`
}

function storageLabel(location: Api.File.StorageLocation) {
  return storageOptions.find(item => item.value === location)?.label || location
}

function bizTypeLabel(bizType: string) {
  return bizTypeOptions.find(item => item.value === bizType)?.label || bizType || '-'
}

function storageTagType(location: Api.File.StorageLocation): NaiveUI.ThemeColor {
  const map: Record<Api.File.StorageLocation, NaiveUI.ThemeColor> = {
    local: 'default',
    aliyun: 'success',
    qiniu: 'info'
  }
  return map[location] || 'default'
}

function buildQueryParams(): Api.File.ListReq {
  const params: Api.File.ListReq = {
    page: queryParams.page,
    page_size: queryParams.page_size
  }
  if (queryParams.keyword.trim()) params.keyword = queryParams.keyword.trim()
  if (queryParams.biz_type) params.biz_type = queryParams.biz_type
  if (queryParams.storage_location) params.storage_location = queryParams.storage_location
  if (uploadedRange.value?.length === 2) {
    params.start_time = dayjs(uploadedRange.value[0]).toISOString()
    params.end_time = dayjs(uploadedRange.value[1]).toISOString()
  }
  return params
}

function formatUploaderDisplay(user: Api.UserManagement.User) {
  return user.name || user.username || user.email || user.phone_number || ''
}

async function loadUploaderDisplayMap(files: Api.File.ListItem[]) {
  const hasUnresolvedUploader = files.some(row => {
    if (!row.uploaded_by || row.uploaded_by_name || row.uploaded_by_account) return false
    return !uploaderDisplayMap.value[row.uploaded_by]
  })
  if (!hasUnresolvedUploader || userListLoaded.value) return

  try {
    const data = await fetchUserList({ page: 1, page_size: 1000 })
    const users = normalizeUsers(data)
    const nextMap = { ...uploaderDisplayMap.value }
    users.forEach(user => {
      const id = String(user.id || '').trim()
      const display = formatUploaderDisplay(user)
      if (id && display) nextMap[id] = display
    })
    uploaderDisplayMap.value = nextMap
    userListLoaded.value = true
  } catch {
    userListLoaded.value = true
  }
}

async function getTableData() {
  loading.value = true
  try {
    const data: any = await getFileListByPage(buildQueryParams())
    const normalized = normalizePagedFiles(data)
    tableData.value = normalized.list
    pagination.itemCount = normalized.total
    await loadUploaderDisplayMap(normalized.list)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  queryParams.page = 1
  pagination.page = 1
  getTableData()
}

function handleReset() {
  queryParams.keyword = ''
  queryParams.biz_type = null
  queryParams.storage_location = null
  queryParams.page = 1
  pagination.page = 1
  uploadedRange.value = null
  getTableData()
}

function getAccessibleUrl(row: Api.File.ListItem) {
  return resolveFileUrl(row.url || row.path, getDemoServerUrl())
}

function isImage(row: Api.File.ListItem) {
  const ext = String(row.file_ext || '').toLowerCase()
  return row.mime_type?.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)
}

function uploaderLabel(row: Api.File.ListItem) {
  if (row.uploaded_by_name) return row.uploaded_by_name
  if (row.uploaded_by_account) return row.uploaded_by_account
  if (row.uploaded_by && uploaderDisplayMap.value[row.uploaded_by]) return uploaderDisplayMap.value[row.uploaded_by]
  return '-'
}

function handlePreview(row: Api.File.ListItem) {
  if (isImage(row)) {
    previewFile.value = row
    previewVisible.value = true
    return
  }
  window.open(getAccessibleUrl(row), '_blank', 'noopener,noreferrer')
}

async function handleDownload(row: Api.File.ListItem) {
  if (row.storage_location !== 'local') {
    window.open(getAccessibleUrl(row), '_blank', 'noopener,noreferrer')
    return
  }

  const token = String(localStg.get('token') || '').trim()
  const headers: Record<string, string> = {}
  if (token) headers['x-token'] = token
  const language = String(localStg.get('lang') || '').trim()
  if (language) headers['Accept-Language'] = language

  const baseUrl = getDemoServerUrl().replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/file/${row.id}/download`, { headers })
  if (!response.ok) {
    message.error(`下载失败（HTTP ${response.status}）`)
    return
  }
  const contentType = response.headers.get('content-type') || ''
  const disposition = response.headers.get('content-disposition') || ''
  if (contentType.includes('application/json') && !disposition) {
    const payload = await response.json().catch(() => null)
    message.error(payload?.message || '下载失败')
    return
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = row.file_name || 'download'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleDelete(row: Api.File.ListItem) {
  await deleteFile(row.id)
  message.success('删除成功')

  if (tableData.value.length <= 1 && queryParams.page > 1) {
    queryParams.page -= 1
    pagination.page = queryParams.page
  }
  await getTableData()
}

const columns: Ref<DataTableColumns<Api.File.ListItem>> = ref([
  {
    key: 'file_name',
    title: '文件名',
    minWidth: 240,
    ellipsis: { tooltip: true }
  },
  {
    key: 'file_size',
    title: '大小',
    width: 110,
    render: row => formatSize(row.file_size)
  },
  {
    key: 'biz_type',
    title: '业务类型',
    width: 140,
    ellipsis: { tooltip: true },
    render: row => bizTypeLabel(row.biz_type)
  },
  {
    key: 'storage_location',
    title: '存储位置',
    width: 130,
    render: row => <NTag type={storageTagType(row.storage_location)}>{storageLabel(row.storage_location)}</NTag>
  },
  {
    key: 'mime_type',
    title: '文件类型',
    minWidth: 170,
    render: row => row.mime_type || row.file_ext || '-'
  },
  {
    key: 'uploaded_at',
    title: '上传时间',
    width: 180,
    render: row => formatDateTime(row.uploaded_at) || '-'
  },
  {
    key: 'uploaded_by',
    title: '上传人',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: row => uploaderLabel(row)
  },
  {
    key: 'url',
    title: '访问地址',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render: row => getAccessibleUrl(row)
  },
  {
    key: 'operate',
    title: '操作',
    width: 210,
    fixed: 'right',
    render: row => (
      <NSpace size={8} justify="end">
        <NTooltip trigger="hover">
          {{
            trigger: () => (
              <NButton size="small" secondary onClick={() => handlePreview(row)}>
                预览
              </NButton>
            ),
            default: () => '预览文件'
          }}
        </NTooltip>
        <NTooltip trigger="hover">
          {{
            trigger: () => (
              <NButton size="small" secondary onClick={() => handleDownload(row)}>
                下载
              </NButton>
            ),
            default: () => '下载文件'
          }}
        </NTooltip>
        <NPopconfirm positive-text="确认删除" negative-text="取消" onPositiveClick={() => handleDelete(row)}>
          {{
            default: () => '删除后会同步删除存储对象，且可能影响已引用该附件的页面或记录。确认删除？',
            trigger: () => (
              <NButton size="small" type="error" secondary>
                删除
              </NButton>
            )
          }}
        </NPopconfirm>
      </NSpace>
    )
  }
])

onMounted(() => {
  getTableData()
})
</script>

<template>
  <NCard :title="$t('route.management_attachment')" :bordered="false" class="h-full rounded-8px shadow-sm">
    <div class="attachment-toolbar">
      <NInput
        v-model:value="queryParams.keyword"
        clearable
        placeholder="搜索文件名、原始文件名或路径"
        class="attachment-toolbar__keyword"
        @keyup.enter="handleSearch"
      />
      <NSelect
        v-model:value="queryParams.biz_type"
        clearable
        :options="bizTypeOptions"
        placeholder="业务类型"
        class="attachment-toolbar__biz"
      />
      <NSelect
        v-model:value="queryParams.storage_location"
        clearable
        :options="storageOptions"
        placeholder="存储位置"
        class="attachment-toolbar__storage"
      />
      <NDatePicker
        v-model:value="uploadedRange"
        type="datetimerange"
        clearable
        separator="-"
        class="attachment-toolbar__range"
      />
      <NSpace>
        <NButton type="primary" @click="handleSearch">查询</NButton>
        <NButton secondary @click="handleReset">重置</NButton>
      </NSpace>
    </div>

    <NDataTable
      remote
      :loading="loading"
      :columns="columns"
      :data="tableData"
      :pagination="pagination"
      :scroll-x="1540"
      class="mt-16px"
    />

    <NModal v-model:show="previewVisible" preset="card" :title="previewFile?.file_name || '预览'" class="w-720px">
      <div class="attachment-preview">
        <NImage
          v-if="previewFile"
          :src="getAccessibleUrl(previewFile)"
          object-fit="contain"
          class="attachment-preview__image"
        />
      </div>
    </NModal>
  </NCard>
</template>

<style scoped lang="scss">
.attachment-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.attachment-toolbar__keyword {
  width: 300px;
}

.attachment-toolbar__biz {
  width: 160px;
}

.attachment-toolbar__storage {
  width: 160px;
}

.attachment-toolbar__range {
  width: 360px;
}

.attachment-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

.attachment-preview__image {
  max-width: 100%;
  max-height: 70vh;
}
</style>
