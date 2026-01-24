<script setup lang="tsx">
import { computed, reactive, ref, toRefs, watch } from 'vue'
import { NButton, NDataTable, NForm, NFormItem, NInput, NInputGroup, NModal, NSpace, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import { fetchUserList } from '@/service/api/auth'

interface EndUserRow {
  id: string
  name?: string | null
  phone_number: string
  email: string
  status?: 'N' | 'F'
}

interface Props {
  modelValue: string | null
  placeholder?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: '请选择APP用户',
  disabled: false
})

const { modelValue, placeholder, disabled } = toRefs(props)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
  (e: 'select', value: EndUserRow | null): void
}>()

const message = useMessage()

const showModal = ref(false)
const loading = ref(false)
const keyword = ref('')
const tableData = ref<EndUserRow[]>([])
const checkedRowKeys = ref<string[]>([])
const selectedRow = ref<EndUserRow | null>(null)

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 50],
  onChange: (page: number) => {
    pagination.page = page
    fetchList()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    fetchList()
  }
})

const displayLabel = computed(() => {
  if (selectedRow.value) {
    const name = selectedRow.value.name ? `（${selectedRow.value.name}）` : ''
    return `${selectedRow.value.phone_number}${name}`
  }
  return ''
})

const columns = computed<DataTableColumns<EndUserRow>>(() => [
  { type: 'selection', multiple: true },
  { key: 'phone_number', title: '手机号', minWidth: 140 },
  { key: 'name', title: '姓名', minWidth: 120, render: r => r.name || '--' },
  { key: 'email', title: '邮箱', minWidth: 180 },
  {
    key: 'status',
    title: '状态',
    width: 90,
    render: r => <NTag type={r.status === 'F' ? 'error' : 'success'}>{r.status === 'F' ? '冻结' : '正常'}</NTag>
  }
])

function openModal() {
  if (disabled.value) return
  showModal.value = true
  if (tableData.value.length === 0) fetchList()
}

function closeModal() {
  showModal.value = false
}

function buildQueryParams() {
  const kw = keyword.value.trim()
  const params: any = {
    page: pagination.page,
    page_size: pagination.pageSize,
    user_kind: 'END_USER'
  }
  if (kw) {
    if (kw.includes('@')) params.email = kw
    else if (/^[0-9+\\-\\s]+$/.test(kw)) params.phone_number = kw
    else params.name = kw
  }
  return params
}

async function fetchList() {
  loading.value = true
  try {
    const res: any = await fetchUserList(buildQueryParams())
    const payload = res?.data
    tableData.value = payload?.list || []
    pagination.itemCount = payload?.total || 0
  } catch (e: any) {
    message.error(e?.message || '加载用户失败')
    tableData.value = []
    pagination.itemCount = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function handleResetSearch() {
  keyword.value = ''
  pagination.page = 1
  fetchList()
}

function handleSelectionChange(keys: string[], rows?: EndUserRow[]) {
  if (keys.length === 0) {
    checkedRowKeys.value = []
    selectedRow.value = null
    return
  }
  const lastKey = keys[keys.length - 1]
  const sourceRows = rows && rows.length ? rows : tableData.value
  const lastRow = sourceRows.find(r => r.id === lastKey) || sourceRows[sourceRows.length - 1]
  checkedRowKeys.value = lastKey ? [lastKey] : []
  selectedRow.value = lastRow || null
}

function confirmSelect() {
  if (!selectedRow.value) {
    message.warning('请先选择用户')
    return
  }
  emit('update:modelValue', selectedRow.value.id)
  emit('select', selectedRow.value)
  showModal.value = false
}

function clearSelection() {
  checkedRowKeys.value = []
  selectedRow.value = null
  emit('update:modelValue', null)
  emit('select', null)
}

watch(
  () => modelValue.value,
  v => {
    if (!v) {
      selectedRow.value = null
      checkedRowKeys.value = []
    }
  }
)
</script>

<template>
  <NInputGroup>
    <NInput :value="displayLabel" :placeholder="placeholder" readonly :disabled="disabled" />
    <NButton :disabled="disabled" type="primary" @click="openModal">选择</NButton>
    <NButton v-if="modelValue" :disabled="disabled" @click="clearSelection">清除</NButton>
  </NInputGroup>

  <NModal v-model:show="showModal" preset="card" title="选择APP用户" style="width: 880px">
    <NForm inline :show-feedback="false" class="mb-12px">
      <NFormItem label="关键词">
        <NInput v-model:value="keyword" placeholder="手机号/邮箱/姓名" clearable style="width: 240px" />
      </NFormItem>
      <NFormItem>
        <NSpace>
          <NButton type="primary" @click="handleSearch">查询</NButton>
          <NButton @click="handleResetSearch">重置</NButton>
        </NSpace>
      </NFormItem>
    </NForm>

    <NDataTable
      :columns="columns"
      :data="tableData"
      :loading="loading"
      :pagination="pagination"
      :row-key="row => row.id"
      :checked-row-keys="checkedRowKeys"
      @update:checked-row-keys="handleSelectionChange"
    />

    <template #footer>
      <NSpace justify="end">
        <NButton @click="closeModal">取消</NButton>
        <NButton type="primary" :disabled="!selectedRow" @click="confirmSelect">确定</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
