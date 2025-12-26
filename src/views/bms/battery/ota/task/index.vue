<script setup lang="tsx">
import { ref } from 'vue'
import { NButton, NCard, NDataTable, NForm, NFormItem, NSelect, NSpace, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useTable } from '@/hooks/common/table'
import { useRouterPush } from '@/hooks/common/router'
import { getOtaTaskList, getOtaUpgradePackageList } from '@/service/api/bms'

interface OtaTaskItem {
  id: string
  name: string
  ota_upgrade_package_id: string
  created_at: string
  description?: string | null
  remark?: string | null
  device_count?: number | null
}

const message = useMessage()
const { routerPushByKey } = useRouterPush()

const pkgOptions = ref<Array<{ label: string; value: string }>>([])

const searchForm = ref({
  ota_upgrade_package_id: '' as string
})

async function loadPackages() {
  try {
    const res: any = await getOtaUpgradePackageList({ page: 1, page_size: 1000 })
    const list = (res?.data?.list || []) as Array<{
      id: string
      name: string
      version: string
      target_version?: string | null
    }>
    pkgOptions.value = list.map(i => ({
      label: `${i.name} / ${i.version}${i.target_version ? ` → ${i.target_version}` : ''}`,
      value: i.id
    }))
  } catch {
    pkgOptions.value = []
  }
}

function createColumns(): DataTableColumns<OtaTaskItem> {
  return [
    { key: 'name', title: '任务名称', minWidth: 200 },
    { key: 'device_count', title: '设备数', minWidth: 90, render: r => <NTag type="info">{r.device_count ?? 0}</NTag> },
    { key: 'created_at', title: '创建时间', minWidth: 160 },
    { key: 'remark', title: '备注', minWidth: 160, render: r => r.remark || '--' },
    {
      key: 'actions',
      title: '操作',
      minWidth: 140,
      fixed: 'right',
      render: r => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => goDetail(r)}>
            查看详情
          </NButton>
        </NSpace>
      )
    }
  ]
}

const { data, loading, pagination, columns, getData, updateSearchParams } = useTable<
  OtaTaskItem,
  typeof getOtaTaskList
>({
  apiFn: getOtaTaskList,
  apiParams: { page: 1, page_size: 10, ota_upgrade_package_id: '' },
  transformer: (res: any) => {
    const payload = res?.data
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    }
  },
  columns: () => createColumns()
})

function handleSearch() {
  if (!searchForm.value.ota_upgrade_package_id) {
    message.warning('请先选择升级包')
    return
  }
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    ota_upgrade_package_id: searchForm.value.ota_upgrade_package_id
  })
  getData()
}

function goDetail(row: OtaTaskItem) {
  routerPushByKey('bms_battery_ota_task_detail', {
    query: {
      task_id: row.id
    }
  })
}

loadPackages()
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="OTA升级任务管理" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem label="升级包" required>
          <NSelect
            v-model:value="searchForm.ota_upgrade_package_id"
            :options="pkgOptions"
            filterable
            clearable
            style="width: 420px"
          />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="860"
      />
    </NCard>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
