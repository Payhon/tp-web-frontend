<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInst } from 'naive-ui'
import { useLoading } from '@sa/hooks'
import { editNotificationServices, fetchNotificationServicesSMS } from '@/service/api'
import { deepClone } from '@/utils/common/tool'
import { createRequiredFormRule } from '@/utils/form/rule'
import { $t } from '~/src/locales'

const { loading, startLoading, endLoading } = useLoading(false)

const formModel = reactive<NotificationServices.SMS>(createDefaultFormModel())

function createDefaultFormModel(): NotificationServices.SMS {
  return {
    id: '',
    sme_config: {
      provider: 'ALIYUN',
      aliyun_sms_config: {
        access_key_id: '',
        access_key_secret: '',
        endpoint: 'dysmsapi.aliyuncs.com',
        sign_name: '',
        template_code: ''
      }
    },
    config: '',
    notice_type: 'SME_CODE',
    status: 'CLOSE',
    remark: ''
  }
}

function setTableData(data: Api.NotificationServices.SMS) {
  Object.assign(formModel, data)
  const raw = (data as any).config
  if (!raw || raw === 'null') return
  try {
    formModel.sme_config = JSON.parse(raw)
  } catch {
    // ignore parse error to avoid breaking page
  }
}

async function getNotificationServices() {
  startLoading()
  const { data } = await fetchNotificationServicesSMS()
  if (data) {
    setTableData(data)
  }
  endLoading()
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
  const formData = deepClone(formModel) as any
  delete formData.config
  const data: any = await editNotificationServices(formData)
  if (!data.error) {
    window.$message?.success('success')
    await getNotificationServices()
  }
  endLoading()
}

function init() {
  getNotificationServices()
}

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
          <NButton class="ml-20px w-72px" type="primary" @click="handleSubmit">
            {{ $t('common.save') }}
          </NButton>
        </NFormItemGridItem>
      </NGrid>
    </NForm>
  </NSpin>
</template>
