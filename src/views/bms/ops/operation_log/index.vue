<script setup lang="tsx">
import { computed, reactive, ref } from 'vue'
import { NButton, NCard, NDatePicker, NForm, NFormItem, NInput, NSelect, useMessage } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import moment from 'moment'
import { getBatteryOperationLogList } from '@/service/api/bms'
import { formatDateTime } from '@/utils/common/datetime'

const message = useMessage()

const opTypeOptions = [
  { label: '全部', value: '' },
  { label: '创建', value: 'CREATE' },
  { label: '导入', value: 'IMPORT' },
  { label: '转移/调拨', value: 'TRANSFER' },
  { label: '维保提交', value: 'WARRANTY_SUBMIT' },
  { label: '维保处理', value: 'WARRANTY_HANDLE' },
  { label: '维保记录提交', value: 'MAINTENANCE_SUBMIT' },
  { label: '维保记录处理', value: 'MAINTENANCE_HANDLE' }
]

const range = ref<[number, number]>([moment().subtract(7, 'days').valueOf(), moment().valueOf()])

const queryParams = reactive({
  device_number: '',
  operation_type: '' as string,
  start_time: '',
  end_time: ''
})

const total = ref(0)
const tableData = ref<any[]>([])

const pagination: PaginationProps = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 50],
  onChange: (page: number) => {
    pagination.page = page
    getTableData()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    getTableData()
  }
})

function pickerChange(value: [number, number] | null) {
  if (value && value.length === 2) {
    const startDate = moment(value[0])
    const endDate = moment(value[1]).endOf('day')
    queryParams.start_time = startDate.format('YYYY-MM-DDTHH:mm:ssZ')
    queryParams.end_time = endDate.format('YYYY-MM-DDTHH:mm:ssZ')
  } else {
    queryParams.start_time = ''
    queryParams.end_time = ''
  }
}

const columns = computed<DataTableColumns<any>>(() => [
  {
    key: 'occurred_at',
    title: '时间',
    minWidth: 160,
    render: row => formatDateTime(row.occurred_at)
  },
  { key: 'device_number', title: '电池编号', minWidth: 160 },
  { key: 'operation_type', title: '类型', minWidth: 140, render: row => row.operation_type || '-' },
  { key: 'operator_name', title: '操作人', minWidth: 140, render: row => row.operator_name || '-' },
  {
    key: 'description',
    title: '描述',
    minWidth: 360,
    ellipsis: { tooltip: true },
    render: row => row.description || '-'
  }
])

async function getTableData() {
  const params: any = {
    page: pagination.page || 1,
    page_size: pagination.pageSize || 10,
    device_number: queryParams.device_number || undefined,
    operation_type: queryParams.operation_type || undefined,
    start_time: queryParams.start_time || undefined,
    end_time: queryParams.end_time || undefined
  }
  try {
    const res: any = await getBatteryOperationLogList(params)
    tableData.value = res?.data?.list || []
    total.value = res?.data?.total || 0
  } catch (e: any) {
    message.error(e?.message || '获取操作记录失败')
  }
}

function handleQuery() {
  pagination.page = 1
  getTableData()
}

function handleReset() {
  queryParams.device_number = ''
  queryParams.operation_type = ''
  queryParams.start_time = ''
  queryParams.end_time = ''
  range.value = [moment().subtract(7, 'days').valueOf(), moment().valueOf()]
  pagination.page = 1
  getTableData()
}

getTableData()
</script>

<template>
  <NCard title="运营日志">
    <NForm class="mb-12px" :inline="true" label-placement="left" :model="queryParams">
      <NFormItem label="电池编号">
        <NInput v-model:value="queryParams.device_number" class="w-220px" placeholder="支持模糊查询" />
      </NFormItem>
      <NFormItem label="类型">
        <NSelect v-model:value="queryParams.operation_type" class="w-200px" :options="opTypeOptions" />
      </NFormItem>
      <NFormItem label="时间范围">
        <NDatePicker v-model:value="range" type="datetimerange" clearable separator="-" @update:value="pickerChange" />
      </NFormItem>
      <NFormItem>
        <NButton type="primary" @click="handleQuery">查询</NButton>
      </NFormItem>
      <NFormItem>
        <NButton @click="handleReset">重置</NButton>
      </NFormItem>
    </NForm>

    <NDataTable
      :columns="columns"
      :data="tableData"
      :pagination="{ ...pagination, itemCount: total }"
      :bordered="false"
      :scroll-x="1200"
    />
  </NCard>
</template>
