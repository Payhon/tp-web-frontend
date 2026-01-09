<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.replace({ path: '/bms/org', query: { org_type: 'PACK_FACTORY' } })
})
</script>

<template>
  <div class="flex items-center justify-center h-full">
    <span>正在跳转...</span>
  </div>
</template>


