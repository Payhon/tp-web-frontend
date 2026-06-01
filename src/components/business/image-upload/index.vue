<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { UploadCustomRequestOptions, UploadFileInfo } from 'naive-ui'
import { getDemoServerUrl, resolveFileUrl } from '@/utils/common/tool'
import { uploadFileWithStorageStrategy, type UploadStage } from '../upload/shared'

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
const effectiveValueMode = computed(() => (props.valueMode === 'path' ? 'url' : props.valueMode))

const isMultiple = computed(() => props.multiple || props.max > 1 || Array.isArray(props.modelValue))
const fileList = ref<UploadFileInfo[]>([])
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStage = ref<UploadStage>('preparing')
const uploadError = ref('')
const uploadStatusText = computed(() => {
  if (uploadError.value) return uploadError.value
  if (!uploading.value) return ''
  if (uploadStage.value === 'preparing') return '正在准备上传...'
  if (uploadStage.value === 'registering') return '上传完成，正在登记文件...'
  return `上传中 ${uploadProgress.value}%`
})

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
      status: 'finished' as const,
      url: toPreviewUrl(path)
    }))
    fileList.value = list
  },
  { immediate: true, deep: true }
)

async function handleUploadRequest(options: UploadCustomRequestOptions) {
  const rawFile = options.file.file as File | null
  if (!rawFile) {
    options.onError()
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  uploadStage.value = 'preparing'
  uploadError.value = ''

  try {
    const uploaded = await uploadFileWithStorageStrategy({
      file: rawFile,
      bizType: props.bizType,
      onProgress: percentage => {
        uploadProgress.value = percentage
        options.onProgress({ percent: percentage })
      },
      onStageChange: stage => {
        uploadStage.value = stage
      }
    })

    const value = effectiveValueMode.value === 'url' ? uploaded?.url || uploaded?.path : uploaded?.path || uploaded?.url
    if (!value) return
    const current = normalizeValue(props.modelValue)
    const next = isMultiple.value ? [...current, value] : [value]
    updateModelValue(Array.from(new Set(next)))
    if (uploaded) emit('uploaded', uploaded)
    uploadProgress.value = 100
    options.onFinish()
    uploading.value = false
    uploadProgress.value = 0
    uploadStage.value = 'preparing'
  } catch (error: any) {
    uploadError.value = error?.message || '上传失败'
    uploading.value = false
    options.onError()
    window.$message?.error(uploadError.value)
  }
}

function handleRemove({ file }: { file: UploadFileInfo }) {
  if (uploading.value) return false
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
    :max="max"
    :multiple="isMultiple"
    :accept="accept"
    :list-type="listType"
    :disabled="uploading"
    :custom-request="handleUploadRequest"
    @remove="handleRemove"
  />
  <div v-if="uploading || uploadError" class="mt-8px">
    <NProgress
      type="line"
      :percentage="uploadError ? uploadProgress : Math.max(uploadProgress, uploading ? 1 : 0)"
      :status="uploadError ? 'error' : undefined"
      :show-indicator="true"
    />
    <div class="mt-6px text-12px opacity-80" :class="{ 'text-red-500': uploadError }">
      {{ uploadStatusText }}
    </div>
  </div>
</template>
