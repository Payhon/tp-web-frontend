<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { useThemeStore } from '@/store/modules/theme'

type Props = {
  modelValue: string
  placeholder?: string
  height?: number
  minHeight?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const theme = useThemeStore()

const domRef = ref<HTMLElement>()
const vditor = ref<Vditor>()
const ready = ref(false)

function getThemeMode(dark: boolean) {
  return dark ? 'dark' : 'classic'
}

function renderVditor() {
  if (!domRef.value) return

  vditor.value = new Vditor(domRef.value, {
    minHeight: props.minHeight ?? 360,
    height: props.height,
    theme: getThemeMode(theme.darkMode),
    icon: 'material',
    placeholder: props.placeholder,
    cache: { enable: false },
    input: (value: string) => {
      emit('update:modelValue', value)
    },
    after: () => {
      ready.value = true
      vditor.value?.setValue(props.modelValue || '')
    }
  })
}

const stopThemeWatch = watch(
  () => theme.darkMode,
  dark => {
    vditor.value?.setTheme(getThemeMode(dark))
  }
)

watch(
  () => props.modelValue,
  value => {
    if (!ready.value) return
    if (!vditor.value) return
    if (value === vditor.value.getValue()) return
    vditor.value.setValue(value || '')
  }
)

onMounted(() => {
  renderVditor()
})

onUnmounted(() => {
  stopThemeWatch()
  vditor.value?.destroy?.()
  vditor.value = undefined
})
</script>
<template>
  <div ref="domRef"></div>
</template>
