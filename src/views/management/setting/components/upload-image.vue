<script setup lang="ts">
import { computed, ref } from 'vue'
import { getDemoServerUrl } from '@/utils/common/tool'
import FilePicker from '@/components/business/file-picker/index.vue'
defineOptions({ name: 'UploadFile' })
export interface Props {
  modelValue: string
  /** 选取文件的类型 */
  accept: string
  /** 上传的文件类型 */
  fileType: string[]
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  accept: 'image/png, image/jpeg, image/jpg, image/gif',
  fileType: () => ['png', 'jpeg', 'jpg', 'gif']
})

interface Emits {
  (e: 'update:modelValue', val: string): void
  (e: 'success', val: string): void
}

const emit = defineEmits<Emits>()

const url = ref(new URL(getDemoServerUrl()))
const previewSrc = computed(() => (props.modelValue ? url.value.origin + props.modelValue.slice(1) : ''))

function handleUpdate(val: string) {
  emit('update:modelValue', val)
  emit('success', val)
}
</script>

<template>
  <div class="flex items-start gap-12px">
    <div class="flex flex-col gap-8px">
      <FilePicker
        :model-value="modelValue"
        biz-type="image"
        :accept="accept"
        :allowed-extensions="fileType"
        @update:model-value="handleUpdate"
      />
      <div class="text-12px opacity-70">支持：{{ fileType.join('/') }}</div>
    </div>
    <NImage v-if="previewSrc" :src="previewSrc" width="120" height="120" object-fit="contain" />
  </div>
</template>
