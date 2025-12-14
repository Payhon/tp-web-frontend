<script setup lang="tsx">
import { computed, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { getDealerList } from '@/service/api/bms'
import { addUser, editUser, fetchUserList, delUser } from '@/service/api/auth'

const message = useMessage()

type BmsAccountType = 'TENANT_ADMIN' | 'TENANT_USER'

const accountTypeOptions = [
  { label: '全部', value: '' },
  { label: '厂家管理员', value: 'TENANT_ADMIN' },
  { label: '经销商管理员', value: 'TENANT_USER' }
]

const statusOptions = [
  { label: '全部', value: '' },
  { label: '启用', value: 'N' },
  { label: '禁用', value: 'F' }
]

const dealerOptions = ref<{ label: string; value: string }[]>([])
async function loadDealers() {
  try {
    const res: any = await getDealerList({ page: 1, page_size: 9999 })
    const list = res?.data?.list ?? res?.data?.list ?? []
    dealerOptions.value = (list || []).map((d: any) => ({
      label: d.name || d.dealer_name || d.id,
      value: d.id
    }))
  } catch {
    dealerOptions.value = []
  }
}

// 列表
const searchForm = ref<{
  phone_number: string
  name: string
  status: string
  authority: '' | BmsAccountType
  dealer_id: string
}>({
  phone_number: '',
  name: '',
  status: '',
  authority: '',
  dealer_id: ''
})

function createColumns(): DataTableColumns<any> {
  return [
    { key: 'phone_number', title: '手机号', minWidth: 140 },
    { key: 'name', title: '姓名', minWidth: 120, render: row => row.name || '--' },
    {
      key: 'authority',
      title: '角色',
      minWidth: 120,
      render: row => {
        const a = row.authority
        return <NTag>{a === 'TENANT_ADMIN' ? '厂家管理员' : a === 'TENANT_USER' ? '经销商管理员' : a || '--'}</NTag>
      }
    },
    {
      key: 'dealer_name',
      title: '所属经销商',
      minWidth: 160,
      render: row => row.dealer_name || '--'
    },
    {
      key: 'status',
      title: '状态',
      minWidth: 100,
      render: row => <NTag type={row.status === 'N' ? 'success' : 'warning'}>{row.status === 'N' ? '启用' : '禁用'}</NTag>
    },
    { key: 'created_at', title: '创建时间', minWidth: 160, render: row => String(row.created_at || '--') },
    {
      key: 'operate',
      title: '操作',
      minWidth: 280,
      fixed: 'right',
      render: row => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => openEdit(row)}>
            编辑
          </NButton>
          <NButton size="small" type="warning" onClick={() => openResetPwd(row)}>
            重置密码
          </NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => '确认删除？',
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
  ]
}

const apiGetUserList = async (params: any) => {
  const res: any = await fetchUserList(params)
  return { res, params }
}

const { data, loading, filteredColumns, pagination, getData, updateSearchParams } = useTable<any, typeof apiGetUserList>({
  apiFn: apiGetUserList,
  apiParams: {
    page: 1,
    page_size: 10,
    all_authorities: true
  },
  transformer: (wrapped: any) => {
    const payload = wrapped?.res?.data
    return {
      data: payload?.list ?? [],
      pageNum: wrapped?.params?.page ?? 1,
      pageSize: wrapped?.params?.page_size ?? 10,
      total: (payload?.total as number) ?? 0
    }
  },
  columns: (): any => createColumns()
})

function handleSearch() {
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    all_authorities: true,
    phone_number: searchForm.value.phone_number || undefined,
    name: searchForm.value.name || undefined,
    status: searchForm.value.status || undefined,
    authority: searchForm.value.authority || undefined
  })
  getData()
}

function handleReset() {
  searchForm.value = { phone_number: '', name: '', status: '', authority: '', dealer_id: '' }
  handleSearch()
}

// 客户端经销商过滤（后端列表当前不支持 dealer_id 条件）
const viewData = computed(() => {
  if (!searchForm.value.dealer_id) return data.value
  return (data.value || []).filter((r: any) => r.dealer_id === searchForm.value.dealer_id)
})

// 新增/编辑
const modalVisible = ref(false)
const modalType = ref<'create' | 'edit'>('create')
const saving = ref(false)
const form = ref<{
  id?: string
  authority: BmsAccountType
  dealer_id: string
  phone_number: string
  email: string
  name: string
  password: string
  status: 'N' | 'F'
}>({
  authority: 'TENANT_USER',
  dealer_id: '',
  phone_number: '',
  email: '',
  name: '',
  password: '123456',
  status: 'N'
})

function openCreate() {
  modalType.value = 'create'
  modalVisible.value = true
  form.value = {
    authority: 'TENANT_USER',
    dealer_id: '',
    phone_number: '',
    email: '',
    name: '',
    password: '123456',
    status: 'N'
  }
}

function openEdit(row: any) {
  modalType.value = 'edit'
  modalVisible.value = true
  form.value = {
    id: row.id,
    authority: (row.authority as BmsAccountType) || 'TENANT_USER',
    dealer_id: row.dealer_id || '',
    phone_number: row.phone_number || '',
    email: row.email || '',
    name: row.name || '',
    password: '',
    status: (row.status as 'N' | 'F') || 'N'
  }
}

async function submit() {
  saving.value = true
  try {
    if (modalType.value === 'create') {
      if (!form.value.phone_number || !form.value.email || !form.value.password) {
        message.warning('请填写手机号/邮箱/初始密码')
        return
      }
      if (form.value.authority === 'TENANT_USER' && !form.value.dealer_id) {
        message.warning('经销商管理员必须选择所属经销商')
        return
      }
      await addUser({
        phone_number: form.value.phone_number,
        email: form.value.email,
        password: form.value.password,
        name: form.value.name || undefined,
        authority: form.value.authority,
        dealer_id: form.value.authority === 'TENANT_USER' ? form.value.dealer_id : undefined
      })
      message.success('创建成功')
    } else {
      if (!form.value.id) return
      await editUser({
        id: form.value.id,
        phone_number: form.value.phone_number || undefined,
        email: form.value.email || undefined,
        name: form.value.name || undefined,
        status: form.value.status,
        dealer_id: form.value.authority === 'TENANT_USER' ? form.value.dealer_id : ''
      })
      message.success('更新成功')
    }
    modalVisible.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 重置密码（直接走 updateUser 的 password）
const resetVisible = ref(false)
const resetRow = ref<any>(null)
const resetPassword = ref('123456')

function openResetPwd(row: any) {
  resetRow.value = row
  resetPassword.value = '123456'
  resetVisible.value = true
}

async function submitResetPwd() {
  if (!resetRow.value?.id) return
  if (!resetPassword.value || resetPassword.value.length < 6) {
    message.warning('密码至少 6 位')
    return
  }
  saving.value = true
  try {
    await editUser({ id: resetRow.value.id, password: resetPassword.value })
    message.success('密码已重置')
    resetVisible.value = false
  } catch (e: any) {
    message.error(e?.message || '重置失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await delUser(row.id)
    message.success('删除成功')
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

loadDealers()
getData()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden <sm:overflow-auto">
    <NCard title="账号管理" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm inline :model="searchForm" label-placement="left" label-width="auto" class="mb-4 flex flex-wrap gap-4 items-end">
        <NFormItem label="手机号">
          <NInput v-model:value="searchForm.phone_number" placeholder="手机号" style="width: 200px" clearable />
        </NFormItem>
        <NFormItem label="姓名">
          <NInput v-model:value="searchForm.name" placeholder="姓名" style="width: 180px" clearable />
        </NFormItem>
        <NFormItem label="账号类型">
          <NSelect v-model:value="searchForm.authority" :options="accountTypeOptions" style="width: 180px" clearable />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect v-model:value="searchForm.status" :options="statusOptions" style="width: 140px" clearable />
        </NFormItem>
        <NFormItem label="所属经销商">
          <NSelect v-model:value="searchForm.dealer_id" :options="dealerOptions" style="width: 220px" clearable />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
            <NButton type="success" @click="openCreate">新增账号</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        :columns="filteredColumns"
        :data="viewData"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="1200"
      />
    </NCard>

    <NModal v-model:show="modalVisible" preset="card" :title="modalType === 'create' ? '新增账号' : '编辑账号'" style="width: 640px">
      <NForm label-placement="left" label-width="120" :model="form">
        <NFormItem label="账号类型" required>
          <NSelect
            v-model:value="form.authority"
            :options="accountTypeOptions.filter(o => o.value)"
            placeholder="请选择"
          />
        </NFormItem>
        <NFormItem v-if="form.authority === 'TENANT_USER'" label="所属经销商" required>
          <NSelect v-model:value="form.dealer_id" :options="dealerOptions" placeholder="请选择经销商" />
        </NFormItem>
        <NFormItem label="手机号" required>
          <NInput v-model:value="form.phone_number" placeholder="手机号" />
        </NFormItem>
        <NFormItem label="邮箱" required>
          <NInput v-model:value="form.email" placeholder="邮箱" />
        </NFormItem>
        <NFormItem label="姓名">
          <NInput v-model:value="form.name" placeholder="姓名" />
        </NFormItem>
        <NFormItem v-if="modalType === 'create'" label="初始密码" required>
          <NInput v-model:value="form.password" placeholder="初始密码" />
        </NFormItem>
        <NFormItem v-if="modalType === 'edit'" label="状态">
          <NSelect v-model:value="form.status" :options="statusOptions.filter(o => o.value)" />
        </NFormItem>
      </NForm>

      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="submit">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="resetVisible" preset="card" title="重置密码" style="width: 520px">
      <NForm label-placement="left" label-width="120">
        <NFormItem label="新密码" required>
          <NInput v-model:value="resetPassword" placeholder="至少 6 位" />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="resetVisible = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="submitResetPwd">确定</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>

