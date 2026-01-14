<script setup lang="tsx">
import { computed, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'
import dayjs from 'dayjs'
import { NButton, NInput, NPopconfirm, NRadioButton, NRadioGroup, NSpace, NTag } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import { useBoolean, useLoading } from '@sa/hooks'
import { $t } from '@/locales'
import { useAuthStore } from '@/store/modules/auth'
import {
  createDictItem,
  deleteDictItem,
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

const categoryOptions = computed(() => {
  const opts = categories.value.map(item => ({
    label: `${item.category} (${item.count})`,
    value: item.category
  }))
  return [{ label: $t('common.all'), value: '__all__' }, ...opts]
})

async function refreshCategories() {
  const params: any = { scope: scope.value }
  if (isSysAdmin.value && filterTenantID.value) params.tenant_id = filterTenantID.value
  categories.value = await fetchDictCategories(params)
  if (activeCategory.value !== '__all__' && !categories.value.some(c => c.category === activeCategory.value)) {
    activeCategory.value = '__all__'
  }
}

async function getTableData() {
  startLoading()
  try {
    const params: any = {
      page: queryParams.page,
      page_size: queryParams.page_size,
      scope: scope.value
    }
    if (activeCategory.value !== '__all__') params.category = activeCategory.value
    if (queryParams.dict_code) params.dict_code = queryParams.dict_code
    if (queryParams.dict_value) params.dict_value = queryParams.dict_value
    if (isSysAdmin.value && filterTenantID.value) params.tenant_id = filterTenantID.value

    const data = await fetchDictList(params)
    pagination.itemCount = data.total
    tableData.value = data.list ?? []
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
const langForm = reactive({
  language_code: 'zh',
  translation: ''
})

async function openLanguage(row: DictManagement.DictItem) {
  if (!isSysAdmin.value && row.tenant_id === '0') {
    window.$message?.warning($t('custom.dict.globalReadonly'))
    return
  }
  langDict.value = row
  langForm.language_code = 'zh'
  langForm.translation = ''
  openLang()
  langLoading.value = true
  try {
    langList.value = await fetchDictLanguages(row.id)
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
  langList.value = await fetchDictLanguages(langDict.value.id)
  langForm.translation = ''
}

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
          <NInput
            v-if="isSysAdmin"
            v-model:value="filterTenantID"
            size="small"
            clearable
            :placeholder="$t('custom.dict.filterTenantIdPlaceholder')"
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

      <NModal v-model:show="langVisible" preset="card" :title="$t('custom.dict.language')">
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
            :columns="[
              { key: 'language_code', title: $t('custom.dict.languageCode'), minWidth: 120 },
              { key: 'translation', title: $t('custom.dict.translation'), minWidth: 200 }
            ]"
            :pagination="false"
            :row-key="row => row.id"
          />
          <div class="grid grid-cols-[140px_1fr_auto] gap-8px">
            <NInput v-model:value="langForm.language_code" :placeholder="$t('custom.dict.languageCode')" />
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
