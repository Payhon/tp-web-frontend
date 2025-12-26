<script setup lang="tsx">
import { ref } from 'vue'
import { NCard, NDataTable, NForm, NFormItem, NInput, NButton, NSpace, NTag, NDatePicker } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { useTable } from '@/hooks/common/table'
import { getTransferHistory } from '@/service/api/bms'

interface TransferItem {
  id: string
  device_id: string
  device_number: string
  device_model: string
  from_dealer_id?: string | null
  from_dealer_name?: string | null
  to_dealer_id?: string | null
  to_dealer_name?: string | null
  operator_id?: string | null
  operator_name?: string | null
  transfer_time: string
  remark?: string | null
}

interface TransferListResponse {
  list: TransferItem[]
  total: number
  page: number
  page_size: number
}

const createColumns = (): DataTableColumns<TransferItem> => [
  { key: 'device_number', title: '设备编号', minWidth: 150 },
  { key: 'device_model', title: '设备型号', minWidth: 120 },
  {
    key: 'from_dealer_name',
    title: '原经销商',
    minWidth: 150,
    render: row => row.from_dealer_name || <NTag type="info">厂家</NTag>
  },
  {
    key: 'to_dealer_name',
    title: '目标经销商',
    minWidth: 150,
    render: row => row.to_dealer_name || <NTag type="info">厂家</NTag>
  },
  { key: 'operator_name', title: '操作人', minWidth: 100 },
  { key: 'transfer_time', title: '转移时间', minWidth: 160 },
  {
    key: 'remark',
    title: '备注',
    minWidth: 200,
    ellipsis: { tooltip: true }
  }
]

const { data, loading, columns, pagination, getData, updateSearchParams } = useTable<
  TransferItem,
  typeof getTransferHistory
>({
  apiFn: getTransferHistory,
  apiParams: {
    page: 1,
    page_size: 10,
    device_number: '',
    start_time: undefined,
    end_time: undefined
  },
  transformer: (res: any) => {
    const payload: TransferListResponse | undefined = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): any => createColumns()
})

const searchForm = ref({
  device_number: '',
  start_time: null as number | null,
  end_time: null as number | null
})

const handleSearch = () => {
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    device_number: searchForm.value.device_number || undefined,
    start_time: searchForm.value.start_time
      ? dayjs(searchForm.value.start_time).format('YYYY-MM-DD HH:mm:ss')
      : undefined,
    end_time: searchForm.value.end_time ? dayjs(searchForm.value.end_time).format('YYYY-MM-DD HH:mm:ss') : undefined
  })
  getData()
}

const handleReset = () => {
  searchForm.value = {
    device_number: '',
    start_time: null,
    end_time: null
  }
  handleSearch()
}
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="设备转移记录" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem label="设备编号" path="device_number">
          <NInput
            v-model:value="searchForm.device_number"
            placeholder="请输入设备编号"
            style="width: 220px"
            clearable
          />
        </NFormItem>
        <NFormItem label="开始时间" path="start_time">
          <NDatePicker v-model:value="searchForm.start_time" type="datetime" clearable style="width: 260px" />
        </NFormItem>
        <NFormItem label="结束时间" path="end_time">
          <NDatePicker v-model:value="searchForm.end_time" type="datetime" clearable style="width: 260px" />
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
        :scroll-x="960"
      />
    </NCard>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
