<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { UploadFileInfo } from 'naive-ui'
import { getDemoServerUrl, resolveFileUrl } from '@/utils/common/tool'
import { localStg } from '@/utils/storage'

type ModelValue = string | string[]

export interface Props {
  modelValue: ModelValue
  /** 上传时传给后端的 type（业务类型） */
  bizType?: string
  /** 最大文件数 */
  max?: number
  /** 是否多选 */
  multiple?: boolean
  /** input accept */
  accept?: string
  /** 输出值类型 */
  valueMode?: 'path' | 'url'
  /** 上传列表样式 */
  listType?: 'image' | 'image-card' | 'text'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  bizType: 'image',
  max: 1,
  multiple: false,
  accept: 'image/png, image/jpeg, image/jpg, image/gif, image/svg+xml',
  valueMode: 'path',
  listType: 'image-card'
})

interface Emits {
  (e: 'update:modelValue', val: ModelValue): void
  (e: 'uploaded', val: Api.File.UploadRsp): void
  (e: 'removed', val: string): void
}

const emit = defineEmits<Emits>()

const serverBaseUrl = computed(() => getDemoServerUrl())
const uploadAction = computed(() => `${serverBaseUrl.value}/file/up`)

const isMultiple = computed(() => props.multiple || props.max > 1 || Array.isArray(props.modelValue))
const fileList = ref<UploadFileInfo[]>([])

function normalizeValue(value: ModelValue): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

function updateModelValue(values: string[]) {
  if (isMultiple.value) {
    emit('update:modelValue', values)
  } else {
    emit('update:modelValue', values[0] || '')
  }
}

function toPreviewUrl(path: string) {
  return resolveFileUrl(path, serverBaseUrl.value)
}

watch(
  () => props.modelValue,
  value => {
    const list = normalizeValue(value).map(path => ({
      id: path,
      name: path.split('/').pop() || 'image',
      status: 'finished',
      url: toPreviewUrl(path)
    }))
    fileList.value = list
  },
  { immediate: true, deep: true }
)

function handleFinish({ event }: { file: UploadFileInfo; event?: ProgressEvent }) {
  try {
    const response = JSON.parse((event?.target as XMLHttpRequest).response)
    const uploaded = response?.data as Api.File.UploadRsp | undefined
    const value = props.valueMode === 'url' ? uploaded?.url || uploaded?.path : uploaded?.path || uploaded?.url
    if (!value) return
    const current = normalizeValue(props.modelValue)
    const next = isMultiple.value ? [...current, value] : [value]
    updateModelValue(Array.from(new Set(next)))
    if (uploaded) emit('uploaded', uploaded)
  } catch {
    // ignore parse errors; keep upload state as-is
  }
}

function handleRemove({ file }: { file: UploadFileInfo }) {
  const id = String(file.id || '')
  const next = normalizeValue(props.modelValue).filter(item => item !== id)
  updateModelValue(next)
  emit('removed', id)
  return true
}
</script>

<template>
  <NUpload
    v-model:file-list="fileList"
    :action="uploadAction"
    :headers="{ 'x-token': localStg.get('token') || '' }"
    :data="{ type: bizType }"
    :max="max"
    :multiple="isMultiple"
    :accept="accept"
    :list-type="listType"
    @finish="handleFinish"
    @remove="handleRemove"
  />
</template>
