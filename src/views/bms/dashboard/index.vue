<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { getBmsDashboardAlarmOverview, getBmsDashboardKpi, getBmsDashboardOnlineTrend } from '@/service/api/bms'
import dayjs from 'dayjs'

const message = useMessage()

const loading = ref(false)

const kpi = ref({
  device_total: 0,
  device_online: 0,
  device_activated: 0,
  alarm_active: 0
})

const alarmOverview = ref<{
  status_counts: Array<{ status: string; count: number }>
  top: Array<{ name: string; count: number }>
  trend: Array<{ date: string; count: number }>
}>({
  status_counts: [],
  top: [],
  trend: []
})

const onlineTrend = ref<{ points: Array<{ timestamp: string; device_total: number; device_online: number; device_offline: number }> }>({
  points: []
})

const onlineRate = computed(() => {
  if (!kpi.value.device_total) return 0
  return Math.round((kpi.value.device_online / kpi.value.device_total) * 100)
})

function statusLabel(s: string) {
  if (s === 'H') return '高'
  if (s === 'M') return '中'
  if (s === 'L') return '低'
  if (s === 'N') return '正常'
  return s || '--'
}

async function loadAll() {
  loading.value = true
  try {
    const [kpiRes, alarmRes, trendRes]: any = await Promise.all([
      getBmsDashboardKpi(),
      getBmsDashboardAlarmOverview({ days: 7 }),
      getBmsDashboardOnlineTrend()
    ])

    kpi.value = kpiRes?.data ?? kpi.value
    alarmOverview.value = alarmRes?.data ?? alarmOverview.value

    const points = (trendRes?.data?.points ?? []).map((p: any) => ({
      timestamp: p.timestamp,
      device_total: p.device_total,
      device_online: p.device_online,
      device_offline: p.device_offline
    }))
    onlineTrend.value = { points }
  } catch (e: any) {
    message.error(e?.message || '加载看板数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden <sm:overflow-auto">
    <NCard title="BMS 看板" :bordered="false" size="small" class="card-wrapper">
      <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="16" :y-gap="16">
        <NGridItem>
          <NCard size="small" :bordered="true">
            <div class="text-14px text-gray-500">设备总数</div>
            <div class="text-28px font-600">{{ kpi.device_total }}</div>
          </NCard>
        </NGridItem>
        <NGridItem>
          <NCard size="small" :bordered="true">
            <div class="text-14px text-gray-500">在线设备</div>
            <div class="text-28px font-600">{{ kpi.device_online }}</div>
            <div class="text-12px text-gray-500">在线率 {{ onlineRate }}%</div>
          </NCard>
        </NGridItem>
        <NGridItem>
          <NCard size="small" :bordered="true">
            <div class="text-14px text-gray-500">已激活</div>
            <div class="text-28px font-600">{{ kpi.device_activated }}</div>
          </NCard>
        </NGridItem>
        <NGridItem>
          <NCard size="small" :bordered="true">
            <div class="text-14px text-gray-500">活跃告警</div>
            <div class="text-28px font-600">{{ kpi.alarm_active }}</div>
          </NCard>
        </NGridItem>
      </NGrid>

      <NDivider class="my-12px" />

      <NGrid cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
        <NGridItem>
          <NCard size="small" title="告警概览(近7天)" :bordered="true" :loading="loading">
            <NSpace vertical :size="8">
              <div>
                <div class="text-13px text-gray-500 mb-8px">状态分布</div>
                <NSpace>
                  <NTag v-for="s in alarmOverview.status_counts" :key="s.status" type="warning">
                    {{ statusLabel(s.status) }}：{{ s.count }}
                  </NTag>
                </NSpace>
              </div>
              <div>
                <div class="text-13px text-gray-500 mb-8px">Top3</div>
                <NDataTable
                  size="small"
                  :bordered="false"
                  :columns="[
                    { title: '告警', key: 'name' },
                    { title: '次数', key: 'count', width: 80 }
                  ]"
                  :data="alarmOverview.top"
                  :pagination="false"
                  :row-key="row => row.name"
                />
              </div>
            </NSpace>
          </NCard>
        </NGridItem>
        <NGridItem>
          <NCard size="small" title="在线趋势" :bordered="true" :loading="loading">
            <NDataTable
              size="small"
              :bordered="false"
              :columns="[
                { title: '时间', key: 'timestamp', render: (row: any) => dayjs(row.timestamp).format('MM-DD HH:mm') },
                { title: '总数', key: 'device_total', width: 80 },
                { title: '在线', key: 'device_online', width: 80 },
                { title: '离线', key: 'device_offline', width: 80 }
              ]"
              :data="onlineTrend.points"
              :pagination="{ pageSize: 8 }"
              :row-key="row => row.timestamp"
            />
            <div class="text-12px text-gray-500 mt-8px">
              经销商账号当前仅展示实时点（历史趋势后续补充按经销商采样）。
            </div>
          </NCard>
        </NGridItem>
      </NGrid>

      <NDivider class="my-12px" />

      <NCard size="small" title="快捷入口" :bordered="true">
        <NSpace>
          <NButton type="primary" @click="$router.push('/bms/battery/list')">电池列表</NButton>
          <NButton @click="$router.push('/bms/dealer')">经销商管理</NButton>
          <NButton @click="$router.push('/bms/warranty')">维保中心</NButton>
          <NButton @click="$router.push('/bms/battery/transfer')">转移记录</NButton>
        </NSpace>
      </NCard>
    </NCard>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>

