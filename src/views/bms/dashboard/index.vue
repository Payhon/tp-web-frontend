<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { getBmsDashboardAlarmOverview, getBmsDashboardKpi, getBmsDashboardOnlineTrend } from '@/service/api/bms'
import dayjs from 'dayjs'
import { $t } from '@/locales'

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

const onlineTrend = ref<{
  points: Array<{ timestamp: string; device_total: number; device_online: number; device_offline: number }>
}>({
  points: []
})

const onlineRate = computed(() => {
  if (!kpi.value.device_total) return 0
  return Math.round((kpi.value.device_online / kpi.value.device_total) * 100)
})

function statusLabel(s: string) {
  if (s === 'H') return $t('bms.pages.dashboard.severityHigh')
  if (s === 'M') return $t('bms.pages.dashboard.severityMedium')
  if (s === 'L') return $t('bms.pages.dashboard.severityLow')
  if (s === 'N') return $t('bms.pages.dashboard.severityNormal')
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
    message.error(e?.message || $t('bms.pages.dashboard.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="$t('bms.pages.dashboard.title')" :bordered="false" size="small" class="card-wrapper">
      <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="16" :y-gap="16">
        <NGridItem>
          <NCard size="small" :bordered="true">
            <div class="text-14px text-gray-500">{{ $t('bms.pages.dashboard.deviceTotal') }}</div>
            <div class="text-28px font-600">{{ kpi.device_total }}</div>
          </NCard>
        </NGridItem>
        <NGridItem>
          <NCard size="small" :bordered="true">
            <div class="text-14px text-gray-500">{{ $t('bms.pages.dashboard.onlineDevices') }}</div>
            <div class="text-28px font-600">{{ kpi.device_online }}</div>
            <div class="text-12px text-gray-500">{{ $t('bms.pages.dashboard.onlineRate') }} {{ onlineRate }}%</div>
          </NCard>
        </NGridItem>
        <NGridItem>
          <NCard size="small" :bordered="true">
            <div class="text-14px text-gray-500">{{ $t('bms.pages.dashboard.activated') }}</div>
            <div class="text-28px font-600">{{ kpi.device_activated }}</div>
          </NCard>
        </NGridItem>
        <NGridItem>
          <NCard size="small" :bordered="true">
            <div class="text-14px text-gray-500">{{ $t('bms.pages.dashboard.activeAlarms') }}</div>
            <div class="text-28px font-600">{{ kpi.alarm_active }}</div>
          </NCard>
        </NGridItem>
      </NGrid>

      <NDivider class="my-12px" />

      <NGrid cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
        <NGridItem>
          <NCard size="small" :title="$t('bms.pages.dashboard.alarmOverview')" :bordered="true" :loading="loading">
            <NSpace vertical :size="8">
              <div>
                <div class="text-13px text-gray-500 mb-8px">{{ $t('bms.pages.dashboard.statusDistribution') }}</div>
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
                    { title: $t('bms.pages.dashboard.alarm'), key: 'name' },
                    { title: $t('bms.pages.dashboard.count'), key: 'count', width: 80 }
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
          <NCard size="small" :title="$t('bms.pages.dashboard.onlineTrend')" :bordered="true" :loading="loading">
            <NDataTable
              size="small"
              :bordered="false"
              :columns="[
                {
                  title: $t('bms.pages.dashboard.time'),
                  key: 'timestamp',
                  render: (row: any) => dayjs(row.timestamp).format('MM-DD HH:mm')
                },
                { title: $t('bms.pages.dashboard.total'), key: 'device_total', width: 80 },
                { title: $t('bms.pages.dashboard.online'), key: 'device_online', width: 80 },
                { title: $t('bms.pages.dashboard.offline'), key: 'device_offline', width: 80 }
              ]"
              :data="onlineTrend.points"
              :pagination="{ pageSize: 8 }"
              :row-key="row => row.timestamp"
            />
            <div class="text-12px text-gray-500 mt-8px">
              {{ $t('bms.pages.dashboard.dealerRealtimeHint') }}
            </div>
          </NCard>
        </NGridItem>
      </NGrid>

      <NDivider class="my-12px" />

      <NCard size="small" :title="$t('bms.pages.dashboard.quickLinks')" :bordered="true">
        <NSpace>
          <NButton type="primary" @click="$router.push('/bms/battery/list')">
            {{ $t('bms.pages.dashboard.batteryList') }}
          </NButton>
          <NButton @click="$router.push('/bms/dealer')">{{ $t('bms.pages.dashboard.dealerManagement') }}</NButton>
          <NButton @click="$router.push('/bms/warranty')">{{ $t('bms.pages.dashboard.warrantyCenter') }}</NButton>
          <NButton @click="$router.push('/bms/battery/transfer')">
            {{ $t('bms.pages.dashboard.transferRecords') }}
          </NButton>
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
