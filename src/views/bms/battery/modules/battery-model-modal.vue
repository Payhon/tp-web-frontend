<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NInput, NInputNumber, NModal, NSelect, NSpace, useMessage } from 'naive-ui'
import { getDeviceConfigList } from '@/service/api/device'

interface Props {
  visible: boolean
  type: 'add' | 'edit'
  data?: any
}

const props = defineProps<Props>()
const emit = defineEmits(['update:visible', 'submit'])

const message = useMessage()
const formRef = ref()
const deviceConfigOptions = ref<Array<{ label: string; value: string }>>([])
const formData = ref({
  name: '',
  device_config_id: '',
  voltage_rated: 0,
  capacity_rated: 0,
  cell_count: 0,
  nominal_power: 0,
  warranty_months: 0,
  description: ''
})

const rules = {
  name: { required: true, message: '请输入型号名称', trigger: 'blur' },
  device_config_id: { required: true, message: '请选择关联设备模板', trigger: ['blur', 'change'] },
  voltage_rated: { required: true, type: 'number', message: '请输入额定电压', trigger: 'blur' },
  capacity_rated: { required: true, type: 'number', message: '请输入额定容量', trigger: 'blur' },
  cell_count: { required: true, type: 'number', message: '请输入电芯串数', trigger: 'blur' }
}

const title = computed(() => (props.type === 'add' ? '新增电池型号' : '编辑电池型号'))

async function fetchDeviceConfigs() {
  try {
    const res: any = await getDeviceConfigList({ page: 1, page_size: 1000 })
    const list = (res?.data?.list || res?.data?.data || res?.data || []) as any[]
    deviceConfigOptions.value = list.map((i: any) => ({
      label: i.name || i.device_config_name || i.id,
      value: i.id
    }))
  } catch (e: any) {
    deviceConfigOptions.value = []
    message.error(e?.message || '获取设备模板列表失败')
  }
}

onMounted(() => {
  fetchDeviceConfigs()
})

watch(
  () => props.visible,
  val => {
    if (val) {
      if (props.type === 'edit' && props.data) {
        formData.value = { ...props.data }
      } else {
        formData.value = {
          name: '',
          device_config_id: '',
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
      <NFormItem label="关联设备模板" path="device_config_id">
        <NSelect
          v-model:value="formData.device_config_id"
          filterable
          :options="deviceConfigOptions"
          placeholder="请选择设备模板"
        />
      </NFormItem>
      <NFormItem label="额定电压(V)" path="voltage_rated">
        <NInputNumber v-model:value="formData.voltage_rated" placeholder="请输入额定电压" :precision="2" />
      </NFormItem>
      <NFormItem label="额定容量(Ah)" path="capacity_rated">
        <NInputNumber v-model:value="formData.capacity_rated" placeholder="请输入额定容量" :precision="2" />
      </NFormItem>
      <NFormItem label="电芯串数" path="cell_count">
        <NInputNumber v-model:value="formData.cell_count" placeholder="请输入电芯串数" :precision="0" />
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
