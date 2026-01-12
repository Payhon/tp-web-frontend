<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NDatePicker, NForm, NFormItem, NInput, NModal, NSelect, NSpace } from 'naive-ui'

interface Props {
  visible: boolean
  modelOptions: Array<{ label: string; value: string }>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'submit', data: any): void
}>()

const formRef = ref()
const formData = ref({
  item_uuid: '',
  batch_number: '',
  product_spec: '',
  order_number: '',
  battery_model_id: null as string | null,
  ble_mac: '',
  comm_chip_id: '',
  production_date: null as number | null,
  warranty_expire_date: null as number | null,
  remark: ''
})

const rules = {
  item_uuid: { required: true, message: '请输入电池序列号ID（设备编号）', trigger: 'blur' },
  batch_number: { required: true, message: '请输入批号', trigger: 'blur' },
  product_spec: { required: true, message: '请输入产品规格', trigger: 'blur' },
  order_number: { required: true, message: '请输入订单编号', trigger: 'blur' }
}

const title = computed(() => '添加单个电池')

watch(
  () => props.visible,
  v => {
    if (v) {
      formData.value = {
        item_uuid: '',
        batch_number: '',
        product_spec: '',
        order_number: '',
        battery_model_id: null,
        ble_mac: '',
        comm_chip_id: '',
        production_date: null,
        warranty_expire_date: null,
        remark: ''
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
      <NFormItem label="电池序列号ID" path="item_uuid">
        <NInput v-model:value="formData.item_uuid" placeholder="对应 devices.device_number" />
      </NFormItem>
      <NFormItem label="批号" path="batch_number">
        <NInput v-model:value="formData.batch_number" placeholder="请输入批号" />
      </NFormItem>
      <NFormItem label="产品规格" path="product_spec">
        <NInput v-model:value="formData.product_spec" maxlength="32" show-count placeholder="必填（最多32个字符）" />
      </NFormItem>
      <NFormItem label="订单编号" path="order_number">
        <NInput v-model:value="formData.order_number" maxlength="32" show-count placeholder="必填（最多32个字符）" />
      </NFormItem>
      <NFormItem label="电池型号" path="battery_model_id">
        <NSelect
          v-model:value="formData.battery_model_id"
          filterable
          clearable
          :options="props.modelOptions"
          placeholder="按名称选择（可选）"
        />
      </NFormItem>
      <NFormItem label="蓝牙Mac" path="ble_mac">
        <NInput v-model:value="formData.ble_mac" placeholder="可选，如 AA:BB:CC:DD:EE:FF" />
      </NFormItem>
      <NFormItem label="4G通讯卡ID" path="comm_chip_id">
        <NInput v-model:value="formData.comm_chip_id" placeholder="可选" />
      </NFormItem>
      <NFormItem label="出厂日期" path="production_date">
        <NDatePicker v-model:value="formData.production_date" type="date" clearable />
      </NFormItem>
      <NFormItem label="质保到期" path="warranty_expire_date">
        <NDatePicker v-model:value="formData.warranty_expire_date" type="date" clearable />
      </NFormItem>
      <NFormItem label="备注" path="remark">
        <NInput v-model:value="formData.remark" placeholder="可选" />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">取消</NButton>
        <NButton type="primary" @click="handleSubmit">确定</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
