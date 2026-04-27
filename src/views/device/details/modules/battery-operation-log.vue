<script setup lang="tsx">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { NDataTable, NEmpty, NSpin, useMessage } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import { getBatteryOperationLogList } from '@/service/api/bms'
import { formatDateTime } from '@/utils/common/datetime'

const props = defineProps<{
  id: string
}>()

type BatteryOperationLogRow = {
  id: number
  occurred_at?: string
  operation_type?: string
  operator_name?: string | null
  description?: string | null
}

const message = useMessage()
const loading = ref(false)
const tableData = ref<BatteryOperationLogRow[]>([])

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 50],
  onChange: (page: number) => {
    pagination.page = page
    fetchData()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    fetchData()
  }
})

const columns = computed<DataTableColumns<BatteryOperationLogRow>>(() => [
  {
    key: 'occurred_at',
    title: '时间',
    minWidth: 180,
    render: row => formatDateTime(row.occurred_at) || '-'
  },
  {
    key: 'operation_type',
    title: '类型',
    minWidth: 140,
    render: row => row.operation_type || '-'
  },
  {
    key: 'operator_name',
    title: '操作人',
    minWidth: 140,
    render: row => row.operator_name || '-'
  },
  {
    key: 'description',
    title: '描述',
    minWidth: 420,
    ellipsis: { tooltip: true },
    render: row => row.description || '-'
  }
])

async function fetchData() {
  if (!props.id) {
    tableData.value = []
    pagination.itemCount = 0
    return
  }

  loading.value = true
  try {
    const res: any = await getBatteryOperationLogList({
      page: pagination.page || 1,
      page_size: pagination.pageSize || 10,
      device_id: props.id
    })
    const payload = res?.data || {}
    tableData.value = payload.list || []
    pagination.itemCount = payload.total || 0

    if (pagination.itemCount > 0 && tableData.value.length === 0 && (pagination.page || 1) > 1) {
      pagination.page = Math.max(1, (pagination.page || 1) - 1)
      await fetchData()
    }
  } catch (error: any) {
    tableData.value = []
    pagination.itemCount = 0
    message.error(error?.message || '获取操作记录失败')
  } finally {
    loading.value = false
  }
}

function resetAndFetch() {
  pagination.page = 1
  fetchData()
}

onMounted(() => {
  fetchData()
})

watch(
  () => props.id,
  () => {
    resetAndFetch()
  }
)
</script>

<template>
  <div class="flex-vertical gap-12px">
    <NSpin :show="loading">
      <NDataTable
        v-if="tableData.length > 0"
        remote
        :columns="columns"
        :data="tableData"
        :pagination="pagination"
        :bordered="false"
        :scroll-x="960"
      />
      <NEmpty v-else-if="!loading" description="暂无操作记录" class="py-24px" />
    </NSpin>
  </div>
</template>
