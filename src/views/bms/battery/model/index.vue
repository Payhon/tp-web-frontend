<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, onMounted, ref } from 'vue'
import { NButton, NCard, NDataTable, NInput, NInputNumber, NPopconfirm, NSpace, NSelect, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useAuthStore } from '@/store/modules/auth'
import {
  createBatteryModel,
  deleteBatteryModel,
  getBatteryModelList,
  getOrgList,
  updateBatteryModel
} from '@/service/api/bms'

type BatteryModelRow = {
  id: string
  seq_no?: number | null
  name: string
  org_id?: string | null
  org_name?: string | null
  created_at: string
  isNew?: boolean
  editing?: boolean
  draftSeqNo?: number
  draftName?: string
  draftOrgId?: string | null
}

type OrgOption = {
  label: string
  value: string
}

const message = useMessage()
const authStore = useAuthStore()
const loading = ref(false)
const savingId = ref<string | null>(null)
const data = ref<BatteryModelRow[]>([])
const orgOptions = ref<OrgOption[]>([])

const isTenantAdmin = computed(() => {
  const authority = String((authStore.userInfo as any)?.authority || '').toUpperCase()
  return authority === 'TENANT_ADMIN' || authority === 'SYS_ADMIN'
})

function normalizeName(name: string) {
  return name.trim()
}

function getNextSeqNo(rows: BatteryModelRow[], orgId?: string | null) {
  const maxSeqNo = rows.reduce((max, item) => {
    if (orgId && item.org_id !== orgId) return max
    const current = Number(item.seq_no ?? 0)
    return Number.isInteger(current) ? Math.max(max, current) : max
  }, 0)
  return Math.min(maxSeqNo + 1, 255)
}

function getDefaultOrgId() {
  return orgOptions.value[0]?.value || null
}

function startEdit(row: BatteryModelRow) {
  row.editing = true
  row.draftSeqNo = row.seq_no ?? 1
  row.draftName = row.name
  row.draftOrgId = row.org_id ?? null
}

function cancelEdit(row: BatteryModelRow) {
  if (row.isNew) {
    data.value = data.value.filter(item => item.id !== row.id)
    return
  }
  row.editing = false
  row.draftSeqNo = row.seq_no ?? 1
  row.draftName = row.name
  row.draftOrgId = row.org_id ?? null
}

function validateRow(row: BatteryModelRow): { seqNo: number; name: string; orgId?: string } | null {
  const seqNo = Number(row.draftSeqNo)
  const name = normalizeName(row.draftName || '')
  const orgId = row.draftOrgId ? String(row.draftOrgId).trim() : ''

  if (!Number.isInteger(seqNo) || seqNo < 1 || seqNo > 255) {
    message.warning(bt('auto.s_739763a4f8'))
    return null
  }
  if (!name) {
    message.warning(bt('auto.s_bf3afc290c'))
    return null
  }
  if (isTenantAdmin.value && !orgId) {
    message.warning(bt('auto.s_b888630fc8'))
    return null
  }
  return { seqNo, name, orgId: orgId || undefined }
}

function handleNameEnter(row: BatteryModelRow, event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  if (!row.editing || savingId.value === row.id) return
  void saveRow(row)
}

function handleOrgChange(row: BatteryModelRow, value: string | null) {
  row.draftOrgId = value
  if (!row.isNew) return

  const otherRows = data.value.filter(item => item.id !== row.id)
  row.draftSeqNo = getNextSeqNo(otherRows, value)
}

async function saveRow(row: BatteryModelRow) {
  const payload = validateRow(row)
  if (!payload) return

  savingId.value = row.id
  try {
    if (row.isNew) {
      await createBatteryModel({ seq_no: payload.seqNo, name: payload.name, org_id: payload.orgId })
      message.success(bt('auto.s_a5bfd70d4a'))
    } else {
      await updateBatteryModel(row.id, { seq_no: payload.seqNo, name: payload.name, org_id: payload.orgId })
      message.success(bt('auto.s_55aa6366c0'))
    }
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_6de920b4e4'))
  } finally {
    savingId.value = null
  }
}

function handleAdd() {
  if (data.value.some(item => item.isNew)) {
    message.warning(bt('auto.s_5a0d0f4b9a'))
    return
  }
  if (isTenantAdmin.value && orgOptions.value.length === 0) {
    message.warning(bt('auto.s_d0f8d45e10'))
    return
  }

  const tempId = `new-${Date.now()}`
  const defaultOrgId = isTenantAdmin.value ? getDefaultOrgId() : null
  data.value = [
    {
      id: tempId,
      seq_no: getNextSeqNo(data.value, defaultOrgId),
      name: '',
      org_id: defaultOrgId,
      org_name: orgOptions.value.find(item => item.value === defaultOrgId)?.label || null,
      created_at: '--',
      isNew: true,
      editing: true,
      draftSeqNo: getNextSeqNo(data.value, defaultOrgId),
      draftName: '',
      draftOrgId: defaultOrgId
    },
    ...data.value
  ]
}

async function handleDelete(row: BatteryModelRow) {
  if (row.isNew) {
    data.value = data.value.filter(item => item.id !== row.id)
    return
  }

  try {
    await deleteBatteryModel(row.id)
    message.success(bt('auto.s_0007d170de'))
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_acf0664a54'))
  }
}

const columns: DataTableColumns<BatteryModelRow> = [
  {
    key: 'seq_no',
    title: bt('auto.s_faaadc447b'),
    width: 120,
    render: row => {
      if (row.editing) {
        return (
          <NInputNumber
            value={row.draftSeqNo}
            min={1}
            max={255}
            precision={0}
            onUpdateValue={value => {
              row.draftSeqNo = value ?? undefined
            }}
          />
        )
      }
      return row.seq_no ?? '--'
    }
  },
  {
    key: 'name',
    title: bt('auto.s_ac4190dfda'),
    minWidth: 260,
    render: row => {
      if (row.editing) {
        return (
          <NInput
            value={row.draftName}
            maxlength={64}
            showCount
            placeholder={bt('auto.s_bf3afc290c')}
            onKeydown={event => handleNameEnter(row, event)}
            onUpdateValue={value => {
              row.draftName = value
            }}
          />
        )
      }
      return row.name
    }
  },
  {
    key: 'org_name',
    title: bt('auto.s_b77053aabc'),
    minWidth: 180,
    render: row => {
      if (row.editing && isTenantAdmin.value) {
        return (
          <NSelect
            value={row.draftOrgId}
            options={orgOptions.value}
            placeholder={bt('auto.s_b888630fc8')}
            onUpdateValue={value => handleOrgChange(row, value)}
          />
        )
      }
      return row.org_name || '--'
    }
  },
  { key: 'created_at', title: bt('auto.s_eca37cb072'), minWidth: 180 },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    width: 220,
    render: row => {
      const saving = savingId.value === row.id
      if (row.editing) {
        return (
          <NSpace>
            <NButton size="small" type="primary" loading={saving} onClick={() => saveRow(row)}>{bt('auto.s_be5fbbe34c')}</NButton>
            <NButton size="small" onClick={() => cancelEdit(row)}>{bt('auto.s_625fb26b4b')}</NButton>
          </NSpace>
        )
      }

      return (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => startEdit(row)}>{bt('auto.s_95b351c862')}</NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => bt('auto.s_e834753718'),
              trigger: () => (
                <NButton size="small" type="error">{bt('auto.s_2f4aaddde3')}</NButton>
              )
            }}
          </NPopconfirm>
        </NSpace>
      )
    }
  }
]

async function fetchData() {
  loading.value = true
  try {
    const res: any = await getBatteryModelList({})
    const list = (res?.data?.list || []) as BatteryModelRow[]
    data.value = list.map(item => ({
      ...item,
      editing: false,
      draftSeqNo: item.seq_no ?? 1,
      draftName: item.name,
      draftOrgId: item.org_id ?? null
    }))
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_fe9d24d531'))
    data.value = []
  } finally {
    loading.value = false
  }
}

async function fetchPackFactoryOptions() {
  if (!isTenantAdmin.value) {
    orgOptions.value = []
    return
  }

  try {
    const res: any = await getOrgList({ page: 1, page_size: 1000, org_type: 'PACK_FACTORY' })
    const list = (res?.data?.list || []) as Array<{ id: string; name: string }>
    orgOptions.value = list.map(item => ({
      label: item.name,
      value: item.id
    }))
  } catch (e: any) {
    orgOptions.value = []
    message.error(e?.message || bt('auto.s_31cdd36dea'))
  }
}

onMounted(async () => {
  await Promise.all([fetchData(), fetchPackFactoryOptions()])
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_930a1e0a72')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <div class="mb-4">
        <NButton type="primary" @click="handleAdd">{{ bt('auto.s_098743c537') }}</NButton>
      </div>

      <NDataTable :columns="columns" :data="data" :loading="loading" :pagination="false" :row-key="row => row.id" />
    </NCard>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
