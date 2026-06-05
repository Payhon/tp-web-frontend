<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref } from 'vue'
import {
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { useTable } from '@/hooks/common/table'
import { createBatteryMaintenance, getBatteryMaintenanceDetail, getBatteryMaintenanceList } from '@/service/api/bms'

interface Item {
  id: string
  device_id: string
  device_number: string
  battery_model?: string | null
  fault_type: string
  maintain_at: string
  maintainer: string
  solution?: string | null
  parts: string[]
  affect_warranty: boolean
  remark?: string | null
  created_at: string
}

const message = useMessage()

function createColumns(): DataTableColumns<Item> {
  return [
    { key: 'device_number', title: bt('auto.s_cf05392308'), minWidth: 160 },
    { key: 'battery_model', title: bt('auto.s_ac4190dfda'), minWidth: 140, render: row => row.battery_model || '--' },
    { key: 'fault_type', title: bt('auto.s_105e4e0658'), minWidth: 140 },
    { key: 'maintain_at', title: bt('auto.s_e215216902'), minWidth: 160 },
    { key: 'maintainer', title: bt('auto.s_f2eaaafb1d'), minWidth: 140 },
    {
      key: 'affect_warranty',
      title: bt('auto.s_5a83ce52b0'),
      minWidth: 100,
      render: row => (row.affect_warranty ? bt('auto.s_0a60ac8f02') : bt('auto.s_c9744f45e7'))
    },
    { key: 'created_at', title: bt('auto.s_0039880117'), minWidth: 160 },
    {
      key: 'operate',
      title: bt('auto.s_2b6bc0f293'),
      minWidth: 120,
      render: row => (
        <NButton size="small" type="primary" onClick={() => openDetail(row.id)}>{bt('auto.s_607e7a4f37')}</NButton>
      )
    }
  ]
}

const { data, loading, filteredColumns, pagination, getData, updateSearchParams } = useTable<
  Item,
  typeof getBatteryMaintenanceList
>({
  apiFn: getBatteryMaintenanceList,
  apiParams: { page: 1, page_size: 10 },
  transformer: (res: any) => {
    const payload = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): any => createColumns()
})

const searchForm = ref<{
  device_number: string
  fault_type: string
  time_range: [number, number] | null
}>({
  device_number: '',
  fault_type: '',
  time_range: null
})

function handleSearch() {
  const [start, end] = searchForm.value.time_range || []
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    device_number: searchForm.value.device_number || undefined,
    fault_type: searchForm.value.fault_type || undefined,
    start_time: start ? dayjs(start).toISOString() : undefined,
    end_time: end ? dayjs(end).toISOString() : undefined
  })
  getData()
}

function handleReset() {
  searchForm.value = { device_number: '', fault_type: '', time_range: null }
  handleSearch()
}

// 新增
const createVisible = ref(false)
const creating = ref(false)
const createForm = ref<{
  device_number: string
  fault_type: string
  maintain_at: number | null
  maintainer: string
  parts_text: string
  solution: string
  affect_warranty: boolean
  remark: string
}>({
  device_number: '',
  fault_type: '',
  maintain_at: null,
  maintainer: '',
  parts_text: '',
  solution: '',
  affect_warranty: false,
  remark: ''
})

function openCreate() {
  createVisible.value = true
  createForm.value = {
    device_number: '',
    fault_type: '',
    maintain_at: null,
    maintainer: '',
    parts_text: '',
    solution: '',
    affect_warranty: false,
    remark: ''
  }
}

async function submitCreate() {
  if (
    !createForm.value.device_number ||
    !createForm.value.fault_type ||
    !createForm.value.maintainer ||
    !createForm.value.maintain_at
  ) {
    message.warning(bt('auto.s_a9b0968d3f'))
    return
  }
  creating.value = true
  try {
    const parts = (createForm.value.parts_text || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    await createBatteryMaintenance({
      device_number: createForm.value.device_number,
      fault_type: createForm.value.fault_type,
      maintainer: createForm.value.maintainer,
      maintain_at: new Date(createForm.value.maintain_at).toISOString(),
      parts,
      solution: createForm.value.solution ? createForm.value.solution : undefined,
      affect_warranty: createForm.value.affect_warranty,
      remark: createForm.value.remark ? createForm.value.remark : undefined
    })
    message.success(bt('auto.s_a5bfd70d4a'))
    createVisible.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_bac372f6cd'))
  } finally {
    creating.value = false
  }
}

// 详情
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<Item | null>(null)

async function openDetail(id: string) {
  detailVisible.value = true
  detailLoading.value = true
  try {
    const res: any = await getBatteryMaintenanceDetail(id)
    detailData.value = res?.data as Item
  } finally {
    detailLoading.value = false
  }
}

getData()
</script>

<template>
  <NCard :title="bt('auto.s_3a81246f35')">
    <NForm class="mb-12px" :inline="true" label-placement="left" :model="searchForm">
      <NFormItem :label="bt('auto.s_cf05392308')">
        <NInput v-model:value="searchForm.device_number" class="w-220px" :placeholder="bt('auto.s_4419e8a1ba')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_105e4e0658')">
        <NInput v-model:value="searchForm.fault_type" class="w-220px" :placeholder="bt('auto.s_105e4e0658')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_e215216902')">
        <NDatePicker v-model:value="searchForm.time_range" type="datetimerange" clearable />
      </NFormItem>
      <NFormItem>
        <NButton type="primary" @click="handleSearch">{{ bt('auto.s_bee912d79e') }}</NButton>
      </NFormItem>
      <NFormItem>
        <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
      </NFormItem>
      <NFormItem>
        <NButton type="success" @click="openCreate">{{ bt('auto.s_a4313469fd') }}</NButton>
      </NFormItem>
    </NForm>

    <NDataTable
      :columns="filteredColumns"
      :data="data"
      :loading="loading"
      :pagination="pagination"
      :bordered="false"
      :scroll-x="980"
    />

    <NModal v-model:show="createVisible" preset="card" :title="bt('auto.s_22410100b4')" style="width: 720px">
      <NForm label-placement="left" label-width="120" :model="createForm">
        <NFormItem :label="bt('auto.s_cf05392308')" required>
          <NInput v-model:value="createForm.device_number" :placeholder="bt('auto.s_a49005fbd8')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_105e4e0658')" required>
          <NInput v-model:value="createForm.fault_type" :placeholder="bt('auto.s_bf6af88d97')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_e215216902')" required>
          <NDatePicker v-model:value="createForm.maintain_at" type="datetime" clearable />
        </NFormItem>
        <NFormItem :label="bt('auto.s_f2eaaafb1d')" required>
          <NInput v-model:value="createForm.maintainer" :placeholder="bt('auto.s_f2eaaafb1d')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_595dab53ea')">
          <NInput v-model:value="createForm.parts_text" type="textarea" :placeholder="bt('auto.s_bf1206f33d')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_de842a6c80')">
          <NInput v-model:value="createForm.solution" type="textarea" :placeholder="bt('auto.s_517228a055')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_5a83ce52b0')">
          <NCheckbox v-model:checked="createForm.affect_warranty">{{ bt('auto.s_0a60ac8f02') }}</NCheckbox>
        </NFormItem>
        <NFormItem :label="bt('auto.s_2432b57515')">
          <NInput v-model:value="createForm.remark" :placeholder="bt('auto.s_2432b57515')" />
        </NFormItem>
      </NForm>

      <NSpace justify="end">
        <NButton @click="createVisible = false">{{ bt('auto.s_625fb26b4b') }}</NButton>
        <NButton type="primary" :loading="creating" @click="submitCreate">{{ bt('auto.s_939d5345ad') }}</NButton>
      </NSpace>
    </NModal>

    <NModal
      v-model:show="detailVisible"
      preset="card"
      :title="bt('auto.s_b265bfb51c')"
      style="width: 720px"
      :loading="detailLoading"
    >
      <div v-if="detailData">
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_cf05392308'), value: detailData.device_number }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_ac4190dfda'), value: detailData.battery_model || '--' }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_105e4e0658'), value: detailData.fault_type }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_e215216902'), value: detailData.maintain_at }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_f2eaaafb1d'), value: detailData.maintainer }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_5a83ce52b0'), value: detailData.affect_warranty ? bt('auto.s_0a60ac8f02') : bt('auto.s_c9744f45e7') }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_595dab53ea'), value: (detailData.parts || []).join(bt('common.listSeparator')) || '--' }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_de842a6c80'), value: detailData.solution || '--' }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_2432b57515'), value: detailData.remark || '--' }) }}</div>
        <div class="mb-8px">{{ bt('common.labelWithValue', { label: bt('auto.s_0039880117'), value: detailData.created_at }) }}</div>
      </div>
    </NModal>
  </NCard>
</template>
