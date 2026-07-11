<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { onMounted, reactive, ref } from 'vue'
import { NButton, NCard, NDataTable, NForm, NFormItem, NInput, NPopconfirm, NSpace, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  createBatteryWarrantyRecalcJob,
  createBatteryBmsModel,
  deleteBatteryBmsModel,
  getBatteryBmsModelList,
  updateBatteryBmsModel
} from '@/service/api/bms'
import BatteryModelModal from '../modules/battery-model-modal.vue'
import WarrantyRecalcJobModal from '../modules/warranty-recalc-job-modal.vue'

type BmsModelRow = {
  id: string
  name: string
  device_config_id?: string | null
  device_config_name?: string | null
  voltage_rated?: number | null
  capacity_rated?: number | null
  cell_count?: number | null
  nominal_power?: number | null
  warranty_months?: number | null
  description?: string | null
  created_at?: string
}

const message = useMessage()
const loading = ref(false)
const modalVisible = ref(false)
const modalType = ref<'add' | 'edit'>('add')
const currentRow = ref<BmsModelRow | undefined>(undefined)
const recalcModalVisible = ref(false)
const recalcJobId = ref('')

const queryForm = reactive({
  name: ''
})

const data = ref<BmsModelRow[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onUpdatePage: (page: number) => {
    pagination.page = page
    fetchData()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    fetchData()
  }
})

const columns: DataTableColumns<BmsModelRow> = [
  { key: 'name', title: bt('auto.s_ad635a9565'), minWidth: 160 },
  {
    key: 'device_config_name',
    title: bt('auto.s_ab13e1f9d8'),
    minWidth: 180,
    render: row => row.device_config_name || row.device_config_id || '--'
  },
  { key: 'voltage_rated', title: bt('auto.s_23218d96f8'), width: 120, render: row => row.voltage_rated ?? '--' },
  { key: 'capacity_rated', title: bt('auto.s_f8862f498a'), width: 130, render: row => row.capacity_rated ?? '--' },
  { key: 'cell_count', title: bt('auto.s_9001698fc1'), width: 100, render: row => row.cell_count ?? '--' },
  { key: 'nominal_power', title: bt('auto.s_46d9f2eb39'), width: 130, render: row => row.nominal_power ?? '--' },
  { key: 'warranty_months', title: bt('auto.s_0853ef8711'), width: 100, render: row => row.warranty_months ?? '--' },
  { key: 'description', title: bt('auto.s_3bdd08adab'), minWidth: 180, render: row => row.description || '--' },
  { key: 'created_at', title: bt('auto.s_eca37cb072'), width: 180, render: row => row.created_at || '--' },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    width: 160,
    render: row => (
      <NSpace>
        <NButton size="small" type="primary" onClick={() => handleEdit(row)}>
          {bt('auto.s_95b351c862')}
        </NButton>
        <NPopconfirm onPositiveClick={() => handleDelete(row.id)}>
          {{
            default: () => bt('auto.s_431c1dedab'),
            trigger: () => (
              <NButton size="small" type="error">
                {bt('auto.s_2f4aaddde3')}
              </NButton>
            )
          }}
        </NPopconfirm>
      </NSpace>
    )
  }
]

function handleSearch() {
  pagination.page = 1
  fetchData()
}

function handleReset() {
  queryForm.name = ''
  pagination.page = 1
  fetchData()
}

function handleAdd() {
  modalType.value = 'add'
  currentRow.value = undefined
  modalVisible.value = true
}

function handleEdit(row: BmsModelRow) {
  modalType.value = 'edit'
  currentRow.value = { ...row }
  modalVisible.value = true
}

async function handleDelete(id: string) {
  try {
    await deleteBatteryBmsModel(id)
    message.success(bt('auto.s_0007d170de'))
    if (data.value.length === 1 && pagination.page > 1) {
      pagination.page -= 1
    }
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_acf0664a54'))
  }
}

function openRecalcJob(jobId: string) {
  recalcJobId.value = jobId
  recalcModalVisible.value = true
}

async function handleManualRecalc() {
  try {
    const res: any = await createBatteryWarrantyRecalcJob()
    const jobId = res?.data?.job_id
    if (!jobId) throw new Error(bt('warrantyRecalc.missingJobId'))
    message.success(bt('warrantyRecalc.started'))
    openRecalcJob(jobId)
  } catch (e: any) {
    message.error(e?.message || bt('warrantyRecalc.startFailed'))
  }
}

async function handleSubmit(formData: any) {
  try {
    if (modalType.value === 'add') {
      await createBatteryBmsModel(formData)
      message.success(bt('auto.s_a5bfd70d4a'))
    } else if (currentRow.value?.id) {
      const res: any = await updateBatteryBmsModel(currentRow.value.id, formData)
      message.success(bt('auto.s_55aa6366c0'))
      const jobId = res?.data?.warranty_recalc_job_id
      if (jobId) {
        message.success(bt('warrantyRecalc.started'))
        openRecalcJob(jobId)
      }
    }
    modalVisible.value = false
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_6de920b4e4'))
  }
}

async function fetchData() {
  loading.value = true
  try {
    const res: any = await getBatteryBmsModelList({
      page: pagination.page,
      page_size: pagination.pageSize,
      name: queryForm.name || undefined
    })
    const payload = res?.data || {}
    data.value = payload.list || []
    pagination.itemCount = payload.total || 0
    if (pagination.itemCount > 0 && data.value.length === 0 && pagination.page > 1) {
      pagination.page -= 1
      await fetchData()
      return
    }
  } catch (e: any) {
    data.value = []
    pagination.itemCount = 0
    message.error(e?.message || bt('auto.s_fe9d24d531'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_683e6192f3')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm :model="queryForm" inline class="mb-4">
        <NFormItem :label="bt('auto.s_ad635a9565')">
          <NInput v-model:value="queryForm.name" :placeholder="bt('auto.s_72b407497e')" clearable />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">{{ bt('auto.s_bee912d79e') }}</NButton>
            <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <div class="mb-4">
        <NSpace>
          <NButton type="primary" @click="handleAdd">{{ bt('auto.s_9369cf0afd') }}</NButton>
          <NPopconfirm @positive-click="handleManualRecalc">
            <template #trigger>
              <NButton>{{ bt('warrantyRecalc.button') }}</NButton>
            </template>
            {{ bt('warrantyRecalc.confirm') }}
          </NPopconfirm>
        </NSpace>
      </div>

      <NDataTable
        remote
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
      />
    </NCard>

    <BatteryModelModal
      v-model:visible="modalVisible"
      :type="modalType"
      :data="currentRow"
      :entity-name="bt('auto.s_c44c1028d5')"
      @submit="handleSubmit"
    />

    <WarrantyRecalcJobModal v-model:visible="recalcModalVisible" :job-id="recalcJobId" @finished="fetchData" />
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
