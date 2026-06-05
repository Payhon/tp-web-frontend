<script setup lang="ts">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref, watch } from 'vue'
import { NButton, NDatePicker, NForm, NFormItem, NInput, NModal, NSelect, NSpace } from 'naive-ui'

interface Props {
  visible: boolean
  mode?: 'add' | 'edit'
  editData?: Record<string, any> | null
  bmsModelOptions: Array<{ label: string; value: string }>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
  submit: [data: any]
}>()

const formRef = ref()
const formData = ref({
  item_uuid: '',
  batch_number: '',
  product_spec: '',
  order_number: '',
  bms_comm_type: 1 as 1 | 2 | 3,
  battery_model_id: null as string | null,
  ble_mac: '',
  comm_chip_id: '',
  production_date: null as number | null,
  warranty_expire_date: null as number | null,
  remark: ''
})

const commTypeOptions = [
  { label: bt('auto.s_0a4e486218'), value: 1 },
  { label: '4G', value: 2 },
  { label: bt('auto.s_59b8ad21d6'), value: 3 }
]

const rules = {
  item_uuid: { required: true, message: bt('auto.s_30d8566e58'), trigger: 'blur' },
  batch_number: { required: true, message: bt('auto.s_94b377eb78'), trigger: 'blur' },
  product_spec: { required: true, message: bt('auto.s_392b2bd029'), trigger: 'blur' },
  order_number: { required: true, message: bt('auto.s_ca1eab48bd'), trigger: 'blur' },
  bms_comm_type: { required: true, type: 'number', message: bt('auto.s_b1fb139a5d'), trigger: 'change' }
}

const title = computed(() => (props.mode === 'edit' ? bt('auto.s_a14612b388') : bt('auto.s_1ee52a5845')))

function buildEmptyForm() {
  return {
    item_uuid: '',
    batch_number: '',
    product_spec: '',
    order_number: '',
    bms_comm_type: 1 as 1 | 2 | 3,
    battery_model_id: null as string | null,
    ble_mac: '',
    comm_chip_id: '',
    production_date: null as number | null,
    warranty_expire_date: null as number | null,
    remark: ''
  }
}

function normalizeDateValue(value: unknown) {
  if (!value) return null
  const ts = new Date(String(value)).getTime()
  return Number.isFinite(ts) ? ts : null
}

watch(
  () => props.visible,
  v => {
    if (v) {
      if (props.mode === 'edit' && props.editData) {
        formData.value = {
          item_uuid: String(props.editData.item_uuid || props.editData.device_number || '').trim(),
          batch_number: String(props.editData.batch_number || '').trim(),
          product_spec: String(props.editData.product_spec || '').trim(),
          order_number: String(props.editData.order_number || '').trim(),
          bms_comm_type: Number(props.editData.bms_comm_type || 1) as 1 | 2 | 3,
          battery_model_id: props.editData.battery_model_id || null,
          ble_mac: String(props.editData.ble_mac || '').trim(),
          comm_chip_id: String(props.editData.comm_chip_id || '').trim(),
          production_date: normalizeDateValue(props.editData.production_date),
          warranty_expire_date: normalizeDateValue(props.editData.warranty_expire_date),
          remark: String(props.editData.remark || '').trim()
        }
      } else {
        formData.value = buildEmptyForm()
      }
    }
  }
)

function handleClose() {
  emit('update:visible', false)
}

function handleSubmit() {
  formRef.value?.validate((errors: any) => {
    if (errors) return
    emit('submit', { ...formData.value })
  })
}
</script>

<template>
  <NModal :show="visible" preset="card" :title="title" style="width: 640px" @close="handleClose">
    <NForm
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="120"
      require-mark-placement="right-hanging"
    >
      <NFormItem :label="bt('auto.s_c5ee4fd0f0')" path="item_uuid">
        <NInput v-model:value="formData.item_uuid" :placeholder="bt('auto.s_f5ffa37996')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_b09f4ca805')" path="batch_number">
        <NInput v-model:value="formData.batch_number" :placeholder="bt('auto.s_94b377eb78')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_2b4784210d')" path="product_spec">
        <NInput v-model:value="formData.product_spec" maxlength="32" show-count :placeholder="bt('auto.s_dc92a30718')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_3e86572ee7')" path="order_number">
        <NInput v-model:value="formData.order_number" maxlength="32" show-count :placeholder="bt('auto.s_dc92a30718')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_443c5bff99')" path="bms_comm_type">
        <NSelect v-model:value="formData.bms_comm_type" :options="commTypeOptions" :placeholder="bt('auto.s_708c9d6d2a')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_c44c1028d5')" path="battery_model_id">
        <NSelect
          v-model:value="formData.battery_model_id"
          filterable
          clearable
          :options="props.bmsModelOptions"
          :placeholder="bt('auto.s_14b83844a8')"
        />
      </NFormItem>
      <NFormItem :label="bt('auto.s_4429e85280')" path="ble_mac">
        <NInput v-model:value="formData.ble_mac" :placeholder="bt('auto.s_d85b5a85a4')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_ab5a4e3666')" path="comm_chip_id">
        <NInput v-model:value="formData.comm_chip_id" :placeholder="bt('auto.s_c20cba8992')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_fbe2fcd983')" path="production_date">
        <NDatePicker v-model:value="formData.production_date" type="date" clearable />
      </NFormItem>
      <NFormItem :label="bt('auto.s_f65c27925f')" path="warranty_expire_date">
        <NDatePicker v-model:value="formData.warranty_expire_date" type="date" clearable />
      </NFormItem>
      <NFormItem :label="bt('auto.s_2432b57515')" path="remark">
        <NInput v-model:value="formData.remark" :placeholder="bt('auto.s_c20cba8992')" />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">{{ bt('auto.s_625fb26b4b') }}</NButton>
        <NButton type="primary" @click="handleSubmit">{{ bt('auto.s_38cf16f220') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
