<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  useMessage
} from 'naive-ui'
import { bt } from '@/views/bms/_shared/i18n'
import { getPackWxMpConfig, type PackWxMpConfig, upsertPackWxMpConfig } from '@/service/api/bms'
import {
  fetchAdminContentPage,
  publishAdminContentPage,
  type ContentKey,
  upsertAdminContentPage
} from '@/service/api/app-manage'
import FilePicker from '@/components/business/file-picker/index.vue'
import MarkdownEditor from '@/views/app_manage/content/components/MarkdownEditor.vue'

const props = withDefaults(
  defineProps<{
    orgId: string
    showDescription?: boolean
  }>(),
  {
    showDescription: true
  }
)

const emit = defineEmits<{
  saved: [config: PackWxMpConfig | null]
}>()

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const config = ref<PackWxMpConfig | null>(null)
const activeTab = ref<'basic' | 'content'>('basic')
const form = ref({
  wx_appid: '',
  app_secret: '',
  status: 'OPEN' as 'OPEN' | 'CLOSE',
  home_banner_url: '',
  login_logo_url: '',
  warranty_cards_enabled: true,
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
const markdownEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const markdownFullscreen = ref(false)
const contentEditorHeight = 420

const statusOptions = [
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

function resetContent() {
  markdownEditorRef.value?.exitFullscreen?.()
  markdownFullscreen.value = false
  contentPublished.value = false
  contentForm.value = {
    title: '',
    content_markdown: ''
  }
}

function resetBasicForm() {
  config.value = null
  form.value = {
    wx_appid: '',
    app_secret: '',
    status: 'OPEN',
    home_banner_url: '',
    login_logo_url: '',
    warranty_cards_enabled: true,
    remark: ''
  }
}

async function loadContent() {
  if (!config.value?.app_id) {
    resetContent()
    return
  }
  contentLoading.value = true
  try {
    const res: any = await fetchAdminContentPage(contentKey.value, {
      app_id: config.value.app_id,
      lang: contentLang.value
    })
    const data = res?.data
    contentPublished.value = Boolean(data?.published)
    contentForm.value = {
      title: data?.title || '',
      content_markdown: data?.content_markdown || ''
    }
  } catch (err: any) {
    resetContent()
    message.error(err?.message || bt('auto.s_7619268c4a'))
  } finally {
    contentLoading.value = false
  }
}

async function loadConfig() {
  if (!props.orgId) {
    resetBasicForm()
    resetContent()
    return
  }
  activeTab.value = 'basic'
  resetBasicForm()
  resetContent()
  loading.value = true
  try {
    const res: any = await getPackWxMpConfig(props.orgId)
    const data = res?.data as PackWxMpConfig | undefined
    if (data?.id) {
      config.value = data
      form.value = {
        wx_appid: data.wx_appid || '',
        app_secret: '',
        status: data.status || 'OPEN',
        home_banner_url: data.home_banner_url || '',
        login_logo_url: data.login_logo_url || '',
        warranty_cards_enabled: data.warranty_cards_enabled !== false,
        remark: data.remark || ''
      }
      await loadContent()
    } else if (data) {
      config.value = data
      form.value.status = data.status || 'OPEN'
      form.value.warranty_cards_enabled = data.warranty_cards_enabled !== false
    }
  } catch (err: any) {
    if (err?.response?.status !== 404 && err?.code !== 404) {
      message.error(err?.message || bt('auto.s_1e6408f6f6'))
    }
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!props.orgId) return
  const wxAppID = form.value.wx_appid.trim()
  const secret = form.value.app_secret.trim()
  if (!wxAppID) {
    message.warning(bt('auto.s_a5c86beecc'))
    return
  }
  if (!config.value?.id && !secret) {
    message.warning(bt('auto.s_827339b69a'))
    return
  }

  saving.value = true
  try {
    const res: any = await upsertPackWxMpConfig(props.orgId, {
      wx_appid: wxAppID,
      app_secret: secret || undefined,
      status: form.value.status,
      home_banner_url: form.value.home_banner_url.trim() || undefined,
      login_logo_url: form.value.login_logo_url.trim() || undefined,
      warranty_cards_enabled: form.value.warranty_cards_enabled,
      remark: form.value.remark.trim() || undefined
    })
    config.value = res?.data || null
    form.value.app_secret = ''
    message.success(bt('auto.s_96107b4620'))
    emit('saved', config.value)
    await loadContent()
  } catch (err: any) {
    message.error(err?.message || bt('auto.s_3dc6b0152d'))
  } finally {
    saving.value = false
  }
}

async function saveContent(publish = false) {
  if (!config.value?.app_id) {
    message.warning(bt('auto.s_32f41a1b8b'))
    return
  }
  contentSaving.value = true
  try {
    await upsertAdminContentPage(contentKey.value, {
      app_id: config.value.app_id,
      lang: contentLang.value,
      title: contentForm.value.title,
      content_markdown: contentForm.value.content_markdown
    })
    if (publish) {
      await publishAdminContentPage(contentKey.value, { app_id: config.value.app_id })
    }
    message.success(publish ? bt('auto.s_a99def6083') : bt('auto.s_1c34535aa5'))
    await loadContent()
  } catch (err: any) {
    message.error(err?.message || bt('auto.s_9596d42fb4'))
  } finally {
    contentSaving.value = false
  }
}

function handleMarkdownFullscreen(value: boolean) {
  markdownFullscreen.value = value
}

function exitMarkdownFullscreen() {
  markdownEditorRef.value?.exitFullscreen?.()
}

watch(
  () => props.orgId,
  () => {
    loadConfig()
  },
  { immediate: true }
)

watch([contentKey, contentLang], () => {
  loadContent()
})

defineExpose({
  reload: loadConfig
})
</script>

<template>
  <div class="pack-wxmp-config-panel">
    <NSpin :show="loading">
      <NAlert v-if="showDescription" type="info" class="mb-16px">
        {{ bt('pages.org.wxmpConfigDesc') }}
      </NAlert>
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="basic" :tab="bt('auto.s_8911a9423d')">
          <NForm label-placement="left" label-width="120">
            <NFormItem :label="bt('auto.s_ac09e0a168')">
              <NInput v-model:value="form.wx_appid" :placeholder="bt('auto.s_a5c86beecc')" />
            </NFormItem>
            <NFormItem label="AppSecret">
              <NInput
                v-model:value="form.app_secret"
                type="password"
                show-password-on="click"
                :placeholder="bt('auto.s_e363fb799b')"
              />
            </NFormItem>
            <NFormItem :label="bt('auto.s_3fea7ca76c')">
              <NSelect v-model:value="form.status" :options="statusOptions" />
            </NFormItem>
            <NFormItem :label="bt('pages.org.warrantyCardsEnabled')">
              <NSwitch v-model:value="form.warranty_cards_enabled" />
              <div class="mt-6px text-12px opacity-70">{{ bt('pages.org.warrantyCardsEnabledHint') }}</div>
            </NFormItem>
            <NFormItem :label="bt('auto.s_da98ea8f7f')">
              <FilePicker
                v-model:model-value="form.home_banner_url"
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
                v-model:model-value="form.login_logo_url"
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
              <NInput v-model:value="form.remark" type="textarea" :placeholder="bt('auto.s_db0ce65fbc')" />
            </NFormItem>
          </NForm>

          <NSpace justify="end">
            <NButton :loading="saving" type="primary" @click="saveConfig">{{ bt('auto.s_164ac31dfd') }}</NButton>
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
                <NButton :disabled="!config?.app_id" :loading="contentSaving" @click="saveContent(false)">
                  {{ bt('auto.s_4d7ea6dfa6') }}
                </NButton>
                <NButton type="primary" :disabled="!config?.app_id" :loading="contentSaving" @click="saveContent(true)">
                  {{ bt('auto.s_5c097911f8') }}
                </NButton>
              </NSpace>
            </NSpace>
            <NSpin :show="contentLoading">
              <NAlert v-if="!config?.app_id" type="warning" class="mb-16px">
                {{ bt('pages.org.contentDisabledHint') }}
              </NAlert>
              <NForm v-else label-placement="left" label-width="110">
                <NFormItem :label="bt('auto.s_32c65d8d74')">
                  <NInput v-model:value="contentForm.title" :placeholder="bt('auto.s_e9fa62ec22')" />
                </NFormItem>
                <NFormItem :label="bt('auto.s_c536c43976')" class="items-start">
                  <div class="w-full">
                    <MarkdownEditor
                      ref="markdownEditorRef"
                      v-model="contentForm.content_markdown"
                      :placeholder="bt('auto.s_eda4fb6cf5')"
                      :height="contentEditorHeight"
                      :min-height="contentEditorHeight"
                      @fullscreen-change="handleMarkdownFullscreen"
                    />
                  </div>
                </NFormItem>
              </NForm>
            </NSpin>
          </div>
        </NTabPane>
      </NTabs>
    </NSpin>

    <div v-if="markdownFullscreen" class="markdown-fullscreen-bar">
      <NSpace align="center">
        <NButton size="small" :loading="contentSaving" @click="saveContent(false)">
          {{ bt('auto.s_4d7ea6dfa6') }}
        </NButton>
        <NButton size="small" type="primary" :loading="contentSaving" @click="saveContent(true)">
          {{ bt('auto.s_5c097911f8') }}
        </NButton>
        <NButton size="small" tertiary @click="exitMarkdownFullscreen">{{ bt('auto.s_49041f2450') }}</NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.content-toolbar {
  margin-bottom: 16px;
}

.markdown-fullscreen-bar {
  position: fixed;
  top: 14px;
  right: 72px;
  z-index: 3000;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--n-color);
  box-shadow: 0 8px 24px rgb(0 0 0 / 16%);
}
</style>
