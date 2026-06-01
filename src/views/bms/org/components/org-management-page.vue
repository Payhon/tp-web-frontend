<script setup lang="tsx">
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
    return `${OrgTypeLabels[props.fixedOrgType]}管理`
  }
  return '组织管理'
})

const tabOptions = [
  { key: 'PACK_FACTORY', label: 'PACK厂家' },
  { key: 'DEALER', label: '经销商' },
  { key: 'STORE', label: '门店' }
]

const searchConfigs = ref<any[]>([
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
          {row.org_type === 'PACK_FACTORY' ? (
            <NButton size="small" type="info" onClick={() => handleWxmpConfig(row)}>
              小程序配置
            </NButton>
          ) : null}
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

const columnsToShow = computed<any>(() =>
  columns.value.map((col: any) => ({
    key: col.key,
    label: col.title,
    render: col.render
  }))
)

const currentTypeLabel = computed(() => OrgTypeLabels[activeTab.value] || '组织')

const topActions = computed<any>(() => [
  {
    element: () => (
      <NButton type="primary" onClick={handleAdd}>
        + 新增{currentTypeLabel.value}
      </NButton>
    )
  }
])

const currentOrgType = computed(() => props.fixedOrgType || activeTab.value)

const wxmpStatusOptions = [
  { label: '启用', value: 'OPEN' },
  { label: '停用', value: 'CLOSE' }
]

const contentKeyOptions = [
  { label: '关于我们', value: 'about_us' },
  { label: '隐私协议', value: 'privacy_policy' },
  { label: '用户政策', value: 'user_policy' },
  { label: '联系客服', value: 'contact_service' }
]

const contentLangOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: '英文', value: 'en-US' }
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
    message.error(err?.message || '内容加载失败')
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
      message.error(err?.message || '小程序配置加载失败')
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
    message.warning('请输入微信小程序 AppID')
    return
  }
  if (!wxmpConfig.value?.id && !secret) {
    message.warning('首次配置需要填写 AppSecret')
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
    message.success('小程序配置已保存')
    tablePageRef.value?.reload()
    await loadWxmpContent()
  } catch (err: any) {
    message.error(err?.message || '小程序配置保存失败')
  } finally {
    wxmpSaving.value = false
  }
}

const saveWxmpContent = async (publish = false) => {
  if (!wxmpConfig.value?.app_id) {
    message.warning('请先保存小程序配置')
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
    message.success(publish ? '内容已保存并发布' : '内容已保存')
    await loadWxmpContent()
  } catch (err: any) {
    message.error(err?.message || '内容保存失败')
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
      if (!currentData.value) return
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

    <NModal
      :show="wxmpVisible"
      preset="card"
      :title="`小程序配置 - ${wxmpRow?.name || ''}`"
      style="width: 860px; max-width: 96vw"
      @close="wxmpVisible = false"
    >
      <NSpin :show="wxmpLoading">
        <NAlert type="info" class="mb-16px">
          该配置仅作用于当前 PACK 厂接入的微信小程序。保存后，小程序登录将只走微信用户体系，首页 Banner
          和公开内容按此小程序独立展示。
        </NAlert>
        <NTabs v-model:value="wxmpActiveTab" type="line" animated>
          <NTabPane name="basic" tab="小程序基本信息">
            <NForm label-placement="left" label-width="120">
              <NFormItem label="微信 AppID">
                <NInput v-model:value="wxmpForm.wx_appid" placeholder="请输入微信小程序 AppID" />
              </NFormItem>
              <NFormItem label="AppSecret">
                <NInput
                  v-model:value="wxmpForm.app_secret"
                  type="password"
                  show-password-on="click"
                  placeholder="首次配置必填；留空表示不修改"
                />
              </NFormItem>
              <NFormItem label="状态">
                <NSelect v-model:value="wxmpForm.status" :options="wxmpStatusOptions" />
              </NFormItem>
              <NFormItem label="首页 Banner">
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
                <div class="mt-6px text-12px opacity-70">支持上传或选择已上传图片：png / jpg / jpeg / gif / webp</div>
              </NFormItem>
              <NFormItem label="登录 Logo">
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
                <div class="mt-6px text-12px opacity-70">用于微信小程序登录界面展示，未配置时使用默认 Logo。</div>
              </NFormItem>
              <NFormItem label="备注">
                <NInput v-model:value="wxmpForm.remark" type="textarea" placeholder="可填写用途、版本或客户说明" />
              </NFormItem>
            </NForm>

            <NSpace justify="end">
              <NButton :loading="wxmpSaving" type="primary" @click="saveWxmpConfig">保存小程序配置</NButton>
            </NSpace>
          </NTabPane>

          <NTabPane name="content" tab="文案内容">
            <div class="content-editor">
              <NSpace align="center" justify="space-between" class="content-toolbar">
                <NSpace align="center">
                  <NSelect v-model:value="contentKey" :options="contentKeyOptions" style="width: 140px" />
                  <NSelect v-model:value="contentLang" :options="contentLangOptions" style="width: 110px" />
                  <NTag :type="contentPublished ? 'success' : 'warning'">
                    {{ contentPublished ? '已发布' : '未发布' }}
                  </NTag>
                </NSpace>
                <NSpace>
                  <NButton :disabled="!wxmpConfig?.app_id" :loading="contentSaving" @click="saveWxmpContent(false)">
                    保存草稿
                  </NButton>
                  <NButton
                    type="primary"
                    :disabled="!wxmpConfig?.app_id"
                    :loading="contentSaving"
                    @click="saveWxmpContent(true)"
                  >
                    保存并发布
                  </NButton>
                </NSpace>
              </NSpace>
              <NSpin :show="contentLoading">
                <NAlert v-if="!wxmpConfig?.app_id" type="warning" class="mb-16px">
                  请先在“小程序基本信息”中保存小程序配置，再维护文案内容。
                </NAlert>
                <NForm v-else label-placement="left" label-width="110">
                  <NFormItem label="标题">
                    <NInput v-model:value="contentForm.title" placeholder="请输入页面标题" />
                  </NFormItem>
                  <NFormItem label="正文内容" class="items-start">
                    <div class="w-full">
                      <MarkdownEditor
                        ref="wxmpMarkdownEditorRef"
                        v-model="contentForm.content_markdown"
                        placeholder="请输入页面内容"
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
        <NButton size="small" :loading="contentSaving" @click="saveWxmpContent(false)">保存草稿</NButton>
        <NButton size="small" type="primary" :loading="contentSaving" @click="saveWxmpContent(true)">
          保存并发布
        </NButton>
        <NButton size="small" tertiary @click="exitWxmpMarkdownFullscreen">退出全屏</NButton>
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
