<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NInput, NInputNumber, NModal, NSelect, NSpace, useMessage } from 'naive-ui'
import { useAuthStore } from '@/store/modules/auth'
import { createBatteryModel, getBatteryModelList, getOrgList } from '@/service/api/bms'

type Option = {
  label: string
  value: number
}

const props = withDefaults(
  defineProps<{
    modelValue: number | null
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    allowCreate?: boolean
    orgId?: string | null
  }>(),
  {
    placeholder: '请选择电池型号',
    clearable: true,
    disabled: false,
    allowCreate: false,
    orgId: null
  }
)

const emit = defineEmits(['update:modelValue'])

const message = useMessage()
const authStore = useAuthStore()

const loading = ref(false)
const options = ref<Option[]>([])
const showCreateModal = ref(false)
const saving = ref(false)
const orgOptions = ref<Array<{ label: string; value: string }>>([])

const createForm = ref({
  seq_no: null as number | null,
  name: '',
  org_id: null as string | null
})

const isTenantAdmin = computed(() => {
  const authority = String((authStore.userInfo as any)?.authority || '').toUpperCase()
  return authority === 'TENANT_ADMIN' || authority === 'SYS_ADMIN'
})

async function loadOptions() {
  loading.value = true
  try {
    const res: any = await getBatteryModelList({
      page: 1,
      page_size: 1000,
      org_id: isTenantAdmin.value ? props.orgId || undefined : undefined
    })
    const list = (res?.data?.list || []) as Array<{ seq_no?: number | null; name: string }>
    options.value = list
      .filter(item => Number.isInteger(item.seq_no))
      .map(item => ({
        label: item.name,
        value: Number(item.seq_no)
      }))
  } catch {
    options.value = []
  } finally {
    loading.value = false
  }
}

async function loadOrgOptions() {
  if (!isTenantAdmin.value) return
  try {
    const res: any = await getOrgList({ page: 1, page_size: 1000, org_type: 'PACK_FACTORY' })
    const list = (res?.data?.list || []) as Array<{ id: string; name: string }>
    orgOptions.value = list.map(item => ({ label: item.name, value: item.id }))
  } catch {
    orgOptions.value = []
  }
}

function openCreateModal() {
  createForm.value = {
    seq_no: null,
    name: '',
    org_id: isTenantAdmin.value ? props.orgId || null : null
  }
  showCreateModal.value = true
}

async function handleCreate() {
  const seqNo = Number(createForm.value.seq_no)
  const name = createForm.value.name.trim()
  const orgId = createForm.value.org_id?.trim() || null

  if (!Number.isInteger(seqNo) || seqNo < 1 || seqNo > 255) {
    message.warning('序号必须是 1~255 的整数')
    return
  }
  if (!name) {
    message.warning('请输入电池型号')
    return
  }
  if (isTenantAdmin.value && !orgId) {
    message.warning('请选择PACK厂家')
    return
  }

  saving.value = true
  try {
    await createBatteryModel({
      seq_no: seqNo,
      name,
      org_id: orgId || undefined
    })
    message.success('新增型号成功')
    showCreateModal.value = false
    await loadOptions()
    emit('update:modelValue', seqNo)
  } catch (error: any) {
    message.error(error?.message || '新增型号失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.orgId,
  () => {
    void loadOptions()
  }
)

onMounted(async () => {
  await Promise.all([loadOptions(), loadOrgOptions()])
})

defineExpose({
  reload: loadOptions
})
</script>

<template>
  <NSpace vertical :size="8" style="width: 100%">
    <NSelect
      :value="modelValue"
      :options="options"
      :placeholder="placeholder"
      :clearable="clearable"
      :disabled="disabled"
      :loading="loading"
      filterable
      style="width: 100%"
      @update:value="value => emit('update:modelValue', value === null ? null : Number(value))"
    />

    <NButton v-if="allowCreate" quaternary type="primary" style="align-self: flex-start" @click="openCreateModal">
      新增型号
    </NButton>

    <NModal
      v-model:show="showCreateModal"
      preset="dialog"
      title="新增电池型号"
      positive-text="保存"
      negative-text="取消"
      :loading="saving"
      @positive-click="handleCreate"
    >
      <NForm :model="createForm" label-placement="left" label-width="100px">
        <NFormItem label="序号" required>
          <NInputNumber v-model:value="createForm.seq_no" :min="1" :max="255" :precision="0" style="width: 100%" />
        </NFormItem>
        <NFormItem label="型号" required>
          <NInput v-model:value="createForm.name" maxlength="64" show-count placeholder="请输入电池型号" />
        </NFormItem>
        <NFormItem v-if="isTenantAdmin" label="PACK厂家" required>
          <NSelect
            v-model:value="createForm.org_id"
            :options="orgOptions"
            placeholder="请选择PACK厂家"
            clearable
            style="width: 100%"
          />
        </NFormItem>
      </NForm>
    </NModal>
  </NSpace>
</template>
