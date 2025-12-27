<script setup lang="tsx">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NButton,
  NCard,
  NDataTable,
  NDropdown,
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
import type { DataTableColumns, DropdownOption } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { $t } from '@/locales'
import {
  batchDeleteAppVersions,
  createAppVersion,
  deleteAppVersion,
  fetchAppList,
  fetchAppVersionDetail,
  fetchAppVersionList
} from '@/service/api/app-manage'

type AppOption = { label: string; value: string; appid?: string; name?: string }

type VersionRow = {
  id: string
  appid: string
  name: string
  title?: string | null
  type: 'native_app' | 'wgt'
  platform: string[]
  version: string
  stable_publish: boolean
  create_date: string
}

type ListResp<T> = { list: T[]; total: number; page: number; page_size: number }

const route = useRoute()
const message = useMessage()
const dialog = useDialog()

const appOptions = ref<AppOption[]>([])
const currentAppId = ref<string | null>(null)

const searchForm = ref({ keyword: '' })
const checkedRowKeys = ref<string[]>([])

let getTableData: () => void = () => {}
let setSearchParams: any = () => {}

const table = useTable<VersionRow, typeof fetchAppVersionList>({
  apiFn: fetchAppVersionList,
  apiParams: {
    page: 1,
    page_size: 10
  },
  onPaginationChanged: async p => {
    setSearchParams({
      page: p.page,
      page_size: p.pageSize,
      app_id: currentAppId.value || undefined,
      keyword: searchForm.value.keyword || undefined
    })
    getTableData()
  },
  transformer: (res: any) => {
    const payload: ListResp<VersionRow> | undefined = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: (): DataTableColumns<VersionRow> => [
    { type: 'selection' },
    { key: 'appid', title: $t('page.appManage.apps.table.appid'), minWidth: 140 },
    {
      key: 'title',
      title: $t('page.appManage.upgrade.table.updateTitle'),
      minWidth: 180,
      render: row => row.title || '--'
    },
    {
      key: 'type',
      title: $t('page.appManage.upgrade.table.packageType'),
      width: 140,
      render: row => (
        <NTag type="success" bordered={false}>
          {row.type === 'native_app'
            ? $t('page.appManage.upgrade.publish.nativeApp')
            : $t('page.appManage.upgrade.publish.wgt')}
        </NTag>
      )
    },
    {
      key: 'platform',
      title: $t('page.appManage.upgrade.table.platform'),
      width: 140,
      render: row => (row.platform?.length ? row.platform.join('、') : '--')
    },
    { key: 'version', title: $t('page.appManage.upgrade.table.version'), width: 120 },
    {
      key: 'stable_publish',
      title: $t('page.appManage.upgrade.table.packageStatus'),
      width: 120,
      render: row => (
        <NTag type={row.stable_publish ? 'success' : 'default'}>
          {row.stable_publish
            ? $t('page.appManage.upgrade.table.published')
            : $t('page.appManage.upgrade.table.unpublished')}
        </NTag>
      )
    },
    {
      key: 'create_date',
      title: $t('page.appManage.upgrade.table.uploadTime'),
      minWidth: 160,
      render: row => row.create_date || '--'
    },
    {
      key: 'actions',
      title: $t('common.actions'),
      width: 180,
      fixed: 'right',
      render: row => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => openDetail(row.id)}>
            {$t('page.appManage.upgrade.table.detail')}
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
    app_id: currentAppId.value || undefined,
    keyword: searchForm.value.keyword || undefined
  })
  getData()
}

watch(currentAppId, () => {
  handleSearch()
})

async function initAppOptions() {
  try {
    const res: any = await fetchAppList({ page: 1, page_size: 1000 })
    const list = (res?.data?.list || []) as Array<{ id: string; name: string; appid: string }>
    appOptions.value = list.map(i => ({ label: i.name, value: i.id, appid: i.appid, name: i.name }))
  } catch {
    appOptions.value = []
  }
}

function ensureCurrentAppFromQuery() {
  const q = route.query?.app_id
  if (typeof q === 'string' && q) {
    currentAppId.value = q
  }
}

// -----------------------------------------------------------------------------
// Publish
// -----------------------------------------------------------------------------

const publishVisible = ref(false)
const publishLoading = ref(false)
const publishType = ref<'native_app' | 'wgt'>('native_app')

const publishModel = ref({
  title: '',
  contents: '',
  platform: [] as string[],
  version: '',
  min_uni_version: '',
  url: '',
  stable_publish: false,
  is_silently: false,
  is_mandatory: false,
  uni_platform: 'app'
})

const publishOptions = computed<DropdownOption[]>(() => [
  { label: $t('page.appManage.upgrade.publish.nativeApp'), key: 'native_app' },
  { label: $t('page.appManage.upgrade.publish.wgt'), key: 'wgt' }
])

function openPublish(type: 'native_app' | 'wgt') {
  if (!currentAppId.value) {
    message.warning($t('page.appManage.upgrade.publish.pleaseSelectApp'))
    return
  }
  publishType.value = type
  publishModel.value = {
    title: '',
    contents: '',
    platform: [],
    version: '',
    min_uni_version: '',
    url: '',
    stable_publish: false,
    is_silently: false,
    is_mandatory: false,
    uni_platform: type === 'native_app' ? 'android' : 'app'
  }
  publishVisible.value = true
}

async function submitPublish() {
  if (!currentAppId.value) return
  publishLoading.value = true
  try {
    const payload = {
      app_id: currentAppId.value,
      title: publishModel.value.title || undefined,
      contents: publishModel.value.contents,
      platform: publishModel.value.platform,
      type: publishType.value,
      version: publishModel.value.version,
      min_uni_version: publishType.value === 'wgt' ? publishModel.value.min_uni_version || undefined : undefined,
      url: publishModel.value.url,
      stable_publish: publishModel.value.stable_publish,
      is_silently: publishType.value === 'wgt' ? publishModel.value.is_silently : false,
      is_mandatory: publishModel.value.is_mandatory,
      uni_platform: publishModel.value.uni_platform
    }
    await createAppVersion(payload)
    message.success($t('page.appManage.upgrade.publish.success'))
    publishVisible.value = false
    getData()
  } catch (e: any) {
    message.error(e?.message || $t('page.appManage.upgrade.publish.failed'))
  } finally {
    publishLoading.value = false
  }
}

// -----------------------------------------------------------------------------
// Detail
// -----------------------------------------------------------------------------

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<any>(null)

async function openDetail(id: string) {
  detailVisible.value = true
  detailLoading.value = true
  detailData.value = null
  try {
    const res: any = await fetchAppVersionDetail(id)
    detailData.value = res?.data || null
  } catch (e: any) {
    message.error(e?.message || $t('common.loadFailed'))
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

function confirmDelete(id: string) {
  dialog.warning({
    title: $t('page.appManage.upgrade.confirm.deleteTitle'),
    content: $t('page.appManage.upgrade.confirm.deleteContent'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await deleteAppVersion(id)
        message.success($t('common.deleteSuccess'))
        getData()
      } catch (e: any) {
        message.error(e?.message || $t('common.deleteFailed'))
      }
    }
  })
}

async function handleBatchDelete() {
  if (!checkedRowKeys.value.length) return
  dialog.warning({
    title: $t('page.appManage.upgrade.confirm.batchDeleteTitle'),
    content: $t('page.appManage.upgrade.confirm.batchDeleteContent', { count: checkedRowKeys.value.length }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await batchDeleteAppVersions(checkedRowKeys.value)
        message.success($t('common.deleteSuccess'))
        checkedRowKeys.value = []
        getData()
      } catch (e: any) {
        message.error(e?.message || $t('common.deleteFailed'))
      }
    }
  })
}

const platformOptions = computed(() => [
  { label: $t('page.appManage.apps.form.android'), value: 'Android' },
  { label: $t('page.appManage.apps.form.ios'), value: 'iOS' },
  { label: $t('page.appManage.apps.form.harmony'), value: 'Harmony' }
])

const uniPlatformOptions = [
  { label: 'app', value: 'app' },
  { label: 'android', value: 'android' },
  { label: 'ios', value: 'ios' },
  { label: 'harmony', value: 'harmony' }
]

const isNativeApp = computed(() => publishType.value === 'native_app')

const yesNoOptions = computed(() => [
  { label: $t('common.yesOrNo.no'), value: false },
  { label: $t('common.yesOrNo.yes'), value: true }
])

const publishModalTitle = computed(() =>
  publishType.value === 'native_app'
    ? $t('page.appManage.upgrade.publish.modal.nativeAppTitle')
    : $t('page.appManage.upgrade.publish.modal.wgtTitle')
)

function formatPackageType(type: string) {
  return type === 'native_app'
    ? $t('page.appManage.upgrade.publish.nativeApp')
    : $t('page.appManage.upgrade.publish.wgt')
}

onMounted(async () => {
  await initAppOptions()
  ensureCurrentAppFromQuery()
  handleSearch()
})
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="$t('page.appManage.upgrade.title')" :bordered="false" size="small" class="card-wrapper">
      <div class="flex flex-wrap items-center justify-between gap-12px mb-4">
        <div class="flex items-center gap-12px">
          <span>{{ $t('page.appManage.upgrade.currentApp') }}</span>
          <NSelect
            v-model:value="currentAppId"
            :options="appOptions"
            clearable
            filterable
            :placeholder="$t('page.appManage.upgrade.selectAppPlaceholder')"
            style="min-width: 240px"
          />
        </div>

        <div class="flex flex-wrap items-center gap-12px">
          <NInput
            v-model:value="searchForm.keyword"
            clearable
            style="width: 320px"
            :placeholder="$t('page.appManage.upgrade.searchPlaceholder')"
          />
          <NButton @click="handleSearch">{{ $t('common.search') }}</NButton>
          <NDropdown :options="publishOptions" trigger="click" @select="key => openPublish(key as any)">
            <NButton type="primary">{{ $t('page.appManage.upgrade.publish.button') }}</NButton>
          </NDropdown>
          <NButton type="error" :disabled="checkedRowKeys.length === 0" @click="handleBatchDelete">
            {{ $t('common.batchDelete') }}
          </NButton>
        </div>
      </div>

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

    <NModal v-model:show="publishVisible" preset="card" style="width: 760px" :title="publishModalTitle">
      <NForm :model="publishModel" label-placement="left" label-width="120">
        <NFormItem :label="$t('page.appManage.upgrade.publish.form.appid')">
          <NInput :value="appOptions.find(o => o.value === currentAppId)?.appid || ''" disabled />
        </NFormItem>
        <NFormItem :label="$t('page.appManage.upgrade.publish.form.appName')">
          <NInput :value="appOptions.find(o => o.value === currentAppId)?.name || ''" disabled />
        </NFormItem>
        <NFormItem :label="$t('page.appManage.upgrade.publish.form.updateTitle')">
          <NInput
            v-model:value="publishModel.title"
            :placeholder="$t('page.appManage.upgrade.publish.form.updateTitle')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.appManage.upgrade.publish.form.contents')" required>
          <NInput
            v-model:value="publishModel.contents"
            type="textarea"
            :placeholder="$t('page.appManage.upgrade.publish.form.contentsPlaceholder')"
          />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.upgrade.publish.form.platform')" required>
          <NSelect
            v-model:value="publishModel.platform"
            :options="platformOptions"
            :multiple="!isNativeApp"
            :clearable="true"
            style="width: 420px"
            :placeholder="$t('page.appManage.upgrade.publish.form.platformPlaceholder')"
          />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.upgrade.publish.form.version')" required>
          <NInput
            v-model:value="publishModel.version"
            :placeholder="$t('page.appManage.upgrade.publish.form.versionPlaceholder')"
          />
        </NFormItem>

        <NFormItem v-if="!isNativeApp" :label="$t('page.appManage.upgrade.publish.form.minUniVersion')">
          <NInput
            v-model:value="publishModel.min_uni_version"
            :placeholder="$t('page.appManage.upgrade.publish.form.minUniVersion')"
          />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.upgrade.publish.form.downloadUrl')" required>
          <NInput
            v-model:value="publishModel.url"
            :placeholder="$t('page.appManage.upgrade.publish.form.downloadUrlPlaceholder')"
          />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.upgrade.publish.form.uniPlatform')">
          <NSelect v-model:value="publishModel.uni_platform" :options="uniPlatformOptions" style="width: 220px" />
        </NFormItem>

        <NFormItem v-if="!isNativeApp" :label="$t('page.appManage.upgrade.publish.form.silentlyUpdate')">
          <NSelect v-model:value="publishModel.is_silently" :options="yesNoOptions" style="width: 220px" />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.upgrade.publish.form.mandatoryUpdate')">
          <NSelect v-model:value="publishModel.is_mandatory" :options="yesNoOptions" style="width: 220px" />
        </NFormItem>

        <NFormItem :label="$t('page.appManage.upgrade.publish.form.stablePublish')">
          <NSelect v-model:value="publishModel.stable_publish" :options="yesNoOptions" style="width: 220px" />
        </NFormItem>

        <NSpace justify="end">
          <NButton :loading="publishLoading" type="primary" @click="submitPublish">
            {{ $t('page.appManage.upgrade.publish.button') }}
          </NButton>
          <NButton @click="publishVisible = false">{{ $t('common.cancel') }}</NButton>
        </NSpace>
      </NForm>
    </NModal>

    <NModal
      v-model:show="detailVisible"
      preset="card"
      style="width: 720px"
      :title="$t('page.appManage.upgrade.detail.title')"
    >
      <div v-if="detailLoading">{{ $t('page.appManage.upgrade.detail.loading') }}</div>
      <div v-else class="grid gap-12px">
        <div class="flex justify-between">
          <span>{{ $t('page.appManage.upgrade.publish.form.appid') }}</span>
          <span>{{ detailData?.appid || '--' }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ $t('page.appManage.upgrade.publish.form.appName') }}</span>
          <span>{{ detailData?.name || '--' }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ $t('page.appManage.upgrade.table.packageType') }}</span>
          <span>{{ detailData?.type ? formatPackageType(detailData?.type) : '--' }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ $t('page.appManage.upgrade.table.platform') }}</span>
          <span>{{ detailData?.platform?.join('、') || '--' }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ $t('page.appManage.upgrade.publish.form.version') }}</span>
          <span>{{ detailData?.version || '--' }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ $t('page.appManage.upgrade.publish.form.stablePublish') }}</span>
          <span>{{ detailData?.stable_publish ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no') }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ $t('page.appManage.upgrade.table.uploadTime') }}</span>
          <span>{{ detailData?.create_date || '--' }}</span>
        </div>
        <div class="flex flex-col gap-6px">
          <span>{{ $t('page.appManage.upgrade.detail.updateContent') }}</span>
          <div class="p-12px bg-gray-50 rounded">{{ detailData?.contents || '--' }}</div>
        </div>
        <div class="flex flex-col gap-6px">
          <span>{{ $t('page.appManage.upgrade.detail.downloadUrl') }}</span>
          <div class="break-all">{{ detailData?.url || '--' }}</div>
        </div>
      </div>
    </NModal>
  </div>
</template>
