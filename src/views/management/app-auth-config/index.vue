<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { $t } from '@/locales'
import { useAuthStore } from '@/store/modules/auth'
import { fetchUserList } from '@/service/api/auth'
import {
  fetchAuthMessageTemplates,
  fetchWxMpConfig,
  type AuthTemplateChannel,
  type AuthTemplateScene,
  upsertAuthMessageTemplate,
  upsertWxMpConfig
} from '@/service/api/app-auth-config'

const authStore = useAuthStore()
const message = useMessage()

const isSysAdmin = computed(() => authStore.userInfo.authority === 'SYS_ADMIN')

const tenantIdInput = ref<string | null>(null)
const effectiveTenantId = computed(() => {
  if (isSysAdmin.value) return (tenantIdInput.value || '').trim()
  return (authStore.userInfo.tenant_id as string) || ''
})

const tenantLoading = ref(false)
const tenantOptions = ref<{ label: string; value: string }[]>([])

async function loadTenants() {
  if (!isSysAdmin.value) return
  tenantLoading.value = true
  try {
    const resp: any = await fetchUserList({ page: 1, page_size: 1000 })
    const list = resp?.data?.list || []
    tenantOptions.value = (list as any[])
      .map(u => {
        const tenantId = (u?.tenant_id as string) || (u?.tenantId as string) || ''
        const labelName = (u?.name as string) || (u?.email as string) || tenantId
        if (!tenantId) return null
        return { label: `${labelName} (${tenantId})`, value: tenantId }
      })
      .filter(Boolean)

    if (!tenantIdInput.value && tenantOptions.value.length > 0) {
      tenantIdInput.value = tenantOptions.value[0].value
    }
  } finally {
    tenantLoading.value = false
  }
}

const templateLoading = ref(false)
const templateSavingKey = ref<string | null>(null)
const wxmpLoading = ref(false)
const wxmpSaving = ref(false)

const scenes: { key: AuthTemplateScene; label: string }[] = [
  { key: 'LOGIN', label: $t('page.manage.appAuthConfig.scenes.login') },
  { key: 'REGISTER', label: $t('page.manage.appAuthConfig.scenes.register') },
  { key: 'RESET_PASSWORD', label: $t('page.manage.appAuthConfig.scenes.resetPassword') },
  { key: 'BIND', label: $t('page.manage.appAuthConfig.scenes.bind') }
]

type TemplateForm = {
  channel: AuthTemplateChannel
  scene: AuthTemplateScene
  status: 'OPEN' | 'CLOSE'
  subject: string
  content: string
  provider: string
  provider_template_code: string
  remark: string
}

function createEmptyTemplate(channel: AuthTemplateChannel, scene: AuthTemplateScene): TemplateForm {
  return {
    channel,
    scene,
    status: 'CLOSE',
    subject: '',
    content: '',
    provider: channel === 'SMS' ? 'ALIYUN' : '',
    provider_template_code: '',
    remark: ''
  }
}

const templates = reactive<Record<AuthTemplateChannel, Record<AuthTemplateScene, TemplateForm>>>({
  EMAIL: {
    LOGIN: createEmptyTemplate('EMAIL', 'LOGIN'),
    REGISTER: createEmptyTemplate('EMAIL', 'REGISTER'),
    RESET_PASSWORD: createEmptyTemplate('EMAIL', 'RESET_PASSWORD'),
    BIND: createEmptyTemplate('EMAIL', 'BIND')
  },
  SMS: {
    LOGIN: createEmptyTemplate('SMS', 'LOGIN'),
    REGISTER: createEmptyTemplate('SMS', 'REGISTER'),
    RESET_PASSWORD: createEmptyTemplate('SMS', 'RESET_PASSWORD'),
    BIND: createEmptyTemplate('SMS', 'BIND')
  }
})

const wxmpForm = reactive({
  appid: '',
  app_secret: '',
  status: 'CLOSE' as 'OPEN' | 'CLOSE',
  remark: ''
})

async function loadTemplates() {
  if (isSysAdmin.value && !effectiveTenantId.value) {
    message.warning($t('page.manage.appAuthConfig.tenantRequired'))
    return
  }
  templateLoading.value = true
  try {
    const data = await fetchAuthMessageTemplates(isSysAdmin.value ? effectiveTenantId.value : undefined)

    for (const channel of ['EMAIL', 'SMS'] as AuthTemplateChannel[]) {
      for (const scene of ['LOGIN', 'REGISTER', 'RESET_PASSWORD', 'BIND'] as AuthTemplateScene[]) {
        Object.assign(templates[channel][scene], createEmptyTemplate(channel, scene))
      }
    }

    for (const item of data || []) {
      const channel = item.channel
      const scene = item.scene
      const form = templates[channel]?.[scene]
      if (!form) continue

      form.status = item.status || 'CLOSE'
      form.subject = item.subject || ''
      form.content = item.content || ''
      form.provider = item.provider || (channel === 'SMS' ? 'ALIYUN' : '')
      form.provider_template_code = item.provider_template_code || ''
      form.remark = item.remark || ''
    }
  } finally {
    templateLoading.value = false
  }
}

async function saveTemplate(channel: AuthTemplateChannel, scene: AuthTemplateScene) {
  if (isSysAdmin.value && !effectiveTenantId.value) {
    message.warning($t('page.manage.appAuthConfig.tenantRequired'))
    return
  }

  const f = templates[channel][scene]
  const key = `${channel}_${scene}`
  templateSavingKey.value = key

  try {
    const payload: any = {
      channel,
      scene,
      status: f.status,
      remark: f.remark || undefined
    }

    if (channel === 'EMAIL') {
      payload.subject = f.subject || undefined
      payload.content = f.content || undefined
    } else {
      payload.provider = f.provider || 'ALIYUN'
      payload.provider_template_code = f.provider_template_code || undefined
    }

    await upsertAuthMessageTemplate(payload, isSysAdmin.value ? effectiveTenantId.value : undefined)
    message.success($t('common.operationSuccess'))
    await loadTemplates()
  } finally {
    templateSavingKey.value = null
  }
}

async function loadWxmpConfig() {
  if (isSysAdmin.value && !effectiveTenantId.value) {
    message.warning($t('page.manage.appAuthConfig.tenantRequired'))
    return
  }
  wxmpLoading.value = true
  try {
    const data = await fetchWxMpConfig(isSysAdmin.value ? effectiveTenantId.value : undefined)
    wxmpForm.appid = data?.appid || ''
    wxmpForm.status = (data?.status as any) || 'CLOSE'
    wxmpForm.remark = (data?.remark as any) || ''
    wxmpForm.app_secret = ''
  } finally {
    wxmpLoading.value = false
  }
}

async function saveWxmpConfig() {
  if (isSysAdmin.value && !effectiveTenantId.value) {
    message.warning($t('page.manage.appAuthConfig.tenantRequired'))
    return
  }
  if (!wxmpForm.appid.trim() || !wxmpForm.app_secret.trim()) {
    message.warning($t('page.manage.appAuthConfig.wxmpSecretRequired'))
    return
  }

  wxmpSaving.value = true
  try {
    await upsertWxMpConfig(
      {
        appid: wxmpForm.appid.trim(),
        app_secret: wxmpForm.app_secret.trim(),
        status: wxmpForm.status,
        remark: wxmpForm.remark || undefined
      },
      isSysAdmin.value ? effectiveTenantId.value : undefined
    )
    message.success($t('common.operationSuccess'))
    await loadWxmpConfig()
  } finally {
    wxmpSaving.value = false
  }
}

function init() {
  loadTemplates()
  loadWxmpConfig()
}

if (isSysAdmin.value) {
  loadTenants()
  watch(
    () => tenantIdInput.value,
    () => {
      if (!effectiveTenantId.value) return
      init()
    }
  )
}

if (!isSysAdmin.value) {
  init()
}
</script>

<template>
  <div class="overflow-hidden">
    <NCard :bordered="false" class="h-full rounded-8px shadow-sm">
      <div class="h-full flex-col gap-16px">
        <div v-if="isSysAdmin" class="flex items-center gap-12px">
          <div class="w-240px">
            <NSelect
              v-model:value="tenantIdInput"
              filterable
              clearable
              :loading="tenantLoading"
              :options="tenantOptions"
              :placeholder="$t('page.manage.appAuthConfig.tenantIdPlaceholder')"
            />
          </div>
          <NButton type="primary" @click="init">{{ $t('common.refresh') }}</NButton>
          <NText depth="3">{{ $t('page.manage.appAuthConfig.tenantHint') }}</NText>
        </div>

        <NTabs type="line" animated>
          <NTabPane name="templates" :tab="$t('page.manage.appAuthConfig.tabs.templates')" class="pannel-content">
            <NSpin :show="templateLoading">
              <NTabs type="segment" animated>
                <NTabPane name="email" :tab="$t('page.manage.appAuthConfig.channels.email')">
                  <div class="grid grid-cols-1 gap-12px lg:grid-cols-2">
                    <NCard
                      v-for="s in scenes"
                      :key="`EMAIL_${s.key}`"
                      size="small"
                      :title="s.label"
                      class="rounded-8px"
                    >
                      <NForm label-placement="left" :label-width="110">
                        <NFormItem :label="$t('page.manage.appAuthConfig.fields.status')">
                          <NSelect
                            v-model:value="templates.EMAIL[s.key].status"
                            :options="[
                              { label: $t('page.manage.appAuthConfig.status.open'), value: 'OPEN' },
                              { label: $t('page.manage.appAuthConfig.status.close'), value: 'CLOSE' }
                            ]"
                          />
                        </NFormItem>
                        <NFormItem :label="$t('page.manage.appAuthConfig.fields.subject')">
                          <NInput v-model:value="templates.EMAIL[s.key].subject" />
                        </NFormItem>
                        <NFormItem :label="$t('page.manage.appAuthConfig.fields.content')">
                          <NInput
                            v-model:value="templates.EMAIL[s.key].content"
                            type="textarea"
                            :placeholder="$t('page.manage.appAuthConfig.emailContentPlaceholder')"
                            :autosize="{ minRows: 3, maxRows: 6 }"
                          />
                        </NFormItem>
                        <NFormItem :label="$t('page.manage.appAuthConfig.fields.remark')">
                          <NInput v-model:value="templates.EMAIL[s.key].remark" />
                        </NFormItem>
                        <div class="flex justify-end">
                          <NButton
                            type="primary"
                            :loading="templateSavingKey === `EMAIL_${s.key}`"
                            @click="saveTemplate('EMAIL', s.key)"
                          >
                            {{ $t('common.save') }}
                          </NButton>
                        </div>
                      </NForm>
                    </NCard>
                  </div>
                </NTabPane>

                <NTabPane name="sms" :tab="$t('page.manage.appAuthConfig.channels.sms')">
                  <NAlert type="info" class="mb-12px">
                    {{ $t('page.manage.appAuthConfig.smsHint') }}
                  </NAlert>
                  <div class="grid grid-cols-1 gap-12px lg:grid-cols-2">
                    <NCard v-for="s in scenes" :key="`SMS_${s.key}`" size="small" :title="s.label" class="rounded-8px">
                      <NForm label-placement="left" :label-width="130">
                        <NFormItem :label="$t('page.manage.appAuthConfig.fields.status')">
                          <NSelect
                            v-model:value="templates.SMS[s.key].status"
                            :options="[
                              { label: $t('page.manage.appAuthConfig.status.open'), value: 'OPEN' },
                              { label: $t('page.manage.appAuthConfig.status.close'), value: 'CLOSE' }
                            ]"
                          />
                        </NFormItem>
                        <NFormItem :label="$t('page.manage.appAuthConfig.fields.provider')">
                          <NSelect
                            v-model:value="templates.SMS[s.key].provider"
                            :options="[{ label: 'ALIYUN', value: 'ALIYUN' }]"
                          />
                        </NFormItem>
                        <NFormItem :label="$t('page.manage.appAuthConfig.fields.providerTemplateCode')">
                          <NInput v-model:value="templates.SMS[s.key].provider_template_code" />
                        </NFormItem>
                        <NFormItem :label="$t('page.manage.appAuthConfig.fields.remark')">
                          <NInput v-model:value="templates.SMS[s.key].remark" />
                        </NFormItem>
                        <div class="flex justify-end">
                          <NButton
                            type="primary"
                            :loading="templateSavingKey === `SMS_${s.key}`"
                            @click="saveTemplate('SMS', s.key)"
                          >
                            {{ $t('common.save') }}
                          </NButton>
                        </div>
                      </NForm>
                    </NCard>
                  </div>
                </NTabPane>
              </NTabs>
            </NSpin>
          </NTabPane>

          <NTabPane name="wxmp" :tab="$t('page.manage.appAuthConfig.tabs.wxmp')" class="pannel-content">
            <NSpin :show="wxmpLoading">
              <NAlert type="warning" class="mb-12px">
                {{ $t('page.manage.appAuthConfig.wxmpSecretNotice') }}
              </NAlert>
              <NForm label-placement="left" :label-width="140">
                <NFormItem :label="$t('page.manage.appAuthConfig.fields.wxmpAppid')">
                  <NInput v-model:value="wxmpForm.appid" />
                </NFormItem>
                <NFormItem :label="$t('page.manage.appAuthConfig.fields.wxmpSecret')">
                  <NInput v-model:value="wxmpForm.app_secret" type="password" show-password-on="mousedown" />
                </NFormItem>
                <NFormItem :label="$t('page.manage.appAuthConfig.fields.status')">
                  <NSelect
                    v-model:value="wxmpForm.status"
                    :options="[
                      { label: $t('page.manage.appAuthConfig.status.open'), value: 'OPEN' },
                      { label: $t('page.manage.appAuthConfig.status.close'), value: 'CLOSE' }
                    ]"
                  />
                </NFormItem>
                <NFormItem :label="$t('page.manage.appAuthConfig.fields.remark')">
                  <NInput v-model:value="wxmpForm.remark" />
                </NFormItem>
                <div class="flex justify-end">
                  <NButton type="primary" :loading="wxmpSaving" @click="saveWxmpConfig">
                    {{ $t('common.save') }}
                  </NButton>
                </div>
              </NForm>
            </NSpin>
          </NTabPane>
        </NTabs>
      </div>
    </NCard>
  </div>
</template>

<style scoped lang="scss">
.pannel-content {
  padding-top: 16px !important;
}
</style>
