<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { NModal, NForm, NFormItem, NInput, NButton, NSpace, NSelect, NTreeSelect } from 'naive-ui';
import { OrgTypeLabels, getOrgTree } from '@/service/api/bms';

interface Props {
  visible: boolean;
  type: 'add' | 'edit';
  data?: any;
  fixedOrgType?: string; // 固定的组织类型（从快捷入口进入时预设）
}

const props = defineProps<Props>();
const emit = defineEmits(['update:visible', 'submit']);

const formRef = ref();
const parentOptions = ref<any[]>([]);
const loading = ref(false);

const formData = ref({
  name: '',
  org_type: '',
  parent_id: null as string | null,
  contact_person: '',
  phone: '',
  email: '',
  province: '',
  city: '',
  district: '',
  address: '',
  remark: ''
});

const orgTypeOptions = computed(() => {
  // 如果有固定类型，只显示该类型
  if (props.fixedOrgType) {
    return [{ label: OrgTypeLabels[props.fixedOrgType], value: props.fixedOrgType }];
  }
  return Object.entries(OrgTypeLabels).map(([value, label]) => ({ label, value }));
});

const rules = {
  name: { required: true, message: '请输入组织名称', trigger: 'blur' },
  org_type: { required: true, message: '请选择组织类型', trigger: 'change' }
};

const title = computed(() => {
  const typeLabel = props.fixedOrgType ? OrgTypeLabels[props.fixedOrgType] : '组织';
  return props.type === 'add' ? `新增${typeLabel}` : `编辑${typeLabel}`;
});

// 加载上级组织选项
const loadParentOptions = async () => {
  loading.value = true;
  try {
    const res: any = await getOrgTree();
    parentOptions.value = transformTreeData(res?.data || []);
  } catch (e) {
    parentOptions.value = [];
  } finally {
    loading.value = false;
  }
};

// 转换树数据为 NTreeSelect 格式
const transformTreeData = (nodes: any[]): any[] => {
  return nodes.map((node) => ({
    key: node.id,
    label: `${node.name} (${OrgTypeLabels[node.org_type] || node.org_type})`,
    children: node.children?.length ? transformTreeData(node.children) : undefined
  }));
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      loadParentOptions();
      if (props.type === 'edit' && props.data) {
        formData.value = {
          name: props.data.name || '',
          org_type: props.data.org_type || '',
          parent_id: props.data.parent_id || null,
          contact_person: props.data.contact_person || '',
          phone: props.data.phone || '',
          email: props.data.email || '',
          province: props.data.province || '',
          city: props.data.city || '',
          district: props.data.district || '',
          address: props.data.address || '',
          remark: props.data.remark || ''
        };
      } else {
        formData.value = {
          name: '',
          org_type: props.fixedOrgType || '',
          parent_id: null,
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
  <NModal :show="visible" :title="title" preset="card" style="width: 640px" @close="handleClose">
    <NForm
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="100"
      require-mark-placement="right-hanging"
    >
      <NFormItem label="组织类型" path="org_type">
        <NSelect
          v-model:value="formData.org_type"
          :options="orgTypeOptions"
          placeholder="请选择组织类型"
          :disabled="type === 'edit' || !!fixedOrgType"
        />
      </NFormItem>
      <NFormItem label="组织名称" path="name">
        <NInput v-model:value="formData.name" placeholder="请输入组织名称" />
      </NFormItem>
      <NFormItem label="上级组织" path="parent_id">
        <NTreeSelect
          v-model:value="formData.parent_id"
          :options="parentOptions"
          placeholder="请选择上级组织（可选）"
          clearable
          :loading="loading"
          :disabled="type === 'edit'"
        />
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
        <NInput v-model:value="formData.remark" type="textarea" placeholder="请输入备注" />
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
