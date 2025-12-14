<script setup lang="tsx">
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
    { key: 'device_number', title: '设备编号', minWidth: 160 },
    { key: 'battery_model', title: '型号', minWidth: 140, render: row => row.battery_model || '--' },
    { key: 'fault_type', title: '故障类型', minWidth: 140 },
    { key: 'maintain_at', title: '维修时间', minWidth: 160 },
    { key: 'maintainer', title: '维修人员', minWidth: 140 },
    {
      key: 'affect_warranty',
      title: '影响质保',
      minWidth: 100,
      render: row => (row.affect_warranty ? '是' : '否')
    },
    { key: 'created_at', title: '录入时间', minWidth: 160 },
    {
      key: 'operate',
      title: '操作',
      minWidth: 120,
      render: row => (
        <NButton size="small" type="primary" onClick={() => openDetail(row.id)}>
          查看
        </NButton>
      )
    }
  ]
}

const {
  data,
  loading,
  filteredColumns,
  pagination,
  getData,
  updateSearchParams
} = useTable<Item, typeof getBatteryMaintenanceList>({
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
  if (!createForm.value.device_number || !createForm.value.fault_type || !createForm.value.maintainer || !createForm.value.maintain_at) {
    message.warning('请填写：设备编号/故障类型/维修人员/维修时间')
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
    message.success('新增成功')
    createVisible.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || '新增失败')
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
  <NCard title="电池维保记录">
    <NForm class="mb-12px" :inline="true" label-placement="left" :model="searchForm">
      <NFormItem label="设备编号">
        <NInput v-model:value="searchForm.device_number" class="w-220px" placeholder="设备序列号" />
      </NFormItem>
      <NFormItem label="故障类型">
        <NInput v-model:value="searchForm.fault_type" class="w-220px" placeholder="故障类型" />
      </NFormItem>
      <NFormItem label="维修时间">
        <NDatePicker v-model:value="searchForm.time_range" type="datetimerange" clearable />
      </NFormItem>
      <NFormItem>
        <NButton type="primary" @click="handleSearch">查询</NButton>
      </NFormItem>
      <NFormItem>
        <NButton @click="handleReset">重置</NButton>
      </NFormItem>
      <NFormItem>
        <NButton type="success" @click="openCreate">新增记录</NButton>
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

    <NModal v-model:show="createVisible" preset="card" title="新增电池维保记录" style="width: 720px">
      <NForm label-placement="left" label-width="120" :model="createForm">
        <NFormItem label="设备编号" required>
          <NInput v-model:value="createForm.device_number" placeholder="设备序列号（精确）" />
        </NFormItem>
        <NFormItem label="故障类型" required>
          <NInput v-model:value="createForm.fault_type" placeholder="如：过压/过温/电芯不均衡" />
        </NFormItem>
        <NFormItem label="维修时间" required>
          <NDatePicker v-model:value="createForm.maintain_at" type="datetime" clearable />
        </NFormItem>
        <NFormItem label="维修人员" required>
          <NInput v-model:value="createForm.maintainer" placeholder="维修人员" />
        </NFormItem>
        <NFormItem label="配件更换清单">
          <NInput v-model:value="createForm.parts_text" type="textarea" placeholder="每行一个配件/更换项" />
        </NFormItem>
        <NFormItem label="解决方案">
          <NInput v-model:value="createForm.solution" type="textarea" placeholder="解决方案/维修说明" />
        </NFormItem>
        <NFormItem label="影响质保">
          <NCheckbox v-model:checked="createForm.affect_warranty">是</NCheckbox>
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="createForm.remark" placeholder="备注" />
        </NFormItem>
      </NForm>

      <NSpace justify="end">
        <NButton @click="createVisible = false">取消</NButton>
        <NButton type="primary" :loading="creating" @click="submitCreate">提交</NButton>
      </NSpace>
    </NModal>

    <NModal v-model:show="detailVisible" preset="card" title="维保记录详情" style="width: 720px" :loading="detailLoading">
      <div v-if="detailData">
        <div class="mb-8px">设备编号：{{ detailData.device_number }}</div>
        <div class="mb-8px">型号：{{ detailData.battery_model || '--' }}</div>
        <div class="mb-8px">故障类型：{{ detailData.fault_type }}</div>
        <div class="mb-8px">维修时间：{{ detailData.maintain_at }}</div>
        <div class="mb-8px">维修人员：{{ detailData.maintainer }}</div>
        <div class="mb-8px">影响质保：{{ detailData.affect_warranty ? '是' : '否' }}</div>
        <div class="mb-8px">配件：{{ (detailData.parts || []).join('、') || '--' }}</div>
        <div class="mb-8px">解决方案：{{ detailData.solution || '--' }}</div>
        <div class="mb-8px">备注：{{ detailData.remark || '--' }}</div>
        <div class="mb-8px">录入时间：{{ detailData.created_at }}</div>
      </div>
    </NModal>
  </NCard>
</template>

