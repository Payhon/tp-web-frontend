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
  'fullscreen-change': [value: boolean]
}>()

const theme = useThemeStore()

const domRef = ref<HTMLElement>()
const vditor = ref<Vditor>()
const ready = ref(false)
const isFullscreen = ref(false)
let fullscreenObserver: MutationObserver | null = null
let bodyFullscreenObserver: MutationObserver | null = null

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
      watchFullscreen()
    }
  })
}

function getEditorRoot(): HTMLElement | null {
  if (!domRef.value) return null
  if (domRef.value.classList.contains('vditor')) return domRef.value
  return (domRef.value.querySelector('.vditor') as HTMLElement) || domRef.value
}

function updateFullscreenState() {
  const root = getEditorRoot()
  const next =
    Boolean(root && root.classList.contains('vditor--fullscreen')) ||
    document.body.classList.contains('vditor--fullscreen')
  if (isFullscreen.value !== next) {
    isFullscreen.value = next
    emit('fullscreen-change', next)
  }
}

function watchFullscreen() {
  const root = getEditorRoot()
  fullscreenObserver?.disconnect()
  bodyFullscreenObserver?.disconnect()
  if (root) {
    fullscreenObserver = new MutationObserver(() => {
      updateFullscreenState()
    })
    fullscreenObserver.observe(root, { attributes: true, attributeFilter: ['class'] })
  }
  bodyFullscreenObserver = new MutationObserver(() => {
    updateFullscreenState()
  })
  bodyFullscreenObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  updateFullscreenState()
}

function toggleFullscreen() {
  const root = getEditorRoot()
  const btn = root?.querySelector('[data-type="fullscreen"]') as HTMLElement | null
  btn?.click()
}

function exitFullscreen() {
  if (!isFullscreen.value) return
  toggleFullscreen()
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
  fullscreenObserver?.disconnect()
  fullscreenObserver = null
  bodyFullscreenObserver?.disconnect()
  bodyFullscreenObserver = null
  vditor.value?.destroy?.()
  vditor.value = undefined
})

defineExpose({
  toggleFullscreen,
  exitFullscreen,
  isFullscreen
})
</script>
<template>
  <div ref="domRef"></div>
</template>
