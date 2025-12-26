<script setup lang="tsx">
import { computed, reactive, ref } from 'vue'
import { NButton, NCard, NDatePicker, NForm, NFormItem, NInput, NSelect, useMessage } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import moment from 'moment'
import { getOperationLogList } from '@/service/api/bms'
import { formatDateTime } from '@/utils/common/datetime'

const message = useMessage()

const moduleOptions = [
  { label: '全部', value: '' },
  { label: '电池管理', value: '/battery' },
  { label: '经销商管理', value: '/dealer' },
  { label: '维保管理', value: '/warranty' },
  { label: '终端用户', value: '/end_user' },
  { label: '设备转移', value: '/device_transfer' },
  { label: '电池型号', value: '/battery_model' },
  { label: '其它', value: '' }
]

const opTypeOptions = [
  { label: '全部', value: '' },
  { label: '新增/下发', value: '新增/下发' },
  { label: '编辑', value: '编辑' },
  { label: '删除', value: '删除' },
  { label: '导入', value: '导入' },
  { label: '导出', value: '导出' },
  { label: '批量操作', value: '批量操作' },
  { label: '绑定', value: '绑定' },
  { label: '解绑', value: '解绑' }
]

const range = ref<[number, number]>([moment().subtract(7, 'days').valueOf(), moment().valueOf()])

const queryParams = reactive({
  username: '',
  ip: '',
  module: '',
  op_type: '' as string,
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
    key: 'created_at',
    title: '时间',
    minWidth: 160,
    render: row => formatDateTime(row.created_at)
  },
  { key: 'username', title: '操作人', minWidth: 140, render: row => row.username || '-' },
  { key: 'authority', title: '角色', minWidth: 140, render: row => row.authority || '-' },
  { key: 'module', title: '模块', minWidth: 120, render: row => row.module || '-' },
  { key: 'op_type', title: '类型', minWidth: 110, render: row => row.op_type || '-' },
  { key: 'content', title: '内容', minWidth: 260, ellipsis: { tooltip: true }, render: row => row.content || '-' },
  { key: 'ip', title: 'IP', minWidth: 140 },
  { key: 'path', title: '路径', minWidth: 220, ellipsis: { tooltip: true }, render: row => row.path || '-' }
])

async function getTableData() {
  const params: any = {
    page: pagination.page || 1,
    page_size: pagination.pageSize || 10,
    username: queryParams.username || undefined,
    ip: queryParams.ip || undefined,
    module: queryParams.module || undefined,
    op_type: queryParams.op_type || undefined,
    start_time: queryParams.start_time || undefined,
    end_time: queryParams.end_time || undefined
  }
  try {
    const res: any = await getOperationLogList(params)
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
  queryParams.username = ''
  queryParams.ip = ''
  queryParams.module = ''
  queryParams.op_type = ''
  queryParams.start_time = ''
  queryParams.end_time = ''
  range.value = [moment().subtract(7, 'days').valueOf(), moment().valueOf()]
  pagination.page = 1
  getTableData()
}

getTableData()
</script>

<template>
  <NCard title="操作记录">
    <NForm class="mb-12px" :inline="true" label-placement="left" :model="queryParams">
      <NFormItem label="操作人">
        <NInput v-model:value="queryParams.username" class="w-200px" placeholder="用户名" />
      </NFormItem>
      <NFormItem label="IP">
        <NInput v-model:value="queryParams.ip" class="w-200px" placeholder="IP" />
      </NFormItem>
      <NFormItem label="模块">
        <NSelect v-model:value="queryParams.module" class="w-180px" :options="moduleOptions" />
      </NFormItem>
      <NFormItem label="类型">
        <NSelect v-model:value="queryParams.op_type" class="w-160px" :options="opTypeOptions" />
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
