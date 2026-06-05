<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, reactive, ref } from 'vue'
import { NButton, NCard, NDatePicker, NForm, NFormItem, NInput, NSelect, useMessage } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import moment from 'moment'
import { getBatteryOperationLogList } from '@/service/api/bms'
import { formatDateTime } from '@/utils/common/datetime'

const message = useMessage()

const opTypeOptions = [
  { label: bt('auto.s_a8b0c20416'), value: '' },
  { label: bt('auto.s_d9ac9228e8'), value: 'CREATE' },
  { label: bt('auto.s_8d9a071ee2'), value: 'IMPORT' },
  { label: bt('auto.s_539d3e5db4'), value: 'FACTORY_OUT' },
  { label: bt('auto.s_2f6f278e3c'), value: 'FACTORY_RESTORE' },
  { label: bt('auto.s_11e8af0bcf'), value: 'TRANSFER' },
  { label: bt('auto.s_c3cb48b69a'), value: 'ROLLBACK' },
  { label: bt('auto.s_83a991d77c'), value: 'ACTIVATE' },
  { label: bt('auto.s_bf7b2d5361'), value: 'INFO_COMPLETE' },
  { label: bt('auto.s_a3427e20cd'), value: 'EDIT_INFO' },
  { label: bt('auto.s_2f4aaddde3'), value: 'DELETE' },
  { label: bt('auto.s_1a261d46f1'), value: 'WARRANTY_SUBMIT' },
  { label: bt('auto.s_b2478eed97'), value: 'WARRANTY_HANDLE' },
  { label: bt('auto.s_c77f159c07'), value: 'MAINTENANCE_SUBMIT' },
  { label: bt('auto.s_529ee279c0'), value: 'MAINTENANCE_HANDLE' }
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
    title: bt('auto.s_19fcb9eb25'),
    minWidth: 160,
    render: row => formatDateTime(row.occurred_at)
  },
  { key: 'device_number', title: bt('auto.s_90ccdfe522'), minWidth: 160 },
  { key: 'operation_type', title: bt('auto.s_226b091218'), minWidth: 140, render: row => row.operation_type || '-' },
  { key: 'operator_name', title: bt('auto.s_f9ac4b2aa6'), minWidth: 140, render: row => row.operator_name || '-' },
  {
    key: 'description',
    title: bt('auto.s_3bdd08adab'),
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
    message.error(e?.message || bt('auto.s_b07bc98fd9'))
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
  <NCard :title="bt('auto.s_9dbcba5a43')">
    <NForm class="mb-12px" :inline="true" label-placement="left" :model="queryParams">
      <NFormItem :label="bt('auto.s_90ccdfe522')">
        <NInput v-model:value="queryParams.device_number" class="w-220px" :placeholder="bt('auto.s_89113e653d')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_226b091218')">
        <NSelect v-model:value="queryParams.operation_type" class="w-200px" :options="opTypeOptions" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_cd649f76d4')">
        <NDatePicker v-model:value="range" type="datetimerange" clearable separator="-" @update:value="pickerChange" />
      </NFormItem>
      <NFormItem>
        <NButton type="primary" @click="handleQuery">{{ bt('auto.s_bee912d79e') }}</NButton>
      </NFormItem>
      <NFormItem>
        <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
      </NFormItem>
    </NForm>

    <NDataTable
      remote
      :columns="columns"
      :data="tableData"
      :pagination="{ ...pagination, itemCount: total }"
      :bordered="false"
      :scroll-x="1200"
    />
  </NCard>
</template>
