<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NTag,
  NTree,
  useDialog,
  useMessage
} from 'naive-ui'
import type { DataTableColumns, TreeOption } from 'naive-ui'
import dayjs from 'dayjs'
import { $t } from '@/locales'
import { delUser, editUser } from '@/service/api/auth'
import {
  fetchAppUserList,
  fetchAppUserSourceOptions,
  type AppUserListItem,
  type AppUserSourceOption
} from '@/service/api/app-manage'

type SourceNode = TreeOption & {
  key: string
  label: string
  source_type: 'APP' | 'WXMP'
  wx_appid?: string
  children?: SourceNode[]
}

const message = useMessage()
const dialog = useDialog()

const sourceLoading = ref(false)
const sourceTree = ref<SourceNode[]>([])
const selectedSourceKeys = ref<string[]>(['APP'])
const selectedSource = ref<SourceNode>({
  key: 'APP',
  label: 'App 端',
  source_type: 'APP'
})

const loading = ref(false)
const data = ref<AppUserListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const searchForm = ref({
  keyword: '',
  status: null as 'N' | 'F' | null
})

const statusOptions = computed(() => [
  { label: $t('page.manage.user.status.normal'), value: 'N' },
  { label: $t('page.manage.user.status.freeze'), value: 'F' }
])

const pagination = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (nextPage: number) => {
    page.value = nextPage
    loadUsers()
  },
  onUpdatePageSize: (nextPageSize: number) => {
    pageSize.value = nextPageSize
    page.value = 1
    loadUsers()
  }
}))

function formatTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'
}

function formatIdentityTypes(value?: string | null) {
  if (!value) return '--'
  const map: Record<string, string> = {
    PHONE: '手机号',
    EMAIL: '邮箱',
    WXMP_OPENID: '微信'
  }
  return value
    .split(',')
    .map(item => map[item] || item)
    .join(' / ')
}

function toSourceNode(item: AppUserSourceOption): SourceNode {
  return {
    key: item.key,
    label: item.label,
    source_type: item.source_type,
    wx_appid: item.wx_appid,
    children: item.children?.map(toSourceNode)
  }
}

function findSourceNode(nodes: SourceNode[], key: string): SourceNode | null {
  for (const node of nodes) {
    if (node.key === key) return node
    const child = node.children ? findSourceNode(node.children, key) : null
    if (child) return child
  }
  return null
}

async function loadSources() {
  sourceLoading.value = true
  try {
    const res: any = await fetchAppUserSourceOptions()
    sourceTree.value = (res?.data || []).map(toSourceNode)
    const initial = findSourceNode(sourceTree.value, selectedSourceKeys.value[0]) || sourceTree.value[0]
    if (initial) {
      selectedSource.value = initial
      selectedSourceKeys.value = [initial.key]
    }
  } catch (e: any) {
    message.error(e?.message || '来源加载失败')
  } finally {
    sourceLoading.value = false
  }
}

async function loadUsers() {
  loading.value = true
  try {
    const source = selectedSource.value
    const res: any = await fetchAppUserList({
      page: page.value,
      page_size: pageSize.value,
      source_type: source.source_type,
      wx_appid: source.wx_appid,
      keyword: searchForm.value.keyword.trim() || undefined,
      status: searchForm.value.status || undefined
    })
    data.value = res?.data?.list || []
    total.value = res?.data?.total || 0
  } catch (e: any) {
    message.error(e?.message || '用户列表加载失败')
  } finally {
    loading.value = false
  }
}

function handleSelectSource(keys: Array<string | number>) {
  const key = String(keys[0] || '')
  const node = findSourceNode(sourceTree.value, key)
  if (!node) return
  selectedSource.value = node
  selectedSourceKeys.value = [key]
  page.value = 1
  loadUsers()
}

function handleSearch() {
  page.value = 1
  loadUsers()
}

function handleReset() {
  searchForm.value = { keyword: '', status: null }
  handleSearch()
}

function toggleStatus(row: AppUserListItem) {
  const next = row.status === 'F' ? 'N' : 'F'
  const nextLabel = next === 'F' ? $t('page.manage.user.status.freeze') : $t('page.manage.user.status.normal')
  dialog.warning({
    title: $t('page.appManage.users.confirm.statusChangeTitle'),
    content: $t('page.appManage.users.confirm.statusChangeContent', { status: nextLabel }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await editUser({ id: row.id, status: next })
        message.success($t('common.operationSuccess'))
        loadUsers()
      } catch (e: any) {
        message.error(e?.message || $t('common.operationFailed'))
      }
    }
  })
}

function confirmDelete(row: AppUserListItem) {
  dialog.warning({
    title: $t('page.appManage.users.confirm.deleteTitle'),
    content: $t('page.appManage.users.confirm.deleteContent', { phone: row.phone_number || row.email || row.username || row.id }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await delUser(row.id)
        message.success($t('common.deleteSuccess'))
        loadUsers()
      } catch (e: any) {
        message.error(e?.message || $t('common.deleteFailed'))
      }
    }
  })
}

const columns = computed<DataTableColumns<AppUserListItem>>(() => [
  { key: 'phone_number', title: '手机号', minWidth: 140, render: row => row.phone_number || '--' },
  { key: 'email', title: '邮箱', minWidth: 190, render: row => row.email || '--' },
  { key: 'username', title: '用户名', minWidth: 160, render: row => row.username || '--' },
  { key: 'name', title: '昵称', minWidth: 130, render: row => row.name || '--' },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: row => (
      <NTag type={row.status === 'F' ? 'error' : 'success'}>
        {row.status === 'F' ? $t('page.manage.user.status.freeze') : $t('page.manage.user.status.normal')}
      </NTag>
    )
  },
  {
    key: 'source',
    title: '来源',
    minWidth: 160,
    render: row => (
      <NSpace size={4}>
        <NTag type={row.source_type === 'WXMP' ? 'info' : 'default'}>{row.source_type === 'WXMP' ? '小程序' : 'App'}</NTag>
        <span>{row.source_name || '--'}</span>
      </NSpace>
    )
  },
  { key: 'wx_appid', title: '微信 AppID', minWidth: 190, render: row => row.wx_appid || '--' },
  { key: 'identity_types', title: '身份', minWidth: 150, render: row => formatIdentityTypes(row.identity_types) },
  { key: 'device_count', title: '绑定设备', width: 100, render: row => row.device_count || 0 },
  { key: 'last_bind_at', title: '最近绑定', minWidth: 170, render: row => row.last_bind_at || '--' },
  { key: 'last_visit_time', title: '最近访问', minWidth: 170, render: row => formatTime(row.last_visit_time) },
  { key: 'created_at', title: '注册时间', minWidth: 170, render: row => formatTime(row.created_at) },
  {
    key: 'actions',
    title: $t('common.actions'),
    width: 190,
    fixed: 'right',
    render: row => (
      <NSpace>
        <NButton size="small" type={row.status === 'F' ? 'primary' : 'warning'} onClick={() => toggleStatus(row)}>
          {row.status === 'F' ? $t('page.appManage.users.action.unfreeze') : $t('page.appManage.users.action.freeze')}
        </NButton>
        <NButton size="small" type="error" onClick={() => confirmDelete(row)}>
          {$t('common.delete')}
        </NButton>
      </NSpace>
    )
  }
])

onMounted(async () => {
  await loadSources()
  await loadUsers()
})
</script>

<template>
  <div class="app-users-page">
    <NCard title="用户来源" :bordered="false" size="small" class="source-card">
      <NTree
        v-model:selected-keys="selectedSourceKeys"
        block-line
        default-expand-all
        :data="sourceTree"
        :loading="sourceLoading"
        :selectable="true"
        key-field="key"
        label-field="label"
        @update:selected-keys="handleSelectSource"
      />
    </NCard>

    <NCard :title="$t('page.appManage.users.title')" :bordered="false" size="small" class="list-card">
      <NForm inline :model="searchForm" label-placement="left" label-width="auto" class="mb-4 flex flex-wrap gap-4">
        <NFormItem label="关键词">
          <NInput
            v-model:value="searchForm.keyword"
            clearable
            style="width: 320px"
            placeholder="手机号 / 邮箱 / 用户名 / 昵称"
            @keyup.enter="handleSearch"
          />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect v-model:value="searchForm.status" :options="statusOptions" clearable style="width: 160px" />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">{{ $t('common.search') }}</NButton>
            <NButton @click="handleReset">{{ $t('common.reset') }}</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id + ':' + (row.wx_appid || row.source_type)"
        :scroll-x="1820"
        class="flex-1-hidden"
      />
    </NCard>
  </div>
</template>

<style scoped>
.app-users-page {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.source-card,
.list-card {
  min-height: 0;
}

@media (max-width: 900px) {
  .app-users-page {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}
</style>
