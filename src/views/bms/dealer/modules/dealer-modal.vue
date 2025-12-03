<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { NModal, NForm, NFormItem, NInput, NButton, NSpace } from 'naive-ui';

interface Props {
  visible: boolean;
  type: 'add' | 'edit';
  data?: any;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:visible', 'submit']);

const formRef = ref();
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
});

const rules = {
  name: { required: true, message: '请输入经销商名称', trigger: 'blur' },
  contact_person: { required: true, message: '请输入联系人', trigger: 'blur' },
  phone: { required: true, message: '请输入联系电话', trigger: 'blur' }
};

const title = computed(() => (props.type === 'add' ? '新增经销商' : '编辑经销商'));

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.type === 'edit' && props.data) {
        formData.value = { ...props.data };
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
        };
      }
    }
  }
);

const handleClose = () => {
  emit('update:visible', false);
};

const handleSubmit = () => {
  formRef.value?.validate((errors: any) => {
    if (!errors) {
      emit('submit', formData.value);
    }
  });
};
</script>

<template>
  <NModal
    :show="visible"
    :title="title"
    preset="card"
    style="width: 600px"
    @close="handleClose"
  >
    <NForm
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="100"
      require-mark-placement="right-hanging"
    >
      <NFormItem label="经销商名称" path="name">
        <NInput v-model:value="formData.name" placeholder="请输入经销商名称" />
      </NFormItem>
      <NFormItem label="联系人" path="contact_person">
        <NInput v-model:value="formData.contact_person" placeholder="请输入联系人" />
      </NFormItem>
      <NFormItem label="联系电话" path="phone">
        <NInput v-model:value="formData.phone" placeholder="请输入联系电话" />
      </NFormItem>
      <NFormItem label="邮箱" path="email">
        <NInput v-model:value="formData.email" placeholder="请输入邮箱" />
      </NFormItem>
      <NFormItem label="省份" path="province">
        <NInput v-model:value="formData.province" placeholder="请输入省份" />
      </NFormItem>
      <NFormItem label="城市" path="city">
        <NInput v-model:value="formData.city" placeholder="请输入城市" />
      </NFormItem>
      <NFormItem label="区县" path="district">
        <NInput v-model:value="formData.district" placeholder="请输入区县" />
      </NFormItem>
      <NFormItem label="详细地址" path="address">
        <NInput v-model:value="formData.address" placeholder="请输入详细地址" />
      </NFormItem>
      <NFormItem label="备注" path="remark">
        <NInput
          v-model:value="formData.remark"
          type="textarea"
          placeholder="请输入备注"
        />
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
