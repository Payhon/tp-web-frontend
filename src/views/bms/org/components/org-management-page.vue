<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NInput, NModal, NPopconfirm, NSpace, NTag, useMessage } from 'naive-ui'
import { createOrg, deleteOrg, getOrgList, resetOrgAccountPassword, updateOrg } from '@/service/api/bms'
import PackWxmpConfigPanel from '@/views/bms/_shared/components/pack-wxmp-config-panel.vue'
import OrgModal from '../modules/org-modal.vue'

interface Props {
  fixedOrgType?: 'PACK_FACTORY' | 'DEALER' | 'STORE'
}

const props = defineProps<Props>()

const message = useMessage()
const tablePageRef = ref()
const modalVisible = ref(false)
const modalType = ref<'add' | 'edit'>('add')
const currentData = ref<any | null>(null)
const resetPwdVisible = ref(false)
const resetPwdRow = ref<any>(null)
const resetPwdFormRef = ref()
const resetPwdForm = ref({
  password: '',
  confirmPassword: ''
})
const wxmpVisible = ref(false)
const wxmpRow = ref<any>(null)

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
    return bt('common.managementTitle', { name: orgTypeLabel(props.fixedOrgType) })
  }
  return bt('auto.s_ee0b0b751c')
})

function orgTypeLabel(type?: string) {
  if (type === 'PACK_FACTORY') return bt('auto.s_5c08c289a8')
  if (type === 'DEALER') return bt('auto.s_9019dc8029')
  if (type === 'STORE') return bt('auto.s_a7da92344c')
  if (type === 'BMS_FACTORY') return 'BMS'
  return type || bt('auto.s_74fe5f9e99')
}

const tabOptions = [
  { key: 'PACK_FACTORY', label: bt('auto.s_5c08c289a8') },
  { key: 'DEALER', label: bt('auto.s_9019dc8029') },
  { key: 'STORE', label: bt('auto.s_a7da92344c') }
]

const searchConfigs = ref<any[]>([
  {
    key: 'name',
    label: bt('auto.s_4c12d831e3'),
    type: 'input',
    placeholder: bt('auto.s_a5bf36a322')
  },
  {
    key: 'phone',
    label: bt('auto.s_09a1f6985a'),
    type: 'input',
    placeholder: bt('auto.s_7b540b8035')
  },
  {
    key: 'status',
    label: bt('auto.s_3fea7ca76c'),
    type: 'select',
    placeholder: bt('auto.s_e1c965efff'),
    options: [
      { label: bt('auto.s_fd6e80f1e0'), value: 'N' },
      { label: bt('auto.s_710ad08b11'), value: 'F' }
    ]
  }
])

const columns = ref([
  {
    key: 'name',
    title: bt('auto.s_4c12d831e3'),
    minWidth: 150
  },
  {
    key: 'org_type',
    title: bt('auto.s_226b091218'),
    minWidth: 100,
    render: (row: any) => {
      return <NTag type="info">{orgTypeLabel(row.org_type)}</NTag>
    }
  },
  {
    key: 'contact_person',
    title: bt('auto.s_52409da520'),
    minWidth: 100
  },
  {
    key: 'phone',
    title: bt('auto.s_09a1f6985a'),
    minWidth: 120
  },
  {
    key: 'region',
    title: bt('auto.s_65d3ab7783'),
    minWidth: 150,
    render: (row: any) => {
      return `${row.province || ''} ${row.city || ''} ${row.district || ''}`.trim() || '--'
    }
  },
  {
    key: 'status',
    title: bt('auto.s_3fea7ca76c'),
    minWidth: 80,
    render: (row: any) => {
      return row.status === 'F' ? (
        <NTag type="error">{bt('auto.s_710ad08b11')}</NTag>
      ) : (
        <NTag type="success">{bt('auto.s_fd6e80f1e0')}</NTag>
      )
    }
  },
  {
    key: 'created_at',
    title: bt('auto.s_eca37cb072'),
    minWidth: 160
  },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    width: 220,
    fixed: 'right',
    render: (row: any) => {
      return (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => handleEdit(row)}>
            {bt('auto.s_95b351c862')}
          </NButton>
          <NButton size="small" type="warning" onClick={() => handleResetPassword(row)}>
            {bt('auto.s_0719aa2bb0')}
          </NButton>
          {row.org_type === 'PACK_FACTORY' ? (
            <NButton size="small" type="info" onClick={() => handleWxmpConfig(row)}>
              {bt('auto.s_701fa5a565')}
            </NButton>
          ) : null}
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => bt('auto.s_bfe73e2e3a'),
              trigger: () => (
                <NButton size="small" type="error">
                  {bt('auto.s_2f4aaddde3')}
                </NButton>
              )
            }}
          </NPopconfirm>
        </NSpace>
      )
    }
  }
])

const columnsToShow = computed<any>(() =>
  columns.value.map((col: any) => ({
    key: col.key,
    label: col.title,
    render: col.render
  }))
)

const currentTypeLabel = computed(() => orgTypeLabel(activeTab.value))

const topActions = computed<any>(() => [
  {
    element: () => (
      <NButton type="primary" onClick={handleAdd}>
        {bt('common.addWithName', { name: currentTypeLabel.value })}
      </NButton>
    )
  }
])

const currentOrgType = computed(() => props.fixedOrgType || activeTab.value)

const fetchData: any = (params: any) => {
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
      message.success(bt('auto.s_0007d170de'))
      tablePageRef.value?.reload()
    }
  } catch (err: any) {
    message.error(err?.message || bt('auto.s_acf0664a54'))
  }
}

const handleResetPassword = (row: any) => {
  resetPwdRow.value = row
  resetPwdForm.value = { password: '', confirmPassword: '' }
  resetPwdVisible.value = true
}

const handleWxmpConfig = (row: any) => {
  wxmpRow.value = row
  wxmpVisible.value = true
}

const handleWxmpSaved = () => {
  tablePageRef.value?.reload()
}

const submitResetPassword = async () => {
  resetPwdFormRef.value?.validate(async (errors: any) => {
    if (errors) return
    try {
      const { error } = await resetOrgAccountPassword(resetPwdRow.value.id, { password: resetPwdForm.value.password })
      if (!error) {
        message.success(bt('auto.s_faa357fc6e'))
        resetPwdVisible.value = false
      }
    } catch (err: any) {
      message.error(err?.message || bt('auto.s_4d71382234'))
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
        message.success(bt('auto.s_04a691b377'))
        modalVisible.value = false
        tablePageRef.value?.reload()
      }
    } else {
      if (!currentData.value) return
      const { error } = await updateOrg(currentData.value.id, formData)
      if (!error) {
        message.success(bt('auto.s_55aa6366c0'))
        modalVisible.value = false
        tablePageRef.value?.reload()
      }
    }
  } catch (err: any) {
    message.error(err?.message || bt('auto.s_5fa802bef5'))
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
        :table-actions="[]"
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
      :title="bt('auto.s_d049dfce64')"
      style="width: 460px"
      @close="resetPwdVisible = false"
    >
      <NForm
        ref="resetPwdFormRef"
        :model="resetPwdForm"
        label-placement="left"
        label-width="90"
        :rules="{
          password: { required: true, message: bt('auto.s_c4f4491d89'), trigger: 'blur' },
          confirmPassword: {
            required: true,
            message: bt('auto.s_d98a14a912'),
            trigger: 'blur',
            validator: (_: any, value: string) => value === resetPwdForm.password
          }
        }"
      >
        <NFormItem :label="bt('auto.s_bf7da0bf02')" path="password">
          <NInput
            v-model:value="resetPwdForm.password"
            type="password"
            show-password-on="click"
            :placeholder="bt('auto.s_abdd7ea830')"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_3fbdde139c')" path="confirmPassword">
          <NInput
            v-model:value="resetPwdForm.confirmPassword"
            type="password"
            show-password-on="click"
            :placeholder="bt('auto.s_d98a14a912')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="resetPwdVisible = false">{{ bt('auto.s_625fb26b4b') }}</NButton>
          <NButton type="primary" @click="submitResetPassword">{{ bt('auto.s_38cf16f220') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      :show="wxmpVisible"
      preset="card"
      :title="bt('common.modalTitleWithName', { title: bt('auto.s_701fa5a565'), name: wxmpRow?.name || '' })"
      style="width: 860px; max-width: 96vw"
      @close="wxmpVisible = false"
    >
      <PackWxmpConfigPanel v-if="wxmpVisible && wxmpRow?.id" :org-id="wxmpRow.id" @saved="handleWxmpSaved" />
    </NModal>
  </div>
</template>
