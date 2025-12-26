<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NModal, NForm, NFormItem, NInput, NInputNumber, NButton, NSpace } from 'naive-ui'

interface Props {
  visible: boolean
  type: 'add' | 'edit'
  data?: any
}

const props = defineProps<Props>()
const emit = defineEmits(['update:visible', 'submit'])

const formRef = ref()
const formData = ref({
  name: '',
  voltage_rated: 0,
  capacity_rated: 0,
  cell_count: 0,
  nominal_power: 0,
  warranty_months: 0,
  description: ''
})

const rules = {
  name: { required: true, message: '请输入型号名称', trigger: 'blur' },
  voltage_rated: { required: true, type: 'number', message: '请输入额定电压', trigger: 'blur' },
  capacity_rated: { required: true, type: 'number', message: '请输入额定容量', trigger: 'blur' },
  cell_count: { required: true, type: 'number', message: '请输入电芯数量', trigger: 'blur' }
}

const title = computed(() => (props.type === 'add' ? '新增电池型号' : '编辑电池型号'))

watch(
  () => props.visible,
  val => {
    if (val) {
      if (props.type === 'edit' && props.data) {
        formData.value = { ...props.data }
      } else {
        formData.value = {
          name: '',
          voltage_rated: 0,
          capacity_rated: 0,
          cell_count: 0,
          nominal_power: 0,
          warranty_months: 0,
          description: ''
        }
      }
    }
  }
)

const handleClose = () => {
  emit('update:visible', false)
}

const handleSubmit = () => {
  formRef.value?.validate((errors: any) => {
    if (!errors) {
      emit('submit', formData.value)
    }
  })
}
</script>

<template>
  <NModal :show="visible" :title="title" preset="card" style="width: 600px" @close="handleClose">
    <NForm
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="120"
      require-mark-placement="right-hanging"
    >
      <NFormItem label="型号名称" path="name">
        <NInput v-model:value="formData.name" placeholder="请输入型号名称" />
      </NFormItem>
      <NFormItem label="额定电压(V)" path="voltage_rated">
        <NInputNumber v-model:value="formData.voltage_rated" placeholder="请输入额定电压" :precision="2" />
      </NFormItem>
      <NFormItem label="额定容量(Ah)" path="capacity_rated">
        <NInputNumber v-model:value="formData.capacity_rated" placeholder="请输入额定容量" :precision="2" />
      </NFormItem>
      <NFormItem label="电芯数量" path="cell_count">
        <NInputNumber v-model:value="formData.cell_count" placeholder="请输入电芯数量" :precision="0" />
      </NFormItem>
      <NFormItem label="标称功率(W)" path="nominal_power">
        <NInputNumber v-model:value="formData.nominal_power" placeholder="请输入标称功率" :precision="2" />
      </NFormItem>
      <NFormItem label="质保期(月)" path="warranty_months">
        <NInputNumber v-model:value="formData.warranty_months" placeholder="请输入质保期" :precision="0" />
      </NFormItem>
      <NFormItem label="描述" path="description">
        <NInput v-model:value="formData.description" type="textarea" placeholder="请输入描述" />
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
