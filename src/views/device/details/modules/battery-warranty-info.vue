<script setup lang="tsx">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSpace,
  NSpin,
  NTag,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  getBatteryWarranty,
  updateBatteryWarranty,
  type BatteryWarrantyInfo,
  type BatteryWarrantyUpdateReq,
  type BatteryWarrantyUser
} from '@/service/api/bms'
import { $t } from '@/locales'
import { formatDateTime } from '@/utils/common/datetime'

const props = defineProps<{
  id: string
}>()

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const editVisible = ref(false)
const warranty = ref<BatteryWarrantyInfo | null>(null)
const form = reactive({
  warranty_months: null as number | null,
  warranty_start_date: '',
  warranty_expire_date: ''
})

function displayText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || '--'
}

function userDisplayName(row: BatteryWarrantyUser) {
  return row.contact_name || row.user_name || row.username || row.user_id
}

const columns = computed<DataTableColumns<BatteryWarrantyUser>>(() => [
  {
    key: 'user_name',
    title: $t('bms.warranty.userName'),
    minWidth: 160,
    render: row => userDisplayName(row)
  },
  {
    key: 'contact_phone',
    title: $t('bms.warranty.contactPhone'),
    minWidth: 140,
    render: row => row.contact_phone || row.user_phone || '--'
  },
  {
    key: 'is_owner',
    title: $t('bms.warranty.owner'),
    width: 100,
    render: row => (
      <NTag size="small" type={row.is_owner ? 'success' : 'default'}>
        {row.is_owner ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no')}
      </NTag>
    )
  },
  {
    key: 'binding_time',
    title: $t('bms.warranty.bindingTime'),
    minWidth: 180,
    render: row => formatDateTime(row.binding_time) || '--'
  }
])

async function loadWarranty() {
  if (!props.id) {
    warranty.value = null
    return
  }
  loading.value = true
  try {
    const res: any = await getBatteryWarranty(props.id)
    warranty.value = (res?.data || null) as BatteryWarrantyInfo | null
  } catch (error: any) {
    warranty.value = null
    message.error(error?.message || $t('bms.warranty.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openEdit() {
  form.warranty_months = warranty.value?.warranty_months ?? null
  form.warranty_start_date = warranty.value?.warranty_start_date || ''
  form.warranty_expire_date = warranty.value?.warranty_expire_date || ''
  editVisible.value = true
}

async function saveWarranty() {
  if (!props.id) return
  saving.value = true
  try {
    const payload: BatteryWarrantyUpdateReq = {
      warranty_start_date: form.warranty_start_date,
      warranty_expire_date: form.warranty_expire_date
    }
    if (form.warranty_months !== null && form.warranty_months !== undefined) {
      payload.warranty_months = form.warranty_months
    }
    const res: any = await updateBatteryWarranty(props.id, payload)
    warranty.value = (res?.data || null) as BatteryWarrantyInfo | null
    editVisible.value = false
    message.success($t('bms.warranty.saveSuccess'))
  } catch (error: any) {
    message.error(error?.message || $t('bms.warranty.saveFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(loadWarranty)

watch(
  () => props.id,
  () => {
    loadWarranty()
  }
)
</script>

<template>
  <NSpin :show="loading">
    <NSpace vertical :size="16">
      <NCard :bordered="false" size="small" :title="$t('bms.warranty.batteryInfo')">
        <template #header-extra>
          <NButton size="small" type="primary" :disabled="!warranty" @click="openEdit">
            {{ $t('bms.warranty.edit') }}
          </NButton>
        </template>

        <template v-if="warranty">
          <NDescriptions label-placement="left" :column="2" bordered size="small">
            <NDescriptionsItem :label="$t('bms.warranty.deviceNumber')">
              {{ displayText(warranty.device_number) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.batterySerial')">
              {{ displayText(warranty.battery_serial) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.bmsModel')">
              {{ displayText(warranty.battery_model_name) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.activationDate')">
              {{ displayText(warranty.activation_date) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.warrantyStartDate')">
              {{ displayText(warranty.warranty_start_date) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.warrantyExpireDate')">
              {{ displayText(warranty.warranty_expire_date) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.warrantyMonths')">
              {{ displayText(warranty.warranty_months) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.manualOverride')">
              <NTag size="small" :type="warranty.warranty_manual_override ? 'warning' : 'success'">
                {{ warranty.warranty_manual_override ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no') }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.updatedAt')">
              {{ formatDateTime(warranty.warranty_updated_at) || '--' }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('bms.warranty.updatedBy')">
              {{ displayText(warranty.warranty_updated_by) }}
            </NDescriptionsItem>
          </NDescriptions>
        </template>
        <NEmpty v-else :description="$t('bms.basicInfo.empty')" />
      </NCard>

      <NCard :bordered="false" size="small" :title="$t('bms.warranty.userInfo')">
        <NDataTable
          v-if="warranty?.users?.length"
          :columns="columns"
          :data="warranty.users"
          :bordered="false"
          size="small"
          :pagination="false"
        />
        <NEmpty v-else :description="$t('bms.warranty.emptyUsers')" />
      </NCard>
    </NSpace>
  </NSpin>

  <NModal
    v-model:show="editVisible"
    preset="card"
    :title="$t('bms.warranty.edit')"
    style="width: 520px; max-width: 96vw"
  >
    <NForm label-placement="left" label-width="140">
      <NFormItem :label="$t('bms.warranty.warrantyMonths')">
        <NInputNumber v-model:value="form.warranty_months" :min="0" :max="600" clearable class="w-full" />
      </NFormItem>
      <NFormItem :label="$t('bms.warranty.warrantyStartDate')">
        <NInput v-model:value="form.warranty_start_date" placeholder="YYYY-MM-DD" clearable />
      </NFormItem>
      <NFormItem :label="$t('bms.warranty.warrantyExpireDate')">
        <NInput v-model:value="form.warranty_expire_date" placeholder="YYYY-MM-DD" clearable />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="editVisible = false">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="saveWarranty">{{ $t('common.save') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
