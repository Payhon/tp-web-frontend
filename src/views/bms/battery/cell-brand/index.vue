<script setup lang="tsx">
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
    message.warning('序号必须是 1~255 的整数')
    return null
  }
  if (!name) {
    message.warning('请输入品牌名')
    return null
  }
  if ([...name].length > 16) {
    message.warning('品牌名不能超过16个字符')
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
      message.success('新增成功')
    } else {
      await updateCellBrand(row.id, { seq_no: payload.seqNo, name: payload.name })
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
  const existsNew = data.value.some(item => item.isNew)
  if (existsNew) {
    message.warning('请先保存当前新增行')
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
    message.success('删除成功')
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

const columns: DataTableColumns<CellBrandRow> = [
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
      return row.seq_no
    }
  },
  {
    key: 'name',
    title: '品牌名',
    minWidth: 220,
    render: row => {
      if (row.editing) {
        return (
          <NInput
            value={row.draftName}
            maxlength={16}
            showCount
            placeholder="请输入品牌名"
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
              default: () => '确认删除该电芯品牌吗？',
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
    const res: any = await getCellBrandList()
    const list = (res?.data?.list || []) as Array<{ id: string; seq_no: number; name: string; created_at: string }>
    data.value = list.map(item => ({
      ...item,
      editing: false,
      draftSeqNo: item.seq_no,
      draftName: item.name
    }))
  } catch (e: any) {
    message.error(e?.message || '获取列表失败')
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
    <NCard title="电芯品牌管理" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <div class="mb-4">
        <NButton type="primary" @click="handleAdd">+ 新增电芯品牌</NButton>
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
