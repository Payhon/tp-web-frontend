<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DataTableColumns, UploadFileInfo } from 'naive-ui'
import { $t } from '@/locales'
import { getDemoServerUrl, getFileName } from '@/utils/common/tool'
import { formatDateTime } from '@/utils/common/datetime'
import { localStg } from '@/utils/storage'
import { getFileListByPage } from '@/service/api/file'

defineOptions({ name: 'FilePicker' })

export interface Props {
  modelValue: string
  /** 上传时传给后端的 type（业务类型） */
  bizType: string
  /** 限制上传后缀名（不含点），为空表示不限制 */
  allowedExtensions?: string[]
  /** 限制上传大小（MB），为空表示不限制 */
  maxSizeMB?: number
  /** input accept */
  accept?: string
  /** 输出值类型 */
  valueMode?: 'path' | 'url'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  allowedExtensions: () => [],
  accept: '',
  valueMode: 'path'
})

interface Emits {
  (e: 'update:modelValue', val: string): void
  (e: 'select', file: Api.File.ListItem): void
  (e: 'uploaded', file: Api.File.UploadRsp): void
}

const emit = defineEmits<Emits>()

const show = ref(false)
const viewMode = ref<'list' | 'thumb'>('list')
const loading = ref(false)

const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const fileList = ref<Api.File.ListItem[]>([])
const selectedId = ref<string>('')

const serverBaseUrl = computed(() => getDemoServerUrl())
const uploadAction = computed(() => `${serverBaseUrl.value}/file/up`)

const displayValue = computed(() => {
  if (!props.modelValue) return ''
  return getFileName(props.modelValue)
})

const selectedFile = computed(() => fileList.value.find(it => it.id === selectedId.value) || null)

function toFileValue(item: Api.File.ListItem): string {
  return props.valueMode === 'url' ? item.url : item.path
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const size = bytes / Math.pow(1024, idx)
  return `${size.toFixed(1)} ${units[idx]}`
}

async function loadFiles() {
  loading.value = true
  try {
    const { data } = await getFileListByPage({
      page: page.value,
      page_size: pageSize.value,
      mine: true,
      keyword: keyword.value || undefined,
      biz_type: props.bizType || undefined
    })
    if (data) {
      total.value = data.total
      fileList.value = data.list || []
      if (!selectedId.value && fileList.value.length) {
        selectedId.value = fileList.value[0].id
      }
    }
  } finally {
    loading.value = false
  }
}

function open() {
  show.value = true
}

function clear() {
  emit('update:modelValue', '')
}

async function refresh() {
  page.value = 1
  await loadFiles()
}

function beforeUpload(data: { file: UploadFileInfo }) {
  const file = data.file.file
  if (!file) return false

  if (props.maxSizeMB && file.size > props.maxSizeMB * 1024 * 1024) {
    window.$message?.error(`文件大小不能超过 ${props.maxSizeMB}MB`)
    return false
  }

  if (props.allowedExtensions.length) {
    const ext = data.file.name.includes('.') ? data.file.name.split('.').pop()?.toLowerCase() || '' : ''
    const allow = props.allowedExtensions.map(x => x.toLowerCase())
    if (!allow.includes(ext)) {
      window.$message?.error(`仅支持上传 ${allow.join('/')} 格式文件`)
      return false
    }
  }

  return true
}

async function handleFinish({ event }: { file: UploadFileInfo; event?: ProgressEvent }) {
  try {
    const response = JSON.parse((event?.target as XMLHttpRequest).response)
    if (response?.data) {
      const uploaded = response.data as Api.File.UploadRsp
      emit('uploaded', uploaded)
      await refresh()
      if (uploaded?.id) selectedId.value = uploaded.id
    }
    window.$message?.success(response?.message || '上传成功')
  } catch {
    window.$message?.success('上传成功')
    await refresh()
  }
}

function handleConfirm() {
  const item = selectedFile.value
  if (!item) {
    window.$message?.warning('请选择文件')
    return
  }
  emit('update:modelValue', toFileValue(item))
  emit('select', item)
  show.value = false
}

const columns = computed<DataTableColumns<Api.File.ListItem>>(() => [
  {
    title: '文件名',
    key: 'file_name',
    ellipsis: { tooltip: true }
  },
  {
    title: '大小',
    key: 'file_size',
    width: 120,
    render: row => formatSize(row.file_size)
  },
  {
    title: '类型',
    key: 'biz_type',
    width: 120
  },
  {
    title: '上传时间',
    key: 'uploaded_at',
    width: 180,
    render: row => formatDateTime(row.uploaded_at) || '--'
  }
])

async function handleChangePage(p: number) {
  page.value = p
  await loadFiles()
}

async function handleChangePageSize(ps: number) {
  pageSize.value = ps
  page.value = 1
  await loadFiles()
}

function handleRowClick(row: Api.File.ListItem) {
  selectedId.value = row.id
}

watch(
  () => show.value,
  async val => {
    if (val) await refresh()
  }
)
</script>

<template>
  <div class="flex items-center gap-8px">
    <NInput :value="displayValue" readonly placeholder="未选择文件" class="w-260px" />
    <NButton type="primary" secondary @click="open">选择文件</NButton>
    <NButton v-if="modelValue" tertiary @click="clear">{{ $t('common.clear') }}</NButton>
  </div>

  <NModal v-model:show="show" preset="card" title="选择文件" style="width: 980px">
    <div class="file-picker-toolbar mb-12px">
      <NInput
        v-model:value="keyword"
        clearable
        placeholder="搜索文件名"
        class="file-picker-toolbar__search"
        size="medium"
        @keyup.enter="refresh"
      >
        <template #prefix>
          <SvgIcon icon="mdi:magnify" class="text-16px opacity-70" />
        </template>
      </NInput>

      <div class="file-picker-toolbar__actions">
        <ButtonIcon
          icon="material-symbols:refresh"
          tooltip-content="刷新"
          size="medium"
          class="h-34px w-34px"
          @click="refresh"
        />
        <NButtonGroup size="medium">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                :type="viewMode === 'list' ? 'primary' : 'default'"
                secondary
                class="w-44px"
                @click="viewMode = 'list'"
              >
                <SvgIcon icon="mdi:format-list-bulleted" class="text-18px" />
              </NButton>
            </template>
            列表
          </NTooltip>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                :type="viewMode === 'thumb' ? 'primary' : 'default'"
                secondary
                class="w-44px"
                @click="viewMode = 'thumb'"
              >
                <SvgIcon icon="mdi:view-grid-outline" class="text-18px" />
              </NButton>
            </template>
            缩略图
          </NTooltip>
        </NButtonGroup>
      </div>
    </div>

    <NAlert type="info" class="mb-12px" :show-icon="false">
      可上传本地文件，或从“我的文件”列表中选择已上传的文件。
    </NAlert>

    <NUpload
      :action="uploadAction"
      :headers="{ 'x-token': localStg.get('token') || '' }"
      :data="{ type: bizType }"
      :accept="accept"
      :show-file-list="false"
      @before-upload="beforeUpload"
      @finish="handleFinish"
    >
      <NUploadDragger>
        <div class="py-12px">点击或拖拽上传</div>
        <div class="text-12px opacity-70">
          <span v-if="allowedExtensions.length">支持：{{ allowedExtensions.join('/') }}</span>
          <span v-if="allowedExtensions.length && maxSizeMB">，</span>
          <span v-if="maxSizeMB">最大：{{ maxSizeMB }}MB</span>
        </div>
      </NUploadDragger>
    </NUpload>

    <div class="mt-12px">
      <NSpin :show="loading">
        <template v-if="viewMode === 'list'">
          <NDataTable
            :columns="columns"
            :data="fileList"
            :pagination="{
              page: page,
              pageSize: pageSize,
              itemCount: total,
              showSizePicker: true,
              pageSizes: [10, 20, 50, 100],
              onChange: handleChangePage,
              onUpdatePageSize: handleChangePageSize
            }"
            :row-props="
              row => ({
                style: { cursor: 'pointer' },
                onClick: () => handleRowClick(row)
              })
            "
            :row-class-name="row => (row.id === selectedId ? 'file-picker-row--selected' : '')"
          />
        </template>

        <template v-else>
          <div class="file-picker-grid">
            <div
              v-for="item in fileList"
              :key="item.id"
              class="file-picker-thumb"
              :class="{ 'file-picker-thumb--selected': item.id === selectedId }"
              @click="selectedId = item.id"
            >
              <div class="file-picker-thumb__preview">
                <NImage v-if="item.mime_type?.startsWith('image/')" :src="item.url" object-fit="cover" />
                <div v-else class="file-picker-thumb__icon">FILE</div>
              </div>
              <div class="file-picker-thumb__name" :title="item.file_name">{{ item.file_name }}</div>
            </div>
          </div>
          <div class="mt-8px flex justify-end">
            <NPagination
              v-model:page="page"
              v-model:page-size="pageSize"
              :item-count="total"
              :page-sizes="[10, 20, 50, 100]"
              show-size-picker
              @update:page="handleChangePage"
              @update:page-size="handleChangePageSize"
            />
          </div>
        </template>
      </NSpin>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <div class="text-12px opacity-70">
          已选：{{ selectedFile?.file_name || '-' }}（{{ selectedFile ? formatSize(selectedFile.file_size) : '-' }}）
        </div>
        <NSpace>
          <NButton @click="show = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleConfirm">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.file-picker-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-picker-toolbar__search {
  flex: 1;
  min-width: 360px;
}

.file-picker-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-picker-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.file-picker-thumb {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
}

.file-picker-thumb--selected {
  border-color: var(--n-color-target);
}

.file-picker-thumb__preview {
  width: 100%;
  height: 110px;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-picker-thumb__icon {
  font-size: 12px;
  opacity: 0.7;
}

.file-picker-thumb__name {
  margin-top: 8px;
  font-size: 12px;
  line-height: 16px;
  max-height: 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

:global(.file-picker-row--selected td) {
  background: rgba(24, 160, 88, 0.08) !important;
}
</style>
