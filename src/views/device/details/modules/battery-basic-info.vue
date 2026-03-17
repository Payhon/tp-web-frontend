<script setup lang="tsx">
import { computed, onMounted, ref, watch } from 'vue'
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpin, NTag } from 'naive-ui'
import { getAppBatteryDetail } from '@/service/api/bms'

const props = defineProps<{
  id: string
}>()

type BatteryBasicInfo = {
  item_uuid?: string | null
  batch_number?: string | null
  product_spec?: string | null
  order_number?: string | null
  bms_comm_type?: number | null
  battery_model_name?: string | null
  ble_mac?: string | null
  comm_chip_id?: string | null
  production_date?: string | null
  warranty_expire_date?: string | null
  remark?: string | null
}

const loading = ref(false)
const battery = ref<BatteryBasicInfo | null>(null)

const commTypeLabel = computed(() => {
  const value = battery.value?.bms_comm_type
  if (value === 1) return '蓝牙'
  if (value === 2) return '4G'
  if (value === 3) return '蓝牙+4G'
  return '--'
})

function displayText(value: string | null | undefined) {
  const text = String(value || '').trim()
  return text || '--'
}

async function loadBatteryBasicInfo() {
  if (!props.id) {
    battery.value = null
    return
  }
  loading.value = true
  try {
    const res: any = await getAppBatteryDetail(props.id)
    battery.value = (res?.data || null) as BatteryBasicInfo | null
  } finally {
    loading.value = false
  }
}

onMounted(loadBatteryBasicInfo)

watch(
  () => props.id,
  () => {
    loadBatteryBasicInfo()
  }
)
</script>

<template>
  <NSpin :show="loading">
    <NCard :bordered="false" size="small">
      <template v-if="battery">
        <NDescriptions label-placement="left" :column="2" bordered size="small">
          <NDescriptionsItem label="电池序列号ID">
            {{ displayText(battery.item_uuid) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="批号">
            {{ displayText(battery.batch_number) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="产品规格">
            {{ displayText(battery.product_spec) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="订单编号">
            {{ displayText(battery.order_number) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="BMS通讯类型">
            <NTag size="small" type="info">
              {{ commTypeLabel }}
            </NTag>
          </NDescriptionsItem>
          <NDescriptionsItem label="BMS型号">
            {{ displayText(battery.battery_model_name) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="蓝牙Mac">
            {{ displayText(battery.ble_mac) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="4G通讯卡ID">
            {{ displayText(battery.comm_chip_id) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="出厂日期">
            {{ displayText(battery.production_date) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="质保到期">
            {{ displayText(battery.warranty_expire_date) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="备注" :span="2">
            {{ displayText(battery.remark) }}
          </NDescriptionsItem>
        </NDescriptions>
      </template>
      <NEmpty v-else description="暂无基本信息" />
    </NCard>
  </NSpin>
</template>
