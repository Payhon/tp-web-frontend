<script setup lang="ts">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NInput, NInputNumber, NModal, NSelect, NSpace, useMessage } from 'naive-ui'
import { getDeviceConfigList } from '@/service/api/device'

interface Props {
  visible: boolean
  type: 'add' | 'edit'
  data?: any
  entityName?: string
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
  name: { required: true, message: bt('auto.s_72b407497e'), trigger: 'blur' },
  device_config_id: { required: true, message: bt('auto.s_844f266270'), trigger: ['blur', 'change'] },
  voltage_rated: { required: true, type: 'number', message: bt('auto.s_3bd0e715c1'), trigger: 'blur' },
  capacity_rated: { required: true, type: 'number', message: bt('auto.s_736011ec04'), trigger: 'blur' },
  cell_count: { required: true, type: 'number', message: bt('auto.s_e44b7e0945'), trigger: 'blur' }
}

const entityName = computed(() => props.entityName || bt('auto.s_ca62d89383'))
const title = computed(() => bt(props.type === 'add' ? 'common.addEntity' : 'common.editEntity', { entity: entityName.value }))

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
    message.error(e?.message || bt('auto.s_5e5bc81529'))
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
      <NFormItem :label="bt('auto.s_ad635a9565')" path="name">
        <NInput v-model:value="formData.name" :placeholder="bt('auto.s_72b407497e')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_ab13e1f9d8')" path="device_config_id">
        <NSelect
          v-model:value="formData.device_config_id"
          filterable
          :options="deviceConfigOptions"
          :placeholder="bt('auto.s_7522eafe6e')"
        />
      </NFormItem>
      <NFormItem :label="bt('auto.s_23218d96f8')" path="voltage_rated">
        <NInputNumber v-model:value="formData.voltage_rated" :placeholder="bt('auto.s_3bd0e715c1')" :precision="2" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_f8862f498a')" path="capacity_rated">
        <NInputNumber v-model:value="formData.capacity_rated" :placeholder="bt('auto.s_736011ec04')" :precision="2" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_9001698fc1')" path="cell_count">
        <NInputNumber v-model:value="formData.cell_count" :placeholder="bt('auto.s_e44b7e0945')" :precision="0" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_46d9f2eb39')" path="nominal_power">
        <NInputNumber v-model:value="formData.nominal_power" :placeholder="bt('auto.s_0f3c9af363')" :precision="2" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_b410dd9928')" path="warranty_months">
        <NInputNumber v-model:value="formData.warranty_months" :placeholder="bt('auto.s_2d1d3f1f13')" :precision="0" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_3bdd08adab')" path="description">
        <NInput v-model:value="formData.description" type="textarea" :placeholder="bt('auto.s_11956a43e2')" />
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
