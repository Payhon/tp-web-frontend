<script setup lang="ts">
import { bt } from '@/views/bms/_shared/i18n'
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
import { useAuthStore } from '@/store/modules/auth'
import pwData from '@/views/management/user/components/pw.json'

interface Props {
  visible: boolean
  type: 'add' | 'edit'
  data?: any
  fixedOrgType?: string // 固定的组织类型（从快捷入口进入时预设）
}

const props = defineProps<Props>()
const emit = defineEmits(['update:visible', 'submit'])
const authStore = useAuthStore()

const formRef = ref()
const parentOptions = ref<any[]>([])
const loading = ref(false)
const currentOrgId = computed(() => String((authStore.userInfo as any)?.org_id || '').trim())
const currentOrgType = computed(() => String((authStore.userInfo as any)?.org_type || '').toUpperCase())
const currentOrgName = computed(() => {
  const info: any = authStore.userInfo || {}
  return String(info.organization || info.org_name || info.orgName || '').trim()
})
const isDealerCreateStoreScene = computed(
  () => props.fixedOrgType === 'STORE' && currentOrgType.value === 'DEALER' && currentOrgId.value !== ''
)
const dealerParentDisplay = computed(() => {
  if (currentOrgName.value) return currentOrgName.value
  return currentOrgId.value ? bt('common.currentOrgWithId', { id: currentOrgId.value }) : bt('auto.s_5b80f24aa3')
})

function orgTypeLabel(type?: string) {
  if (type === 'PACK_FACTORY') return bt('auto.s_5c08c289a8')
  if (type === 'DEALER') return bt('auto.s_9019dc8029')
  if (type === 'STORE') return bt('auto.s_a7da92344c')
  if (type === 'BMS_FACTORY') return 'BMS'
  return type || bt('auto.s_74fe5f9e99')
}

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
    return [{ label: orgTypeLabel(props.fixedOrgType), value: props.fixedOrgType }]
  }
  return Object.keys(OrgTypeLabels).map(value => ({ label: orgTypeLabel(value), value }))
})

const rules = computed(() => {
  const base: any = {
    name: { required: true, message: bt('auto.s_a5bf36a322'), trigger: 'blur' },
    org_type: { required: true, message: bt('auto.s_ece282ac24'), trigger: 'change' }
  }
  if (props.type === 'add') {
    base['account.username'] = { required: true, message: bt('auto.s_822ed79a34'), trigger: 'blur' }
    base['account.password'] = { required: true, message: bt('auto.s_fb23fc9cad'), trigger: 'blur' }
  }
  return base
})

const title = computed(() => {
  const typeLabel = props.fixedOrgType ? orgTypeLabel(props.fixedOrgType) : bt('auto.s_74fe5f9e99')
  return bt(props.type === 'add' ? 'common.addEntity' : 'common.editEntity', { entity: typeLabel })
})

// 加载上级组织选项
const loadParentOptions = async () => {
  if (isDealerCreateStoreScene.value) {
    parentOptions.value = []
    loading.value = false
    return
  }
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
    label: `${node.name} (${orgTypeLabel(node.org_type)})`,
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
        const defaultParentID = isDealerCreateStoreScene.value ? currentOrgId.value : null
        formData.value = {
          name: '',
          org_type: props.fixedOrgType || '',
          parent_id: defaultParentID,
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
      <NDivider title-placement="left">{{ bt('auto.s_9e5ffa068e') }}</NDivider>
      <NGrid cols="24" x-gap="12" y-gap="6">
        <NFormItemGi :span="12" :label="bt('auto.s_b2d081090b')" path="org_type">
          <NSelect
            v-model:value="formData.org_type"
            :options="orgTypeOptions"
            :placeholder="bt('auto.s_ece282ac24')"
            :disabled="type === 'edit' || !!fixedOrgType"
          />
        </NFormItemGi>
        <NFormItemGi :span="12" :label="bt('auto.s_4c12d831e3')" path="name">
          <NInput v-model:value="formData.name" :placeholder="bt('auto.s_a5bf36a322')" />
        </NFormItemGi>

        <NFormItemGi :span="24" :label="bt('auto.s_75432f3ba5')" path="parent_id">
          <NInput v-if="isDealerCreateStoreScene" :value="dealerParentDisplay" disabled />
          <NTreeSelect
            v-else
            v-model:value="formData.parent_id"
            :options="parentOptions"
            :placeholder="bt('auto.s_39dca5a17a')"
            clearable
            :loading="loading"
            :disabled="type === 'edit'"
          />
        </NFormItemGi>

        <NFormItemGi :span="12" :label="bt('auto.s_52409da520')" path="contact_person">
          <NInput v-model:value="formData.contact_person" :placeholder="bt('auto.s_9e3f21b389')" />
        </NFormItemGi>
        <NFormItemGi :span="12" :label="bt('auto.s_09a1f6985a')" path="phone">
          <NInput v-model:value="formData.phone" :placeholder="bt('auto.s_7b540b8035')" />
        </NFormItemGi>
        <NFormItemGi :span="12" :label="bt('auto.s_3bc5e602b2')" path="email">
          <NInput v-model:value="formData.email" :placeholder="bt('auto.s_dbf6d02ab9')" />
        </NFormItemGi>
        <NFormItemGi :span="12" :label="bt('auto.s_5ea217d326')" path="province">
          <NCascader
            v-model:value="formData.addressCascaderValue"
            :options="provinceCityData"
            :placeholder="bt('auto.s_6d121c57a2')"
            clearable
            class="w-300px"
            :show-path="true"
            :filterable="true"
            :filter="filterCascader"
            @update:value="handleAddressChange"
          />
        </NFormItemGi>
        <NFormItemGi :span="24" :label="bt('auto.s_61a0ec8a09')" path="address">
          <NInput v-model:value="formData.address" :placeholder="bt('auto.s_80d6852f33')" />
        </NFormItemGi>
        <NFormItemGi :span="24" :label="bt('auto.s_2432b57515')" path="remark">
          <NInput
            v-model:value="formData.remark"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 3 }"
            :placeholder="bt('auto.s_3cac634296')"
          />
        </NFormItemGi>
      </NGrid>

      <template v-if="type === 'add'">
        <NDivider title-placement="left">{{ bt('auto.s_53cab44e34') }}</NDivider>
        <NGrid cols="24" x-gap="12" y-gap="6">
          <NFormItemGi :span="12" :label="bt('auto.s_819767ada1')" path="account.username">
            <NInput v-model:value="formData.account.username" :placeholder="bt('auto.s_6060566802')" />
          </NFormItemGi>
          <NFormItemGi :span="12" :label="bt('auto.s_a810520460')" path="account.password">
            <NInput
              v-model:value="formData.account.password"
              type="password"
              show-password-on="click"
              :placeholder="bt('auto.s_e39ffe99e9')"
            />
          </NFormItemGi>
        </NGrid>
      </template>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">{{ bt('auto.s_625fb26b4b') }}</NButton>
        <NButton type="primary" @click="handleSubmit">{{ bt('auto.s_38cf16f220') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
