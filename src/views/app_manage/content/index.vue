<script setup lang="tsx">
import { computed, onMounted, ref, watch } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NImage,
  NImageGroup,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  useDialog,
  useMessage
} from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { $t } from '@/locales'
import { resolveFileUrl } from '@/utils/common/tool'
import {
  batchDeleteAdminFaqs,
  createAdminFaq,
  deleteAdminFaq,
  fetchAdminContentPage,
  fetchAdminFaqDetail,
  fetchAdminFaqList,
  fetchAdminFeedbackDetail,
  fetchAdminFeedbackList,
  fetchAppList,
  publishAdminContentPage,
  type AdminFeedbackStatus,
  type ContentKey,
  unpublishAdminContentPage,
  updateAdminFaq,
  updateAdminFeedback,
  upsertAdminContentPage
} from '@/service/api/app-manage'
import MarkdownEditor from './components/MarkdownEditor.vue'

type AppOption = { label: string; value: string; appid?: string; name?: string }

const message = useMessage()
const dialog = useDialog()

function toPublicUrl(path: string) {
  return resolveFileUrl(path)
}

const markdownEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const markdownFullscreen = ref(false)
const contentEditorHeight = 420

function handleMarkdownFullscreen(val: boolean) {
  markdownFullscreen.value = val
}

function exitMarkdownFullscreen() {
  markdownEditorRef.value?.exitFullscreen?.()
}

const currentAppId = ref<string | null>(null)
const appOptions = ref<AppOption[]>([])

async function initAppOptions() {
  try {
    const res: any = await fetchAppList({ page: 1, page_size: 1000 })
    const list = (res?.data?.list || []) as Array<{ id: string; name: string; appid: string }>
    appOptions.value = list.map(i => ({ label: i.name, value: i.id, appid: i.appid, name: i.name }))
    if (!currentAppId.value && appOptions.value.length) currentAppId.value = appOptions.value[0]!.value
  } catch {
    appOptions.value = []
  }
}

const tabs = ref<'pages' | 'faq' | 'feedback'>('pages')

// ---------------------------------------------------------------------------
// Single pages
// ---------------------------------------------------------------------------

const langOptions = computed(() => [
  { label: 'zh-CN', value: 'zh-CN' },
  { label: 'en-US', value: 'en-US' }
])
const currentLang = ref<'zh-CN' | 'en-US'>('zh-CN')

const contentKeyOptions = computed(() => [
  { label: $t('page.appManage.content.pages.userPolicy'), value: 'user_policy' },
  { label: $t('page.appManage.content.pages.privacyPolicy'), value: 'privacy_policy' }
])
const currentContentKey = ref<ContentKey>('user_policy')

const pageLoading = ref(false)
const pagePublished = ref(false)
const pageUpdatedAt = ref('')

const pageForm = ref({
  title: '',
  content_markdown: ''
})

async function loadContentPage() {
  if (!currentAppId.value) return
  pageLoading.value = true
  try {
    const res: any = await fetchAdminContentPage(currentContentKey.value, {
      app_id: currentAppId.value,
      lang: currentLang.value
    })
    const data = res?.data
    pagePublished.value = Boolean(data?.published)
    pageUpdatedAt.value = data?.updated_at || ''
    pageForm.value.title = data?.title || ''
    pageForm.value.content_markdown = data?.content_markdown || ''
  } catch (e: any) {
    message.error(e?.message || $t('common.loadFailed'))
  } finally {
    pageLoading.value = false
  }
}

watch([currentAppId, currentLang, currentContentKey], () => {
  if (tabs.value !== 'pages') return
  loadContentPage()
})

async function saveContentPage() {
  if (!currentAppId.value) return
  pageLoading.value = true
  try {
    await upsertAdminContentPage(currentContentKey.value, {
      app_id: currentAppId.value,
      lang: currentLang.value,
      title: pageForm.value.title,
      content_markdown: pageForm.value.content_markdown
    })
    message.success($t('common.saveSuccess'))
    loadContentPage()
  } catch (e: any) {
    message.error(e?.message || $t('common.saveFailed'))
  } finally {
    pageLoading.value = false
  }
}

async function togglePublishContentPage() {
  if (!currentAppId.value) return
  pageLoading.value = true
  try {
    if (pagePublished.value) {
      await unpublishAdminContentPage(currentContentKey.value, { app_id: currentAppId.value })
      message.success($t('common.updateSuccess'))
    } else {
      await publishAdminContentPage(currentContentKey.value, { app_id: currentAppId.value })
      message.success($t('common.updateSuccess'))
    }
    loadContentPage()
  } catch (e: any) {
    message.error(e?.message || $t('common.updateFailed'))
  } finally {
    pageLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const faqSearchForm = ref({ keyword: '', published: null as boolean | null })
const faqCheckedRowKeys = ref<string[]>([])

let getFaqTableData: () => void = () => {}
let setFaqSearchParams: any = () => {}

const faqTable = useTable<any, typeof fetchAdminFaqList>({
  apiFn: fetchAdminFaqList,
  immediate: false,
  apiParams: {
    page: 1,
    page_size: 10,
    app_id: ''
  } as any,
  onPaginationChanged: async p => {
    setFaqSearchParams({
      page: p.page,
      page_size: p.pageSize
    })
    getFaqTableData()
  },
  transformer: (res: any) => {
    const payload = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): DataTableColumns<any> => [
    { type: 'selection' },
    { key: 'question', title: $t('page.appManage.content.faq.table.question'), minWidth: 260 },
    {
      key: 'is_pinned',
      title: $t('page.appManage.content.faq.table.pinned'),
      width: 100,
      render: row => (row.is_pinned ? <NTag type="warning">{$t('page.appManage.content.faq.pinned')}</NTag> : '--')
    },
    { key: 'sort', title: $t('page.appManage.content.faq.table.sort'), width: 90 },
    {
      key: 'published',
      title: $t('page.appManage.content.faq.table.published'),
      width: 110,
      render: row => (
        <NTag type={row.published ? 'success' : 'default'}>
          {row.published ? $t('page.appManage.content.common.published') : $t('page.appManage.content.common.draft')}
        </NTag>
      )
    },
    {
      key: 'updated_at',
      title: $t('page.appManage.content.common.updatedAtLabel'),
      minWidth: 160,
      render: row => row.updated_at || '--'
    },
    {
      key: 'actions',
      title: $t('common.actions'),
      width: 200,
      fixed: 'right',
      render: row => (
        <NSpace>
          <NButton size="small" onClick={() => openFaqEdit(row.id)}>
            {$t('common.edit')}
          </NButton>
          <NButton size="small" type="error" onClick={() => confirmDeleteFaq(row.id)}>
            {$t('common.delete')}
          </NButton>
        </NSpace>
      )
    }
  ]
})

const {
  data: faqData,
  loading: faqLoading,
  columns: faqColumns,
  pagination: faqPagination,
  getData: faqGetData,
  updateSearchParams: faqUpdateSearchParams
} = faqTable
getFaqTableData = faqGetData
setFaqSearchParams = faqUpdateSearchParams

const faqPublishedOptions = computed(() => [
  { label: $t('page.appManage.content.common.all'), value: null },
  { label: $t('page.appManage.content.common.published'), value: true },
  { label: $t('page.appManage.content.common.draft'), value: false }
])

function handleFaqSearch() {
  if (!currentAppId.value) return
  faqUpdateSearchParams({
    page: 1,
    page_size: faqPagination.pageSize,
    app_id: currentAppId.value,
    lang: currentLang.value,
    keyword: faqSearchForm.value.keyword || undefined,
    published: faqSearchForm.value.published ?? undefined
  })
  faqGetData()
}

function handleFaqReset() {
  faqSearchForm.value = { keyword: '', published: null }
  handleFaqSearch()
}

watch(currentAppId, () => {
  if (tabs.value !== 'faq') return
  handleFaqSearch()
})

watch(currentLang, () => {
  if (tabs.value !== 'faq') return
  handleFaqSearch()
})

async function handleBatchDeleteFaq() {
  if (!faqCheckedRowKeys.value.length) return
  dialog.warning({
    title: $t('page.appManage.content.faq.confirm.batchDeleteTitle'),
    content: $t('page.appManage.content.faq.confirm.batchDeleteContent', { count: faqCheckedRowKeys.value.length }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await batchDeleteAdminFaqs(faqCheckedRowKeys.value)
        message.success($t('common.deleteSuccess'))
        faqCheckedRowKeys.value = []
        faqGetData()
      } catch (e: any) {
        message.error(e?.message || $t('common.deleteFailed'))
      }
    }
  })
}

function confirmDeleteFaq(id: string) {
  dialog.warning({
    title: $t('page.appManage.content.faq.confirm.deleteTitle'),
    content: $t('page.appManage.content.faq.confirm.deleteContent'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await deleteAdminFaq(id)
        message.success($t('common.deleteSuccess'))
        faqGetData()
      } catch (e: any) {
        message.error(e?.message || $t('common.deleteFailed'))
      }
    }
  })
}

const faqModalVisible = ref(false)
const faqModalLoading = ref(false)
const faqOperateType = ref<'add' | 'edit'>('add')
const faqEditingId = ref<string | null>(null)
const faqForm = ref({
  is_pinned: false,
  sort: 0,
  published: false,
  i18n: {
    'zh-CN': { question: '', answer_markdown: '' },
    'en-US': { question: '', answer_markdown: '' }
  }
})

function openFaqAdd() {
  faqOperateType.value = 'add'
  faqEditingId.value = null
  faqForm.value = {
    is_pinned: false,
    sort: 0,
    published: false,
    i18n: {
      'zh-CN': { question: '', answer_markdown: '' },
      'en-US': { question: '', answer_markdown: '' }
    }
  }
  faqModalVisible.value = true
}

async function openFaqEdit(id: string) {
  faqOperateType.value = 'edit'
  faqEditingId.value = id
  faqModalVisible.value = true
  faqModalLoading.value = true
  try {
    const res: any = await fetchAdminFaqDetail(id)
    const d = res?.data
    faqForm.value.is_pinned = Boolean(d?.is_pinned)
    faqForm.value.sort = Number(d?.sort || 0)
    faqForm.value.published = Boolean(d?.published)
    faqForm.value.i18n['zh-CN'] = {
      question: d?.i18n?.['zh-CN']?.question || '',
      answer_markdown: d?.i18n?.['zh-CN']?.answer_markdown || ''
    }
    faqForm.value.i18n['en-US'] = {
      question: d?.i18n?.['en-US']?.question || '',
      answer_markdown: d?.i18n?.['en-US']?.answer_markdown || ''
    }
  } catch (e: any) {
    message.error(e?.message || $t('common.loadFailed'))
    faqModalVisible.value = false
  } finally {
    faqModalLoading.value = false
  }
}

async function submitFaq() {
  if (!currentAppId.value) return
  faqModalLoading.value = true
  try {
    const payload = {
      app_id: currentAppId.value,
      is_pinned: faqForm.value.is_pinned,
      sort: faqForm.value.sort,
      published: faqForm.value.published,
      i18n: faqForm.value.i18n
    }
    if (faqOperateType.value === 'add') {
      await createAdminFaq(payload)
      message.success($t('common.addSuccess'))
    } else if (faqEditingId.value) {
      await updateAdminFaq(faqEditingId.value, payload)
      message.success($t('common.updateSuccess'))
    }
    faqModalVisible.value = false
    faqGetData()
  } catch (e: any) {
    message.error(e?.message || $t('common.operationFailed'))
  } finally {
    faqModalLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const feedbackSearchForm = ref({ status: null as AdminFeedbackStatus | null, keyword: '' })
const feedbackStatusOptions = computed(() => [
  { label: $t('page.appManage.content.common.all'), value: null },
  { label: $t('page.appManage.content.feedback.status.NEW'), value: 'NEW' },
  { label: $t('page.appManage.content.feedback.status.PROCESSING'), value: 'PROCESSING' },
  { label: $t('page.appManage.content.feedback.status.RESOLVED'), value: 'RESOLVED' },
  { label: $t('page.appManage.content.feedback.status.CLOSED'), value: 'CLOSED' }
])

let getFeedbackTableData: () => void = () => {}
let setFeedbackSearchParams: any = () => {}

const feedbackTable = useTable<any, typeof fetchAdminFeedbackList>({
  apiFn: fetchAdminFeedbackList,
  immediate: false,
  apiParams: { page: 1, page_size: 10, app_id: '' } as any,
  onPaginationChanged: async p => {
    setFeedbackSearchParams({ page: p.page, page_size: p.pageSize })
    getFeedbackTableData()
  },
  transformer: (res: any) => {
    const payload = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): DataTableColumns<any> => [
    {
      key: 'created_at',
      title: $t('page.manage.api.created_at'),
      minWidth: 160,
      render: row => row.created_at || '--'
    },
    {
      key: 'user',
      title: $t('page.appManage.content.feedback.table.user'),
      minWidth: 180,
      render: row => row.phone || row.email || row.user_id || '--'
    },
    { key: 'content', title: $t('page.appManage.content.feedback.table.content'), minWidth: 260 },
    { key: 'image_cnt', title: $t('page.appManage.content.feedback.table.images'), width: 90 },
    {
      key: 'status',
      title: $t('page.appManage.content.feedback.table.status'),
      width: 120,
      render: row => <NTag>{$t(`page.appManage.content.feedback.status.${row.status}` as any)}</NTag>
    },
    {
      key: 'reply',
      title: $t('page.appManage.content.feedback.table.reply'),
      minWidth: 160,
      render: row => row.reply || '--'
    },
    {
      key: 'actions',
      title: $t('common.actions'),
      width: 120,
      fixed: 'right',
      render: row => (
        <NButton size="small" type="primary" onClick={() => openFeedbackDetail(row.id)}>
          {$t('page.appManage.content.feedback.table.handle')}
        </NButton>
      )
    }
  ]
})

const {
  data: feedbackData,
  loading: feedbackLoading,
  columns: feedbackColumns,
  pagination: feedbackPagination,
  getData: feedbackGetData,
  updateSearchParams: feedbackUpdateSearchParams
} = feedbackTable
getFeedbackTableData = feedbackGetData
setFeedbackSearchParams = feedbackUpdateSearchParams

function handleFeedbackSearch() {
  if (!currentAppId.value) return
  feedbackUpdateSearchParams({
    page: 1,
    page_size: feedbackPagination.pageSize,
    app_id: currentAppId.value,
    status: feedbackSearchForm.value.status || undefined,
    keyword: feedbackSearchForm.value.keyword || undefined
  })
  feedbackGetData()
}

watch(currentAppId, () => {
  if (tabs.value !== 'feedback') return
  handleFeedbackSearch()
})

function handleFeedbackReset() {
  feedbackSearchForm.value = { status: null, keyword: '' }
  handleFeedbackSearch()
}

const feedbackDetailVisible = ref(false)
const feedbackDetailLoading = ref(false)
const feedbackDetail = ref<any>(null)
const feedbackHandleForm = ref<{ status: AdminFeedbackStatus; reply: string; handle_note: string }>({
  status: 'NEW',
  reply: '',
  handle_note: ''
})

async function openFeedbackDetail(id: string) {
  feedbackDetailVisible.value = true
  feedbackDetailLoading.value = true
  feedbackDetail.value = null
  try {
    const res: any = await fetchAdminFeedbackDetail(id)
    feedbackDetail.value = res?.data || null
    feedbackHandleForm.value = {
      status: feedbackDetail.value?.status || 'NEW',
      reply: feedbackDetail.value?.reply || '',
      handle_note: feedbackDetail.value?.handle_note || ''
    }
  } catch (e: any) {
    message.error(e?.message || $t('common.loadFailed'))
    feedbackDetailVisible.value = false
  } finally {
    feedbackDetailLoading.value = false
  }
}

async function submitFeedbackHandle() {
  if (!feedbackDetail.value?.id) return
  feedbackDetailLoading.value = true
  try {
    await updateAdminFeedback(feedbackDetail.value.id, {
      status: feedbackHandleForm.value.status,
      reply: feedbackHandleForm.value.reply || undefined,
      handle_note: feedbackHandleForm.value.handle_note || undefined
    })
    message.success($t('common.updateSuccess'))
    feedbackDetailVisible.value = false
    feedbackGetData()
  } catch (e: any) {
    message.error(e?.message || $t('common.updateFailed'))
  } finally {
    feedbackDetailLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Tab switch
// ---------------------------------------------------------------------------

watch(
  () => tabs.value,
  t => {
    if (t === 'pages') loadContentPage()
    if (t === 'faq') handleFaqSearch()
    if (t === 'feedback') handleFeedbackSearch()
  },
  { immediate: false }
)

onMounted(async () => {
  await initAppOptions()
  await loadContentPage()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="$t('page.appManage.content.title')" :bordered="false" size="small" class="card-wrapper">
      <NForm inline label-placement="left" label-width="auto" class="mb-4 flex flex-wrap gap-4">
        <NFormItem :label="$t('page.appManage.upgrade.currentApp')">
          <NSelect v-model:value="currentAppId" :options="appOptions" filterable clearable style="width: 320px" />
        </NFormItem>
        <NFormItem :label="$t('page.appManage.content.common.lang')">
          <NSelect v-model:value="currentLang" :options="langOptions" style="width: 160px" />
        </NFormItem>
      </NForm>

      <NTabs v-model:value="tabs" type="line" animated>
        <NTabPane name="pages" :tab="$t('page.appManage.content.tabs.pages')">
          <div class="mb-4 flex flex-wrap items-center gap-12px">
            <NSelect v-model:value="currentContentKey" :options="contentKeyOptions" style="width: 220px" />
            <NTag :type="pagePublished ? 'success' : 'default'">
              {{
                pagePublished
                  ? $t('page.appManage.content.common.published')
                  : $t('page.appManage.content.common.draft')
              }}
            </NTag>
            <span class="text-12px text-gray-500">
              {{ $t('page.appManage.content.common.updatedAt') }} {{ pageUpdatedAt || '--' }}
            </span>
          </div>

          <NForm :model="pageForm" label-placement="left" label-width="110">
            <NFormItem :label="$t('page.appManage.content.pages.form.title')">
              <NInput
                v-model:value="pageForm.title"
                :placeholder="$t('page.appManage.content.pages.form.titlePlaceholder')"
              />
            </NFormItem>
            <NFormItem :label="$t('page.appManage.content.pages.form.content')" class="items-start">
              <div class="w-full">
                <MarkdownEditor
                  ref="markdownEditorRef"
                  v-model="pageForm.content_markdown"
                  :placeholder="$t('page.appManage.content.pages.form.contentPlaceholder')"
                  :height="contentEditorHeight"
                  :min-height="contentEditorHeight"
                  @fullscreen-change="handleMarkdownFullscreen"
                />
              </div>
            </NFormItem>
          </NForm>

          <NSpace justify="end">
            <NButton :loading="pageLoading" @click="saveContentPage">{{ $t('common.save') }}</NButton>
            <NButton :loading="pageLoading" type="primary" @click="togglePublishContentPage">
              {{
                pagePublished
                  ? $t('page.appManage.content.pages.unpublish')
                  : $t('page.appManage.content.pages.publish')
              }}
            </NButton>
          </NSpace>
        </NTabPane>

        <NTabPane name="faq" :tab="$t('page.appManage.content.tabs.faq')">
          <div class="mb-4 flex flex-wrap items-center gap-12px">
            <NInput
              v-model:value="faqSearchForm.keyword"
              clearable
              style="width: 320px"
              :placeholder="$t('page.appManage.content.faq.searchPlaceholder')"
            />
            <NSelect
              v-model:value="faqSearchForm.published"
              clearable
              :options="faqPublishedOptions"
              style="width: 180px"
            />
            <NButton type="primary" @click="handleFaqSearch">{{ $t('common.search') }}</NButton>
            <NButton @click="handleFaqReset">{{ $t('common.reset') }}</NButton>
            <div class="flex-1"></div>
            <NButton type="primary" @click="openFaqAdd">{{ $t('common.add') }}</NButton>
            <NButton type="error" :disabled="faqCheckedRowKeys.length === 0" @click="handleBatchDeleteFaq">
              {{ $t('common.batchDelete') }}
            </NButton>
          </div>

          <NDataTable
            v-model:checked-row-keys="faqCheckedRowKeys"
            :columns="faqColumns"
            :data="faqData"
            size="small"
            :loading="faqLoading"
            :pagination="faqPagination"
            :row-key="row => row.id"
            :scroll-x="1100"
            class="flex-1-hidden"
          />
        </NTabPane>

        <NTabPane name="feedback" :tab="$t('page.appManage.content.tabs.feedback')">
          <div class="mb-4 flex flex-wrap items-center gap-12px">
            <NSelect
              v-model:value="feedbackSearchForm.status"
              clearable
              :options="feedbackStatusOptions"
              style="width: 200px"
            />
            <NInput
              v-model:value="feedbackSearchForm.keyword"
              clearable
              style="width: 320px"
              :placeholder="$t('page.appManage.content.feedback.searchPlaceholder')"
            />
            <NButton type="primary" @click="handleFeedbackSearch">{{ $t('common.search') }}</NButton>
            <NButton @click="handleFeedbackReset">{{ $t('common.reset') }}</NButton>
          </div>

          <NDataTable
            :columns="feedbackColumns"
            :data="feedbackData"
            size="small"
            :loading="feedbackLoading"
            :pagination="feedbackPagination"
            :row-key="row => row.id"
            :scroll-x="1200"
            class="flex-1-hidden"
          />
        </NTabPane>
      </NTabs>
    </NCard>

    <div v-if="markdownFullscreen && tabs === 'pages'" class="markdown-fullscreen-bar">
      <NSpace align="center">
        <NButton size="small" :loading="pageLoading" @click="saveContentPage">{{ $t('common.save') }}</NButton>
        <NButton size="small" type="primary" :loading="pageLoading" @click="togglePublishContentPage">
          {{
            pagePublished
              ? $t('page.appManage.content.pages.unpublish')
              : $t('page.appManage.content.pages.publish')
          }}
        </NButton>
        <NButton size="small" tertiary @click="exitMarkdownFullscreen">{{ $t('icon.fullscreenExit') }}</NButton>
      </NSpace>
    </div>

    <!-- FAQ modal -->
    <NModal
      v-model:show="faqModalVisible"
      preset="card"
      style="width: 920px"
      :title="faqOperateType === 'add' ? $t('common.add') : $t('common.edit')"
    >
      <div v-if="faqModalLoading">{{ $t('common.loading') }}</div>
      <div v-else>
        <NForm :model="faqForm" label-placement="left" label-width="110">
          <NFormItem :label="$t('page.appManage.content.faq.form.pinned')">
            <NSelect
              v-model:value="faqForm.is_pinned"
              :options="[
                { label: $t('common.yesOrNo.no'), value: false },
                { label: $t('common.yesOrNo.yes'), value: true }
              ]"
              style="width: 220px"
            />
          </NFormItem>
          <NFormItem :label="$t('page.appManage.content.faq.form.sort')">
            <NInputNumber v-model:value="faqForm.sort" :min="0" :max="1000000" style="width: 220px" />
          </NFormItem>
          <NFormItem :label="$t('page.appManage.content.faq.form.published')">
            <NSelect
              v-model:value="faqForm.published"
              :options="[
                { label: $t('page.appManage.content.common.draft'), value: false },
                { label: $t('page.appManage.content.common.published'), value: true }
              ]"
              style="width: 220px"
            />
          </NFormItem>

          <NTabs type="line" animated>
            <NTabPane name="zh-CN" tab="zh-CN">
              <NFormItem :label="$t('page.appManage.content.faq.form.question')">
                <NInput v-model:value="faqForm.i18n['zh-CN'].question" />
              </NFormItem>
              <NFormItem :label="$t('page.appManage.content.faq.form.answer')" class="items-start">
                <NInput
                  v-model:value="faqForm.i18n['zh-CN'].answer_markdown"
                  type="textarea"
                  :autosize="{ minRows: 6 }"
                />
              </NFormItem>
            </NTabPane>
            <NTabPane name="en-US" tab="en-US">
              <NFormItem :label="$t('page.appManage.content.faq.form.question')">
                <NInput v-model:value="faqForm.i18n['en-US'].question" />
              </NFormItem>
              <NFormItem :label="$t('page.appManage.content.faq.form.answer')" class="items-start">
                <NInput
                  v-model:value="faqForm.i18n['en-US'].answer_markdown"
                  type="textarea"
                  :autosize="{ minRows: 6 }"
                />
              </NFormItem>
            </NTabPane>
          </NTabs>
        </NForm>
        <NSpace justify="end">
          <NButton :loading="faqModalLoading" type="primary" @click="submitFaq">{{ $t('common.confirm') }}</NButton>
          <NButton @click="faqModalVisible = false">{{ $t('common.cancel') }}</NButton>
        </NSpace>
      </div>
    </NModal>

    <!-- Feedback detail modal -->
    <NModal
      v-model:show="feedbackDetailVisible"
      preset="card"
      style="width: 920px"
      :title="$t('page.appManage.content.feedback.detailTitle')"
    >
      <div v-if="feedbackDetailLoading">{{ $t('common.loading') }}</div>
      <div v-else-if="feedbackDetail" class="grid gap-12px">
        <div class="grid gap-6px">
          <div class="flex justify-between">
            <span class="text-gray-500">{{ $t('page.appManage.content.feedback.table.user') }}</span>
            <span>{{ feedbackDetail.phone || feedbackDetail.email || feedbackDetail.user_id || '--' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ $t('page.appManage.content.feedback.table.status') }}</span>
            <span>{{ $t(`page.appManage.content.feedback.status.${feedbackDetail.status}`) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ $t('page.manage.api.created_at') }}</span>
            <span>{{ feedbackDetail.created_at || '--' }}</span>
          </div>
        </div>

        <div class="grid gap-6px">
          <div class="text-gray-500">{{ $t('page.appManage.content.feedback.table.content') }}</div>
          <div class="p-12px bg-gray-50 rounded whitespace-pre-wrap">{{ feedbackDetail.content }}</div>
        </div>

        <div v-if="feedbackDetail.images?.length" class="grid gap-6px">
          <div class="text-gray-500">{{ $t('page.appManage.content.feedback.table.images') }}</div>
          <NImageGroup>
            <NSpace>
              <NImage v-for="img in feedbackDetail.images" :key="img" :src="toPublicUrl(img)" width="92" />
            </NSpace>
          </NImageGroup>
        </div>

        <NForm :model="feedbackHandleForm" label-placement="left" label-width="110">
          <NFormItem :label="$t('page.appManage.content.feedback.form.status')">
            <NSelect
              v-model:value="feedbackHandleForm.status"
              :options="feedbackStatusOptions.filter(o => o.value !== null)"
              style="width: 220px"
            />
          </NFormItem>
          <NFormItem :label="$t('page.appManage.content.feedback.form.reply')" class="items-start">
            <NInput v-model:value="feedbackHandleForm.reply" type="textarea" :autosize="{ minRows: 4 }" />
          </NFormItem>
          <NFormItem :label="$t('page.appManage.content.feedback.form.note')" class="items-start">
            <NInput v-model:value="feedbackHandleForm.handle_note" type="textarea" :autosize="{ minRows: 3 }" />
          </NFormItem>
        </NForm>

        <NSpace justify="end">
          <NButton :loading="feedbackDetailLoading" type="primary" @click="submitFeedbackHandle">
            {{ $t('common.confirm') }}
          </NButton>
          <NButton @click="feedbackDetailVisible = false">{{ $t('common.cancel') }}</NButton>
        </NSpace>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.markdown-fullscreen-bar {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 2001;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--n-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
}
</style>
