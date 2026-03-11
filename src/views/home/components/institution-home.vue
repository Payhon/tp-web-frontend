<script setup lang="ts">
import { computed, ref } from 'vue'
import { Refresh } from '@vicons/ionicons5'
import type { BmsHomeSummaryResp } from '@/service/api/bms'
import ActivationTrendChart from './activation-trend-chart.vue'

const props = defineProps<{
  orgTypeLabel: string
  summary?: BmsHomeSummaryResp['institution']
}>()

defineEmits(['refresh'])

const activationTab = ref<'week' | 'month'>('week')

const statusItems = computed(() => {
  const summary = props.summary
  if (!summary) return []

  return [
    { label: '在线', value: summary.online_count, type: 'success' as const },
    { label: '离线', value: summary.offline_count, type: 'warning' as const },
    { label: '已激活', value: summary.activated_count, type: 'info' as const },
    { label: '未激活', value: summary.inactive_count, type: 'default' as const }
  ]
})
</script>

<template>
  <div class="flex flex-col gap-16px">
    <div class="flex items-center justify-between">
      <span class="text-16px font-medium">机构概览</span>
      <NButton quaternary circle @click="$emit('refresh')">
        <template #icon>
          <NIcon>
            <Refresh />
          </NIcon>
        </template>
      </NButton>
    </div>

    <NCard :bordered="false" class="rounded-8px shadow-sm">
      <NGrid cols="1 s:2 l:5" responsive="screen" :x-gap="12" :y-gap="12">
        <NGridItem>
          <NStatistic label="电池总数" :value="summary?.battery_total || 0" />
        </NGridItem>
        <NGridItem v-for="item in statusItems" :key="item.label">
          <NStatistic :label="item.label" :value="item.value" />
        </NGridItem>
      </NGrid>
    </NCard>

    <NCard title="状态统计" :bordered="false" class="rounded-8px shadow-sm">
      <NSpace>
        <NTag v-for="item in statusItems" :key="item.label" :type="item.type" size="large">
          {{ item.label }}：{{ item.value }}
        </NTag>
      </NSpace>
    </NCard>

    <NCard title="最近激活" :bordered="false" class="rounded-8px shadow-sm">
      <NTabs v-model:value="activationTab" type="line" animated>
        <NTabPane name="week" tab="近一周">
          <ActivationTrendChart :points="summary?.activation_trend_week || []" />
        </NTabPane>
        <NTabPane name="month" tab="近一月">
          <ActivationTrendChart :points="summary?.activation_trend_month || []" />
        </NTabPane>
      </NTabs>
    </NCard>
  </div>
</template>
