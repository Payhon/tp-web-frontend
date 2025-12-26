<script setup lang="ts">
import { useSysSettingStore } from '@/store/modules/sys-setting'
defineOptions({
  name: 'GlobalFooter'
})
const sysSettingStore = useSysSettingStore()
</script>

<template>
  <DarkModeContainer class="h-full flex-center">
    <a href="/" target="_blank" rel="noopener noreferrer">
      Copyright © {{ new Date().getFullYear() }} {{ sysSettingStore.system_name }}
    </a>
  </DarkModeContainer>
</template>

<style scoped></style>
