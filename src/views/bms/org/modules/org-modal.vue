<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NCascader,
  NDivider,
  NForm,
  NFormItemGi,
  NGrid,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTreeSelect
} from 'naive-ui'
import { OrgTypeLabels, getOrgTree } from '@/service/api/bms'
import pwData from '@/views/management/user/components/pw.json'

interface Props {
  visible: boolean
  type: 'add' | 'edit'
  data?: any
  fixedOrgType?: string // 固定的组织类型（从快捷入口进入时预设）
}

const props = defineProps<Props>()
const emit = defineEmits(['update:visible', 'submit'])

const formRef = ref()
const parentOptions = ref<any[]>([])
const loading = ref(false)

// 转换 pw.json 数据为级联选择器格式
const convertPwDataToCascader = (data: any): any[] => {
  return data.map((province: any) => ({
    value: province.name,
    label: province.name,
    children:
      province.children?.map((city: any) => ({
        value: city.name,
        label: city.name,
        children:
          city.children?.map((district: any) => ({
            value: district.name,
            label: district.name
          })) || []
      })) || []
  }))
}

// 省市区数据（三级联动）
const provinceCityData = convertPwDataToCascader(pwData)

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
  addressCascaderValue: null as string[] | null,
  address: '',
  remark: '',
  account: {
    username: '',
    password: ''
  }
})

const orgTypeOptions = computed(() => {
  // 如果有固定类型，只显示该类型
  if (props.fixedOrgType) {
    return [{ label: OrgTypeLabels[props.fixedOrgType], value: props.fixedOrgType }]
  }
  return Object.entries(OrgTypeLabels).map(([value, label]) => ({ label, value }))
})

const rules = computed(() => {
  const base: any = {
    name: { required: true, message: '请输入组织名称', trigger: 'blur' },
    org_type: { required: true, message: '请选择组织类型', trigger: 'change' }
  }
  if (props.type === 'add') {
    base['account.username'] = { required: true, message: '请输入用户名（手机号/邮箱）', trigger: 'blur' }
    base['account.password'] = { required: true, message: '请输入密码（至少6位）', trigger: 'blur' }
  }
  return base
})

const title = computed(() => {
  const typeLabel = props.fixedOrgType ? OrgTypeLabels[props.fixedOrgType] : '组织'
  return props.type === 'add' ? `新增${typeLabel}` : `编辑${typeLabel}`
})

// 加载上级组织选项
const loadParentOptions = async () => {
  loading.value = true
  try {
    const res: any = await getOrgTree()
    parentOptions.value = transformTreeData(res?.data || [])
  } catch {
    parentOptions.value = []
  } finally {
    loading.value = false
  }
}

// 转换树数据为 NTreeSelect 格式
const transformTreeData = (nodes: any[]): any[] => {
  return nodes.map(node => ({
    key: node.id,
    label: `${node.name} (${OrgTypeLabels[node.org_type] || node.org_type})`,
    children: node.children?.length ? transformTreeData(node.children) : undefined
  }))
}

// 处理省市区选择变化，将选择的值映射到对应的字段
const handleAddressChange = (value: string[] | null) => {
  formData.value.addressCascaderValue = value
  if (value && value.length >= 3) {
    formData.value.province = value[0]
    formData.value.city = value[1]
    formData.value.district = value[2]
  } else {
    formData.value.province = ''
    formData.value.city = ''
    formData.value.district = ''
  }
}

// 级联选择器搜索过滤函数
const filterCascader = (pattern: string, option: any) => {
  return option.label.toLowerCase().includes(pattern.toLowerCase())
}

watch(
  () => props.visible,
  val => {
    if (val) {
      loadParentOptions()
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
          addressCascaderValue:
            props.data.province && props.data.city && props.data.district
              ? [props.data.province, props.data.city, props.data.district]
              : null,
          address: props.data.address || '',
          remark: props.data.remark || '',
          account: {
            username: '',
            password: ''
          }
        }
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
          addressCascaderValue: null,
          address: '',
          remark: '',
          account: {
            username: '',
            password: ''
          }
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
      const payload: any = { ...formData.value }
      delete payload.addressCascaderValue
      if (props.type !== 'add') {
        delete payload.account
      }
      emit('submit', payload)
    }
  })
}
</script>

<template>
  <NModal :show="visible" :title="title" preset="card" style="width: 640px" @close="handleClose">
    <NForm
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="90"
      require-mark-placement="right-hanging"
      size="small"
    >
      <NDivider title-placement="left">基本信息</NDivider>
      <NGrid cols="24" x-gap="12" y-gap="6">
        <NFormItemGi :span="12" label="组织类型" path="org_type">
          <NSelect
            v-model:value="formData.org_type"
            :options="orgTypeOptions"
            placeholder="请选择组织类型"
            :disabled="type === 'edit' || !!fixedOrgType"
          />
        </NFormItemGi>
        <NFormItemGi :span="12" label="组织名称" path="name">
          <NInput v-model:value="formData.name" placeholder="请输入组织名称" />
        </NFormItemGi>

        <NFormItemGi :span="24" label="上级组织" path="parent_id">
          <NTreeSelect
            v-model:value="formData.parent_id"
            :options="parentOptions"
            placeholder="请选择上级组织（可选）"
            clearable
            :loading="loading"
            :disabled="type === 'edit'"
          />
        </NFormItemGi>

        <NFormItemGi :span="12" label="联系人" path="contact_person">
          <NInput v-model:value="formData.contact_person" placeholder="请输入联系人" />
        </NFormItemGi>
        <NFormItemGi :span="12" label="联系电话" path="phone">
          <NInput v-model:value="formData.phone" placeholder="请输入联系电话" />
        </NFormItemGi>
        <NFormItemGi :span="12" label="邮箱" path="email">
          <NInput v-model:value="formData.email" placeholder="请输入邮箱" />
        </NFormItemGi>
        <NFormItemGi :span="12" :label="'省市区'" path="province">
          <NCascader
            v-model:value="formData.addressCascaderValue"
            :options="provinceCityData"
            placeholder="请选择省市区（三级联动）"
            clearable
            class="w-300px"
            :show-path="true"
            :filterable="true"
            :filter="filterCascader"
            @update:value="handleAddressChange"
          />
        </NFormItemGi>
        <NFormItemGi :span="24" label="详细地址" path="address">
          <NInput v-model:value="formData.address" placeholder="请输入详细地址" />
        </NFormItemGi>
        <NFormItemGi :span="24" label="备注" path="remark">
          <NInput
            v-model:value="formData.remark"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 3 }"
            placeholder="请输入备注"
          />
        </NFormItemGi>
      </NGrid>

      <template v-if="type === 'add'">
        <NDivider title-placement="left">账号信息</NDivider>
        <NGrid cols="24" x-gap="12" y-gap="6">
          <NFormItemGi :span="12" label="用户名" path="account.username">
            <NInput v-model:value="formData.account.username" placeholder="手机号/邮箱" />
          </NFormItemGi>
          <NFormItemGi :span="12" label="密码" path="account.password">
            <NInput
              v-model:value="formData.account.password"
              type="password"
              show-password-on="click"
              placeholder="请输入密码"
            />
          </NFormItemGi>
        </NGrid>
      </template>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">取消</NButton>
        <NButton type="primary" @click="handleSubmit">确定</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
