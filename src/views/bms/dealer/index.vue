<script setup lang="tsx">
import { bt } from '@/views/bms/_shared/i18n'
import { computed, ref } from 'vue'
import { NButton, NDivider, NModal, NPopconfirm, NRadioButton, NRadioGroup, NSpace, NTag, useMessage } from 'naive-ui'
import {
  getDealerDetail,
  getDealerList,
  getDealerOverview,
  getDealerPermissionTemplate,
  setDealerPermissionTemplate,
  deleteDealer,
  createDealer,
  updateDealer
} from '@/service/api/bms'
import type { SearchConfig } from '@/components/data-table-page/index.vue'
import { $t } from '@/locales'
import { useRouterPush } from '@/hooks/common/router'
import DealerModal from './modules/dealer-modal.vue'

const message = useMessage()
const { routerPushByKey } = useRouterPush()
const tablePageRef = ref()
const modalVisible = ref(false)
const modalType = ref<'add' | 'edit'>('add')
const currentData = ref(null)

// 详情穿透弹窗
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailDealer = ref<any>(null)
const detailOverview = ref<any>(null)

// 授权模板
const authVisible = ref(false)
const authLoading = ref(false)
const authDealer = ref<any>(null)
const authTemplate = ref<'BASIC' | 'ADVANCED'>('BASIC')
const authCurrent = ref<string>('NONE')

// 搜索配置
const searchConfigs = ref<SearchConfig[]>([
  {
    key: 'name',
    label: bt('auto.s_fe080071ea'),
    type: 'input',
    placeholder: bt('auto.s_821901d3ee')
  },
  {
    key: 'phone',
    label: bt('auto.s_09a1f6985a'),
    type: 'input',
    placeholder: bt('auto.s_7b540b8035')
  },
  {
    key: 'province',
    label: bt('auto.s_d7009d07f0'),
    type: 'input',
    placeholder: bt('auto.s_9257d8e3e4')
  },
  {
    key: 'city',
    label: bt('auto.s_f7d29dfae0'),
    type: 'input',
    placeholder: bt('auto.s_60d56130c5')
  }
])

// 表格列配置（Naive UI 原始列定义，用于自定义渲染）
const columns = ref([
  {
    key: 'name',
    title: bt('auto.s_fe080071ea'),
    minWidth: 150
  },
  {
    key: 'contact_person',
    title: bt('auto.s_52409da520'),
    minWidth: 100
  },
  {
    key: 'phone',
    title: bt('auto.s_09a1f6985a'),
    minWidth: 120
  },
  {
    key: 'region',
    title: bt('auto.s_65d3ab7783'),
    minWidth: 150,
    render: (row: any) => {
      return `${row.province || ''} ${row.city || ''} ${row.district || ''}`
    }
  },
  {
    key: 'device_count',
    title: bt('auto.s_c615660dac'),
    minWidth: 100,
    render: (row: any) => {
      return <NTag type="info">{row.device_count || 0}</NTag>
    }
  },
  {
    key: 'active_count',
    title: bt('auto.s_eb7082c58f'),
    minWidth: 100,
    render: (row: any) => {
      return <NTag type="success">{row.active_count || 0}</NTag>
    }
  },
  {
    key: 'created_at',
    title: bt('auto.s_eca37cb072'),
    minWidth: 160
  },
  {
    key: 'actions',
    title: bt('auto.s_2b6bc0f293'),
    width: 200,
    fixed: 'right',
    render: (row: any) => {
      return (
        <NSpace>
          <NButton size="small" onClick={() => handleDetail(row)}>{bt('auto.s_f26225bde6')}</NButton>
          <NButton size="small" type="warning" onClick={() => handleAuth(row)}>{bt('auto.s_98a315c0fc')}</NButton>
          <NButton size="small" type="primary" onClick={() => handleEdit(row)}>{bt('auto.s_95b351c862')}</NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => bt('auto.s_85f0d850f4'),
              trigger: () => (
                <NButton size="small" type="error">{bt('auto.s_2f4aaddde3')}</NButton>
              )
            }}
          </NPopconfirm>
        </NSpace>
      )
    }
  }
])

// 映射为 DataTablePage 使用的 columnsToShow 配置
const columnsToShow = computed(() =>
  columns.value.map((col: any) => ({
    key: col.key,
    label: col.title,
    render: col.render
  }))
)

// 顶部操作按钮
const topActions = [
  {
    element: () => (
      <NButton type="primary" onClick={handleAdd}>{bt('auto.s_59c0ea479f')}</NButton>
    )
  }
]

// 处理新增
const handleAdd = () => {
  modalType.value = 'add'
  currentData.value = null
  modalVisible.value = true
}

// 处理编辑
const handleEdit = (row: any) => {
  modalType.value = 'edit'
  currentData.value = { ...row }
  modalVisible.value = true
}

// 详情穿透
const handleDetail = async (row: any) => {
  detailVisible.value = true
  detailLoading.value = true
  detailDealer.value = null
  detailOverview.value = null
  try {
    const [dRes, oRes]: any = await Promise.all([getDealerDetail(row.id), getDealerOverview(row.id)])
    detailDealer.value = dRes?.data ?? null
    detailOverview.value = oRes?.data ?? null
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_cb1ae46db5'))
  } finally {
    detailLoading.value = false
  }
}

const goBatteryListByDealer = () => {
  if (!detailDealer.value?.id) return
  routerPushByKey('bms_battery_list', {
    query: { dealer_id: detailDealer.value.id }
  })
}

const goEndUsersByDealer = () => {
  if (!detailDealer.value?.id) return
  // end_user 页面支持 query 预填（前端会带入搜索参数）
  routerPushByKey('bms_end_user', {
    query: { dealer_id: detailDealer.value.id }
  })
}

// 授权弹窗
const handleAuth = async (row: any) => {
  authVisible.value = true
  authLoading.value = true
  authDealer.value = row
  authCurrent.value = 'NONE'
  authTemplate.value = 'BASIC'
  try {
    const res: any = await getDealerPermissionTemplate(row.id)
    authCurrent.value = res?.data?.template ?? 'NONE'
    if (authCurrent.value === 'ADVANCED') authTemplate.value = 'ADVANCED'
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_77d878fb69'))
  } finally {
    authLoading.value = false
  }
}

const submitAuth = async () => {
  if (!authDealer.value?.id) return
  authLoading.value = true
  try {
    const res: any = await setDealerPermissionTemplate(authDealer.value.id, { template: authTemplate.value })
    authCurrent.value = res?.data?.template ?? authTemplate.value
    message.success(
      bt('pages.dealer.authSetSuccess', {
        template: authCurrent.value === 'ADVANCED' ? bt('auto.s_d4d034fefd') : bt('auto.s_890e37079b'),
        count: res?.data?.user_count ?? 0
      })
    )
    authVisible.value = false
  } catch (e: any) {
    message.error(e?.message || bt('auto.s_9f96034c4d'))
  } finally {
    authLoading.value = false
  }
}

// 处理删除
const handleDelete = async (row: any) => {
  try {
    const { error } = await deleteDealer(row.id)
    if (!error) {
      message.success(bt('auto.s_0007d170de'))
      tablePageRef.value?.reload()
    }
  } catch (err) {
    // 错误处理已在 request 中统一处理
  }
}

// 模态框提交
const handleModalSubmit = async (formData: any) => {
  try {
    if (modalType.value === 'add') {
      const { error } = await createDealer(formData)
      if (!error) {
        message.success(bt('auto.s_04a691b377'))
        modalVisible.value = false
        tablePageRef.value?.reload()
      }
    } else {
      const { error } = await updateDealer(currentData.value.id, formData)
      if (!error) {
        message.success(bt('auto.s_55aa6366c0'))
        modalVisible.value = false
        tablePageRef.value?.reload()
      }
    }
  } catch (err) {
    // 错误处理
  }
}
</script>

<template>
  <div class="h-full">
    <DataTablePage
      ref="tablePageRef"
      :fetch-data="getDealerList"
      :columns-to-show="columnsToShow"
      :search-configs="searchConfigs"
      :top-actions="topActions"
    />

    <DealerModal v-model:visible="modalVisible" :type="modalType" :data="currentData" @submit="handleModalSubmit" />

    <NModal v-model:show="detailVisible" preset="card" style="width: 920px" :title="bt('auto.s_d8c3c6db42')" :loading="detailLoading">
      <div v-if="detailDealer">
        <NDescriptions :columns="2" bordered size="small" label-placement="left">
          <NDescriptionsItem :label="bt('auto.s_d7ec2d3fea')">{{ detailDealer.name || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_52409da520')">{{ detailDealer.contact_person || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_5a93d3f72d')">{{ detailDealer.phone || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_3bc5e602b2')">{{ detailDealer.email || '--' }}</NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_2560b304e6')">
            {{ [detailDealer.province, detailDealer.city, detailDealer.district].filter(Boolean).join(' ') || '--' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="bt('auto.s_7650487a87')">{{ detailDealer.address || '--' }}</NDescriptionsItem>
        </NDescriptions>

        <NDivider class="my-12px" />

        <NSpace>
          <NTag type="info">{{ bt('pages.dealer.overviewDeviceTotal', { count: detailOverview?.device_count ?? 0 }) }}</NTag>
          <NTag type="success">{{ bt('pages.dealer.overviewActive', { count: detailOverview?.active_count ?? 0 }) }}</NTag>
          <NTag type="warning">{{ bt('pages.dealer.overviewEndUsers', { count: detailOverview?.end_user_count ?? 0 }) }}</NTag>
          <NTag type="primary">{{ bt('pages.dealer.overviewWarranty', { count: detailOverview?.warranty_total ?? 0 }) }}</NTag>
        </NSpace>

        <NDivider class="my-12px" />

        <NSpace>
          <NButton type="primary" @click="goBatteryListByDealer">{{ bt('auto.s_a7fab8dcfe') }}</NButton>
          <NButton @click="goEndUsersByDealer">{{ bt('auto.s_6b9ae2e884') }}</NButton>
        </NSpace>

        <div class="mt-12px text-12px text-gray-500">
          {{ bt('pages.dealer.filterWarrantyHint') }}
        </div>
      </div>
      <div v-else class="text-12px text-gray-500">{{ bt('auto.s_21efd88b67') }}</div>
    </NModal>

    <NModal
      v-model:show="authVisible"
      preset="dialog"
      :title="bt('auto.s_04ee9933c7')"
      :positive-text="bt('auto.s_be5fbbe34c')"
      :negative-text="bt('auto.s_625fb26b4b')"
      :loading="authLoading"
      @positive-click="submitAuth"
    >
      <NSpace vertical :size="12">
        <div class="text-13px text-gray-500">
          {{ bt('pages.dealer.dealerLabel', { name: authDealer?.name || authDealer?.id || '--' }) }}
        </div>
        <div class="text-13px text-gray-500">
          {{
            bt('pages.dealer.currentTemplate', {
              template:
                authCurrent === 'ADVANCED'
                  ? bt('auto.s_d4d034fefd')
                  : authCurrent === 'BASIC'
                    ? bt('auto.s_890e37079b')
                    : bt('auto.s_fe2d26a257')
            })
          }}
        </div>
        <NRadioGroup v-model:value="authTemplate">
          <NSpace>
            <NRadioButton value="BASIC">{{ bt('auto.s_e8e377a52f') }}</NRadioButton>
            <NRadioButton value="ADVANCED">{{ bt('auto.s_4cfc0467fc') }}</NRadioButton>
          </NSpace>
        </NRadioGroup>
        <div class="text-12px text-gray-500">
          {{ bt('pages.dealer.authHint') }}
        </div>
      </NSpace>
    </NModal>
  </div>
</template>
