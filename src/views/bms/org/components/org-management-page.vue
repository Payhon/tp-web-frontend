<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  useMessage
} from 'naive-ui'
import {
  createOrg,
  deleteOrg,
  getOrgList,
  getPackWxMpConfig,
  OrgTypeLabels,
  resetOrgAccountPassword,
  type PackWxMpConfig,
  updateOrg,
  upsertPackWxMpConfig
} from '@/service/api/bms'
import {
  fetchAdminContentPage,
  publishAdminContentPage,
  type ContentKey,
  upsertAdminContentPage
} from '@/service/api/app-manage'
import FilePicker from '@/components/business/file-picker/index.vue'
import MarkdownEditor from '../../../app_manage/content/components/MarkdownEditor.vue'
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
const wxmpLoading = ref(false)
const wxmpSaving = ref(false)
const wxmpRow = ref<any>(null)
const wxmpConfig = ref<PackWxMpConfig | null>(null)
const wxmpActiveTab = ref<'basic' | 'content'>('basic')
const wxmpForm = ref({
  wx_appid: '',
  app_secret: '',
  status: 'OPEN' as 'OPEN' | 'CLOSE',
  home_banner_url: '',
  login_logo_url: '',
  remark: ''
})
const contentLoading = ref(false)
const contentSaving = ref(false)
const contentPublished = ref(false)
const contentKey = ref<ContentKey>('about_us')
const contentLang = ref<'zh-CN' | 'en-US'>('zh-CN')
const contentForm = ref({
  title: '',
  content_markdown: ''
})
const wxmpMarkdownEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const wxmpMarkdownFullscreen = ref(false)
const wxmpContentEditorHeight = 420

const hideTabs = computed(() => Boolean(props.fixedOrgType))

const activeTab = ref<string>(props.fixedOrgType || 'PACK_FACTORY')

watch(
  () => props.fixedOrgType,
  (value) => {
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
      return row.status === 'F' ? <NTag type="error">{bt('auto.s_710ad08b11')}</NTag> : <NTag type="success">{bt('auto.s_fd6e80f1e0')}</NTag>
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
          <NButton size="small" type="primary" onClick={() => handleEdit(row)}>{bt('auto.s_95b351c862')}</NButton>
          <NButton size="small" type="warning" onClick={() => handleResetPassword(row)}>{bt('auto.s_0719aa2bb0')}</NButton>
          {row.org_type === 'PACK_FACTORY' ? (
            <NButton size="small" type="info" onClick={() => handleWxmpConfig(row)}>{bt('auto.s_701fa5a565')}</NButton>
          ) : null}
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => bt('auto.s_bfe73e2e3a'),
              trigger: () => (
                <NButton size="small" type="error">{bt('auto.s_2f4aaddde3')}</NButton>
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

const wxmpStatusOptions = [
  { label: bt('auto.s_7854b52a88'), value: 'OPEN' },
  { label: bt('auto.s_5c56a88945'), value: 'CLOSE' }
]

const contentKeyOptions = [
  { label: bt('auto.s_3b2e3653b3'), value: 'about_us' },
  { label: bt('auto.s_b0d5608709'), value: 'privacy_policy' },
  { label: bt('auto.s_db1af7def3'), value: 'user_policy' },
  { label: bt('auto.s_b6606015e0'), value: 'contact_service' }
]

const contentLangOptions = [
  { label: bt('auto.s_a7bac2239f'), value: 'zh-CN' },
  { label: bt('auto.s_f9fb6a063d'), value: 'en-US' }
]

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

const resetWxmpContent = () => {
  wxmpMarkdownEditorRef.value?.exitFullscreen?.()
  wxmpMarkdownFullscreen.value = false
  contentPublished.value = false
  contentForm.value = {
    title: '',
    content_markdown: ''
  }
}

const handleWxmpMarkdownFullscreen = (value: boolean) => {
  wxmpMarkdownFullscreen.value = value
}

const exitWxmpMarkdownFullscreen = () => {
  wxmpMarkdownEditorRef.value?.exitFullscreen?.()
}

const loadWxmpContent = async () => {
  if (!wxmpConfig.value?.app_id) {
    resetWxmpContent()
    return
  }
  contentLoading.value = true
  try {
    const res: any = await fetchAdminContentPage(contentKey.value, {
      app_id: wxmpConfig.value.app_id,
      lang: contentLang.value
    })
    const data = res?.data
    contentPublished.value = Boolean(data?.published)
    contentForm.value = {
      title: data?.title || '',
      content_markdown: data?.content_markdown || ''
    }
  } catch (err: any) {
    resetWxmpContent()
    message.error(err?.message || bt('auto.s_7619268c4a'))
  } finally {
    contentLoading.value = false
  }
}

const handleWxmpConfig = async (row: any) => {
  wxmpRow.value = row
  wxmpVisible.value = true
  wxmpActiveTab.value = 'basic'
  wxmpConfig.value = null
  wxmpForm.value = {
    wx_appid: '',
    app_secret: '',
    status: 'OPEN',
    home_banner_url: '',
    login_logo_url: '',
    remark: ''
  }
  resetWxmpContent()
  wxmpLoading.value = true
  try {
    const res: any = await getPackWxMpConfig(row.id)
    const data = res?.data as PackWxMpConfig | undefined
    if (data?.id) {
      wxmpConfig.value = data
      wxmpForm.value = {
        wx_appid: data.wx_appid || '',
        app_secret: '',
        status: data.status || 'OPEN',
        home_banner_url: data.home_banner_url || '',
        login_logo_url: data.login_logo_url || '',
        remark: data.remark || ''
      }
      await loadWxmpContent()
    }
  } catch (err: any) {
    if (err?.response?.status !== 404 && err?.code !== 404) {
      message.error(err?.message || bt('auto.s_1e6408f6f6'))
    }
  } finally {
    wxmpLoading.value = false
  }
}

const saveWxmpConfig = async () => {
  if (!wxmpRow.value?.id) return
  const wxAppID = wxmpForm.value.wx_appid.trim()
  const secret = wxmpForm.value.app_secret.trim()
  if (!wxAppID) {
    message.warning(bt('auto.s_a5c86beecc'))
    return
  }
  if (!wxmpConfig.value?.id && !secret) {
    message.warning(bt('auto.s_827339b69a'))
    return
  }

  wxmpSaving.value = true
  try {
    const res: any = await upsertPackWxMpConfig(wxmpRow.value.id, {
      wx_appid: wxAppID,
      app_secret: secret || undefined,
      status: wxmpForm.value.status,
      home_banner_url: wxmpForm.value.home_banner_url.trim() || undefined,
      login_logo_url: wxmpForm.value.login_logo_url.trim() || undefined,
      remark: wxmpForm.value.remark.trim() || undefined
    })
    wxmpConfig.value = res?.data || null
    wxmpForm.value.app_secret = ''
    message.success(bt('auto.s_96107b4620'))
    tablePageRef.value?.reload()
    await loadWxmpContent()
  } catch (err: any) {
    message.error(err?.message || bt('auto.s_3dc6b0152d'))
  } finally {
    wxmpSaving.value = false
  }
}

const saveWxmpContent = async (publish = false) => {
  if (!wxmpConfig.value?.app_id) {
    message.warning(bt('auto.s_32f41a1b8b'))
    return
  }
  contentSaving.value = true
  try {
    await upsertAdminContentPage(contentKey.value, {
      app_id: wxmpConfig.value.app_id,
      lang: contentLang.value,
      title: contentForm.value.title,
      content_markdown: contentForm.value.content_markdown
    })
    if (publish) {
      await publishAdminContentPage(contentKey.value, { app_id: wxmpConfig.value.app_id })
    }
    message.success(publish ? bt('auto.s_a99def6083') : bt('auto.s_1c34535aa5'))
    await loadWxmpContent()
  } catch (err: any) {
    message.error(err?.message || bt('auto.s_9596d42fb4'))
  } finally {
    contentSaving.value = false
  }
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

watch([contentKey, contentLang], () => {
  if (!wxmpVisible.value) return
  loadWxmpContent()
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
      <NSpin :show="wxmpLoading">
        <NAlert type="info" class="mb-16px">
          {{ bt('pages.org.wxmpConfigDesc') }}
        </NAlert>
        <NTabs v-model:value="wxmpActiveTab" type="line" animated>
          <NTabPane name="basic" :tab="bt('auto.s_8911a9423d')">
            <NForm label-placement="left" label-width="120">
              <NFormItem :label="bt('auto.s_ac09e0a168')">
                <NInput v-model:value="wxmpForm.wx_appid" :placeholder="bt('auto.s_a5c86beecc')" />
              </NFormItem>
              <NFormItem label="AppSecret">
                <NInput
                  v-model:value="wxmpForm.app_secret"
                  type="password"
                  show-password-on="click"
                  :placeholder="bt('auto.s_e363fb799b')"
                />
              </NFormItem>
              <NFormItem :label="bt('auto.s_3fea7ca76c')">
                <NSelect v-model:value="wxmpForm.status" :options="wxmpStatusOptions" />
              </NFormItem>
              <NFormItem :label="bt('auto.s_da98ea8f7f')">
                <FilePicker
                  v-model:model-value="wxmpForm.home_banner_url"
                  biz-type="image"
                  value-mode="url"
                  display-mode="image"
                  :preview-width="180"
                  :preview-height="82"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  :allowed-extensions="['png', 'jpg', 'jpeg', 'gif', 'webp']"
                />
                <div class="mt-6px text-12px opacity-70">{{ bt('auto.s_73805dd353') }}</div>
              </NFormItem>
              <NFormItem :label="bt('auto.s_cf12820ad4')">
                <FilePicker
                  v-model:model-value="wxmpForm.login_logo_url"
                  biz-type="image"
                  value-mode="url"
                  display-mode="image"
                  :preview-width="120"
                  :preview-height="80"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  :allowed-extensions="['png', 'jpg', 'jpeg', 'gif', 'webp']"
                />
                <div class="mt-6px text-12px opacity-70">{{ bt('auto.s_341de825c5') }}</div>
              </NFormItem>
              <NFormItem :label="bt('auto.s_2432b57515')">
                <NInput v-model:value="wxmpForm.remark" type="textarea" :placeholder="bt('auto.s_db0ce65fbc')" />
              </NFormItem>
            </NForm>

            <NSpace justify="end">
              <NButton :loading="wxmpSaving" type="primary" @click="saveWxmpConfig">{{ bt('auto.s_164ac31dfd') }}</NButton>
            </NSpace>
          </NTabPane>

          <NTabPane name="content" :tab="bt('auto.s_17c8aa348f')">
            <div class="content-editor">
              <NSpace align="center" justify="space-between" class="content-toolbar">
                <NSpace align="center">
                  <NSelect v-model:value="contentKey" :options="contentKeyOptions" style="width: 140px" />
                  <NSelect v-model:value="contentLang" :options="contentLangOptions" style="width: 110px" />
                  <NTag :type="contentPublished ? 'success' : 'warning'">
                    {{ contentPublished ? bt('auto.s_dca0c13b83') : bt('auto.s_637e8ba488') }}
                  </NTag>
                </NSpace>
                <NSpace>
                  <NButton :disabled="!wxmpConfig?.app_id" :loading="contentSaving" @click="saveWxmpContent(false)">
                    {{ bt('auto.s_4d7ea6dfa6') }}
                  </NButton>
                  <NButton
                    type="primary"
                    :disabled="!wxmpConfig?.app_id"
                    :loading="contentSaving"
                    @click="saveWxmpContent(true)"
                  >
                    {{ bt('auto.s_5c097911f8') }}
                  </NButton>
                </NSpace>
              </NSpace>
              <NSpin :show="contentLoading">
                <NAlert v-if="!wxmpConfig?.app_id" type="warning" class="mb-16px">
                  {{ bt('pages.org.contentDisabledHint') }}
                </NAlert>
                <NForm v-else label-placement="left" label-width="110">
                  <NFormItem :label="bt('auto.s_32c65d8d74')">
                    <NInput v-model:value="contentForm.title" :placeholder="bt('auto.s_e9fa62ec22')" />
                  </NFormItem>
                  <NFormItem :label="bt('auto.s_c536c43976')" class="items-start">
                    <div class="w-full">
                      <MarkdownEditor
                        ref="wxmpMarkdownEditorRef"
                        v-model="contentForm.content_markdown"
                        :placeholder="bt('auto.s_eda4fb6cf5')"
                        :height="wxmpContentEditorHeight"
                        :min-height="wxmpContentEditorHeight"
                        @fullscreen-change="handleWxmpMarkdownFullscreen"
                      />
                    </div>
                  </NFormItem>
                </NForm>
              </NSpin>
            </div>
          </NTabPane>
        </NTabs>
      </NSpin>
    </NModal>

    <div v-if="wxmpMarkdownFullscreen && wxmpVisible" class="markdown-fullscreen-bar">
      <NSpace align="center">
        <NButton size="small" :loading="contentSaving" @click="saveWxmpContent(false)">{{ bt('auto.s_4d7ea6dfa6') }}</NButton>
        <NButton size="small" type="primary" :loading="contentSaving" @click="saveWxmpContent(true)">
          {{ bt('auto.s_5c097911f8') }}
        </NButton>
        <NButton size="small" tertiary @click="exitWxmpMarkdownFullscreen">{{ bt('auto.s_49041f2450') }}</NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.content-editor {
  padding-top: 4px;
}

.content-toolbar {
  margin-bottom: 12px;
}

.markdown-fullscreen-bar {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 10000;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
  box-shadow: 0 8px 24px rgb(0 0 0 / 16%);
  padding: 10px 12px;
}
</style>
