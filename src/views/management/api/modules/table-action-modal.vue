<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { FormInst, FormItemRule } from 'naive-ui'
import { createRequiredFormRule } from '@/utils/form/rule'
import { addKey, updateKey } from '@/service/api'
import { $t } from '@/locales'
import { useAuthStore } from '@/store/modules/auth'

const authStore = useAuthStore()

export interface Props {
  visible: boolean
  type?: 'add' | 'edit'
  editData?: UserManagement.UserKey | null
  isSysAdmin?: boolean
  defaultTenantId?: string
}

export type ModalType = NonNullable<Props['type']>

defineOptions({ name: 'TableActionModal' })

const props = withDefaults(defineProps<Props>(), {
  type: 'add',
  editData: null,
  isSysAdmin: false,
  defaultTenantId: ''
})

interface Emits {
  (e: 'update:visible', visible: boolean): void
  (e: 'success'): void
}

const emit = defineEmits<Emits>()

const modalVisible = computed({
  get() {
    return props.visible
  },
  set(visible) {
    emit('update:visible', visible)
  }
})

const closeModal = () => {
  modalVisible.value = false
}

const title = computed(() => {
  const titles: Record<ModalType, string> = {
    add: $t('page.manage.api.addApiKey'),
    edit: $t('page.manage.api.editAPi')
  }
  return titles[props.type]
})

const formRef = ref<HTMLElement & FormInst>()

type FormModel = {
  id: string
  tenant_id: string
  app_id: string
  remark: string
  expired_at: number | null
  status: 0 | 1
}

const formModel = reactive<FormModel>(createDefaultFormModel())

const rules: Record<keyof FormModel, FormItemRule | FormItemRule[]> = {
  id: [],
  app_id: [],
  remark: createRequiredFormRule($t('page.manage.api.form.remark')),
  tenant_id: createRequiredFormRule($t('page.manage.api.form.tenantId')),
  expired_at: [],
  status: []
}

const statusOptions = computed(() => [
  {
    label: $t('page.manage.api.apiStatus1.normal'),
    value: 1
  },
  {
    label: $t('page.manage.api.apiStatus1.freeze'),
    value: 0
  }
])

function createDefaultFormModel(): FormModel {
  const tenantId = props.defaultTenantId || (authStore.userInfo.tenant_id as string) || ''
  return {
    id: '',
    tenant_id: tenantId,
    app_id: '',
    remark: '',
    expired_at: null,
    status: 1
  }
}

function applyFormModel(data: Partial<FormModel>) {
  Object.assign(formModel, data)
}

function handleUpdateFormModelByModalType() {
  if (props.type === 'add') {
    applyFormModel(createDefaultFormModel())
    return
  }

  if (!props.editData) {
    return
  }

  const appId = props.editData.app_id || props.editData.api_key || ''
  let expiredAt: number | null = null
  if (props.editData.expired_at) {
    const ts = dayjs(props.editData.expired_at).valueOf()
    expiredAt = Number.isNaN(ts) ? null : ts
  }

  applyFormModel({
    id: props.editData.id,
    tenant_id: props.editData.tenant_id || props.defaultTenantId || '',
    app_id: appId,
    remark: props.editData.remark || props.editData.name || '',
    expired_at: expiredAt,
    status: props.editData.status === 0 ? 0 : 1
  })
}

function formatExpiredAt(expiredAt: number | null): string {
  if (!expiredAt) {
    return ''
  }
  return dayjs(expiredAt).format('YYYY-MM-DD HH:mm:ss')
}

async function handleSubmit() {
  await formRef.value?.validate()

  let res: any
  if (props.type === 'add') {
    const payload: Api.UserManagement.KeyCreateReq = {
      remark: formModel.remark.trim(),
      status: formModel.status
    }
    const tenantId = formModel.tenant_id.trim()
    if (tenantId) {
      payload.tenant_id = tenantId
    }
    const expiredAt = formatExpiredAt(formModel.expired_at)
    if (expiredAt) {
      payload.expired_at = expiredAt
    }
    res = await addKey(payload)
  } else {
    const payload: Api.UserManagement.KeyUpdateReq = {
      id: formModel.id,
      remark: formModel.remark.trim(),
      status: formModel.status,
      expired_at: formatExpiredAt(formModel.expired_at)
    }
    res = await updateKey(payload)
  }

  if (!res.error) {
    emit('success')
    closeModal()
  }
}

watch(
  () => props.visible,
  newValue => {
    if (newValue) {
      handleUpdateFormModelByModalType()
    }
  }
)
</script>

<template>
  <n-modal v-model:show="modalVisible" preset="card" :title="title">
    <n-form ref="formRef" label-placement="left" :label-width="100" :model="formModel" :rules="rules">
      <n-form-item v-if="isSysAdmin" :label="$t('page.manage.api.tenantId')" path="tenant_id">
        <n-input
          v-model:value="formModel.tenant_id"
          :disabled="type === 'edit'"
          :placeholder="$t('page.manage.api.form.tenantId')"
        />
      </n-form-item>

      <n-form-item v-if="type === 'edit'" :label="$t('page.manage.api.appId')" path="app_id">
        <n-input v-model:value="formModel.app_id" disabled />
      </n-form-item>

      <n-form-item :label="$t('page.manage.api.remark')" path="remark">
        <n-input v-model:value="formModel.remark" :placeholder="$t('page.manage.api.form.remark')" />
      </n-form-item>

      <n-form-item :label="$t('page.manage.api.expiredAt')" path="expired_at">
        <n-date-picker v-model:value="formModel.expired_at" type="datetime" clearable style="width: 100%" />
      </n-form-item>

      <n-form-item :label="$t('page.manage.api.apiStatus')" path="status">
        <n-select v-model:value="formModel.status" :options="statusOptions" />
      </n-form-item>

      <n-space class="w-full pt-16px" :size="24" justify="end">
        <n-button class="w-72px" @click="closeModal">{{ $t('generate.cancel') }}</n-button>
        <n-button class="w-72px" type="primary" @click="handleSubmit">{{ $t('page.login.common.confirm') }}</n-button>
      </n-space>
    </n-form>
  </n-modal>
</template>

<style scoped></style>
