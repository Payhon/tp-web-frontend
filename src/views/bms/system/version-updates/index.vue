<script setup lang="tsx">
import { computed, onMounted, reactive, ref } from 'vue'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  useMessage
} from 'naive-ui'
import { createVersionUpdate, deleteVersionUpdate, getVersionUpdateList, updateVersionUpdate } from '@/service/api/bms'
import type { VersionUpdateListParams, VersionUpdatePayload, VersionUpdateProject } from '@/service/api/bms'

type VersionUpdateRow = {
  id: string
  project: VersionUpdateProject
  version_no: string
  release_date: string
  update_content: string
  source: string
  source_ref?: string | null
  created_at: string
  updated_at: string
}

type DateRangeValue = [number, number] | null

const projectOptions: Array<{ label: string; value: VersionUpdateProject }> = [
  { label: '移动端', value: 'MOBILE' },
  { label: '云平台-WEB前端', value: 'CLOUD_FRONTEND' },
  { label: '云平台-后端', value: 'CLOUD_BACKEND' }
]

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const editingId = ref<string | null>(null)
const data = ref<VersionUpdateRow[]>([])
const total = ref(0)

const searchForm = reactive<{
  project: VersionUpdateProject | null
  version_no: string
  keyword: string
  dateRange: DateRangeValue
}>({
  project: null,
  version_no: '',
  keyword: '',
  dateRange: null
})

const formModel = reactive<{
  project: VersionUpdateProject
  version_no: string
  release_date: number | null
  update_content: string
}>({
  project: 'MOBILE',
  version_no: '',
  release_date: null,
  update_content: ''
})

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: page => {
    pagination.page = page
    fetchData()
  },
  onUpdatePageSize: pageSize => {
    pagination.pageSize = pageSize
    pagination.page = 1
    fetchData()
  }
})

const tablePagination = computed(() => ({
  ...pagination,
  itemCount: total.value
}))

const modalTitle = computed(() => (editingId.value ? '编辑版本更新记录' : '新增版本更新记录'))

function projectLabel(project: VersionUpdateProject) {
  return projectOptions.find(item => item.value === project)?.label || project
}

function projectTagType(project: VersionUpdateProject) {
  if (project === 'MOBILE') return 'success'
  if (project === 'CLOUD_FRONTEND') return 'info'
  return 'warning'
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(dateText: string) {
  if (!dateText) return null
  return new Date(`${dateText}T00:00:00`).getTime()
}

function resetForm() {
  editingId.value = null
  formModel.project = 'MOBILE'
  formModel.version_no = ''
  formModel.release_date = null
  formModel.update_content = ''
}

function openCreateModal() {
  resetForm()
  modalVisible.value = true
}

function openEditModal(row: VersionUpdateRow) {
  editingId.value = row.id
  formModel.project = row.project
  formModel.version_no = row.version_no
  formModel.release_date = parseDate(row.release_date)
  formModel.update_content = row.update_content
  modalVisible.value = true
}

function validateForm(): VersionUpdatePayload | null {
  const versionNo = formModel.version_no.trim()
  const updateContent = formModel.update_content.trim()
  const releaseDate = formatDate(formModel.release_date)

  if (!versionNo) {
    message.warning('请输入版本号')
    return null
  }
  if (versionNo.length > 64) {
    message.warning('版本号不能超过64个字符')
    return null
  }
  if (!releaseDate) {
    message.warning('请选择日期')
    return null
  }
  if (!updateContent) {
    message.warning('请输入更新内容')
    return null
  }

  return {
    project: formModel.project,
    version_no: versionNo,
    release_date: releaseDate,
    update_content: updateContent
  }
}

async function saveRecord() {
  const payload = validateForm()
  if (!payload) return

  saving.value = true
  try {
    if (editingId.value) {
      await updateVersionUpdate(editingId.value, payload)
      message.success('更新成功')
    } else {
      await createVersionUpdate(payload)
      message.success('新增成功')
    }
    modalVisible.value = false
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteRecord(row: VersionUpdateRow) {
  try {
    await deleteVersionUpdate(row.id)
    message.success('删除成功')
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

function buildParams(): VersionUpdateListParams {
  const params: VersionUpdateListParams = {
    page: pagination.page || 1,
    page_size: pagination.pageSize || 10
  }
  if (searchForm.project) params.project = searchForm.project
  if (searchForm.version_no.trim()) params.version_no = searchForm.version_no.trim()
  if (searchForm.keyword.trim()) params.keyword = searchForm.keyword.trim()
  if (searchForm.dateRange) {
    params.start_date = formatDate(searchForm.dateRange[0])
    params.end_date = formatDate(searchForm.dateRange[1])
  }
  return params
}

async function fetchData() {
  loading.value = true
  try {
    const res: any = await getVersionUpdateList(buildParams())
    data.value = (res?.data?.list || []) as VersionUpdateRow[]
    total.value = Number(res?.data?.total || 0)
  } catch (e: any) {
    message.error(e?.message || '查询失败')
    data.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchData()
}

function handleReset() {
  searchForm.project = null
  searchForm.version_no = ''
  searchForm.keyword = ''
  searchForm.dateRange = null
  pagination.page = 1
  fetchData()
}

const columns: DataTableColumns<VersionUpdateRow> = [
  {
    key: 'project',
    title: '项目',
    width: 150,
    render: row => (
      <NTag size="small" type={projectTagType(row.project)}>
        {projectLabel(row.project)}
      </NTag>
    )
  },
  { key: 'version_no', title: '版本号', width: 150 },
  { key: 'release_date', title: '日期', width: 130 },
  {
    key: 'update_content',
    title: '更新内容',
    minWidth: 420,
    ellipsis: { tooltip: true }
  },
  {
    key: 'source',
    title: '来源',
    width: 130,
    render: row => {
      if (row.source === 'git_log') return 'Git log'
      if (row.source === 'app_update_doc') return 'APP 文档'
      return '手动'
    }
  },
  {
    key: 'actions',
    title: '操作',
    width: 150,
    fixed: 'right',
    render: row => (
      <NSpace size="small">
        <NButton size="small" type="primary" onClick={() => openEditModal(row)}>
          编辑
        </NButton>
        <NPopconfirm onPositiveClick={() => deleteRecord(row)}>
          {{
            default: () => '确认删除该版本更新记录？',
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

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :bordered="false" size="small" class="card-wrapper">
      <NForm label-placement="left" :show-feedback="false" class="search-form">
        <NSpace align="center" :wrap="true">
          <NFormItem label="项目">
            <NSelect
              v-model:value="searchForm.project"
              :options="projectOptions"
              clearable
              placeholder="全部"
              style="width: 180px"
            />
          </NFormItem>
          <NFormItem label="版本号">
            <NInput v-model:value="searchForm.version_no" clearable placeholder="请输入版本号" style="width: 180px" />
          </NFormItem>
          <NFormItem label="日期">
            <NDatePicker v-model:value="searchForm.dateRange" type="daterange" clearable style="width: 240px" />
          </NFormItem>
          <NFormItem label="内容">
            <NInput v-model:value="searchForm.keyword" clearable placeholder="请输入更新内容" style="width: 220px" />
          </NFormItem>
          <NFormItem>
            <NSpace>
              <NButton type="primary" @click="handleSearch">查询</NButton>
              <NButton @click="handleReset">重置</NButton>
              <NButton type="primary" ghost @click="openCreateModal">新增</NButton>
            </NSpace>
          </NFormItem>
        </NSpace>
      </NForm>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="tablePagination"
        :row-key="row => row.id"
        :scroll-x="1080"
        remote
      />
    </NCard>

    <NModal v-model:show="modalVisible" preset="card" :title="modalTitle" style="width: 720px" @after-leave="resetForm">
      <NForm label-placement="left" label-width="90px">
        <NFormItem label="项目">
          <NSelect v-model:value="formModel.project" :options="projectOptions" />
        </NFormItem>
        <NFormItem label="版本号">
          <NInput v-model:value="formModel.version_no" maxlength="64" show-count placeholder="请输入版本号" />
        </NFormItem>
        <NFormItem label="日期">
          <NDatePicker v-model:value="formModel.release_date" type="date" clearable style="width: 100%" />
        </NFormItem>
        <NFormItem label="更新内容">
          <NInput
            v-model:value="formModel.update_content"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 10 }"
            placeholder="请输入更新内容"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="saveRecord">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}

.search-form {
  margin-bottom: 16px;
}
</style>
