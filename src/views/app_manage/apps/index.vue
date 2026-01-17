<script setup lang="tsx">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTag,
  useDialog,
  useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { $t } from '@/locales'
import ImageUpload from '@/components/business/image-upload/index.vue'
import {
  batchDeleteApps,
  createApp,
  deleteApp,
  fetchAppDetail,
  fetchAppList,
  updateApp
} from '@/service/api/app-manage'

type AppRow = {
  id: string
  appid: string
  app_type: number
  name: string
  description?: string | null
  remark?: string | null
  created_at: string
}

type ListResp<T> = {
  list: T[]
  total: number
  page: number
  page_size: number
}

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const searchForm = ref({
  keyword: ''
})

const checkedRowKeys = ref<string[]>([])

let getTableData: () => void = () => {}
let setSearchParams: any = () => {}

const table = useTable<AppRow, typeof fetchAppList>({
  apiFn: fetchAppList,
  apiParams: {
    page: 1,
    page_size: 10
  },
  onPaginationChanged: async p => {
    setSearchParams({
      page: p.page,
      page_size: p.pageSize,
      keyword: searchForm.value.keyword || undefined
    })
    getTableData()
  },
  transformer: (res: any) => {
    const payload: ListResp<AppRow> | undefined = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): DataTableColumns<AppRow> => [
    { type: 'selection' },
    { key: 'appid', title: $t('page.appManage.apps.table.appid'), minWidth: 140 },
    {
      key: 'app_type',
      title: $t('page.appManage.apps.table.appType'),
      width: 120,
      render: row => (
        <NTag type="info">
          {row.app_type === 1 ? $t('page.appManage.apps.appType.uniAppX') : $t('page.appManage.apps.appType.uniApp')}
        </NTag>
      )
    },
    { key: 'name', title: $t('page.appManage.apps.table.appName'), minWidth: 160 },
    {
      key: 'description',
      title: $t('page.appManage.apps.table.description'),
      minWidth: 220,
      render: row => row.description || '--'
    },
    { key: 'remark', title: $t('page.appManage.apps.table.remark'), minWidth: 160, render: row => row.remark || '--' },
    {
      key: 'created_at',
      title: $t('page.appManage.apps.table.createdAt'),
      minWidth: 160,
      render: row => row.created_at || '--'
    },
    {
      key: 'actions',
      title: $t('common.actions'),
      width: 320,
      fixed: 'right',
      render: row => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => goVersionManager(row)}>
            {$t('page.appManage.apps.table.versionManager')}
          </NButton>
          <NButton size="small" onClick={() => openEdit(row.id)}>
            {$t('common.edit')}
          </NButton>
          <NButton size="small" type="error" onClick={() => confirmDelete(row.id)}>
            {$t('common.delete')}
          </NButton>
        </NSpace>
      )
    }
  ]
})

const { data, loading, columns, pagination, getData, updateSearchParams } = table
getTableData = getData
setSearchParams = updateSearchParams

function handleSearch() {
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    keyword: searchForm.value.keyword || undefined
  })
  getData()
}

function handleReset() {
  searchForm.value.keyword = ''
  handleSearch()
}

function goVersionManager(row: AppRow) {
  router.push({ path: '/app/manage/upgrade', query: { app_id: row.id } })
}

async function handleBatchDelete() {
  if (!checkedRowKeys.value.length) return
  dialog.warning({
    title: $t('page.appManage.apps.confirm.batchDeleteTitle'),
    content: $t('page.appManage.apps.confirm.batchDeleteContent', { count: checkedRowKeys.value.length }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await batchDeleteApps(checkedRowKeys.value)
        message.success($t('common.deleteSuccess'))
        checkedRowKeys.value = []
        getData()
      } catch (e: any) {
        message.error(e?.message || $t('common.deleteFailed'))
      }
    }
  })
}

function confirmDelete(id: string) {
  dialog.warning({
    title: $t('page.appManage.apps.confirm.deleteTitle'),
    content: $t('page.appManage.apps.confirm.deleteContent'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await deleteApp(id)
        message.success($t('common.deleteSuccess'))
        getData()
      } catch (e: any) {
        message.error(e?.message || $t('common.deleteFailed'))
      }
    }
  })
}

// -----------------------------------------------------------------------------
// Create / Edit modal
// -----------------------------------------------------------------------------

type AppFormModel = {
  id?: string
  appid: string
  app_type: number
  name: string
  description: string
  remark: string
  icon_url: string
  screenshot: string[]
  app_android: { name?: string; url?: string }
  app_ios: { name?: string; url?: string; abm_url?: string }
  app_harmony: { name?: string; url?: string }
  h5: { url?: string }
}

const modalVisible = ref(false)
const modalLoading = ref(false)
const operateType = ref<'add' | 'edit'>('add')

const formModel = ref<AppFormModel>({
  appid: '',
  app_type: 0,
  name: '',
  description: '',
  remark: '',
  icon_url: '',
  screenshot: [],
  app_android: {},
  app_ios: {},
  app_harmony: {},
  h5: {}
})


function openAdd() {
  operateType.value = 'add'
  formModel.value = {
    appid: '',
    app_type: 0,
    name: '',
    description: '',
    remark: '',
    icon_url: '',
    screenshot: [],
    app_android: {},
    app_ios: {},
    app_harmony: {},
    h5: {}
  }
  modalVisible.value = true
}

async function openEdit(id: string) {
  operateType.value = 'edit'
  modalLoading.value = true
  modalVisible.value = true
  try {
    const res: any = await fetchAppDetail(id)
    const d = res?.data
    formModel.value = {
      id: d?.id,
      appid: d?.appid || '',
      app_type: d?.app_type ?? 0,
      name: d?.name || '',
      description: d?.description || '',
      remark: d?.remark || '',
      icon_url: d?.icon_url || '',
      screenshot: d?.screenshot || [],
      app_android: d?.app_android || {},
      app_ios: d?.app_ios || {},
      app_harmony: d?.app_harmony || {},
      h5: d?.h5 || {}
    }
  } catch (e: any) {
    message.error(e?.message || $t('page.appManage.apps.message.loadDetailFailed'))
    modalVisible.value = false
  } finally {
    modalLoading.value = false
  }
}


async function handleSubmit() {
  modalLoading.value = true
  try {
    const payload = {
      appid: formModel.value.appid,
      app_type: formModel.value.app_type,
      name: formModel.value.name,
      description: formModel.value.description || undefined,
      remark: formModel.value.remark || undefined,
      icon_url: formModel.value.icon_url || undefined,
      screenshot: formModel.value.screenshot || [],
      app_android: formModel.value.app_android,
      app_ios: formModel.value.app_ios,
      app_harmony: formModel.value.app_harmony,
      h5: formModel.value.h5
    }

    if (operateType.value === 'add') {
      await createApp(payload)
      message.success($t('common.addSuccess'))
    } else if (formModel.value.id) {
      await updateApp(formModel.value.id, payload)
      message.success($t('common.updateSuccess'))
    }

    modalVisible.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || $t('page.appManage.apps.message.submitFailed'))
  } finally {
    modalLoading.value = false
  }
}

const appTypeOptions = computed(() => [
  { label: $t('page.appManage.apps.appType.uniApp'), value: 0 },
  { label: $t('page.appManage.apps.appType.uniAppX'), value: 1 }
])
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="$t('page.appManage.apps.title')" :bordered="false" size="small" class="card-wrapper">
      <NForm inline :model="searchForm" label-placement="left" label-width="auto" class="mb-4 flex flex-wrap gap-4">
        <NFormItem :label="$t('page.appManage.apps.search')" path="keyword">
          <NInput
            v-model:value="searchForm.keyword"
            clearable
            style="width: 320px"
            :placeholder="$t('page.appManage.apps.searchPlaceholder')"
          />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton @click="handleSearch">{{ $t('common.search') }}</NButton>
            <NButton @click="handleReset">{{ $t('common.reset') }}</NButton>
            <NButton type="primary" @click="openAdd">{{ $t('common.add') }}</NButton>
            <NButton type="error" :disabled="checkedRowKeys.length === 0" @click="handleBatchDelete">
              {{ $t('common.batchDelete') }}
            </NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        v-model:checked-row-keys="checkedRowKeys"
        :columns="columns"
        :data="data"
        size="small"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="1200"
        class="flex-1-hidden"
      />
    </NCard>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      style="width: 920px"
      :title="
        operateType === 'add' ? $t('page.appManage.apps.modal.addTitle') : $t('page.appManage.apps.modal.editTitle')
      "
    >
      <NForm :model="formModel" label-placement="left" label-width="120">
        <NFormItem :label="$t('page.appManage.apps.form.appType')">
          <NSelect v-model:value="formModel.app_type" :options="appTypeOptions" style="width: 240px" />
        </NFormItem>
        <NFormItem :label="$t('page.appManage.apps.form.appid')">
          <NInput
            v-model:value="formModel.appid"
            :disabled="operateType === 'edit'"
            :placeholder="$t('page.appManage.apps.form.appid')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.appManage.apps.form.appName')">
          <NInput
            v-model:value="formModel.name"
            :disabled="operateType === 'edit'"
            :placeholder="$t('page.appManage.apps.form.appName')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.appManage.apps.form.description')">
          <NInput
            v-model:value="formModel.description"
            type="textarea"
            :placeholder="$t('page.appManage.apps.form.description')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.appManage.apps.form.remark')">
          <NInput
            v-model:value="formModel.remark"
            type="textarea"
            :placeholder="$t('page.appManage.apps.form.remark')"
          />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.apps.form.icon')">
          <ImageUpload v-model="formModel.icon_url" :max="1" />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.apps.form.screenshots')">
          <ImageUpload v-model="formModel.screenshot" :max="9" multiple />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.apps.form.ios')">
          <div class="grid gap-8px w-full" style="grid-template-columns: 1fr 1fr">
            <NInput v-model:value="formModel.app_ios.name" :placeholder="$t('page.appManage.apps.form.quickAppName')" />
            <NInput v-model:value="formModel.app_ios.url" :placeholder="$t('page.appManage.apps.form.appStoreUrl')" />
            <div style="grid-column: 1 / span 2">
              <NInput v-model:value="formModel.app_ios.abm_url" :placeholder="$t('page.appManage.apps.form.abmUrl')" />
            </div>
          </div>
        </NFormItem>

        <NFormItem :label="$t('page.appManage.apps.form.android')">
          <div class="grid gap-8px w-full" style="grid-template-columns: 1fr 1fr">
            <NInput
              v-model:value="formModel.app_android.name"
              :placeholder="$t('page.appManage.apps.form.quickAppName')"
            />
            <NInput
              v-model:value="formModel.app_android.url"
              :placeholder="$t('page.appManage.apps.form.androidUrl')"
            />
          </div>
        </NFormItem>

        <NFormItem :label="$t('page.appManage.apps.form.harmony')">
          <div class="grid gap-8px w-full" style="grid-template-columns: 1fr 1fr">
            <NInput
              v-model:value="formModel.app_harmony.name"
              :placeholder="$t('page.appManage.apps.form.harmonyName')"
            />
            <NInput
              v-model:value="formModel.app_harmony.url"
              :placeholder="$t('page.appManage.apps.form.harmonyUrl')"
            />
          </div>
        </NFormItem>

        <NFormItem :label="$t('page.appManage.apps.form.webH5')">
          <NInput v-model:value="formModel.h5.url" :placeholder="$t('page.appManage.apps.form.h5Url')" />
        </NFormItem>

        <NSpace justify="end">
          <NButton :loading="modalLoading" type="primary" @click="handleSubmit">{{ $t('common.save') }}</NButton>
          <NButton @click="modalVisible = false">{{ $t('common.cancel') }}</NButton>
        </NSpace>
      </NForm>
    </NModal>
  </div>
</template>
