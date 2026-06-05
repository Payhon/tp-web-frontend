<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTag,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { cancelOfflineCommand, getOfflineCommandDetail, getOfflineCommandList } from '@/service/api/bms'

interface OfflineCmdItem {
  id: string
  device_id: string
  device_number: string
  command_type: string
  identify: string
  status: 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
  created_at: string
  operator_name?: string | null
  dispatched_at?: string | null
  executed_at?: string | null
  error_message?: string | null
}

const message = useMessage()

const searchForm = ref({
  device_number: '',
  command_type: '',
  status: null as OfflineCmdItem['status'] | null
})

const statusOptions = [
  { label: bt('auto.s_6139a6998b'), value: 'PENDING' },
  { label: bt('auto.s_31ad9b0011'), value: 'SENT' },
  { label: bt('auto.s_fb11059057'), value: 'SUCCESS' },
  { label: bt('auto.s_1c83d79715'), value: 'FAILED' },
  { label: bt('auto.s_50239f4fee'), value: 'CANCELLED' }
]

function statusTagType(status: OfflineCmdItem['status']) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'error'
  if (status === 'CANCELLED') return 'default'
  if (status === 'SENT') return 'info'
  return 'warning'
}

function statusLabel(status: OfflineCmdItem['status']) {
  const map: Record<string, string> = {
    PENDING: bt('auto.s_6139a6998b'),
    SENT: bt('auto.s_49799437d0'),
    SUCCESS: bt('auto.s_fb11059057'),
    FAILED: bt('auto.s_1c83d79715'),
    CANCELLED: bt('auto.s_50239f4fee')
  }
  return map[status] || status
}

function createColumns(): DataTableColumns<OfflineCmdItem> {
  return [
    { key: 'device_number', title: bt('auto.s_4419e8a1ba'), minWidth: 160 },
    { key: 'command_type', title: bt('auto.s_9e7d7ccfb7'), minWidth: 160, render: r => r.command_type || '--' },
    {
      key: 'status',
      title: bt('auto.s_b56fe3d184'),
      minWidth: 140,
      render: r => <NTag type={statusTagType(r.status)}>{statusLabel(r.status)}</NTag>
    },
    { key: 'created_at', title: bt('auto.s_e8c30dca69'), minWidth: 160 },
    { key: 'operator_name', title: bt('auto.s_f9ac4b2aa6'), minWidth: 120, render: r => r.operator_name || '--' },
    { key: 'executed_at', title: bt('auto.s_70b3635aa3'), minWidth: 160, render: r => r.executed_at || '--' },
    { key: 'error_message', title: bt('auto.s_13d5f24381'), minWidth: 200, render: r => r.error_message || '--' },
    {
      key: 'actions',
      title: bt('auto.s_2b6bc0f293'),
      minWidth: 220,
      fixed: 'right',
      render: r => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => openDetail(r)}>{bt('auto.s_f26225bde6')}</NButton>
          <NButton size="small" type="warning" disabled={r.status !== 'PENDING'} onClick={() => doCancel(r)}>{bt('auto.s_bd9fcf46b4')}</NButton>
        </NSpace>
      )
    }
  ]
}

const { data, loading, pagination, columns, getData, updateSearchParams } = useTable<
  OfflineCmdItem,
  typeof getOfflineCommandList
>({
  apiFn: getOfflineCommandList,
  apiParams: { page: 1, page_size: 10 },
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

function handleSearch() {
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    device_number: searchForm.value.device_number || undefined,
    command_type: searchForm.value.command_type || undefined,
    status: searchForm.value.status || undefined
  })
  getData()
}

function handleReset() {
  searchForm.value = { device_number: '', command_type: '', status: null }
  handleSearch()
}

async function doCancel(row: OfflineCmdItem) {
  try {
    await cancelOfflineCommand(row.id)
    message.success(bt('auto.s_8e05b0c1b6'))
    getData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_a8301ae83a'))
  }
}

// detail modal
const showDetail = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)

async function openDetail(row: OfflineCmdItem) {
  showDetail.value = true
  detailLoading.value = true
  try {
    const res: any = await getOfflineCommandDetail(row.id)
    detail.value = res?.data
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_181421dd8a'))
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

getData()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_d3f156bcf0')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem :label="bt('auto.s_4419e8a1ba')">
          <NInput v-model:value="searchForm.device_number" :placeholder="bt('auto.s_f33cb868c8')" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem :label="bt('auto.s_9e7d7ccfb7')">
          <NInput v-model:value="searchForm.command_type" :placeholder="bt('auto.s_f33cb868c8')" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem :label="bt('auto.s_3fea7ca76c')">
          <NSelect v-model:value="searchForm.status" :options="statusOptions" clearable style="width: 220px" />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">{{ bt('auto.s_bee912d79e') }}</NButton>
            <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="1200"
      />
    </NCard>

    <NModal v-model:show="showDetail" preset="card" :title="bt('auto.s_74380878eb')" style="width: 860px">
      <template v-if="detailLoading">
        <div style="padding: 12px">{{ bt('auto.s_26b5bd4947') }}</div>
      </template>
      <template v-else>
        <NDescriptions bordered label-placement="left" :column="2">
          <NDescriptionsItem :label="bt('auto.s_4419e8a1ba')">{{ detail?.device_number || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_9e7d7ccfb7')">{{ detail?.command_type || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="Identify">{{ detail?.identify || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_3fea7ca76c')">{{ detail?.status || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_e8c30dca69')">{{ detail?.created_at || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_f9ac4b2aa6')">{{ detail?.operator_name || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_70b3635aa3')">{{ detail?.executed_at || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_13d5f24381')">{{ detail?.error_message || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="Payload" :span="2">
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0">{{ detail?.payload || '--' }}</pre>
          </NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_b688d62966')" :span="2">
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0">{{
              detail?.command_log_rsp_data || '--'
            }}</pre>
          </NDescriptionsItem>
        </NDescriptions>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
