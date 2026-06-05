<script setup lang="ts">
import { bt } from '@/views/bms/_shared/i18n'
import { ref, watch, computed } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NSpace } from 'naive-ui'

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
  contact_person: '',
  phone: '',
  email: '',
  province: '',
  city: '',
  district: '',
  address: '',
  remark: ''
})

const rules = {
  name: { required: true, message: bt('auto.s_821901d3ee'), trigger: 'blur' },
  contact_person: { required: true, message: bt('auto.s_9e3f21b389'), trigger: 'blur' },
  phone: { required: true, message: bt('auto.s_7b540b8035'), trigger: 'blur' }
}

const title = computed(() => (props.type === 'add' ? bt('auto.s_28ce8259ee') : bt('auto.s_b196ada7f3')))

watch(
  () => props.visible,
  val => {
    if (val) {
      if (props.type === 'edit' && props.data) {
        formData.value = { ...props.data }
      } else {
        formData.value = {
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          province: '',
          city: '',
          district: '',
          address: '',
          remark: ''
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
      label-width="100"
      require-mark-placement="right-hanging"
    >
      <NFormItem :label="bt('auto.s_fe080071ea')" path="name">
        <NInput v-model:value="formData.name" :placeholder="bt('auto.s_821901d3ee')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_52409da520')" path="contact_person">
        <NInput v-model:value="formData.contact_person" :placeholder="bt('auto.s_9e3f21b389')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_09a1f6985a')" path="phone">
        <NInput v-model:value="formData.phone" :placeholder="bt('auto.s_7b540b8035')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_3bc5e602b2')" path="email">
        <NInput v-model:value="formData.email" :placeholder="bt('auto.s_dbf6d02ab9')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_d7009d07f0')" path="province">
        <NInput v-model:value="formData.province" :placeholder="bt('auto.s_9257d8e3e4')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_f7d29dfae0')" path="city">
        <NInput v-model:value="formData.city" :placeholder="bt('auto.s_60d56130c5')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_569c49687f')" path="district">
        <NInput v-model:value="formData.district" :placeholder="bt('auto.s_8fe4dbbd1f')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_61a0ec8a09')" path="address">
        <NInput v-model:value="formData.address" :placeholder="bt('auto.s_80d6852f33')" />
      </NFormItem>
      <NFormItem :label="bt('auto.s_2432b57515')" path="remark">
        <NInput v-model:value="formData.remark" type="textarea" :placeholder="bt('auto.s_3cac634296')" />
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
