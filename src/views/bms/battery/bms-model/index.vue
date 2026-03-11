<script setup lang="tsx">
import { onMounted, reactive, ref } from 'vue'
import { NButton, NCard, NDataTable, NForm, NFormItem, NInput, NPopconfirm, NSpace, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  createBatteryBmsModel,
  deleteBatteryBmsModel,
  getBatteryBmsModelList,
  updateBatteryBmsModel
} from '@/service/api/bms'
import BatteryModelModal from '../modules/battery-model-modal.vue'

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
  { key: 'name', title: '型号名称', minWidth: 160 },
  {
    key: 'device_config_name',
    title: '关联设备模板',
    minWidth: 180,
    render: row => row.device_config_name || row.device_config_id || '--'
  },
  { key: 'voltage_rated', title: '额定电压(V)', width: 120, render: row => row.voltage_rated ?? '--' },
  { key: 'capacity_rated', title: '额定容量(Ah)', width: 130, render: row => row.capacity_rated ?? '--' },
  { key: 'cell_count', title: '电芯串数', width: 100, render: row => row.cell_count ?? '--' },
  { key: 'nominal_power', title: '标称功率(W)', width: 130, render: row => row.nominal_power ?? '--' },
  { key: 'warranty_months', title: '质保(月)', width: 100, render: row => row.warranty_months ?? '--' },
  { key: 'description', title: '描述', minWidth: 180, render: row => row.description || '--' },
  { key: 'created_at', title: '创建时间', width: 180, render: row => row.created_at || '--' },
  {
    key: 'actions',
    title: '操作',
    width: 160,
    render: row => (
      <NSpace>
        <NButton size="small" type="primary" onClick={() => handleEdit(row)}>
          编辑
        </NButton>
        <NPopconfirm onPositiveClick={() => handleDelete(row.id)}>
          {{
            default: () => '确认删除该 BMS 型号吗？',
            trigger: () => (
              <NButton size="small" type="error">
                删除
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
    message.success('删除成功')
    if (data.value.length === 1 && pagination.page > 1) {
      pagination.page -= 1
    }
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

async function handleSubmit(formData: any) {
  try {
    if (modalType.value === 'add') {
      await createBatteryBmsModel(formData)
      message.success('新增成功')
    } else if (currentRow.value?.id) {
      await updateBatteryBmsModel(currentRow.value.id, formData)
      message.success('更新成功')
    }
    modalVisible.value = false
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
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
    message.error(e?.message || '获取列表失败')
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
    <NCard title="BMS 型号管理" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm :model="queryForm" inline class="mb-4">
        <NFormItem label="型号名称">
          <NInput v-model:value="queryForm.name" placeholder="请输入型号名称" clearable />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <div class="mb-4">
        <NButton type="primary" @click="handleAdd">新增 BMS 型号</NButton>
      </div>

      <NDataTable
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
      entity-name="BMS型号"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
