<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { onMounted, ref } from 'vue'
import { NButton, NCard, NDataTable, NInput, NInputNumber, NPopconfirm, NSpace, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { createCellBrand, deleteCellBrand, getCellBrandList, updateCellBrand } from '@/service/api/bms'

type CellBrandRow = {
  id: string
  seq_no: number
  name: string
  created_at: string
  isNew?: boolean
  editing?: boolean
  draftSeqNo?: number
  draftName?: string
}

const message = useMessage()
const loading = ref(false)
const savingId = ref<string | null>(null)
const data = ref<CellBrandRow[]>([])

function normalizeName(name: string) {
  return name.trim()
}

function getNextSeqNo(rows: CellBrandRow[]) {
  const maxSeqNo = rows.reduce((max, item) => Math.max(max, Number(item.seq_no || 0)), 0)
  return Math.min(maxSeqNo + 1, 255)
}

function startEdit(row: CellBrandRow) {
  row.editing = true
  row.draftSeqNo = row.seq_no
  row.draftName = row.name
}

function cancelEdit(row: CellBrandRow) {
  if (row.isNew) {
    data.value = data.value.filter(item => item.id !== row.id)
    return
  }
  row.editing = false
  row.draftSeqNo = row.seq_no
  row.draftName = row.name
}

function validateRow(row: CellBrandRow): { seqNo: number; name: string } | null {
  const seqNo = Number(row.draftSeqNo)
  const name = normalizeName(row.draftName || '')

  if (!Number.isInteger(seqNo) || seqNo < 1 || seqNo > 255) {
    message.warning(bt('auto.s_739763a4f8'))
    return null
  }
  if (!name) {
    message.warning(bt('auto.s_a800e7be00'))
    return null
  }
  if ([...name].length > 16) {
    message.warning(bt('auto.s_155eb813be'))
    return null
  }
  return { seqNo, name }
}

function handleNameEnter(row: CellBrandRow, event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  if (!row.editing || savingId.value === row.id) return
  void saveRow(row)
}

async function saveRow(row: CellBrandRow) {
  const payload = validateRow(row)
  if (!payload) return

  savingId.value = row.id
  try {
    if (row.isNew) {
      await createCellBrand({ seq_no: payload.seqNo, name: payload.name })
      message.success(bt('auto.s_a5bfd70d4a'))
    } else {
      await updateCellBrand(row.id, { seq_no: payload.seqNo, name: payload.name })
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
  const existsNew = data.value.some(item => item.isNew)
  if (existsNew) {
    message.warning(bt('auto.s_5a0d0f4b9a'))
    return
  }
  const tempId = `new-${Date.now()}`
  const nextSeqNo = getNextSeqNo(data.value)
  data.value = [
    {
      id: tempId,
      seq_no: nextSeqNo,
      name: '',
      created_at: '--',
      isNew: true,
      editing: true,
      draftSeqNo: nextSeqNo,
      draftName: ''
    },
    ...data.value
  ]
}

async function handleDelete(row: CellBrandRow) {
  if (row.isNew) {
    data.value = data.value.filter(item => item.id !== row.id)
    return
  }

  try {
    await deleteCellBrand(row.id)
    message.success(bt('auto.s_0007d170de'))
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_acf0664a54'))
  }
}

const columns: DataTableColumns<CellBrandRow> = [
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
      return row.seq_no
    }
  },
  {
    key: 'name',
    title: bt('auto.s_fc4a058347'),
    minWidth: 220,
    render: row => {
      if (row.editing) {
        return (
          <NInput
            value={row.draftName}
            maxlength={16}
            showCount
            placeholder={bt('auto.s_a800e7be00')}
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
              default: () => bt('auto.s_059e1dcc48'),
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
    const res: any = await getCellBrandList()
    const list = (res?.data?.list || []) as Array<{ id: string; seq_no: number; name: string; created_at: string }>
    data.value = list.map(item => ({
      ...item,
      editing: false,
      draftSeqNo: item.seq_no,
      draftName: item.name
    }))
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_fe9d24d531'))
    data.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_a9ef81fe9d')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <div class="mb-4">
        <NButton type="primary" @click="handleAdd">{{ bt('auto.s_41cbaa2302') }}</NButton>
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
