<script setup lang="tsx">
import { ref } from 'vue'
import { NButton, NCard, NDataTable, NDescriptions, NDescriptionsItem, NForm, NFormItem, NInput, NModal, NSelect, NSpace, NTag, useMessage } from 'naive-ui'
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
  { label: '待执行', value: 'PENDING' },
  { label: '已下发(等待结果)', value: 'SENT' },
  { label: '已执行(成功)', value: 'SUCCESS' },
  { label: '执行失败', value: 'FAILED' },
  { label: '已撤销', value: 'CANCELLED' }
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
    PENDING: '待执行',
    SENT: '已下发',
    SUCCESS: '已执行(成功)',
    FAILED: '执行失败',
    CANCELLED: '已撤销'
  }
  return map[status] || status
}

function createColumns(): DataTableColumns<OfflineCmdItem> {
  return [
    { key: 'device_number', title: '设备序列号', minWidth: 160 },
    { key: 'command_type', title: '指令类型', minWidth: 160, render: r => r.command_type || '--' },
    { key: 'status', title: '执行状态', minWidth: 140, render: r => <NTag type={statusTagType(r.status)}>{statusLabel(r.status)}</NTag> },
    { key: 'created_at', title: '下发时间', minWidth: 160 },
    { key: 'operator_name', title: '操作人', minWidth: 120, render: r => r.operator_name || '--' },
    { key: 'executed_at', title: '执行时间', minWidth: 160, render: r => r.executed_at || '--' },
    { key: 'error_message', title: '失败原因', minWidth: 200, render: r => r.error_message || '--' },
    {
      key: 'actions',
      title: '操作',
      minWidth: 220,
      fixed: 'right',
      render: r => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => openDetail(r)}>
            详情
          </NButton>
          <NButton size="small" type="warning" disabled={r.status !== 'PENDING'} onClick={() => doCancel(r)}>
            撤销
          </NButton>
        </NSpace>
      )
    }
  ]
}

const { data, loading, pagination, columns, getData, updateSearchParams } = useTable<OfflineCmdItem, typeof getOfflineCommandList>({
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
    message.success('撤销成功')
    getData()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
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
    message.error(e?.message || '获取详情失败')
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

getData()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="离线指令" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm inline :model="searchForm" label-placement="left" label-width="auto" class="mb-4 flex flex-wrap gap-4 items-end">
        <NFormItem label="设备序列号">
          <NInput v-model:value="searchForm.device_number" placeholder="支持模糊搜索" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem label="指令类型">
          <NInput v-model:value="searchForm.command_type" placeholder="支持模糊搜索" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect v-model:value="searchForm.status" :options="statusOptions" clearable style="width: 220px" />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
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

    <NModal v-model:show="showDetail" preset="card" title="离线指令详情" style="width: 860px">
      <template v-if="detailLoading">
        <div style="padding: 12px">加载中...</div>
      </template>
      <template v-else>
        <NDescriptions bordered label-placement="left" :column="2">
          <NDescriptionsItem label="设备序列号">{{ detail?.device_number || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="指令类型">{{ detail?.command_type || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="Identify">{{ detail?.identify || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="状态">{{ detail?.status || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="下发时间">{{ detail?.created_at || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="操作人">{{ detail?.operator_name || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="执行时间">{{ detail?.executed_at || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="失败原因">{{ detail?.error_message || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="Payload" :span="2">
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0">{{ detail?.payload || '--' }}</pre>
          </NDescriptionsItem>
          <NDescriptionsItem label="设备响应" :span="2">
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0">{{ detail?.command_log_rsp_data || '--' }}</pre>
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

