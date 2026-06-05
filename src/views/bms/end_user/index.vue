<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
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
  username?: string | null
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
  { key: 'device_number', title: bt('auto.s_cf05392308'), minWidth: 140 },
  { key: 'device_name', title: bt('auto.s_9f694f603c'), minWidth: 140, render: r => r.device_name || '--' },
  {
    key: 'is_owner',
    title: bt('auto.s_8bd7d7bc69'),
    width: 90,
    render: r => <NTag type={r.is_owner ? 'success' : 'default'}>{r.is_owner ? bt('auto.s_0a60ac8f02') : bt('auto.s_c9744f45e7')}</NTag>
  },
  { key: 'binding_time', title: bt('auto.s_d129528d4a'), minWidth: 160 },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    width: 120,
    fixed: 'right',
    render: row => (
      <NButton size="small" type="error" onClick={() => confirmForceUnbind(row)}>{bt('auto.s_a7a881b549')}</NButton>
    )
  }
])

const createColumns = (): DataTableColumns<EndUserItem> => [
  { key: 'user_phone', title: bt('auto.s_8098e2b4e8'), minWidth: 140 },
  { key: 'username', title: bt('auto.s_819767ada1'), minWidth: 160, render: r => r.username || '--' },
  { key: 'user_name', title: bt('auto.s_60d0458ac6'), minWidth: 120, render: r => r.user_name || '--' },
  { key: 'device_count', title: bt('auto.s_d27754bfcc'), width: 110 },
  { key: 'last_bind_at', title: bt('auto.s_5ebab5068c'), minWidth: 160, render: r => r.last_bind_at || '--' },
  { key: 'dealer_name', title: bt('auto.s_9019dc8029'), minWidth: 140, render: r => r.dealer_name || '--' },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    width: 220,
    fixed: 'right',
    render: row => (
      <NSpace>
        <NButton size="small" type="primary" onClick={() => openDevices(row)}>{bt('auto.s_8004d8433c')}</NButton>
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
    message.error(e?.message || bt('auto.s_bb670c6ed6'))
  } finally {
    devicesLoading.value = false
  }
}

function confirmForceUnbind(item: DeviceItem) {
  dialog.warning({
    title: bt('auto.s_bdbd91fd77'),
    content: bt('pages.endUser.forceUnbindContent', { device: item.device_number }),
    positiveText: bt('auto.s_9981b36e81'),
    negativeText: bt('auto.s_625fb26b4b'),
    onPositiveClick: async () => {
      await doForceUnbind(item.binding_id)
    }
  })
}

async function doForceUnbind(bindingId: string) {
  try {
    await forceUnbindEndUserDeviceApi({ binding_id: bindingId })
    message.success(bt('auto.s_1c4385b583'))
    await loadDevices()
    getData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_913643d07c'))
  }
}

onMounted(() => {
  initDealerOptions()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_5ddfa01711')" :bordered="false" size="small" class="card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem :label="bt('auto.s_9019dc8029')" path="dealer_id">
          <NSelect
            v-model:value="searchForm.dealer_id"
            :options="dealerOptions"
            clearable
            style="width: 220px"
            :placeholder="bt('auto.s_a8b0c20416')"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_8098e2b4e8')" path="phone">
          <NInput v-model:value="searchForm.phone" clearable style="width: 220px" :placeholder="bt('auto.s_8098e2b4e8')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_cf05392308')" path="device_number">
          <NInput v-model:value="searchForm.device_number" clearable style="width: 220px" :placeholder="bt('auto.s_cf05392308')" />
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
        :row-key="row => row.user_id"
        :scroll-x="1120"
      />
    </NCard>

    <NModal v-model:show="showDevicesModal" preset="card" style="width: 860px" :title="bt('auto.s_4e11161b68')">
      <NSpace vertical :size="12">
        <div class="text-13px text-gray-500">
          {{ bt('pages.endUser.userLabel', { user: currentUser?.user_phone || '--' }) }}
          {{ currentUser?.username ? `[${currentUser?.username}]` : '' }}
          {{ currentUser?.user_name ? `(${currentUser?.user_name})` : '' }}
        </div>
        <NDataTable
          :columns="deviceColumns"
          :data="devices"
          :loading="devicesLoading"
          :pagination="false"
          :row-key="row => row.binding_id"
        >
          <template #empty>{{ bt('auto.s_cb86be4c85') }}</template>
        </NDataTable>
        <div class="text-12px text-gray-500">{{ bt('auto.s_1c18afe3fd') }}</div>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
