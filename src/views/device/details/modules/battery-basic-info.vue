<script setup lang="tsx">
import { computed, onMounted, ref, watch } from 'vue'
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpin, NTag } from 'naive-ui'
import { getAppBatteryDetail } from '@/service/api/bms'
import { $t } from '@/locales'

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
  if (value === 1) return $t('bms.common.bluetooth')
  if (value === 2) return '4G'
  if (value === 3) return $t('bms.common.bluetooth4g')
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
          <NDescriptionsItem :label="$t('bms.basicInfo.itemUuid')">
            {{ displayText(battery.item_uuid) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.batchNumber')">
            {{ displayText(battery.batch_number) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.productSpec')">
            {{ displayText(battery.product_spec) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.orderNumber')">
            {{ displayText(battery.order_number) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.commType')">
            <NTag size="small" type="info">
              {{ commTypeLabel }}
            </NTag>
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.bmsModel')">
            {{ displayText(battery.battery_model_name) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.bleMac')">
            {{ displayText(battery.ble_mac) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.commChipId')">
            {{ displayText(battery.comm_chip_id) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.productionDate')">
            {{ displayText(battery.production_date) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.warrantyExpireDate')">
            {{ displayText(battery.warranty_expire_date) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('bms.basicInfo.remark')" :span="2">
            {{ displayText(battery.remark) }}
          </NDescriptionsItem>
        </NDescriptions>
      </template>
      <NEmpty v-else :description="$t('bms.basicInfo.empty')" />
    </NCard>
  </NSpin>
</template>
