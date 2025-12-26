<script setup lang="tsx">
import { computed, reactive, ref } from 'vue'
import { NButton, NCard, NDatePicker, NForm, NFormItem, NInput, NSelect, useMessage } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import moment from 'moment'
import { getActivationLogList } from '@/service/api/bms'
import { formatDateTime } from '@/utils/common/datetime'

const message = useMessage()

const methodOptions = [
  { label: '全部', value: '' },
  { label: 'APP扫码', value: 'APP' },
  { label: 'WEB手动', value: 'WEB' }
]

const range = ref<[number, number]>([moment().subtract(1, 'months').valueOf(), moment().valueOf()])

const queryParams = reactive({
  device_number: '',
  user_phone: '',
  method: '' as '' | 'APP' | 'WEB',
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
    key: 'activation_time',
    title: '激活时间',
    minWidth: 160,
    render: row => row.activation_time || formatDateTime(row.created_at)
  },
  {
    key: 'device_number',
    title: '序列号',
    minWidth: 160
  },
  {
    key: 'battery_model',
    title: '型号',
    minWidth: 140,
    render: row => row.battery_model || '-'
  },
  {
    key: 'user_phone',
    title: '激活用户(手机号)',
    minWidth: 140
  },
  {
    key: 'activation_way',
    title: '激活方式',
    minWidth: 120
  },
  {
    key: 'binding_terminal',
    title: '终端',
    minWidth: 100
  },
  {
    key: 'ip',
    title: 'IP',
    minWidth: 140
  }
])

async function getTableData() {
  const params: any = {
    page: pagination.page || 1,
    page_size: pagination.pageSize || 10,
    device_number: queryParams.device_number || undefined,
    user_phone: queryParams.user_phone || undefined,
    method: queryParams.method || undefined,
    start_time: queryParams.start_time || undefined,
    end_time: queryParams.end_time || undefined
  }
  try {
    const res: any = await getActivationLogList(params)
    tableData.value = res?.data?.list || []
    total.value = res?.data?.total || 0
  } catch (e: any) {
    message.error(e?.message || '获取激活日志失败')
  }
}

function handleQuery() {
  pagination.page = 1
  getTableData()
}

function handleReset() {
  queryParams.device_number = ''
  queryParams.user_phone = ''
  queryParams.method = ''
  queryParams.start_time = ''
  queryParams.end_time = ''
  range.value = [moment().subtract(1, 'months').valueOf(), moment().valueOf()]
  pagination.page = 1
  getTableData()
}

getTableData()
</script>

<template>
  <NCard title="激活日志">
    <NForm class="mb-12px" :inline="true" label-placement="left" :model="queryParams">
      <NFormItem label="序列号">
        <NInput v-model:value="queryParams.device_number" class="w-220px" placeholder="设备序列号" />
      </NFormItem>
      <NFormItem label="手机号">
        <NInput v-model:value="queryParams.user_phone" class="w-220px" placeholder="激活用户手机号" />
      </NFormItem>
      <NFormItem label="时间范围">
        <NDatePicker v-model:value="range" type="datetimerange" clearable separator="-" @update:value="pickerChange" />
      </NFormItem>
      <NFormItem label="方式">
        <NSelect v-model:value="queryParams.method" class="w-160px" :options="methodOptions" />
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
      :scroll-x="980"
    />
  </NCard>
</template>
