<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInst } from 'naive-ui'
import { useBoolean, useLoading } from '@sa/hooks'
import { editNotificationServices, fetchNotificationServicesSMS, fetchUserList, sendTestSMS } from '@/service/api'
import { useAuthStore } from '@/store/modules/auth'
import { deepClone } from '@/utils/common/tool'
import { createRequiredFormRule } from '@/utils/form/rule'
import { $t } from '~/src/locales'

const { loading, startLoading, endLoading } = useLoading(false)
const { bool: debugVisible, setTrue: openDebugModal, setFalse: closeDebugModal } = useBoolean()
const authStore = useAuthStore()
const isSysAdmin = computed(() => authStore.userInfo.authority === 'SYS_ADMIN')
const tenantLoading = ref(false)
const tenantOptions = ref<{ label: string; value: string }[]>([])
const debugTenantId = ref<string | null>(null)

const formModel = reactive<NotificationServices.SMS>(createDefaultFormModel())
const debugSubmitting = ref(false)
const debugResult = ref('')
const debugForm = reactive({
  phone_prefix: '+86',
  phone_number: '',
  scene: 'REGISTER' as 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD' | 'BIND'
})
const debugSceneOptions = [
  { label: 'LOGIN', value: 'LOGIN' },
  { label: 'REGISTER', value: 'REGISTER' },
  { label: 'RESET_PASSWORD', value: 'RESET_PASSWORD' },
  { label: 'BIND', value: 'BIND' }
]

const effectiveDebugTenantId = computed(() => {
  if (isSysAdmin.value) return (debugTenantId.value || '').trim()
  return String(authStore.userInfo.tenant_id || '').trim()
})

const currentTenantOption = computed(() => {
  const tenantId = String(authStore.userInfo.tenant_id || '').trim()
  if (!tenantId) return null
  const labelName = String(authStore.userInfo.userName || authStore.userInfo.name || tenantId)
  return {
    label: `${labelName} (${tenantId})`,
    value: tenantId
  }
})

const debugTenantOptions = computed(() => {
  const options = [...tenantOptions.value]
  const fallback = currentTenantOption.value
  if (fallback && !options.some(option => option.value === fallback.value)) {
    options.unshift(fallback)
  }
  return options
})

function createDefaultSMSConfig() {
  return {
    provider: 'ALIYUN',
    aliyun_sms_config: {
      access_key_id: '',
      access_key_secret: '',
      endpoint: 'dysmsapi.aliyuncs.com',
      sign_name: '',
      template_code: ''
    }
  }
}

function createDefaultFormModel(): NotificationServices.SMS {
  return {
    id: '',
    sme_config: createDefaultSMSConfig(),
    config: '',
    notice_type: 'SME_CODE',
    status: 'CLOSE',
    remark: ''
  }
}

function resolveNotificationConfigPayload<T>(payload: T | { data?: T | null } | null | undefined): T | null {
  if (!payload) return null

  if (typeof payload === 'object' && 'data' in payload) {
    return (payload as { data?: T | null }).data ?? null
  }

  return payload as T
}

function resolveSMSTestResult(
  payload:
    | NotificationServices.SMSTestResult
    | { data?: NotificationServices.SMSTestResult | null; message?: string | null }
    | null
    | undefined
): NotificationServices.SMSTestResult {
  const result = resolveNotificationConfigPayload<NotificationServices.SMSTestResult>(payload as any)

  if (result && typeof result === 'object' && 'success' in result) {
    return result
  }

  return {
    success: false,
    summary: typeof payload === 'object' && payload?.message ? payload.message : '短信调试返回结果异常',
    phone: '',
    scene: '',
    steps: []
  }
}

function normalizeSMSConfig(data: Api.NotificationServices.SMS | null) {
  const nextSMSConfig = createDefaultSMSConfig()
  const rawConfig = data?.config
  const parsedConfig =
    typeof rawConfig === 'string' && rawConfig && rawConfig !== 'null'
      ? (() => {
          try {
            return JSON.parse(rawConfig)
          } catch {
            return null
          }
        })()
      : rawConfig && typeof rawConfig === 'object'
        ? rawConfig
        : null

  const sourceConfig = ((parsedConfig ?? data?.sme_config) as Partial<typeof nextSMSConfig> | null) ?? null

  if (!sourceConfig || typeof sourceConfig !== 'object') {
    return nextSMSConfig
  }

  nextSMSConfig.provider = sourceConfig.provider ?? nextSMSConfig.provider
  Object.assign(nextSMSConfig.aliyun_sms_config, sourceConfig.aliyun_sms_config ?? {})

  return nextSMSConfig
}

function setTableData(data: Api.NotificationServices.SMS | null) {
  const defaults = createDefaultFormModel()
  const nextSMSConfig = normalizeSMSConfig(data)

  formModel.id = data?.id ?? defaults.id
  formModel.config = data?.config ?? defaults.config
  formModel.notice_type = data?.notice_type ?? defaults.notice_type
  formModel.status = data?.status ?? defaults.status
  formModel.remark = data?.remark ?? defaults.remark
  formModel.sme_config.provider = nextSMSConfig.provider
  Object.assign(
    formModel.sme_config.aliyun_sms_config,
    createDefaultSMSConfig().aliyun_sms_config,
    nextSMSConfig.aliyun_sms_config
  )
}

async function getNotificationServices() {
  startLoading()
  try {
    const response = await fetchNotificationServicesSMS()
    const data = resolveNotificationConfigPayload<Api.NotificationServices.SMS>(response as any)
    if (data) {
      setTableData(data)
    }
  } finally {
    endLoading()
  }
}

async function loadTenants() {
  tenantLoading.value = true
  try {
    const resp: any = await fetchUserList({ page: 1, page_size: 1000 })
    const list = resp?.data?.list || resp?.list || []
    tenantOptions.value = (list as any[])
      .map((u): { label: string; value: string } | null => {
        const tenantId = (u?.tenant_id as string) || (u?.tenantId as string) || ''
        const labelName = (u?.name as string) || (u?.email as string) || tenantId
        if (!tenantId) return null
        return { label: `${labelName} (${tenantId})`, value: tenantId }
      })
      .filter((item): item is { label: string; value: string } => item !== null)

    if (!debugTenantId.value && debugTenantOptions.value.length > 0) {
      debugTenantId.value = debugTenantOptions.value[0].value
    }
  } catch {
    if (!debugTenantId.value && currentTenantOption.value) {
      debugTenantId.value = currentTenantOption.value.value
    }
  } finally {
    tenantLoading.value = false
  }
}

function formatSMSTestResult(result: NotificationServices.SMSTestResult) {
  const lines = [
    `结果: ${result.success ? '成功' : '失败'}`,
    `摘要: ${result.summary || '-'}`,
    `手机号: ${result.phone || '-'}`,
    `场景: ${result.scene || '-'}`
  ]

  if (result.provider) lines.push(`供应商: ${result.provider}`)
  if (result.template_code) lines.push(`实际模板ID: ${result.template_code}`)
  if (result.default_template_code) lines.push(`通知配置默认模板ID: ${result.default_template_code}`)
  if (result.sign_name) lines.push(`签名: ${result.sign_name}`)
  if (result.endpoint) lines.push(`Endpoint: ${result.endpoint}`)
  if (result.provider_code) lines.push(`供应商返回码: ${result.provider_code}`)
  if (result.provider_message) lines.push(`供应商返回信息: ${result.provider_message}`)
  if (result.request_id) lines.push(`RequestId: ${result.request_id}`)

  if (Array.isArray(result.steps) && result.steps.length > 0) {
    lines.push('', '链路诊断:')
    result.steps.forEach((step, index) => {
      lines.push(`${index + 1}. [${step.ok ? 'OK' : 'FAIL'}] ${step.name}: ${step.detail || '-'}`)
    })
  }

  return lines.join('\n')
}

function handleOpenDebugModal() {
  debugResult.value = ''
  openDebugModal()
}

async function handleSendDebug() {
  const phoneNumber = debugForm.phone_number.trim()
  if (isSysAdmin.value && !effectiveDebugTenantId.value) {
    window.$message?.warning($t('page.manage.appAuthConfig.tenantRequired'))
    return
  }
  if (!phoneNumber) {
    window.$message?.warning($t('page.manage.notification.shortMessage.debug.phonePlaceholder'))
    return
  }

  debugSubmitting.value = true
  debugResult.value = ''
  try {
    const payload = await sendTestSMS({
      tenant_id: isSysAdmin.value ? effectiveDebugTenantId.value : undefined,
      phone_prefix: debugForm.phone_prefix.trim() || '+86',
      phone_number: phoneNumber,
      scene: debugForm.scene
    })
    const result = resolveSMSTestResult(payload as any)
    debugResult.value = formatSMSTestResult(result)

    if (result.success === true) {
      window.$message?.success(result.summary || 'success')
    } else {
      window.$message?.warning(result.summary || 'failed')
    }
  } catch (error: any) {
    const summary = error?.message || '短信调试请求失败'
    debugResult.value = formatSMSTestResult({
      success: false,
      summary,
      phone: `${debugForm.phone_prefix.trim() || '+86'} ${phoneNumber}`.trim(),
      scene: debugForm.scene,
      steps: []
    })
    throw error
  } finally {
    debugSubmitting.value = false
  }
}

const rules = {
  'sme_config.provider': createRequiredFormRule($t('common.pleaseCheckValue')),
  'sme_config.aliyun_sms_config.access_key_id': createRequiredFormRule($t('common.pleaseCheckValue')),
  'sme_config.aliyun_sms_config.access_key_secret': createRequiredFormRule($t('common.pleaseCheckValue')),
  'sme_config.aliyun_sms_config.endpoint': createRequiredFormRule($t('common.pleaseCheckValue')),
  'sme_config.aliyun_sms_config.sign_name': createRequiredFormRule($t('common.pleaseCheckValue')),
  'sme_config.aliyun_sms_config.template_code': createRequiredFormRule($t('common.pleaseCheckValue'))
}

const formRef = ref<HTMLElement & FormInst>()
async function handleSubmit() {
  await formRef.value?.validate()
  startLoading()
  try {
    const formData = deepClone(formModel) as any
    delete formData.config
    const data: any = await editNotificationServices(formData)
    if (!data.error) {
      window.$message?.success('success')
      await getNotificationServices()
    }
  } finally {
    endLoading()
  }
}

function init() {
  getNotificationServices()
}

loadTenants()
watch(
  () => debugVisible.value,
  visible => {
    if (visible && !debugTenantId.value && debugTenantOptions.value.length > 0) {
      debugTenantId.value = debugTenantOptions.value[0].value
    }
  }
)

init()
</script>

<template>
  <NSpin :show="loading">
    <NForm ref="formRef" label-placement="left" :label-width="160" :model="formModel" :rules="rules">
      <NGrid :cols="24">
        <NFormItemGridItem
          :span="8"
          :label="$t('page.manage.notification.shortMessage.form.provider')"
          path="sme_config.provider"
        >
          <NSelect v-model:value="formModel.sme_config.provider" :options="[{ label: 'ALIYUN', value: 'ALIYUN' }]" />
        </NFormItemGridItem>
      </NGrid>

      <NGrid :cols="24">
        <NFormItemGridItem
          :span="12"
          :label="$t('page.manage.notification.shortMessage.form.accessKeyId')"
          path="sme_config.aliyun_sms_config.access_key_id"
        >
          <NInput v-model:value="formModel.sme_config.aliyun_sms_config.access_key_id" />
        </NFormItemGridItem>
      </NGrid>
      <NGrid :cols="24">
        <NFormItemGridItem
          :span="12"
          :label="$t('page.manage.notification.shortMessage.form.accessKeySecret')"
          path="sme_config.aliyun_sms_config.access_key_secret"
        >
          <NInput
            v-model:value="formModel.sme_config.aliyun_sms_config.access_key_secret"
            type="password"
            show-password-on="mousedown"
          />
        </NFormItemGridItem>
      </NGrid>
      <NGrid :cols="24">
        <NFormItemGridItem
          :span="12"
          :label="$t('page.manage.notification.shortMessage.form.endpoint')"
          path="sme_config.aliyun_sms_config.endpoint"
        >
          <NInput v-model:value="formModel.sme_config.aliyun_sms_config.endpoint" />
        </NFormItemGridItem>
      </NGrid>
      <NGrid :cols="24">
        <NFormItemGridItem
          :span="12"
          :label="$t('page.manage.notification.shortMessage.form.signName')"
          path="sme_config.aliyun_sms_config.sign_name"
        >
          <NInput v-model:value="formModel.sme_config.aliyun_sms_config.sign_name" />
        </NFormItemGridItem>
      </NGrid>
      <NGrid :cols="24">
        <NFormItemGridItem
          :span="12"
          :label="$t('page.manage.notification.shortMessage.form.templateCode')"
          path="sme_config.aliyun_sms_config.template_code"
        >
          <NInput v-model:value="formModel.sme_config.aliyun_sms_config.template_code" />
        </NFormItemGridItem>
      </NGrid>

      <NGrid :cols="24">
        <NFormItemGridItem :span="8" :label="$t('page.manage.notification.enableDisableService')" path="status">
          <n-switch v-model:value="formModel.status" checked-value="OPEN" unchecked-value="CLOSE" />
        </NFormItemGridItem>
      </NGrid>

      <NGrid :cols="24">
        <NFormItemGridItem :span="24" class="mt-20px">
          <div class="w-120px"></div>
          <NButton class="w-72px" @click="handleOpenDebugModal">
            {{ $t('common.debug') }}
          </NButton>
          <NButton class="ml-20px w-72px" type="primary" @click="handleSubmit">
            {{ $t('common.save') }}
          </NButton>
        </NFormItemGridItem>
      </NGrid>
    </NForm>
  </NSpin>

  <NModal
    v-model:show="debugVisible"
    preset="card"
    :title="$t('page.manage.notification.shortMessage.debug.title')"
    class="w-640px"
  >
    <NForm label-placement="left" :label-width="120" :model="debugForm">
      <NGrid :cols="24" :x-gap="18">
        <NFormItemGridItem :span="24" :label="$t('page.manage.api.tenantId')" path="tenant_id">
          <NSelect
            v-model:value="debugTenantId"
            filterable
            clearable
            :loading="tenantLoading"
            :options="debugTenantOptions"
            :placeholder="$t('page.manage.appAuthConfig.tenantIdPlaceholder')"
          />
        </NFormItemGridItem>

        <NFormItemGridItem
          :span="24"
          :label="$t('page.manage.notification.shortMessage.debug.phoneNumber')"
          path="phone_number"
        >
          <NInputGroup>
            <NInput v-model:value="debugForm.phone_prefix" class="max-w-90px" />
            <NInput
              v-model:value="debugForm.phone_number"
              :placeholder="$t('page.manage.notification.shortMessage.debug.phonePlaceholder')"
            />
          </NInputGroup>
        </NFormItemGridItem>

        <NFormItemGridItem :span="24" :label="$t('page.manage.notification.shortMessage.debug.scene')" path="scene">
          <NSelect v-model:value="debugForm.scene" :options="debugSceneOptions" />
        </NFormItemGridItem>

        <NFormItemGridItem :span="24" :label="$t('page.manage.notification.shortMessage.debug.result')">
          <NInput
            :value="debugResult"
            type="textarea"
            readonly
            :autosize="{ minRows: 10, maxRows: 16 }"
            :placeholder="$t('page.manage.notification.shortMessage.debug.resultPlaceholder')"
          />
        </NFormItemGridItem>
      </NGrid>

      <NSpace class="w-full pt-16px" :size="24" justify="center">
        <NButton @click="closeDebugModal">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="debugSubmitting" @click="handleSendDebug">
          {{ $t('common.send') }}
        </NButton>
      </NSpace>
    </NForm>
  </NModal>
</template>
