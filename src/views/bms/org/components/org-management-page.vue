<script setup lang="tsx">
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  useMessage
} from 'naive-ui'
import { createOrg, deleteOrg, getOrgList, OrgTypeLabels, resetOrgAccountPassword, updateOrg } from '@/service/api/bms'
import type { SearchConfig } from '@/components/data-table-page/index.vue'
import OrgModal from '../modules/org-modal.vue'

interface Props {
  fixedOrgType?: 'PACK_FACTORY' | 'DEALER' | 'STORE'
}

const props = defineProps<Props>()

const message = useMessage()
const tablePageRef = ref()
const modalVisible = ref(false)
const modalType = ref<'add' | 'edit'>('add')
const currentData = ref(null)
const resetPwdVisible = ref(false)
const resetPwdRow = ref<any>(null)
const resetPwdFormRef = ref()
const resetPwdForm = ref({
  password: '',
  confirmPassword: ''
})

const hideTabs = computed(() => Boolean(props.fixedOrgType))

const activeTab = ref<string>(props.fixedOrgType || 'PACK_FACTORY')

watch(
  () => props.fixedOrgType,
  value => {
    if (value) {
      activeTab.value = value
    }
  },
  { immediate: true }
)

const pageTitle = computed(() => {
  if (props.fixedOrgType) {
    return `${OrgTypeLabels[props.fixedOrgType]}管理`
  }
  return '组织管理'
})

const tabOptions = [
  { key: 'PACK_FACTORY', label: 'PACK厂家' },
  { key: 'DEALER', label: '经销商' },
  { key: 'STORE', label: '门店' }
]

const searchConfigs = ref<SearchConfig[]>([
  {
    key: 'name',
    label: '组织名称',
    type: 'input',
    placeholder: '请输入组织名称'
  },
  {
    key: 'phone',
    label: '联系电话',
    type: 'input',
    placeholder: '请输入联系电话'
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { label: '正常', value: 'N' },
      { label: '禁用', value: 'F' }
    ]
  }
])

const columns = ref([
  {
    key: 'name',
    title: '组织名称',
    minWidth: 150
  },
  {
    key: 'org_type',
    title: '类型',
    minWidth: 100,
    render: (row: any) => {
      return <NTag type="info">{OrgTypeLabels[row.org_type] || row.org_type}</NTag>
    }
  },
  {
    key: 'contact_person',
    title: '联系人',
    minWidth: 100
  },
  {
    key: 'phone',
    title: '联系电话',
    minWidth: 120
  },
  {
    key: 'region',
    title: '所在地区',
    minWidth: 150,
    render: (row: any) => {
      return `${row.province || ''} ${row.city || ''} ${row.district || ''}`.trim() || '--'
    }
  },
  {
    key: 'status',
    title: '状态',
    minWidth: 80,
    render: (row: any) => {
      return row.status === 'F' ? <NTag type="error">禁用</NTag> : <NTag type="success">正常</NTag>
    }
  },
  {
    key: 'created_at',
    title: '创建时间',
    minWidth: 160
  },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    fixed: 'right',
    render: (row: any) => {
      return (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => handleEdit(row)}>
            编辑
          </NButton>
          <NButton size="small" type="warning" onClick={() => handleResetPassword(row)}>
            重置密码
          </NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => '确认删除该组织吗？删除后不可恢复。',
              trigger: () => (
                <NButton size="small" type="error">
                  删除
                </NButton>
              )
            }}
          </NPopconfirm>
        </NSpace>
      )
    }
  }
])

const columnsToShow = computed(() =>
  columns.value.map((col: any) => ({
    key: col.key,
    label: col.title,
    render: col.render
  }))
)

const currentTypeLabel = computed(() => OrgTypeLabels[activeTab.value] || '组织')

const topActions = computed(() => [
  {
    element: () => (
      <NButton type="primary" onClick={handleAdd}>
        + 新增{currentTypeLabel.value}
      </NButton>
    )
  }
])

const currentOrgType = computed(() => props.fixedOrgType || activeTab.value)

const fetchData = (params: any) => {
  return getOrgList({
    ...params,
    org_type: currentOrgType.value
  })
}

const handleAdd = () => {
  modalType.value = 'add'
  currentData.value = null
  modalVisible.value = true
}

const handleEdit = (row: any) => {
  modalType.value = 'edit'
  currentData.value = { ...row }
  modalVisible.value = true
}

const handleDelete = async (row: any) => {
  try {
    const { error } = await deleteOrg(row.id)
    if (!error) {
      message.success('删除成功')
      tablePageRef.value?.reload()
    }
  } catch (err: any) {
    message.error(err?.message || '删除失败')
  }
}

const handleResetPassword = (row: any) => {
  resetPwdRow.value = row
  resetPwdForm.value = { password: '', confirmPassword: '' }
  resetPwdVisible.value = true
}

const submitResetPassword = async () => {
  resetPwdFormRef.value?.validate(async (errors: any) => {
    if (errors) return
    try {
      const { error } = await resetOrgAccountPassword(resetPwdRow.value.id, { password: resetPwdForm.value.password })
      if (!error) {
        message.success('重置成功')
        resetPwdVisible.value = false
      }
    } catch (err: any) {
      message.error(err?.message || '重置失败')
    }
  })
}

const handleModalSubmit = async (formData: any) => {
  try {
    if (modalType.value === 'add') {
      const { error } = await createOrg({
        ...formData,
        org_type: currentOrgType.value
      })
      if (!error) {
        message.success('创建成功')
        modalVisible.value = false
        tablePageRef.value?.reload()
      }
    } else {
      const { error } = await updateOrg(currentData.value.id, formData)
      if (!error) {
        message.success('更新成功')
        modalVisible.value = false
        tablePageRef.value?.reload()
      }
    }
  } catch (err: any) {
    message.error(err?.message || '操作失败')
  }
}

watch(activeTab, () => {
  if (hideTabs.value) return
  tablePageRef.value?.reload()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="hideTabs" class="mb-16px">
      <h2 class="text-18px font-medium m-0">{{ pageTitle }}</h2>
    </div>

    <NTabs v-if="!hideTabs" v-model:value="activeTab" type="line" class="mb-16px">
      <NTabPane v-for="tab in tabOptions" :key="tab.key" :name="tab.key" :tab="tab.label" />
    </NTabs>

    <div class="flex-1 min-h-0">
      <DataTablePage
        ref="tablePageRef"
        :fetch-data="fetchData"
        :columns-to-show="columnsToShow"
        :search-configs="searchConfigs"
        :top-actions="topActions"
        :view-types="['list']"
        initial-view-type="list"
      />
    </div>

    <OrgModal
      v-model:visible="modalVisible"
      :type="modalType"
      :data="currentData"
      :fixed-org-type="currentOrgType"
      @submit="handleModalSubmit"
    />

    <NModal
      :show="resetPwdVisible"
      preset="card"
      title="重置账号密码"
      style="width: 460px"
      @close="resetPwdVisible = false"
    >
      <NForm
        ref="resetPwdFormRef"
        :model="resetPwdForm"
        label-placement="left"
        label-width="90"
        :rules="{
          password: { required: true, message: '请输入新密码（至少6位）', trigger: 'blur' },
          confirmPassword: {
            required: true,
            message: '请再次输入新密码',
            trigger: 'blur',
            validator: (_: any, value: string) => value === resetPwdForm.password
          }
        }"
      >
        <NFormItem label="新密码" path="password">
          <NInput
            v-model:value="resetPwdForm.password"
            type="password"
            show-password-on="click"
            placeholder="请输入新密码"
          />
        </NFormItem>
        <NFormItem label="确认密码" path="confirmPassword">
          <NInput
            v-model:value="resetPwdForm.confirmPassword"
            type="password"
            show-password-on="click"
            placeholder="请再次输入新密码"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="resetPwdVisible = false">取消</NButton>
          <NButton type="primary" @click="submitResetPassword">确定</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
