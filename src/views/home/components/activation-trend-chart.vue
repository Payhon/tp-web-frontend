<script setup lang="ts">
import { watch } from 'vue'
import { useEcharts } from '@/hooks/chart/use-echarts'
import type { BmsActivationTrendPoint } from '@/service/api/bms'

const props = withDefaults(
  defineProps<{
    points: BmsActivationTrendPoint[]
  }>(),
  {
    points: () => []
  }
)

function mapXAxis(points: BmsActivationTrendPoint[]) {
  return (points || []).map(item => {
    const date = String(item?.date || '')
    return date.length >= 10 ? date.slice(5) : date
  })
}

function mapSeries(points: BmsActivationTrendPoint[]) {
  return (points || []).map(item => Number(item?.count || 0))
}

const { domRef, updateOptions } = useEcharts(
  () => ({
    tooltip: {
      trigger: 'axis'
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: mapXAxis(props.points)
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series: [
      {
        name: '激活数',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        areaStyle: {
          opacity: 0.1
        },
        data: mapSeries(props.points)
      }
    ]
  }),
  {
    // 该图默认不走 loading 态，避免初始数据已就绪但图表仍显示 Loading。
    onRender: chart => {
      chart.hideLoading()
    },
    onUpdated: chart => {
      chart.hideLoading()
    }
  }
)

watch(
  () => props.points,
  points => {
    updateOptions(opts => {
      opts.xAxis.data = mapXAxis(points)
      opts.series[0].data = mapSeries(points)
      return opts
    })
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div ref="domRef" class="h-280px w-full"></div>
</template>
