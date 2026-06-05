<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
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
  { key: 'device_number', title: bt('auto.s_cf05392308'), minWidth: 150 },
  { key: 'device_model', title: bt('auto.s_5858832b73'), minWidth: 120 },
  {
    key: 'from_dealer_name',
    title: bt('auto.s_60ae0a35c8'),
    minWidth: 150,
    render: row => row.from_dealer_name || <NTag type="info">{bt('auto.s_8284e8dacc')}</NTag>
  },
  {
    key: 'to_dealer_name',
    title: bt('auto.s_62377d58e6'),
    minWidth: 150,
    render: row => row.to_dealer_name || <NTag type="info">{bt('auto.s_8284e8dacc')}</NTag>
  },
  { key: 'operator_name', title: bt('auto.s_f9ac4b2aa6'), minWidth: 100 },
  { key: 'transfer_time', title: bt('auto.s_96973db7f5'), minWidth: 160 },
  {
    key: 'remark',
    title: bt('auto.s_2432b57515'),
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
    <NCard :title="bt('auto.s_cc286cd5f4')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem :label="bt('auto.s_cf05392308')" path="device_number">
          <NInput
            v-model:value="searchForm.device_number"
            :placeholder="bt('auto.s_52b2a2bd92')"
            style="width: 220px"
            clearable
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_592c595891')" path="start_time">
          <NDatePicker v-model:value="searchForm.start_time" type="datetime" clearable style="width: 260px" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_f782779e8b')" path="end_time">
          <NDatePicker v-model:value="searchForm.end_time" type="datetime" clearable style="width: 260px" />
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
