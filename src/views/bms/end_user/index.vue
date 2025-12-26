<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTag,
  useDialog,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import {
  getDealerList,
  getEndUserDevices,
  getEndUserList,
  forceUnbindEndUserDevice as forceUnbindEndUserDeviceApi
} from '@/service/api/bms'

interface EndUserItem {
  user_id: string
  user_name?: string | null
  user_phone: string
  device_count: number
  last_bind_at?: string | null
  dealer_id?: string | null
  dealer_name?: string | null
}

interface ListResp<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

interface DeviceItem {
  binding_id: string
  device_id: string
  device_number: string
  device_name?: string | null
  is_owner: boolean
  binding_time: string
}

const message = useMessage()
const dialog = useDialog()

const dealerOptions = ref<Array<{ label: string; value: string }>>([])

const searchForm = ref({
  dealer_id: null as string | null,
  phone: '',
  device_number: ''
})

const showDevicesModal = ref(false)
const currentUser = ref<EndUserItem | null>(null)
const devicesLoading = ref(false)
const devices = ref<DeviceItem[]>([])

const deviceColumns = computed<DataTableColumns<DeviceItem>>(() => [
  { key: 'device_number', title: '设备编号', minWidth: 140 },
  { key: 'device_name', title: '设备名称', minWidth: 140, render: r => r.device_name || '--' },
  {
    key: 'is_owner',
    title: '主用户',
    width: 90,
    render: r => <NTag type={r.is_owner ? 'success' : 'default'}>{r.is_owner ? '是' : '否'}</NTag>
  },
  { key: 'binding_time', title: '绑定时间', minWidth: 160 },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    fixed: 'right',
    render: row => (
      <NButton size="small" type="error" onClick={() => confirmForceUnbind(row)}>
        强制解绑
      </NButton>
    )
  }
])

const createColumns = (): DataTableColumns<EndUserItem> => [
  { key: 'user_phone', title: '手机号', minWidth: 140 },
  { key: 'user_name', title: '姓名', minWidth: 120, render: r => r.user_name || '--' },
  { key: 'device_count', title: '绑定设备数', width: 110 },
  { key: 'last_bind_at', title: '最近绑定', minWidth: 160, render: r => r.last_bind_at || '--' },
  { key: 'dealer_name', title: '经销商', minWidth: 140, render: r => r.dealer_name || '--' },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    fixed: 'right',
    render: row => (
      <NSpace>
        <NButton size="small" type="primary" onClick={() => openDevices(row)}>
          查看绑定设备
        </NButton>
      </NSpace>
    )
  }
]

const { data, loading, columns, pagination, getData, updateSearchParams } = useTable<
  EndUserItem,
  typeof getEndUserList
>({
  apiFn: getEndUserList,
  apiParams: {
    page: 1,
    page_size: 10
  },
  transformer: (res: any) => {
    const payload: ListResp<EndUserItem> | undefined = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): any => createColumns()
})

function handleSearch() {
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    dealer_id: searchForm.value.dealer_id || undefined,
    phone: searchForm.value.phone || undefined,
    device_number: searchForm.value.device_number || undefined
  })
  getData()
}

function handleReset() {
  searchForm.value = { dealer_id: null, phone: '', device_number: '' }
  handleSearch()
}

async function initDealerOptions() {
  try {
    const res: any = await getDealerList({ page: 1, page_size: 1000 })
    const list = (res?.data?.list || []) as Array<{ id: string; name: string }>
    dealerOptions.value = list.map(i => ({ label: i.name, value: i.id }))
  } catch {
    dealerOptions.value = []
  }
}

async function openDevices(row: EndUserItem) {
  currentUser.value = row
  showDevicesModal.value = true
  await loadDevices()
}

async function loadDevices() {
  if (!currentUser.value) return
  devicesLoading.value = true
  try {
    const res: any = await getEndUserDevices({ page: 1, page_size: 100, user_id: currentUser.value.user_id })
    devices.value = res?.data?.list ?? []
  } catch (e: any) {
    message.error(e?.message || '加载绑定设备失败')
  } finally {
    devicesLoading.value = false
  }
}

function confirmForceUnbind(item: DeviceItem) {
  dialog.warning({
    title: '强制解绑确认',
    content: `确认解绑设备 ${item.device_number} 吗？`,
    positiveText: '确认解绑',
    negativeText: '取消',
    onPositiveClick: async () => {
      await doForceUnbind(item.binding_id)
    }
  })
}

async function doForceUnbind(bindingId: string) {
  try {
    await forceUnbindEndUserDeviceApi({ binding_id: bindingId })
    message.success('解绑成功')
    await loadDevices()
    getData()
  } catch (e: any) {
    message.error(e?.message || '解绑失败')
  }
}

onMounted(() => {
  initDealerOptions()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="终端用户" :bordered="false" size="small" class="card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem label="经销商" path="dealer_id">
          <NSelect
            v-model:value="searchForm.dealer_id"
            :options="dealerOptions"
            clearable
            style="width: 220px"
            placeholder="全部"
          />
        </NFormItem>
        <NFormItem label="手机号" path="phone">
          <NInput v-model:value="searchForm.phone" clearable style="width: 220px" placeholder="手机号" />
        </NFormItem>
        <NFormItem label="设备编号" path="device_number">
          <NInput v-model:value="searchForm.device_number" clearable style="width: 220px" placeholder="设备编号" />
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
        :row-key="row => row.user_id"
        :scroll-x="960"
      />
    </NCard>

    <NModal v-model:show="showDevicesModal" preset="card" style="width: 860px" title="绑定设备">
      <NSpace vertical :size="12">
        <div class="text-13px text-gray-500">
          用户：{{ currentUser?.user_phone }} {{ currentUser?.user_name ? `(${currentUser?.user_name})` : '' }}
        </div>
        <NDataTable
          :columns="deviceColumns"
          :data="devices"
          :loading="devicesLoading"
          :pagination="false"
          :row-key="row => row.binding_id"
        >
          <template #empty>暂无绑定设备</template>
        </NDataTable>
        <div class="text-12px text-gray-500">提示：强制解绑会在无其它绑定时重置激活状态。</div>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
