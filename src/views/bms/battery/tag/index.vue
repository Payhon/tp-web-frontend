<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref } from 'vue'
import {
  NButton,
  NCard,
  NColorPicker,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  useMessage
} from 'naive-ui'
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
    { key: 'name', title: bt('auto.s_341fe804cc'), minWidth: 180 },
    {
      key: 'color',
      title: bt('auto.s_6b36c6f7ec'),
      minWidth: 140,
      render: row => (
        <div class="flex items-center gap-8px">
          <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: row.color || '#d9d9d9' }} />
          <span>{row.color || '--'}</span>
        </div>
      )
    },
    { key: 'scene', title: bt('auto.s_62b37e9905'), minWidth: 180, render: row => row.scene || '--' },
    { key: 'device_count', title: bt('auto.s_966ed3cc29'), minWidth: 120 },
    { key: 'created_at', title: bt('auto.s_eca37cb072'), minWidth: 160 },
    {
      key: 'operate',
      title: bt('auto.s_2b6bc0f293'),
      minWidth: 200,
      fixed: 'right',
      render: row => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => openEdit(row)}>{bt('auto.s_95b351c862')}</NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => bt('auto.s_5d0076f51d'),
              trigger: () => (
                <NButton size="small" type="error">{bt('auto.s_2f4aaddde3')}</NButton>
              )
            }}
          </NPopconfirm>
        </NSpace>
      )
    }
  ]
}

const { data, loading, filteredColumns, pagination, getData, updateSearchParams } = useTable<
  TagItem,
  typeof getBatteryTagList
>({
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
const form = ref<{ id?: string; name: string; scene: string; color: string | null }>({
  name: '',
  scene: '',
  color: null
})

const title = computed(() => (modalType.value === 'create' ? bt('auto.s_a1d3bf8853') : bt('auto.s_4f3b1f6754')))

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
    message.warning(bt('auto.s_6f81f3f145'))
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
      message.success(bt('auto.s_04a691b377'))
    } else if (form.value.id) {
      await updateBatteryTag(form.value.id, payload)
      message.success(bt('auto.s_55aa6366c0'))
    }
    modalVisible.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_6de920b4e4'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: TagItem) {
  try {
    await deleteBatteryTag(row.id)
    message.success(bt('auto.s_0007d170de'))
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_acf0664a54'))
  }
}

getData()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_2ec512a4e3')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem :label="bt('auto.s_341fe804cc')">
          <NInput v-model:value="searchForm.name" :placeholder="bt('auto.s_f33cb868c8')" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem :label="bt('auto.s_62b37e9905')">
          <NInput v-model:value="searchForm.scene" :placeholder="bt('auto.s_0a9b22b715')" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">{{ bt('auto.s_bee912d79e') }}</NButton>
            <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
            <NButton type="success" @click="openCreate">{{ bt('auto.s_a1d3bf8853') }}</NButton>
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
        <NFormItem :label="bt('auto.s_341fe804cc')" required>
          <NInput v-model:value="form.name" :placeholder="bt('auto.s_a1d5128820')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_62b37e9905')">
          <NInput v-model:value="form.scene" :placeholder="bt('auto.s_1022da11fe')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_6b36c6f7ec')">
          <NColorPicker v-model:value="form.color" :modes="['hex']" />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">{{ bt('auto.s_625fb26b4b') }}</NButton>
          <NButton type="primary" :loading="saving" @click="submit">{{ bt('auto.s_be5fbbe34c') }}</NButton>
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
