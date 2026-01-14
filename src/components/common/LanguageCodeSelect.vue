<script setup lang="ts">
import { computed } from 'vue'
import { NSelect } from 'naive-ui'
import { localStg } from '@/utils/storage'
import languageCodes from './language-codes.json'

defineOptions({ name: 'LanguageCodeSelect' })

interface Props {
  value?: string
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  filterable?: boolean
}

type Emits = {
  (e: 'update:value', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  value: '',
  placeholder: '',
  disabled: false,
  clearable: true,
  filterable: true
})

const emit = defineEmits<Emits>()

const displayNames = computed(() => {
  const lang = localStg.get('lang') || 'en'
  try {
    return new Intl.DisplayNames([lang], { type: 'language' })
  } catch {
    return null
  }
})

const options = computed(() =>
  (languageCodes as Array<{ code: string; name: string; flag: string }>).map(item => {
    const localizedName = displayNames.value?.of(item.code) || item.name
    return {
      label: `${item.flag} ${localizedName} (${item.code})`,
      value: item.code
    }
  })
)

function handleUpdateValue(value: string | number | null) {
  emit('update:value', value == null ? '' : String(value))
}
</script>

<template>
  <NSelect
    :value="props.value"
    :options="options"
    :disabled="props.disabled"
    :placeholder="props.placeholder"
    :clearable="props.clearable"
    :filterable="props.filterable"
    virtual-scroll
    @update:value="handleUpdateValue"
  />
</template>

<style scoped></style>
