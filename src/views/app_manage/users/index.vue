<script setup lang="tsx">
import { computed, ref } from 'vue'
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
  useDialog,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { useTable } from '@/hooks/common/table'
import { $t } from '@/locales'
import { delUser, editUser, fetchUserList } from '@/service/api/auth'

type UserRow = {
  id: string
  email: string
  name?: string | null
  phone_number: string
  status?: 'N' | 'F'
  created_at?: string
  updated_at?: string
  user_kind?: string
}

type ListResp<T> = {
  list: T[]
  total: number
}

const message = useMessage()
const dialog = useDialog()

const searchForm = ref({
  keyword: '',
  status: null as 'N' | 'F' | null
})

const checkedRowKeys = ref<string[]>([])

const fetchEndUserList = async (params: any) => {
  const res: any = await fetchUserList(params)
  return { ...res, __params: params }
}

let getTableData: () => void = () => {}
let setSearchParams: any = () => {}

const table = useTable<UserRow, typeof fetchEndUserList>({
  apiFn: fetchEndUserList as any,
  apiParams: {
    page: 1,
    page_size: 10,
    user_kind: 'END_USER'
  } as any,
  onPaginationChanged: async p => {
    const kw = searchForm.value.keyword.trim()
    const next: any = {
      page: p.page,
      page_size: p.pageSize,
      user_kind: 'END_USER',
      status: searchForm.value.status || undefined
    }
    if (kw) {
      if (kw.includes('@')) next.email = kw
      else if (/^[0-9+\\-\\s]+$/.test(kw)) next.phone_number = kw
      else next.name = kw
    }
    setSearchParams(next)
    getTableData()
  },
  transformer: (res: any) => {
    const payload: ListResp<UserRow> | undefined = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: res?.__params?.page ?? 1,
      pageSize: res?.__params?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): DataTableColumns<UserRow> => [
    { type: 'selection' },
    { key: 'phone_number', title: $t('page.manage.user.userPhone'), minWidth: 140 },
    { key: 'email', title: $t('page.manage.user.userEmail'), minWidth: 180 },
    { key: 'name', title: $t('page.manage.user.userName'), minWidth: 140, render: row => row.name || '--' },
    {
      key: 'status',
      title: $t('page.manage.user.userStatus2'),
      width: 100,
      render: row => (
        <NTag type={row.status === 'F' ? 'error' : 'success'}>
          {row.status === 'F' ? $t('page.manage.user.status.freeze') : $t('page.manage.user.status.normal')}
        </NTag>
      )
    },
    {
      key: 'created_at',
      title: $t('page.manage.api.created_at'),
      minWidth: 160,
      render: row => (row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss') : '--')
    },
    {
      key: 'actions',
      title: $t('common.actions'),
      width: 200,
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
  ]
})

const { data, loading, columns, pagination, getData, updateSearchParams } = table
getTableData = getData
setSearchParams = updateSearchParams

function handleSearch() {
  const kw = searchForm.value.keyword.trim()
  const next: any = {
    page: 1,
    page_size: pagination.pageSize,
    user_kind: 'END_USER',
    status: searchForm.value.status || undefined
  }
  if (kw) {
    if (kw.includes('@')) next.email = kw
    else if (/^[0-9+\\-\\s]+$/.test(kw)) next.phone_number = kw
    else next.name = kw
  }
  updateSearchParams(next)
  getData()
}

function handleReset() {
  searchForm.value = { keyword: '', status: null }
  handleSearch()
}

function toggleStatus(row: UserRow) {
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
        getData()
      } catch (e: any) {
        message.error(e?.message || $t('common.operationFailed'))
      }
    }
  })
}

function confirmDelete(row: UserRow) {
  dialog.warning({
    title: $t('page.appManage.users.confirm.deleteTitle'),
    content: $t('page.appManage.users.confirm.deleteContent', { phone: row.phone_number }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await delUser(row.id)
        message.success($t('common.deleteSuccess'))
        getData()
      } catch (e: any) {
        message.error(e?.message || $t('common.deleteFailed'))
      }
    }
  })
}

const statusOptions = computed(() => [
  { label: $t('page.manage.user.status.normal'), value: 'N' },
  { label: $t('page.manage.user.status.freeze'), value: 'F' }
])
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="$t('page.appManage.users.title')" :bordered="false" size="small" class="card-wrapper">
      <NForm inline :model="searchForm" label-placement="left" label-width="auto" class="mb-4 flex flex-wrap gap-4">
        <NFormItem :label="$t('page.appManage.users.keyword')">
          <NInput
            v-model:value="searchForm.keyword"
            clearable
            style="width: 320px"
            :placeholder="$t('page.appManage.users.keywordPlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.manage.user.userStatus2')">
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
        v-model:checked-row-keys="checkedRowKeys"
        :columns="columns"
        :data="data"
        size="small"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="1100"
        class="flex-1-hidden"
      />
    </NCard>
  </div>
</template>
