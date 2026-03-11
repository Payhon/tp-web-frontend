<script setup lang="tsx">
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
    message.warning('序号必须是 1~255 的整数')
    return null
  }
  if (!name) {
    message.warning('请输入型号')
    return null
  }
  if (isTenantAdmin.value && !orgId) {
    message.warning('请选择PACK厂家')
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
      message.success('新增成功')
    } else {
      await updateBatteryModel(row.id, { seq_no: payload.seqNo, name: payload.name, org_id: payload.orgId })
      message.success('更新成功')
    }
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    savingId.value = null
  }
}

function handleAdd() {
  if (data.value.some(item => item.isNew)) {
    message.warning('请先保存当前新增行')
    return
  }
  if (isTenantAdmin.value && orgOptions.value.length === 0) {
    message.warning('当前没有可选的PACK厂家')
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
    message.success('删除成功')
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

const columns: DataTableColumns<BatteryModelRow> = [
  {
    key: 'seq_no',
    title: '序号',
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
    title: '型号',
    minWidth: 260,
    render: row => {
      if (row.editing) {
        return (
          <NInput
            value={row.draftName}
            maxlength={64}
            showCount
            placeholder="请输入型号"
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
    title: '机构',
    minWidth: 180,
    render: row => {
      if (row.editing && isTenantAdmin.value) {
        return (
          <NSelect
            value={row.draftOrgId}
            options={orgOptions.value}
            placeholder="请选择PACK厂家"
            onUpdateValue={value => handleOrgChange(row, value)}
          />
        )
      }
      return row.org_name || '--'
    }
  },
  { key: 'created_at', title: '创建时间', minWidth: 180 },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    render: row => {
      const saving = savingId.value === row.id
      if (row.editing) {
        return (
          <NSpace>
            <NButton size="small" type="primary" loading={saving} onClick={() => saveRow(row)}>
              保存
            </NButton>
            <NButton size="small" onClick={() => cancelEdit(row)}>
              取消
            </NButton>
          </NSpace>
        )
      }

      return (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => startEdit(row)}>
            编辑
          </NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => '确认删除该电池型号吗？',
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
    message.error(e?.message || '获取列表失败')
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
    message.error(e?.message || '获取PACK厂家列表失败')
  }
}

onMounted(async () => {
  await Promise.all([fetchData(), fetchPackFactoryOptions()])
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="电池型号管理" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <div class="mb-4">
        <NButton type="primary" @click="handleAdd">+ 新增电池型号</NButton>
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
