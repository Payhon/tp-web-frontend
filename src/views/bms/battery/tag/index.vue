<script setup lang="tsx">
import { computed, ref } from 'vue'
import { NButton, NCard, NColorPicker, NDataTable, NForm, NFormItem, NInput, NModal, NPopconfirm, NSpace, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { createBatteryTag, deleteBatteryTag, getBatteryTagList, updateBatteryTag } from '@/service/api/bms'

interface TagItem {
  id: string
  name: string
  color?: string | null
  scene?: string | null
  device_count: number
  created_at: string
}

const message = useMessage()

const searchForm = ref<{ name: string; scene: string }>({ name: '', scene: '' })

function createColumns(): DataTableColumns<TagItem> {
  return [
    { key: 'name', title: '标签名称', minWidth: 180 },
    {
      key: 'color',
      title: '颜色',
      minWidth: 140,
      render: row => (
        <div class="flex items-center gap-8px">
          <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: row.color || '#d9d9d9' }} />
          <span>{row.color || '--'}</span>
        </div>
      )
    },
    { key: 'scene', title: '适用场景', minWidth: 180, render: row => row.scene || '--' },
    { key: 'device_count', title: '关联设备数', minWidth: 120 },
    { key: 'created_at', title: '创建时间', minWidth: 160 },
    {
      key: 'operate',
      title: '操作',
      minWidth: 200,
      fixed: 'right',
      render: row => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => openEdit(row)}>
            编辑
          </NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => '确认删除？（关联关系将被清理）',
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
}

const { data, loading, filteredColumns, pagination, getData, updateSearchParams } = useTable<TagItem, typeof getBatteryTagList>({
  apiFn: getBatteryTagList,
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

function handleSearch() {
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    name: searchForm.value.name || undefined,
    scene: searchForm.value.scene || undefined
  })
  getData()
}

function handleReset() {
  searchForm.value = { name: '', scene: '' }
  handleSearch()
}

// create/edit modal
const modalVisible = ref(false)
const modalType = ref<'create' | 'edit'>('create')
const saving = ref(false)
const form = ref<{ id?: string; name: string; scene: string; color: string | null }>({ name: '', scene: '', color: null })

const title = computed(() => (modalType.value === 'create' ? '新增标签' : '编辑标签'))

function openCreate() {
  modalType.value = 'create'
  form.value = { name: '', scene: '', color: null }
  modalVisible.value = true
}

function openEdit(row: TagItem) {
  modalType.value = 'edit'
  form.value = { id: row.id, name: row.name, scene: row.scene || '', color: row.color || null }
  modalVisible.value = true
}

async function submit() {
  if (!form.value.name.trim()) {
    message.warning('请输入标签名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      scene: form.value.scene.trim() ? form.value.scene.trim() : undefined,
      color: form.value.color || undefined
    }
    if (modalType.value === 'create') {
      await createBatteryTag(payload)
      message.success('创建成功')
    } else if (form.value.id) {
      await updateBatteryTag(form.value.id, payload)
      message.success('更新成功')
    }
    modalVisible.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: TagItem) {
  try {
    await deleteBatteryTag(row.id)
    message.success('删除成功')
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

getData()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="标签管理" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm inline :model="searchForm" label-placement="left" label-width="auto" class="mb-4 flex flex-wrap gap-4 items-end">
        <NFormItem label="标签名称">
          <NInput v-model:value="searchForm.name" placeholder="支持模糊搜索" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem label="适用场景">
          <NInput v-model:value="searchForm.scene" placeholder="如：户外使用/快充型" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
            <NButton type="success" @click="openCreate">新增标签</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        :columns="filteredColumns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="980"
      />
    </NCard>

    <NModal v-model:show="modalVisible" preset="card" :title="title" style="width: 640px">
      <NForm label-placement="left" label-width="120" :model="form">
        <NFormItem label="标签名称" required>
          <NInput v-model:value="form.name" placeholder="例如：户外使用" />
        </NFormItem>
        <NFormItem label="适用场景">
          <NInput v-model:value="form.scene" placeholder="可选，例如：快充型" />
        </NFormItem>
        <NFormItem label="颜色">
          <NColorPicker v-model:value="form.color" :modes="['hex']" />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="submit">保存</NButton>
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

