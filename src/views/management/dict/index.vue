<script setup lang="tsx">
import { computed, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'
import dayjs from 'dayjs'
import { NButton, NInput, NPopconfirm, NRadioButton, NRadioGroup, NSelect, NSpace, NTag } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import { useBoolean, useLoading } from '@sa/hooks'
import { $t } from '@/locales'
import { useAuthStore } from '@/store/modules/auth'
import { fetchUserList } from '@/service/api/auth'
import LanguageCodeSelect from '@/components/common/LanguageCodeSelect.vue'
import {
  createDictItem,
  deleteDictItem,
  deleteDictLanguage,
  fetchDictCategories,
  fetchDictLanguages,
  fetchDictList,
  updateDictItem,
  upsertDictLanguage
} from '@/service/api/dict'

const authStore = useAuthStore()
const authority = computed(() => authStore.userInfo.authority)
const isSysAdmin = computed(() => authority.value === 'SYS_ADMIN')
const canCreate = computed(() => isSysAdmin.value || scope.value !== 'global')

const scope = ref<'all' | 'global' | 'tenant'>('all')
const filterTenantID = ref<string>('')
const tenantLoading = ref(false)
const tenantOptions = ref<{ label: string; value: string }[]>([])

const categories = ref<DictManagement.DictCategory[]>([])
const activeCategory = ref<string>('__all__')

const queryParams = reactive({
  page: 1,
  page_size: 10,
  dict_code: '',
  dict_value: ''
})

const pagination: PaginationProps = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  itemCount: 0,
  pageSizes: [10, 15, 20, 25, 30],
  onChange: (page: number) => {
    pagination.page = page
    queryParams.page = page
    getTableData()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    queryParams.page = 1
    queryParams.page_size = pageSize
    getTableData()
  }
})

const { loading, startLoading, endLoading } = useLoading(false)
const tableData = ref<DictManagement.DictItem[]>([])

function normalizeDictItem(raw: any): DictManagement.DictItem {
  return {
    id: raw?.id ?? raw?.ID ?? '',
    dict_code: raw?.dict_code ?? raw?.dictCode ?? raw?.DictCode ?? '',
    dict_value: raw?.dict_value ?? raw?.dictValue ?? raw?.DictValue ?? '',
    tenant_id: String(raw?.tenant_id ?? raw?.tenantId ?? raw?.TenantID ?? ''),
    category: raw?.category ?? raw?.Category ?? '',
    created_at: raw?.created_at ?? raw?.createdAt ?? raw?.CreatedAt ?? '',
    remark: raw?.remark ?? raw?.Remark ?? null
  }
}

function normalizePagedList(raw: any): { total: number; list: any[] } {
  if (!raw) return { total: 0, list: [] }
  if (Array.isArray(raw)) return { total: raw.length, list: raw }
  if (raw?.data) return normalizePagedList(raw.data)
  if (Array.isArray(raw?.list)) return { total: Number(raw?.total ?? raw.list.length), list: raw.list }
  return { total: Number(raw?.total ?? 0), list: [] }
}

function normalizeTenantList(raw: any): any[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (raw?.data) return normalizeTenantList(raw.data)
  if (Array.isArray(raw?.list)) return raw.list
  return []
}

async function loadTenantOptions(keyword = '') {
  if (!isSysAdmin.value) return
  tenantLoading.value = true
  try {
    const params: any = { page: 1, page_size: 1000 }
    if (keyword) params.name = keyword
    const data: any = await fetchUserList(params)
    const list = normalizeTenantList(data)

    const seen = new Set<string>()
    tenantOptions.value = list
      .map((row: any) => ({
        tenant_id: row?.tenant_id ?? row?.tenantId ?? row?.TenantID ?? '',
        name: row?.name ?? row?.email ?? ''
      }))
      .filter(item => item.tenant_id && item.tenant_id !== '0')
      .filter(item => {
        if (seen.has(item.tenant_id)) return false
        seen.add(item.tenant_id)
        return true
      })
      .map(item => ({
        label: item.name ? `${item.name} (${item.tenant_id})` : item.tenant_id,
        value: item.tenant_id
      }))
  } finally {
    tenantLoading.value = false
  }
}

const categoryOptions = computed(() => {
  const opts = categories.value.map(item => ({
    label: `${item.category} (${item.count})`,
    value: item.category
  }))
  return [{ label: $t('common.all'), value: '__all__' }, ...opts]
})

async function refreshCategories() {
  const params: any = { scope: scope.value }
  if (isSysAdmin.value) {
    if (scope.value === 'tenant' && !filterTenantID.value) {
      categories.value = []
      activeCategory.value = '__all__'
      return
    }
    if (filterTenantID.value) params.tenant_id = filterTenantID.value
  }
  const data = await fetchDictCategories(params)
  categories.value = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
  if (activeCategory.value !== '__all__' && !categories.value.some(c => c.category === activeCategory.value)) {
    activeCategory.value = '__all__'
  }
}

async function getTableData() {
  startLoading()
  try {
    if (isSysAdmin.value && scope.value === 'tenant' && !filterTenantID.value) {
      pagination.itemCount = 0
      tableData.value = []
      return
    }
    const params: any = {
      page: queryParams.page,
      page_size: queryParams.page_size,
      scope: scope.value
    }
    if (activeCategory.value !== '__all__') params.category = activeCategory.value
    if (queryParams.dict_code) params.dict_code = queryParams.dict_code
    if (queryParams.dict_value) params.dict_value = queryParams.dict_value
    if (isSysAdmin.value && filterTenantID.value) params.tenant_id = filterTenantID.value

    const data: any = await fetchDictList(params)
    const { total, list } = normalizePagedList(data)
    pagination.itemCount = total
    tableData.value = list.map(normalizeDictItem)
  } finally {
    endLoading()
  }
}

watch([scope, filterTenantID], async () => {
  queryParams.page = 1
  pagination.page = 1
  await refreshCategories()
  await getTableData()
})

watch(activeCategory, async () => {
  queryParams.page = 1
  pagination.page = 1
  await getTableData()
})

watch(
  isSysAdmin,
  async v => {
    if (v) await loadTenantOptions()
  },
  { immediate: true }
)

const { bool: editVisible, setTrue: openEdit, setFalse: closeEdit } = useBoolean()
const editMode = ref<'create' | 'edit'>('create')
const editingRow = ref<DictManagement.DictItem | null>(null)
const editForm = reactive({
  category: '',
  dict_code: '',
  dict_value: '',
  tenant_id: '0',
  remark: '' as string | null
})

function openCreate() {
  editMode.value = 'create'
  editingRow.value = null
  editForm.category = activeCategory.value !== '__all__' ? activeCategory.value : ''
  editForm.dict_code = ''
  editForm.dict_value = ''
  editForm.tenant_id = '0'
  editForm.remark = ''
  openEdit()
}

function openUpdate(row: DictManagement.DictItem) {
  if (!isSysAdmin.value && row.tenant_id === '0') {
    window.$message?.warning($t('custom.dict.globalReadonly'))
    return
  }
  editMode.value = 'edit'
  editingRow.value = row
  editForm.category = row.category
  editForm.dict_code = row.dict_code
  editForm.dict_value = row.dict_value
  editForm.tenant_id = row.tenant_id
  editForm.remark = row.remark ?? ''
  openEdit()
}

async function submitEdit() {
  if (!editForm.category || !editForm.dict_code || !editForm.dict_value) {
    window.$message?.warning($t('common.pleaseInput'))
    return
  }
  if (editMode.value === 'create') {
    await createDictItem({
      category: editForm.category,
      dict_code: editForm.dict_code,
      dict_value: editForm.dict_value,
      tenant_id: isSysAdmin.value ? editForm.tenant_id : undefined,
      remark: editForm.remark
    })
  } else if (editingRow.value) {
    await updateDictItem(editingRow.value.id, {
      category: editForm.category,
      dict_code: editForm.dict_code,
      dict_value: editForm.dict_value,
      remark: editForm.remark
    })
  }
  closeEdit()
  await refreshCategories()
  await getTableData()
}

const { bool: langVisible, setTrue: openLang, setFalse: closeLang } = useBoolean()
const langDict = ref<DictManagement.DictItem | null>(null)
const langLoading = ref(false)
const langList = ref<DictManagement.DictLanguage[]>([])
const langMode = ref<'create' | 'edit'>('create')
const editingLangRow = ref<DictManagement.DictLanguage | null>(null)
const langForm = reactive({
  language_code: 'zh',
  translation: ''
})

function handleLangAfterLeave() {
  langDict.value = null
  langList.value = []
  langMode.value = 'create'
  editingLangRow.value = null
  langForm.translation = ''
}

function normalizeDictLanguageItem(raw: any): DictManagement.DictLanguage {
  return {
    id: raw?.id ?? raw?.ID ?? '',
    dict_id: raw?.dict_id ?? raw?.dictId ?? raw?.DictID ?? '',
    language_code: raw?.language_code ?? raw?.languageCode ?? raw?.LanguageCode ?? '',
    translation: raw?.translation ?? raw?.Translation ?? ''
  }
}

function normalizeLanguageList(raw: any): DictManagement.DictLanguage[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(normalizeDictLanguageItem)
  if (raw?.data) return normalizeLanguageList(raw.data)
  if (Array.isArray(raw?.list)) return raw.list.map(normalizeDictLanguageItem)
  return []
}

function resetLangForm() {
  langMode.value = 'create'
  editingLangRow.value = null
  langForm.language_code = 'zh'
  langForm.translation = ''
}

async function openLanguage(row: DictManagement.DictItem) {
  if (!isSysAdmin.value && row.tenant_id === '0') {
    window.$message?.warning($t('custom.dict.globalReadonly'))
    return
  }
  langDict.value = row
  resetLangForm()
  openLang()
  langLoading.value = true
  try {
    const data = await fetchDictLanguages(row.id)
    langList.value = normalizeLanguageList(data)
  } finally {
    langLoading.value = false
  }
}

async function submitLanguage() {
  if (!langDict.value) return
  if (!langForm.language_code || !langForm.translation) {
    window.$message?.warning($t('common.pleaseInput'))
    return
  }
  await upsertDictLanguage({
    dict_id: langDict.value.id,
    language_code: langForm.language_code,
    translation: langForm.translation
  })
  const data = await fetchDictLanguages(langDict.value.id)
  langList.value = normalizeLanguageList(data)
  resetLangForm()
}

function openLanguageEdit(row: DictManagement.DictLanguage) {
  langMode.value = 'edit'
  editingLangRow.value = row
  langForm.language_code = row.language_code
  langForm.translation = row.translation
}

const langColumns: Ref<DataTableColumns<DictManagement.DictLanguage>> = ref([
  { key: 'language_code', title: () => $t('custom.dict.languageCode'), minWidth: 140 },
  { key: 'translation', title: () => $t('custom.dict.translation'), minWidth: 240 },
  {
    key: 'actions',
    title: () => $t('common.action'),
    minWidth: 160,
    render: row => (
      <NSpace>
        <NButton size="small" secondary onClick={() => openLanguageEdit(row)}>
          {$t('common.edit')}
        </NButton>
        <NPopconfirm
          onPositiveClick={async () => {
            await deleteDictLanguage(row.id)
            if (langDict.value) {
              const data = await fetchDictLanguages(langDict.value.id)
              langList.value = normalizeLanguageList(data)
            }
            if (editingLangRow.value?.id === row.id) resetLangForm()
          }}
        >
          {{
            default: () => $t('common.confirmDelete'),
            trigger: () => (
              <NButton size="small" type="error" secondary>
                {$t('common.delete')}
              </NButton>
            )
          }}
        </NPopconfirm>
      </NSpace>
    )
  }
])

const columns: Ref<DataTableColumns<DictManagement.DictItem>> = ref([
  {
    key: 'category',
    title: () => $t('custom.dict.category'),
    minWidth: 120
  },
  {
    key: 'dict_code',
    title: () => $t('custom.dict.dictCode'),
    minWidth: 140
  },
  {
    key: 'dict_value',
    title: () => $t('custom.dict.dictValue'),
    minWidth: 140
  },
  {
    key: 'tenant_id',
    title: () => $t('custom.dict.tenantId'),
    minWidth: 120,
    render: row => {
      const isGlobal = row.tenant_id === '0'
      return <NTag type={isGlobal ? 'default' : 'info'}>{row.tenant_id}</NTag>
    }
  },
  {
    key: 'created_at',
    title: () => $t('common.creationTime'),
    minWidth: 160,
    render: row => dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss')
  },
  {
    key: 'remark',
    title: () => $t('common.remark'),
    minWidth: 160
  },
  {
    key: 'actions',
    title: () => $t('common.action'),
    minWidth: 220,
    render: row => (
      <NSpace>
        <NButton
          size="small"
          type="primary"
          secondary
          disabled={!isSysAdmin.value && row.tenant_id === '0'}
          onClick={() => openUpdate(row)}
        >
          {$t('common.edit')}
        </NButton>
        <NButton
          size="small"
          tertiary
          disabled={!isSysAdmin.value && row.tenant_id === '0'}
          onClick={() => openLanguage(row)}
        >
          {$t('custom.dict.language')}
        </NButton>
        <NPopconfirm
          disabled={!isSysAdmin.value && row.tenant_id === '0'}
          onPositiveClick={async () => {
            await deleteDictItem(row.id)
            await refreshCategories()
            await getTableData()
          }}
        >
          {{
            default: () => $t('common.confirmDelete'),
            trigger: () => (
              <NButton size="small" type="error" secondary>
                {$t('common.delete')}
              </NButton>
            )
          }}
        </NPopconfirm>
      </NSpace>
    )
  }
])

refreshCategories()
getTableData()
</script>

<template>
  <div class="h-full">
    <NCard :bordered="false" class="h-full rounded-8px shadow-sm">
      <div class="h-full grid grid-cols-[260px_1fr] gap-12px">
        <div class="h-full flex flex-col gap-12px">
          <div class="flex items-center justify-between">
            <span class="text-16px font-600">{{ $t('custom.dict.category') }}</span>
          </div>
          <NRadioGroup v-model:value="scope" size="small">
            <NRadioButton value="all">{{ $t('common.all') }}</NRadioButton>
            <NRadioButton value="global">{{ $t('custom.dict.scopeGlobal') }}</NRadioButton>
            <NRadioButton value="tenant">{{ $t('custom.dict.scopeTenant') }}</NRadioButton>
          </NRadioGroup>
          <NSelect
            v-if="isSysAdmin"
            v-model:value="filterTenantID"
            size="small"
            clearable
            filterable
            remote
            :loading="tenantLoading"
            :options="tenantOptions"
            :placeholder="$t('custom.dict.selectTenantPlaceholder')"
            @search="loadTenantOptions"
          />
          <div class="flex-1 overflow-auto rounded-6px border border-#eee p-8px">
            <div
              v-for="opt in categoryOptions"
              :key="opt.value"
              class="cursor-pointer rounded-6px px-10px py-8px text-14px"
              :class="opt.value === activeCategory ? 'bg-primary text-white' : 'hover:bg-#f6f6f6'"
              @click="activeCategory = opt.value"
            >
              {{ opt.label }}
            </div>
          </div>
        </div>

        <div class="h-full flex flex-col gap-12px">
          <div class="flex items-center justify-between gap-12px">
            <div class="flex items-center gap-8px">
              <NInput
                v-model:value="queryParams.dict_code"
                size="small"
                clearable
                :placeholder="$t('custom.dict.dictCode')"
              />
              <NInput
                v-model:value="queryParams.dict_value"
                size="small"
                clearable
                :placeholder="$t('custom.dict.dictValue')"
              />
              <NButton size="small" type="primary" secondary :loading="loading" @click="getTableData">
                {{ $t('common.search') }}
              </NButton>
            </div>
            <NButton size="small" type="primary" :disabled="!canCreate" @click="openCreate">
              {{ $t('common.add') }}
            </NButton>
          </div>

          <NDataTable
            class="flex-1"
            remote
            :loading="loading"
            :columns="columns"
            :data="tableData"
            :pagination="pagination"
            :row-key="row => row.id"
          />
        </div>
      </div>

      <NModal
        v-model:show="editVisible"
        preset="card"
        :style="{ width: '640px' }"
        :mask-closable="true"
        :close-on-esc="true"
        :closable="true"
        :title="editMode === 'create' ? $t('common.add') : $t('common.edit')"
      >
        <div class="flex flex-col gap-12px">
          <NInput v-model:value="editForm.category" :placeholder="$t('custom.dict.category')" />
          <NInput v-model:value="editForm.dict_code" :placeholder="$t('custom.dict.dictCode')" />
          <NInput v-model:value="editForm.dict_value" :placeholder="$t('custom.dict.dictValue')" />
          <NInput v-if="isSysAdmin" v-model:value="editForm.tenant_id" :placeholder="$t('custom.dict.tenantId')" />
          <NInput v-model:value="editForm.remark" :placeholder="$t('common.remark')" />
          <div class="flex justify-end gap-8px">
            <NButton @click="closeEdit">{{ $t('common.cancel') }}</NButton>
            <NButton type="primary" @click="submitEdit">{{ $t('common.confirm') }}</NButton>
          </div>
        </div>
      </NModal>

      <NModal
        v-model:show="langVisible"
        preset="card"
        :style="{ width: '640px' }"
        :mask-closable="true"
        :close-on-esc="true"
        :closable="true"
        :title="$t('custom.dict.language')"
        @after-leave="handleLangAfterLeave"
      >
        <div class="flex flex-col gap-12px">
          <div class="text-14px">
            {{ $t('custom.dict.dictCode') }}:
            <span class="font-600">{{ langDict?.dict_code }}</span>
            <span class="mx-8px">/</span>
            {{ $t('custom.dict.dictValue') }}:
            <span class="font-600">{{ langDict?.dict_value }}</span>
          </div>
          <NDataTable
            :loading="langLoading"
            :data="langList"
            :columns="langColumns"
            :pagination="false"
            :row-key="row => row.id"
          />
          <div class="grid grid-cols-[140px_1fr_auto] gap-8px">
            <LanguageCodeSelect
              v-model:value="langForm.language_code"
              :clearable="false"
              :disabled="langMode === 'edit'"
              :placeholder="$t('custom.dict.languageCode')"
            />
            <NInput v-model:value="langForm.translation" :placeholder="$t('custom.dict.translation')" />
            <NButton type="primary" secondary @click="submitLanguage">{{ $t('common.save') }}</NButton>
          </div>
          <div class="flex justify-end">
            <NButton @click="closeLang">{{ $t('common.close') }}</NButton>
          </div>
        </div>
      </NModal>
    </NCard>
  </div>
</template>

<style scoped></style>
