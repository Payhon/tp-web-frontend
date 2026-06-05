<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, h, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NDropdown,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTag,
  useMessage
} from 'naive-ui'
import type { DataTableColumns, DropdownOption } from 'naive-ui'
import {
  AddCircleOutline,
  BanOutline,
  CheckmarkCircleOutline,
  ChevronDownOutline,
  CreateOutline,
  KeyOutline,
  ShieldCheckmarkOutline,
  ShuffleOutline,
  TrashOutline
} from '@vicons/ionicons5'
import { useTable } from '@/hooks/common/table'
import { fetchUserList, addUser, editUser, delUser } from '@/service/api/auth'
import { getOrgList } from '@/service/api/bms'
import { rlesList } from '@/service/api/rlesList'
import { useAuthStore } from '@/store/modules/auth'

const authStore = useAuthStore()
const message = useMessage()

type AuthorityType = 'TENANT_ADMIN' | 'TENANT_USER'
type UserKind = 'ORG_USER' | 'END_USER'

type OrgOption = {
  label: string
  value: string
  org_type?: string
  parent_id?: string | null
}

type RoleOption = {
  label: string
  value: string
  authority?: string
  user_kind?: string
  org_type?: string
}

const authorityOptions = [
  { label: bt('auto.s_a8b0c20416'), value: '' },
  { label: bt('auto.s_d9e9f3a411'), value: 'TENANT_ADMIN' },
  { label: bt('auto.s_7cfa6d1891'), value: 'TENANT_USER' }
]

const isMainOptions = [
  { label: bt('auto.s_a8b0c20416'), value: null },
  { label: bt('auto.s_0010795e51'), value: 1 },
  { label: bt('auto.s_7cad89ba44'), value: 0 }
]

const statusOptions = [
  { label: bt('auto.s_a8b0c20416'), value: '' },
  { label: bt('auto.s_7854b52a88'), value: 'N' },
  { label: bt('auto.s_710ad08b11'), value: 'F' }
]

const orgOptions = ref<OrgOption[]>([])
const roleOptions = ref<RoleOption[]>([])
const currentAuthority = computed(() => String(authStore.userInfo.authority || ''))
const currentUserKind = computed(() => String(authStore.userInfo.user_kind || ''))
const currentOrgId = computed(() => String(authStore.userInfo.org_id || ''))
const currentOrgType = computed(() => String(authStore.userInfo.org_type || ''))
const isOrgScopedUser = computed(() => currentAuthority.value === 'TENANT_USER' && currentUserKind.value === 'ORG_USER')
const currentOrgHasChildren = computed(() => {
  if (!currentOrgId.value) return false
  return orgOptions.value.some(item => item.parent_id === currentOrgId.value)
})
const showAuthorityFilter = computed(() => !isOrgScopedUser.value)
const showIsMainFilter = computed(() => !isOrgScopedUser.value)
const showOrgFilter = computed(() => {
  if (!isOrgScopedUser.value) return true
  if (!currentOrgId.value) return false
  if (currentOrgType.value === 'STORE') return false
  return currentOrgHasChildren.value
})
const showRoleFieldInEditModal = computed(() => modalType.value === 'create')

async function loadOrgs() {
  try {
    const res: any = await getOrgList({ page: 1, page_size: 1000 })
    const list = res?.data?.list || []
    orgOptions.value = list.map((item: any) => ({
      label: `${item.name}${item.org_type ? ` (${item.org_type})` : ''}`,
      value: item.id,
      org_type: item.org_type,
      parent_id: item.parent_id || null
    }))
  } catch {
    orgOptions.value = []
  }
}

async function loadRoles() {
  try {
    const res: any = await rlesList({ page: 1, page_size: 1000 })
    const list = res?.data?.list || []
    roleOptions.value = list.map((item: any) => ({
      label: item.name,
      value: item.id,
      authority: item.authority,
      user_kind: item.user_kind,
      org_type: item.org_type
    }))
  } catch {
    roleOptions.value = []
  }
}

function roleNameList(roleIds: string[] = []) {
  if (!Array.isArray(roleIds) || roleIds.length === 0) return '--'
  const names = roleIds.map(id => roleOptions.value.find(item => item.value === id)?.label || id).filter(Boolean)
  return names.length > 0 ? names.join(' / ') : '--'
}

function accountTypeLabel(row: any) {
  const authority = row.authority
  const userKind = row.user_kind
  const isMain = Number(row.is_main || 0)
  if (authority === 'TENANT_ADMIN' && userKind === 'ORG_USER') {
    return isMain === 1 ? bt('auto.s_85764d6eb7') : bt('auto.s_43820b9934')
  }
  if (authority === 'TENANT_USER' && userKind === 'ORG_USER') {
    return isMain === 1 ? bt('auto.s_514d73ca26') : bt('auto.s_ab58493f1e')
  }
  if (authority === 'TENANT_USER' && userKind === 'END_USER') {
    return bt('auto.s_5ddfa01711')
  }
  return authority || '--'
}

function accountTypeTagType(row: any): 'error' | 'warning' | 'success' | 'info' | 'default' {
  const authority = row.authority
  const userKind = row.user_kind
  const isMain = Number(row.is_main || 0)
  if (authority === 'TENANT_ADMIN' && userKind === 'ORG_USER' && isMain === 1) return 'error'
  if (authority === 'TENANT_ADMIN' && userKind === 'ORG_USER') return 'warning'
  if (authority === 'TENANT_USER' && userKind === 'ORG_USER' && isMain === 1) return 'success'
  if (authority === 'TENANT_USER' && userKind === 'ORG_USER') return 'info'
  return 'default'
}

function renderDropdownIcon(icon: any) {
  return () =>
    h(NIcon, null, {
      default: () => h(icon)
    })
}

const addButtonIcon = renderDropdownIcon(AddCircleOutline)

const currentUserId = computed(() => String(authStore.userInfo.id || authStore.userInfo.userId || ''))

function isCurrentUser(row: any) {
  return Boolean(row?.id) && String(row.id) === currentUserId.value
}

function isMainAccount(row: any) {
  return Number(row?.is_main || 0) === 1
}

function canAssignRoles(row: any) {
  return !isMainAccount(row)
}

function canToggleStatus(row: any) {
  return !isCurrentUser(row) && !isMainAccount(row)
}

function canDelete(row: any) {
  return !isCurrentUser(row) && !isMainAccount(row)
}

function getToggleBlockedReason(row: any) {
  if (isCurrentUser(row)) return bt('auto.s_08448939fb')
  if (isMainAccount(row)) return bt('auto.s_c1d98f42ba')
  return ''
}

function getDeleteBlockedReason(row: any) {
  if (isCurrentUser(row)) return bt('auto.s_13b06cb00e')
  if (isMainAccount(row)) return bt('auto.s_ca202ab07a')
  return ''
}

function getRoleAssignBlockedReason(row: any) {
  if (isMainAccount(row)) return bt('auto.s_5368a66ff8')
  return ''
}

type UserActionKey = 'edit' | 'assignRoles' | 'resetPwd' | 'disable' | 'enable' | 'delete'

function buildActionOptions(row: any): DropdownOption[] {
  return [
    {
      label: bt('auto.s_95b351c862'),
      key: 'edit',
      icon: renderDropdownIcon(CreateOutline)
    },
    {
      label: bt('auto.s_d2a708a427'),
      key: 'assignRoles',
      disabled: !canAssignRoles(row),
      icon: renderDropdownIcon(ShieldCheckmarkOutline)
    },
    {
      label: bt('auto.s_0719aa2bb0'),
      key: 'resetPwd',
      icon: renderDropdownIcon(KeyOutline)
    },
    row.status === 'N'
      ? {
          label: bt('auto.s_710ad08b11'),
          key: 'disable',
          disabled: !canToggleStatus(row),
          icon: renderDropdownIcon(BanOutline)
        }
      : {
          label: bt('auto.s_5e62471769'),
          key: 'enable',
          disabled: !canToggleStatus(row),
          icon: renderDropdownIcon(CheckmarkCircleOutline)
        },
    {
      label: bt('auto.s_2f4aaddde3'),
      key: 'delete',
      disabled: !canDelete(row),
      icon: renderDropdownIcon(TrashOutline)
    }
  ]
}

const searchForm = ref<{
  phone_number: string
  username: string
  name: string
  status: string
  authority: '' | AuthorityType
  is_main: number | null
  org_id: string | null
}>({
  phone_number: '',
  username: '',
  name: '',
  status: '',
  authority: '',
  is_main: null,
  org_id: null
})

function createColumns(): DataTableColumns<any> {
  return [
    { key: 'phone_number', title: bt('auto.s_8098e2b4e8'), minWidth: 140 },
    { key: 'username', title: bt('auto.s_819767ada1'), minWidth: 160, render: row => row.username || '--' },
    { key: 'name', title: bt('auto.s_60d0458ac6'), minWidth: 120, render: row => row.name || '--' },
    {
      key: 'account_type',
      title: bt('auto.s_c65d927694'),
      minWidth: 160,
      render: row => <NTag type={accountTypeTagType(row)}>{accountTypeLabel(row)}</NTag>
    },
    {
      key: 'org_name',
      title: bt('auto.s_ee51f92f41'),
      minWidth: 180,
      render: row => row.org_name || row.organization || '--'
    },
    {
      key: 'user_roles',
      title: bt('auto.s_2a697fb459'),
      minWidth: 220,
      render: row => roleNameList(row.user_roles)
    },
    {
      key: 'status',
      title: bt('auto.s_3fea7ca76c'),
      minWidth: 100,
      render: row => (
        <NTag type={row.status === 'N' ? 'success' : 'warning'}>{row.status === 'N' ? bt('auto.s_7854b52a88') : bt('auto.s_710ad08b11')}</NTag>
      )
    },
    { key: 'created_at', title: bt('auto.s_eca37cb072'), minWidth: 180, render: row => String(row.created_at || '--') },
    {
      key: 'operate',
      title: bt('auto.s_2b6bc0f293'),
      minWidth: 140,
      fixed: 'right',
      render: row => (
        <NDropdown
          options={buildActionOptions(row)}
          trigger="click"
          onSelect={key => handleActionSelect(String(key), row)}
        >
          <NButton size="small" secondary type="primary">
            {{
              default: () => bt('auto.s_2b6bc0f293'),
              icon: () => (
                <NIcon>
                  <ChevronDownOutline />
                </NIcon>
              )
            }}
          </NButton>
        </NDropdown>
      )
    }
  ]
}

const apiGetUserList = async (params: any) => {
  const res: any = await fetchUserList(params)
  return { res, params }
}

const { data, loading, columns, pagination, getData, updateSearchParams } = useTable<any, typeof apiGetUserList>({
  apiFn: apiGetUserList,
  apiParams: {
    page: 1,
    page_size: 10,
    all_authorities: !isOrgScopedUser.value,
    all_user_kinds: false,
    authority: isOrgScopedUser.value ? 'TENANT_USER' : undefined,
    user_kind: 'ORG_USER'
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
    all_authorities: !isOrgScopedUser.value,
    all_user_kinds: false,
    user_kind: 'ORG_USER',
    phone_number: searchForm.value.phone_number || undefined,
    username: searchForm.value.username || undefined,
    name: searchForm.value.name || undefined,
    status: searchForm.value.status || undefined,
    authority: showAuthorityFilter.value ? searchForm.value.authority || undefined : 'TENANT_USER',
    is_main: showIsMainFilter.value ? (searchForm.value.is_main ?? undefined) : undefined,
    org_id: showOrgFilter.value ? searchForm.value.org_id || undefined : undefined
  })
  getData()
}

function handleReset() {
  searchForm.value = {
    phone_number: '',
    username: '',
    name: '',
    status: '',
    authority: '',
    is_main: null,
    org_id: null
  }
  handleSearch()
}

const modalVisible = ref(false)
const modalType = ref<'create' | 'edit'>('create')
const saving = ref(false)

const form = ref<{
  id?: string
  authority: AuthorityType
  user_kind: UserKind
  is_main: 0 | 1
  org_id: string | null
  phone_number: string
  username: string
  email: string
  name: string
  password: string
  status: 'N' | 'F'
  userRoles: string[]
}>({
  authority: 'TENANT_ADMIN',
  user_kind: 'ORG_USER',
  is_main: 0,
  org_id: null,
  phone_number: '',
  username: '',
  email: '',
  name: '',
  password: '123456',
  status: 'N',
  userRoles: []
})

const filteredRoleOptions = computed(() => {
  return roleOptions.value.filter(item => {
    if (item.authority && item.authority !== form.value.authority) return false
    if (item.user_kind && item.user_kind !== form.value.user_kind) return false
    const org = orgOptions.value.find(opt => opt.value === form.value.org_id)
    if (item.org_type && form.value.authority === 'TENANT_USER' && org?.org_type && item.org_type !== org.org_type)
      return false
    return true
  })
})

function openCreate() {
  modalType.value = 'create'
  modalVisible.value = true
  form.value = {
    authority: isOrgScopedUser.value ? 'TENANT_USER' : 'TENANT_ADMIN',
    user_kind: 'ORG_USER',
    is_main: 0,
    org_id: isOrgScopedUser.value ? currentOrgId.value || null : null,
    phone_number: '',
    username: '',
    email: '',
    name: '',
    password: '123456',
    status: 'N',
    userRoles: []
  }
}

function openEdit(row: any) {
  modalType.value = 'edit'
  modalVisible.value = true
  form.value = {
    id: row.id,
    authority: (row.authority as AuthorityType) || 'TENANT_ADMIN',
    user_kind: (row.user_kind as UserKind) || 'ORG_USER',
    is_main: Number(row.is_main || 0) === 1 ? 1 : 0,
    org_id: row.org_id || null,
    phone_number: row.phone_number || '',
    username: row.username || '',
    email: row.email || '',
    name: row.name || '',
    password: '',
    status: (row.status as 'N' | 'F') || 'N',
    userRoles: Array.isArray(row.user_roles) ? row.user_roles : []
  }
}

function openRoleAssign(row: any) {
  const blockedReason = getRoleAssignBlockedReason(row)
  if (blockedReason) {
    message.warning(blockedReason)
    return
  }
  roleAssignRow.value = row
  roleAssignValue.value = Array.isArray(row.user_roles) ? [...row.user_roles] : []
  roleAssignVisible.value = true
}

async function submit() {
  saving.value = true
  try {
    if (!form.value.phone_number || !form.value.email) {
      message.warning(bt('auto.s_4b55a75b2c'))
      return
    }
    if (form.value.authority === 'TENANT_USER' && form.value.user_kind === 'ORG_USER' && !form.value.org_id) {
      message.warning(bt('auto.s_af1170e432'))
      return
    }

    const payload: any = {
      phone_number: form.value.phone_number,
      email: form.value.email,
      name: form.value.name || undefined,
      authority: form.value.authority,
      user_kind: form.value.user_kind,
      is_main: form.value.is_main,
      org_id:
        form.value.authority === 'TENANT_USER' && form.value.user_kind === 'ORG_USER' ? form.value.org_id : undefined,
      userRoles: form.value.userRoles
    }

    if (modalType.value === 'create') {
      if (!form.value.password || form.value.password.length < 6) {
        message.warning(bt('auto.s_0951e1d94c'))
        return
      }
      payload.password = form.value.password
      await addUser(payload)
      message.success(bt('auto.s_04a691b377'))
    } else {
      payload.id = form.value.id
      payload.status = form.value.status
      await editUser(payload)
      message.success(bt('auto.s_55aa6366c0'))
    }
    modalVisible.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_6de920b4e4'))
  } finally {
    saving.value = false
  }
}

const resetVisible = ref(false)
const resetRow = ref<any>(null)
const resetPassword = ref('123456')
const roleAssignVisible = ref(false)
const roleAssignRow = ref<any>(null)
const roleAssignValue = ref<string[]>([])

function generateStrongPassword(length = 12) {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lowercase = 'abcdefghijkmnopqrstuvwxyz'
  const numbers = '23456789'
  const symbols = '!@#$%^&*'
  const groups = [uppercase, lowercase, numbers, symbols]
  const allChars = groups.join('')
  const bytes = window.crypto.getRandomValues(new Uint32Array(length))
  const passwordChars = groups.map((group, index) => group[bytes[index] % group.length])
  for (let i = passwordChars.length; i < length; i += 1) {
    passwordChars.push(allChars[bytes[i] % allChars.length])
  }
  for (let i = passwordChars.length - 1; i > 0; i -= 1) {
    const swapIndex = bytes[i] % (i + 1)
    ;[passwordChars[i], passwordChars[swapIndex]] = [passwordChars[swapIndex], passwordChars[i]]
  }
  return passwordChars.join('')
}

function fillRandomResetPassword() {
  resetPassword.value = generateStrongPassword()
  message.success(bt('auto.s_2ff94ae968'))
}

const roleAssignOptions = computed(() => {
  const row = roleAssignRow.value
  if (!row) return []
  return roleOptions.value.filter(item => {
    if (item.authority && item.authority !== row.authority) return false
    if (item.user_kind && item.user_kind !== row.user_kind) return false
    const org = orgOptions.value.find(opt => opt.value === row.org_id)
    if (item.org_type && row.authority === 'TENANT_USER' && org?.org_type && item.org_type !== org.org_type) {
      return false
    }
    return true
  })
})

function openResetPwd(row: any) {
  resetRow.value = row
  resetPassword.value = generateStrongPassword()
  resetVisible.value = true
}

function handleActionSelect(key: string, row: any) {
  const action = key as UserActionKey
  switch (action) {
    case 'edit':
      openEdit(row)
      break
    case 'assignRoles':
      openRoleAssign(row)
      break
    case 'resetPwd':
      openResetPwd(row)
      break
    case 'disable':
      handleToggleStatus(row, 'F')
      break
    case 'enable':
      handleToggleStatus(row, 'N')
      break
    case 'delete':
      if (!canDelete(row)) {
        message.warning(getDeleteBlockedReason(row) || bt('auto.s_360afc6ab4'))
        return
      }
      window.$dialog?.warning({
        title: bt('auto.s_631cd22018'),
        content: bt('auto.s_2d67da85a2'),
        positiveText: bt('auto.s_2f4aaddde3'),
        negativeText: bt('auto.s_625fb26b4b'),
        onPositiveClick: () => handleDelete(row)
      })
      break
    default:
      break
  }
}

async function submitResetPwd() {
  if (!resetRow.value?.id) return
  if (!resetPassword.value || resetPassword.value.length < 6) {
    message.warning(bt('auto.s_441ea65131'))
    return
  }
  saving.value = true
  try {
    await editUser({ id: resetRow.value.id, password: resetPassword.value })
    message.success(bt('auto.s_2f1f1d2769'))
    resetVisible.value = false
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_4d71382234'))
  } finally {
    saving.value = false
  }
}

async function handleToggleStatus(row: any, status: 'N' | 'F') {
  const blockedReason = getToggleBlockedReason(row)
  if (blockedReason) {
    message.warning(blockedReason)
    return
  }
  try {
    await editUser({ id: row.id, status })
    message.success(status === 'N' ? bt('auto.s_414c3dfac4') : bt('auto.s_6bfb3ef71d'))
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_5fa802bef5'))
  }
}

async function handleDelete(row: any) {
  const blockedReason = getDeleteBlockedReason(row)
  if (blockedReason) {
    message.warning(blockedReason)
    return
  }
  try {
    await delUser(row.id)
    message.success(bt('auto.s_0007d170de'))
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_acf0664a54'))
  }
}

async function submitRoleAssign() {
  if (!roleAssignRow.value?.id) return
  saving.value = true
  try {
    await editUser({
      id: roleAssignRow.value.id,
      userRoles: roleAssignValue.value
    })
    message.success(bt('auto.s_6c5e069860'))
    roleAssignVisible.value = false
    handleSearch()
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_ae3097dd3a'))
  } finally {
    saving.value = false
  }
}

loadOrgs()
loadRoles()
getData()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="bt('auto.s_b62120711b')" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem :label="bt('auto.s_8098e2b4e8')">
          <NInput v-model:value="searchForm.phone_number" :placeholder="bt('auto.s_8098e2b4e8')" style="width: 200px" clearable />
        </NFormItem>
        <NFormItem :label="bt('auto.s_819767ada1')">
          <NInput v-model:value="searchForm.username" :placeholder="bt('auto.s_819767ada1')" style="width: 180px" clearable />
        </NFormItem>
        <NFormItem :label="bt('auto.s_60d0458ac6')">
          <NInput v-model:value="searchForm.name" :placeholder="bt('auto.s_60d0458ac6')" style="width: 180px" clearable />
        </NFormItem>
        <NFormItem v-if="showAuthorityFilter" :label="bt('auto.s_b7a6446a6a')">
          <NSelect v-model:value="searchForm.authority" :options="authorityOptions" style="width: 180px" clearable />
        </NFormItem>
        <NFormItem v-if="showIsMainFilter" :label="bt('auto.s_26bad6efc6')">
          <NSelect v-model:value="searchForm.is_main" :options="isMainOptions" style="width: 140px" clearable />
        </NFormItem>
        <NFormItem v-if="showOrgFilter" :label="bt('auto.s_ee51f92f41')">
          <NSelect v-model:value="searchForm.org_id" :options="orgOptions" style="width: 240px" clearable />
        </NFormItem>
        <NFormItem :label="bt('auto.s_3fea7ca76c')">
          <NSelect v-model:value="searchForm.status" :options="statusOptions" style="width: 140px" clearable />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">{{ bt('auto.s_bee912d79e') }}</NButton>
            <NButton @click="handleReset">{{ bt('auto.s_4b9c3271dc') }}</NButton>
            <NButton type="success" :render-icon="addButtonIcon" @click="openCreate">{{ bt('auto.s_3840c26cd5') }}</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="1600"
      />
    </NCard>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="modalType === 'create' ? bt('auto.s_3840c26cd5') : bt('auto.s_48b240a4b3')"
      style="width: 760px"
    >
      <NForm label-placement="left" label-width="120" :model="form">
        <NFormItem :label="bt('auto.s_b7a6446a6a')" required>
          <NSelect
            v-model:value="form.authority"
            :options="authorityOptions.filter(item => item.value)"
            :disabled="isOrgScopedUser"
            @update:value="
              value => {
                if (value === 'TENANT_ADMIN') {
                  form.user_kind = 'ORG_USER'
                  form.is_main = 0
                  form.org_id = null
                }
              }
            "
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_d340e9a6b9')" required>
          <NSelect
            v-model:value="form.user_kind"
            :options="[
              { label: bt('auto.s_7d4ed93aa4'), value: 'ORG_USER' },
              { label: bt('auto.s_5ddfa01711'), value: 'END_USER' }
            ]"
            :disabled="form.authority === 'TENANT_ADMIN' || isOrgScopedUser"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_26bad6efc6')" required>
          <NSelect
            v-model:value="form.is_main"
            :options="[
              { label: bt('auto.s_0010795e51'), value: 1 },
              { label: bt('auto.s_7cad89ba44'), value: 0 }
            ]"
            :disabled="isOrgScopedUser || (form.authority === 'TENANT_ADMIN' && modalType === 'edit')"
          />
        </NFormItem>
        <NFormItem v-if="form.authority === 'TENANT_USER' && form.user_kind === 'ORG_USER'" :label="bt('auto.s_ee51f92f41')" required>
          <NSelect
            v-model:value="form.org_id"
            :options="orgOptions"
            :placeholder="bt('auto.s_2c919d5bda')"
            clearable
            :disabled="isOrgScopedUser && !showOrgFilter"
          />
        </NFormItem>
        <NFormItem :label="bt('auto.s_8098e2b4e8')" required>
          <NInput v-model:value="form.phone_number" :placeholder="bt('auto.s_8098e2b4e8')" />
        </NFormItem>
        <NFormItem :label="bt('auto.s_3bc5e602b2')" required>
          <NInput v-model:value="form.email" :placeholder="bt('auto.s_3bc5e602b2')" />
        </NFormItem>
        <NFormItem v-if="modalType === 'edit'" :label="bt('auto.s_819767ada1')">
          <NInput v-model:value="form.username" :placeholder="bt('auto.s_da7b08118f')" readonly />
        </NFormItem>
        <NFormItem :label="bt('auto.s_60d0458ac6')">
          <NInput v-model:value="form.name" :placeholder="bt('auto.s_60d0458ac6')" />
        </NFormItem>
        <NFormItem v-if="showRoleFieldInEditModal" :label="bt('auto.s_1318cc070d')">
          <NSelect
            v-model:value="form.userRoles"
            multiple
            :options="filteredRoleOptions"
            :placeholder="bt('auto.s_e3be7b8a45')"
            clearable
          />
        </NFormItem>
        <NFormItem v-if="modalType === 'create'" :label="bt('auto.s_763ffee1e9')" required>
          <NInput v-model:value="form.password" :placeholder="bt('auto.s_002b6972a7')" />
        </NFormItem>
        <NFormItem v-if="modalType === 'edit'" :label="bt('auto.s_3fea7ca76c')">
          <NSelect v-model:value="form.status" :options="statusOptions.filter(item => item.value)" />
        </NFormItem>
      </NForm>

      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">{{ bt('auto.s_625fb26b4b') }}</NButton>
          <NButton type="primary" :loading="saving" @click="submit">{{ bt('auto.s_be5fbbe34c') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="resetVisible" preset="card" :title="bt('auto.s_0719aa2bb0')" style="width: 520px">
      <NForm label-placement="left" label-width="120">
        <NFormItem :label="bt('auto.s_bf7da0bf02')" required>
          <NSpace style="width: 100%" :wrap-item="false">
            <NInput v-model:value="resetPassword" type="password" show-password-on="click" :placeholder="bt('auto.s_002b6972a7')" />
            <NButton circle secondary type="primary" @click="fillRandomResetPassword">
              <template #icon>
                <NIcon>
                  <ShuffleOutline />
                </NIcon>
              </template>
            </NButton>
          </NSpace>
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="resetVisible = false">{{ bt('auto.s_625fb26b4b') }}</NButton>
          <NButton type="primary" :loading="saving" @click="submitResetPwd">{{ bt('auto.s_38cf16f220') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="roleAssignVisible" preset="card" :title="bt('auto.s_d2a708a427')" style="width: 620px">
      <NForm label-placement="left" label-width="120">
        <NFormItem :label="bt('auto.s_7035c62fb0')">
          <span>{{ roleAssignRow?.username || roleAssignRow?.name || roleAssignRow?.phone_number || '--' }}</span>
        </NFormItem>
        <NFormItem :label="bt('auto.s_c65d927694')">
          <span>{{ roleAssignRow ? accountTypeLabel(roleAssignRow) : '--' }}</span>
        </NFormItem>
        <NFormItem :label="bt('auto.s_ee51f92f41')">
          <span>{{ roleAssignRow?.org_name || roleAssignRow?.organization || '--' }}</span>
        </NFormItem>
        <NFormItem :label="bt('auto.s_1318cc070d')">
          <NSelect
            v-model:value="roleAssignValue"
            multiple
            :options="roleAssignOptions"
            :placeholder="bt('auto.s_4a93b1538a')"
            clearable
          />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="roleAssignVisible = false">{{ bt('auto.s_625fb26b4b') }}</NButton>
          <NButton type="primary" :loading="saving" @click="submitRoleAssign">{{ bt('auto.s_be5fbbe34c') }}</NButton>
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
