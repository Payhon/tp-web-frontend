<script setup lang="tsx">
import { computed, getCurrentInstance, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import dayjs from 'dayjs'
import { NButton, NPopconfirm, NSpace, NSwitch, NTag } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import { useBoolean, useLoading } from '@sa/hooks'
import { apiKeyDel, fetchKeyList, updateKey } from '@/service/api'
import { useAuthStore } from '@/store/modules/auth'
import { $t } from '@/locales'
import { formatDateTime } from '@/utils/common/datetime'
import TableActionModal from './modules/table-action-modal.vue'
import type { ModalType } from './modules/table-action-modal.vue'

const authStore = useAuthStore()
const isSysAdmin = computed(() => authStore.userInfo.authority === 'SYS_ADMIN')

const { loading, startLoading, endLoading } = useLoading(false)
const { bool: visible, setTrue: openModal } = useBoolean()

type QueryFormModel = {
  keyword: string | null
  status: 0 | 1 | null
  tenant_id: string | null
  page: number
  page_size: number
}

const queryParams = reactive<QueryFormModel>({
  keyword: null,
  status: null,
  tenant_id: (authStore.userInfo.tenant_id as string) || null,
  page: 1,
  page_size: 10
})

const tableData = ref<UserManagement.UserKey[]>([])

function normalizeAppID(row: UserManagement.UserKey): string {
  return row.app_id || row.api_key || ''
}

function setTableData(data: UserManagement.UserKey[]) {
  tableData.value = data.map(item => ({
    ...item,
    show: false
  }))
}

function buildQueryParams(): Api.UserManagement.KeyQuery {
  const payload: Api.UserManagement.KeyQuery = {
    page: queryParams.page,
    page_size: queryParams.page_size
  }
  if (queryParams.keyword) {
    payload.keyword = queryParams.keyword.trim()
  }
  if (queryParams.status !== null) {
    payload.status = queryParams.status
  }
  if (isSysAdmin.value && queryParams.tenant_id) {
    payload.tenant_id = queryParams.tenant_id.trim()
  }
  return payload
}

async function getTableData() {
  startLoading()
  const { data } = await fetchKeyList(buildQueryParams())
  if (data) {
    const list: UserManagement.UserKey[] = data.list || []
    pagination.itemCount = data.total || 0
    setTableData(list)
  }
  endLoading()
}

function isExpired(row: UserManagement.UserKey): boolean {
  if (!row.expired_at) {
    return false
  }
  return dayjs(row.expired_at).isBefore(dayjs())
}

function formatTime(time: string | null): string {
  return formatDateTime(time) || '-'
}

async function handleCopyText(text: string) {
  if (!text) {
    return
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      window.$message?.success($t('theme.configOperation.copySuccess') || '复制成功')
      return
    } catch (err) {
      console.error('navigator.clipboard.writeText failed:', err)
    }
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.top = '-9999px'
  textArea.style.left = '-9999px'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  textArea.setSelectionRange(0, textArea.value.length)
  try {
    const copied = document.execCommand('copy')
    if (copied) {
      window.$message?.success($t('theme.configOperation.copySuccess') || '复制成功')
      return
    }
  } catch (err) {
    console.error("document.execCommand('copy') failed:", err)
  } finally {
    document.body.removeChild(textArea)
  }
  window.$message?.error($t('theme.configOperation.copyFail') || '复制失败')
}

const statusOptions = computed(() => [
  {
    label: $t('page.manage.api.apiStatus1.normal'),
    value: 1
  },
  {
    label: $t('page.manage.api.apiStatus1.freeze'),
    value: 0
  }
])

const columns: Ref<DataTableColumns<UserManagement.UserKey>> = ref([
  {
    key: 'app_id',
    minWidth: '240px',
    title: () => $t('page.manage.api.appId'),
    align: 'left',
    render: row => {
      const appId = normalizeAppID(row)
      return (
        <NSpace justify="space-between">
          <NSpace>
            <span>{appId || '-'}</span>
            {appId && <svg-icon local-icon="copy" class="text-18px" onClick={() => handleCopyText(appId)} />}
          </NSpace>
        </NSpace>
      )
    }
  },
  {
    key: 'secret_key',
    minWidth: '260px',
    title: () => $t('page.manage.api.secretKey'),
    align: 'left',
    render: (row: any) => {
      const secret = row.secret_key || ''
      if (!secret) {
        return <span>-</span>
      }

      if (row.show) {
        return (
          <NSpace justify="space-between">
            <NSpace>
              <span>{secret}</span>
              <svg-icon local-icon="eye-close" class="text-20px" onClick={() => handleHideSecret(row.id)} />
              <svg-icon local-icon="copy" class="text-20px" onClick={() => handleCopyText(secret)} />
            </NSpace>
          </NSpace>
        )
      }

      return (
        <NSpace justify="space-between">
          <NSpace>
            <span>********</span>
            <svg-icon local-icon="eye" class="text-20px" onClick={() => handleShowSecret(row.id)} />
          </NSpace>
        </NSpace>
      )
    }
  },
  {
    key: 'remark',
    minWidth: '160px',
    title: () => $t('page.manage.api.remark'),
    align: 'left',
    render: row => <span>{row.remark || row.name || '-'}</span>
  },
  {
    key: 'tenant_id',
    minWidth: '120px',
    title: () => $t('page.manage.api.tenantId'),
    align: 'left'
  },
  {
    key: 'expired_at',
    minWidth: '220px',
    title: () => $t('page.manage.api.expiredAt'),
    align: 'left',
    render: row => {
      if (!row.expired_at) {
        return <NTag type="default">{$t('page.manage.api.neverExpire')}</NTag>
      }
      return (
        <NSpace>
          <span>{formatTime(row.expired_at)}</span>
          <NTag type={isExpired(row) ? 'error' : 'success'}>
            {isExpired(row) ? $t('page.manage.api.expired') : $t('page.manage.api.notExpired')}
          </NTag>
        </NSpace>
      )
    }
  },
  {
    key: 'last_used_at',
    minWidth: '170px',
    title: () => $t('page.manage.api.lastUsedAt'),
    align: 'left',
    render: row => <span>{formatTime(row.last_used_at || null)}</span>
  },
  {
    key: 'status',
    title: () => $t('page.manage.api.apiStatus'),
    minWidth: '90px',
    align: 'left',
    render: row => {
      if (row.status === 0) {
        return <NTag type="error">{$t('page.manage.api.apiStatus1.freeze')}</NTag>
      }
      return <NTag type="success">{$t('page.manage.api.apiStatus1.normal')}</NTag>
    }
  },
  {
    key: 'created_at',
    title: () => $t('page.manage.api.created_at'),
    minWidth: '170px',
    align: 'left',
    render: row => <span>{formatTime(row.created_at || null)}</span>
  },
  {
    key: 'actions',
    title: () => $t('common.actions'),
    align: 'left',
    width: '380px',
    render: row => (
      <NSpace justify="start">
        <NButton type="primary" size="small" onClick={() => handleEditTable(row.id)}>
          {$t('common.edit')}
        </NButton>

        <NPopconfirm onPositiveClick={() => handleRotateSecret(row.id)}>
          {{
            default: () => $t('page.manage.api.rotateSecretConfirm'),
            trigger: () => (
              <NButton type="warning" size="small">
                {$t('page.manage.api.rotateSecret')}
              </NButton>
            )
          }}
        </NPopconfirm>

        <NPopconfirm onPositiveClick={() => handleDeleteTable(row.id)}>
          {{
            default: () => $t('common.confirmDelete'),
            trigger: () => (
              <NButton type="error" size="small">
                {$t('common.delete')}
              </NButton>
            )
          }}
        </NPopconfirm>

        <NSwitch value={Boolean(row.status === 1)} onChange={() => handleSwitchChange(row.id)} />
      </NSpace>
    )
  }
]) as Ref<DataTableColumns<UserManagement.UserKey>>

const modalType = ref<ModalType>('add')

function setModalType(type: ModalType) {
  modalType.value = type
}

const editData = ref<UserManagement.UserKey | null>(null)

function setEditData(data: UserManagement.UserKey | null) {
  editData.value = data
}

function handleAddTable() {
  setEditData(null)
  setModalType('add')
  openModal()
}

function handleShowSecret(rowId: string) {
  const item = tableData.value.find(v => v.id === rowId)
  if (item) {
    item.show = true
  }
}

function handleHideSecret(rowId: string) {
  const item = tableData.value.find(v => v.id === rowId)
  if (item) {
    item.show = false
  }
}

function handleEditTable(rowId: string) {
  const item = tableData.value.find(v => v.id === rowId)
  if (item) {
    setEditData(item)
  }
  setModalType('edit')
  openModal()
}

async function handleSwitchChange(rowId: string) {
  const item = tableData.value.find(v => v.id === rowId)
  if (!item) {
    return
  }
  const prevStatus = item.status
  const nextStatus: 0 | 1 = prevStatus === 1 ? 0 : 1
  item.status = nextStatus

  const res: any = await updateKey({
    id: rowId,
    status: nextStatus
  })
  if (res.error) {
    item.status = prevStatus
    return
  }
  window.$message?.success($t('common.updateSuccess'))
}

async function handleRotateSecret(rowId: string) {
  const res: any = await updateKey({
    id: rowId,
    rotate_secret: true
  })
  if (!res.error) {
    window.$message?.success($t('page.manage.api.rotateSecretSuccess'))
    await getTableData()
  }
}

async function handleDeleteTable(rowId: string) {
  const res: any = await apiKeyDel(rowId)
  if (!res.error) {
    window.$message?.success($t('common.deleteSuccess'))
    await getTableData()
  }
}

function handleSearch() {
  pagination.page = 1
  queryParams.page = 1
  getTableData()
}

function handleReset() {
  queryParams.keyword = null
  queryParams.status = null
  queryParams.tenant_id = (authStore.userInfo.tenant_id as string) || null
  pagination.page = 1
  queryParams.page = 1
  getTableData()
}

const pagination: PaginationProps = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 15, 20, 25, 30],
  onChange: (page: number) => {
    pagination.page = page
    queryParams.page = page
    getTableData()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    queryParams.page = 1
    queryParams.page_size = pageSize
    getTableData()
  }
})

const getPlatform = computed(() => {
  const { proxy }: any = getCurrentInstance()
  return proxy.getPlatform()
})

getTableData()
</script>

<template>
  <div>
    <n-card>
      <div class="h-full flex-col gap-15px">
        <NSpace align="center" wrap>
          <n-input
            v-model:value="queryParams.keyword"
            clearable
            style="width: 260px"
            :placeholder="$t('page.manage.api.searchPlaceholder')"
          />
          <n-select
            v-model:value="queryParams.status"
            clearable
            style="width: 140px"
            :options="statusOptions"
            :placeholder="$t('page.manage.api.apiStatus')"
          />
          <n-input
            v-if="isSysAdmin"
            v-model:value="queryParams.tenant_id"
            clearable
            style="width: 180px"
            :placeholder="$t('page.manage.api.tenantPlaceholder')"
          />
          <NButton type="primary" @click="handleSearch">{{ $t('common.search') }}</NButton>
          <NButton @click="handleReset">{{ $t('common.reset') }}</NButton>
        </NSpace>

        <NSpace>
          <NButton type="primary" @click="handleAddTable">
            <icon-ic-round-plus class="mr-4px text-20px" />
            {{ $t('page.manage.api.addApiKey') }}
          </NButton>
        </NSpace>

        <NDataTable
          :columns="columns"
          :data="tableData"
          :loading="loading"
          :pagination="pagination"
          class="flex-1-hidden"
        />

        <TableActionModal
          v-model:visible="visible"
          :class="getPlatform ? 'w-90%' : 'w-560px'"
          :type="modalType"
          :edit-data="editData"
          :is-sys-admin="isSysAdmin"
          :default-tenant-id="(authStore.userInfo.tenant_id as string) || ''"
          @success="getTableData"
        />
      </div>
    </n-card>
  </div>
</template>

<style scoped></style>
