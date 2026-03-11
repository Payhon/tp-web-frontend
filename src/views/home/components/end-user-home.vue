<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    userName: string
    batteryTotal: number
  }>(),
  {
    userName: '用户',
    batteryTotal: 0
  }
)
</script>

<template>
  <div class="h-full flex items-center justify-center p-16px">
    <NCard class="w-full max-w-760px rounded-12px shadow-sm" :bordered="false">
      <NSpace vertical :size="20">
        <div>
          <h2 class="mb-8px text-24px font-600">欢迎你，{{ props.userName }}</h2>
          <p class="text-14px text-gray-500">很高兴再次见到你，下面是当前账号的电池资产概览。</p>
        </div>

        <NStatistic label="我拥有的电池总数" :value="props.batteryTotal" />

        <NAlert type="success" :show-icon="false">后续我们会持续迭代你的专属首页内容，带来更多实用功能。</NAlert>
      </NSpace>
    </NCard>
  </div>
</template>
