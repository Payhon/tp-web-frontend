<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { ref, computed } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NTag,
  NDatePicker,
  NModal,
  NSpace,
  NTabs,
  NTabPane,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { getWarrantyList, getWarrantyDetail, updateWarrantyStatus } from '@/service/api/bms'
import dayjs from 'dayjs'
import BatteryMaintenance from './modules/battery-maintenance.vue'

interface WarrantyItem {
  id: string
  device_id: string
  device_number: string
  device_name: string
  user_id: string
  user_name?: string | null
  user_phone: string
  type: string
  description?: string | null
  images?: string[]
  status: string
  result_info?: Record<string, any>
  handler_id?: string | null
  handler_name?: string | null
  created_at: string
  updated_at: string
}

interface WarrantyListResponse {
  list: WarrantyItem[]
  total: number
  page: number
  page_size: number
}

const message = useMessage()

const activeTab = ref<'apply' | 'battery_maintenance'>('apply')

// 列配置（提前声明为函数，避免初始化顺序问题）
function createColumns(): DataTableColumns<WarrantyItem> {
  return [
    {
      key: 'device_number',
      title: bt('auto.s_cf05392308'),
      minWidth: 150
    },
    {
      key: 'device_name',
      title: bt('auto.s_9f694f603c'),
      minWidth: 140
    },
    {
      key: 'type',
      title: bt('auto.s_719e1bff45'),
      minWidth: 100,
      render: row => <NTag>{typeLabel(row.type)}</NTag>
    },
    {
      key: 'user_name',
      title: bt('auto.s_8ac8da8362'),
      minWidth: 120,
      render: row => row.user_name || '--'
    },
    {
      key: 'user_phone',
      title: bt('auto.s_09a1f6985a'),
      minWidth: 130
    },
    {
      key: 'status',
      title: bt('auto.s_3fea7ca76c'),
      minWidth: 110,
      render: row => <NTag type={statusTagType(row.status)}>{statusLabel(row.status)}</NTag>
    },
    {
      key: 'handler_name',
      title: bt('auto.s_4c8c9d4f5d'),
      minWidth: 120,
      render: row => row.handler_name || '--'
    },
    {
      key: 'created_at',
      title: bt('auto.s_eca37cb072'),
      minWidth: 160
    },
    {
      key: 'operate',
      title: bt('auto.s_2b6bc0f293'),
      minWidth: 180,
      align: 'center',
      render: row => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => handleView(row.id)}>{bt('auto.s_607e7a4f37')}</NButton>
          <NButton size="small" type="success" onClick={() => handleProcess(row.id)}>{bt('auto.s_7b1d15e557')}</NButton>
        </NSpace>
      )
    }
  ]
}

// 列表与分页
const { data, loading, columns, filteredColumns, pagination, getData, updateSearchParams } = useTable<
  WarrantyItem,
  typeof getWarrantyList
>({
  apiFn: getWarrantyList,
  apiParams: {
    page: 1,
    page_size: 10
  },
  transformer: (res: any) => {
    const payload: WarrantyListResponse | undefined = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): any => createColumns()
})

// 搜索表单
const searchForm = ref<{
  device_number: string
  type: string | null
  status: string | null
  create_time: [number, number] | null
}>({
  device_number: '',
  type: null,
  status: null,
  create_time: null
})

const typeOptions = [
  { label: bt('auto.s_324712a311'), value: 'REPAIR' },
  { label: bt('auto.s_9627644f81'), value: 'RETURN' },
  { label: bt('auto.s_bb9cd53da8'), value: 'EXCHANGE' }
]

const statusOptions = [
  { label: bt('auto.s_5cb424765c'), value: 'PENDING' },
  { label: bt('auto.s_ecfa64c174'), value: 'APPROVED' },
  { label: bt('auto.s_dbf36ddc55'), value: 'REJECTED' },
  { label: bt('auto.s_5d459d550a'), value: 'PROCESSING' },
  { label: bt('auto.s_fad5222ca0'), value: 'COMPLETED' }
]

const handleSearch = () => {
  const [start, end] = searchForm.value.create_time || []

  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    device_number: searchForm.value.device_number || undefined,
    type: searchForm.value.type || undefined,
    status: searchForm.value.status || undefined,
    start_time: start ? dayjs(start).format('YYYY-MM-DD HH:mm:ss') : undefined,
    end_time: end ? dayjs(end).format('YYYY-MM-DD HH:mm:ss') : undefined
  })

  getData()
}

const handleReset = () => {
  searchForm.value = {
    device_number: '',
    type: null,
    status: null,
    create_time: null
  }
  handleSearch()
}

// 状态样式
function statusTagType(status: string): 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'PENDING':
      return 'warning'
    case 'APPROVED':
      return 'success'
    case 'REJECTED':
      return 'error'
    case 'PROCESSING':
      return 'info'
    case 'COMPLETED':
      return 'success'
    default:
      return 'info'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return bt('auto.s_5cb424765c')
    case 'APPROVED':
      return bt('auto.s_ecfa64c174')
    case 'REJECTED':
      return bt('auto.s_dbf36ddc55')
    case 'PROCESSING':
      return bt('auto.s_5d459d550a')
    case 'COMPLETED':
      return bt('auto.s_fad5222ca0')
    default:
      return status
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'REPAIR':
      return bt('auto.s_324712a311')
    case 'RETURN':
      return bt('auto.s_9627644f81')
    case 'EXCHANGE':
      return bt('auto.s_bb9cd53da8')
    default:
      return type
  }
}

// 详情 & 处理弹窗
const detailVisible = ref(false)
const processVisible = ref(false)
const detailData = ref<WarrantyItem | null>(null)

const processForm = ref({
  id: '',
  status: '' as string,
  result: ''
})

const processing = ref(false)
const detailLoading = ref(false)

const handleView = async (id: string) => {
  detailVisible.value = true
  detailLoading.value = true
  try {
    const res: any = await getWarrantyDetail(id)
    detailData.value = res?.data as WarrantyItem
  } catch (error) {
    // 错误提示已由 request 统一处理
  } finally {
    detailLoading.value = false
  }
}

const handleProcess = async (id: string) => {
  processVisible.value = true
  processForm.value.id = id
  processForm.value.status = ''
  processForm.value.result = ''
}

const handleProcessSubmit = async () => {
  if (!processForm.value.status) {
    message.warning(bt('auto.s_9e471ba44d'))
    return
  }

  processing.value = true
  try {
    await updateWarrantyStatus(processForm.value.id, {
      status: processForm.value.status,
      result_info: processForm.value.result ? { remark: processForm.value.result } : undefined
    })
    message.success(bt('auto.s_3ba621d736'))
    processVisible.value = false
    getData()
  } catch (error) {
    // 错误提示已由 request 统一处理
  } finally {
    processing.value = false
  }
}

const detailResultText = computed(() => {
  if (!detailData.value?.result_info) return ''
  try {
    // 后端 result_info 是 map[string]interface{}，前端收到已是对象
    const info = detailData.value.result_info as Record<string, any>
    if (info.remark) return String(info.remark)
    return JSON.stringify(info)
  } catch {
    return ''
  }
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_9185bb6280')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="apply" :tab="bt('auto.s_4fb8af4576')">
          <!-- 搜索区域 -->
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
            <NFormItem :label="bt('auto.s_719e1bff45')" path="type">
              <NSelect
                v-model:value="searchForm.type"
                :options="typeOptions"
                :placeholder="bt('auto.s_c9e2692ba3')"
                clearable
                style="width: 200px"
              />
            </NFormItem>
            <NFormItem :label="bt('auto.s_3fea7ca76c')" path="status">
              <NSelect
                v-model:value="searchForm.status"
                :options="statusOptions"
                :placeholder="bt('auto.s_e1c965efff')"
                clearable
                style="width: 200px"
              />
            </NFormItem>
            <NFormItem :label="bt('auto.s_eca37cb072')" path="create_time">
              <NDatePicker v-model:value="searchForm.create_time" type="datetimerange" clearable style="width: 320px" />
            </NFormItem>
            <NFormItem>
              <NSpace>
                <NButton type="primary" @click="handleSearch">{{ bt('auto.s_bee912d79e') }}</NButton>
                <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
              </NSpace>
            </NFormItem>
          </NForm>

          <!-- 表格 -->
          <NDataTable
            :columns="columns"
            :data="data"
            :loading="loading"
            :pagination="pagination"
            :row-key="row => row.id"
            :scroll-x="960"
          />
        </NTabPane>

        <NTabPane name="battery_maintenance" :tab="bt('auto.s_48c341c746')">
          <BatteryMaintenance />
        </NTabPane>
      </NTabs>
    </NCard>

    <!-- 详情弹窗 -->
    <NModal v-model:show="detailVisible" preset="card" :title="bt('auto.s_2715a04c10')" style="width: 640px">
      <n-spin :show="detailLoading">
        <div v-if="detailData">
          <p>
            <strong>{{ bt('auto.s_2909a48bc6') }}</strong>
            {{ detailData.device_number }}
          </p>
          <p>
            <strong>{{ bt('auto.s_36c039a7e3') }}</strong>
            {{ detailData.device_name }}
          </p>
          <p>
            <strong>{{ bt('auto.s_17c1454547') }}</strong>
            {{ typeLabel(detailData.type) }}
          </p>
          <p>
            <strong>{{ bt('auto.s_1635c93a29') }}</strong>
            {{ detailData.user_name || '--' }}（{{ detailData.user_phone }}）
          </p>
          <p>
            <strong>{{ bt('auto.s_bec98b4d6a') }}</strong>
            <NTag :type="statusTagType(detailData.status)">{{ statusLabel(detailData.status) }}</NTag>
          </p>
          <p>
            <strong>{{ bt('auto.s_ef4406db97') }}</strong>
            {{ detailData.handler_name || '--' }}
          </p>
          <p>
            <strong>{{ bt('auto.s_312f45014a') }}</strong>
            {{ detailData.created_at }}
          </p>
          <p>
            <strong>{{ bt('auto.s_780fb9f3d0') }}</strong>
            {{ detailData.updated_at }}
          </p>
          <p class="mt-2">
            <strong>{{ bt('auto.s_9d277bc2c8') }}</strong>
          </p>
          <p>{{ detailData.description || '--' }}</p>
          <p v-if="detailResultText" class="mt-2">
            <strong>{{ bt('auto.s_e266667794') }}</strong>
          </p>
          <p v-if="detailResultText">{{ detailResultText }}</p>
        </div>
      </n-spin>
    </NModal>

    <!-- 处理弹窗 -->
    <NModal v-model:show="processVisible" preset="card" :title="bt('auto.s_cc2417624c')" style="width: 520px">
      <NForm :model="processForm">
        <NFormItem :label="bt('auto.s_21b31425c3')" path="status" required>
          <NSelect
            v-model:value="processForm.status"
            :options="statusOptions"
            :placeholder="bt('auto.s_9e471ba44d')"
            style="width: 260px"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_79a5432662')" path="result">
          <NInput
            v-model:value="processForm.result"
            type="textarea"
            :placeholder="bt('auto.s_ae4e496a26')"
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="processVisible = false">{{ bt('auto.s_625fb26b4b') }}</NButton>
          <NButton type="primary" :loading="processing" @click="handleProcessSubmit">{{ bt('auto.s_38cf16f220') }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
