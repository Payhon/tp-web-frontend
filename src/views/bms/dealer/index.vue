<script setup lang="tsx">
import { computed, ref } from 'vue';
import { NButton, NDivider, NModal, NPopconfirm, NRadioButton, NRadioGroup, NSpace, NTag, useMessage } from 'naive-ui';
import {
  getDealerDetail,
  getDealerList,
  getDealerOverview,
  getDealerPermissionTemplate,
  setDealerPermissionTemplate,
  deleteDealer,
  createDealer,
  updateDealer
} from '@/service/api/bms';
import type { SearchConfig } from '@/components/data-table-page/index.vue';
import { $t } from '@/locales';
import { useRouterPush } from '@/hooks/common/router';
import DealerModal from './modules/dealer-modal.vue';

const message = useMessage();
const { routerPushByKey } = useRouterPush();
const tablePageRef = ref();
const modalVisible = ref(false);
const modalType = ref<'add' | 'edit'>('add');
const currentData = ref(null);

// 详情穿透弹窗
const detailVisible = ref(false);
const detailLoading = ref(false);
const detailDealer = ref<any>(null);
const detailOverview = ref<any>(null);

// 授权模板
const authVisible = ref(false);
const authLoading = ref(false);
const authDealer = ref<any>(null);
const authTemplate = ref<'BASIC' | 'ADVANCED'>('BASIC');
const authCurrent = ref<string>('NONE');

// 搜索配置
const searchConfigs = ref<SearchConfig[]>([
  {
    key: 'name',
    label: '经销商名称',
    type: 'input',
    placeholder: '请输入经销商名称'
  },
  {
    key: 'phone',
    label: '联系电话',
    type: 'input',
    placeholder: '请输入联系电话'
  },
  {
    key: 'province',
    label: '省份',
    type: 'input',
    placeholder: '请输入省份'
  },
  {
    key: 'city',
    label: '城市',
    type: 'input',
    placeholder: '请输入城市'
  }
]);

// 表格列配置（Naive UI 原始列定义，用于自定义渲染）
const columns = ref([
  {
    key: 'name',
    title: '经销商名称',
    minWidth: 150
  },
  {
    key: 'contact_person',
    title: '联系人',
    minWidth: 100
  },
  {
    key: 'phone',
    title: '联系电话',
    minWidth: 120
  },
  {
    key: 'region',
    title: '所在地区',
    minWidth: 150,
    render: (row: any) => {
      return `${row.province || ''} ${row.city || ''} ${row.district || ''}`;
    }
  },
  {
    key: 'device_count',
    title: '设备总数',
    minWidth: 100,
    render: (row: any) => {
      return <NTag type="info">{row.device_count || 0}</NTag>;
    }
  },
  {
    key: 'active_count',
    title: '激活设备',
    minWidth: 100,
    render: (row: any) => {
      return <NTag type="success">{row.active_count || 0}</NTag>;
    }
  },
  {
    key: 'created_at',
    title: '创建时间',
    minWidth: 160
  },
  {
    key: 'actions',
    title: '操作',
    width: 200,
    fixed: 'right',
    render: (row: any) => {
      return (
        <NSpace>
          <NButton size="small" onClick={() => handleDetail(row)}>
            详情
          </NButton>
          <NButton size="small" type="warning" onClick={() => handleAuth(row)}>
            授权
          </NButton>
          <NButton size="small" type="primary" onClick={() => handleEdit(row)}>
            编辑
          </NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => '确认删除该经销商吗？',
              trigger: () => <NButton size="small" type="error">删除</NButton>
            }}
          </NPopconfirm>
        </NSpace>
      );
    }
  }
]);

// 映射为 DataTablePage 使用的 columnsToShow 配置
const columnsToShow = computed(() =>
  columns.value.map((col: any) => ({
    key: col.key,
    label: col.title,
    render: col.render
  }))
);

// 顶部操作按钮
const topActions = [
  {
    element: () => (
      <NButton type="primary" onClick={handleAdd}>
        + 新增经销商
      </NButton>
    )
  }
];

// 处理新增
const handleAdd = () => {
  modalType.value = 'add';
  currentData.value = null;
  modalVisible.value = true;
};

// 处理编辑
const handleEdit = (row: any) => {
  modalType.value = 'edit';
  currentData.value = { ...row };
  modalVisible.value = true;
};

// 详情穿透
const handleDetail = async (row: any) => {
  detailVisible.value = true;
  detailLoading.value = true;
  detailDealer.value = null;
  detailOverview.value = null;
  try {
    const [dRes, oRes]: any = await Promise.all([getDealerDetail(row.id), getDealerOverview(row.id)]);
    detailDealer.value = dRes?.data ?? null;
    detailOverview.value = oRes?.data ?? null;
  } catch (e: any) {
    message.error(e?.message || '加载经销商详情失败');
  } finally {
    detailLoading.value = false;
  }
};

const goBatteryListByDealer = () => {
  if (!detailDealer.value?.id) return;
  routerPushByKey('bms_battery_list', {
    query: { dealer_id: detailDealer.value.id }
  });
};

const goEndUsersByDealer = () => {
  if (!detailDealer.value?.id) return;
  // end_user 页面支持 query 预填（前端会带入搜索参数）
  routerPushByKey('bms_end_user', {
    query: { dealer_id: detailDealer.value.id }
  });
};

// 授权弹窗
const handleAuth = async (row: any) => {
  authVisible.value = true;
  authLoading.value = true;
  authDealer.value = row;
  authCurrent.value = 'NONE';
  authTemplate.value = 'BASIC';
  try {
    const res: any = await getDealerPermissionTemplate(row.id);
    authCurrent.value = res?.data?.template ?? 'NONE';
    if (authCurrent.value === 'ADVANCED') authTemplate.value = 'ADVANCED';
  } catch (e: any) {
    message.error(e?.message || '获取权限模板失败');
  } finally {
    authLoading.value = false;
  }
};

const submitAuth = async () => {
  if (!authDealer.value?.id) return;
  authLoading.value = true;
  try {
    const res: any = await setDealerPermissionTemplate(authDealer.value.id, { template: authTemplate.value });
    authCurrent.value = res?.data?.template ?? authTemplate.value;
    message.success(`已设置为 ${authCurrent.value === 'ADVANCED' ? '高级版' : '基础版'}（作用用户数：${res?.data?.user_count ?? 0}）`);
    authVisible.value = false;
  } catch (e: any) {
    message.error(e?.message || '设置失败');
  } finally {
    authLoading.value = false;
  }
};

// 处理删除
const handleDelete = async (row: any) => {
  try {
    const { error } = await deleteDealer(row.id);
    if (!error) {
      message.success('删除成功');
      tablePageRef.value?.reload();
    }
  } catch (err) {
    // 错误处理已在 request 中统一处理
  }
};

// 模态框提交
const handleModalSubmit = async (formData: any) => {
  try {
    if (modalType.value === 'add') {
      const { error } = await createDealer(formData);
      if (!error) {
        message.success('创建成功');
        modalVisible.value = false;
        tablePageRef.value?.reload();
      }
    } else {
      const { error } = await updateDealer(currentData.value.id, formData);
      if (!error) {
        message.success('更新成功');
        modalVisible.value = false;
        tablePageRef.value?.reload();
      }
    }
  } catch (err) {
    // 错误处理
  }
};
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

    <DealerModal
      v-model:visible="modalVisible"
      :type="modalType"
      :data="currentData"
      @submit="handleModalSubmit"
    />

    <NModal v-model:show="detailVisible" preset="card" style="width: 920px" title="经销商详情" :loading="detailLoading">
      <div v-if="detailDealer">
        <NDescriptions :columns="2" bordered size="small" label-placement="left">
          <NDescriptionsItem label="名称">{{ detailDealer.name || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="联系人">{{ detailDealer.contact_person || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="电话">{{ detailDealer.phone || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="邮箱">{{ detailDealer.email || '--' }}</NDescriptionsItem>
          <NDescriptionsItem label="地区">
            {{ [detailDealer.province, detailDealer.city, detailDealer.district].filter(Boolean).join(' ') || '--' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="地址">{{ detailDealer.address || '--' }}</NDescriptionsItem>
        </NDescriptions>

        <NDivider class="my-12px" />

        <NSpace>
          <NTag type="info">设备总数：{{ detailOverview?.device_count ?? 0 }}</NTag>
          <NTag type="success">激活设备：{{ detailOverview?.active_count ?? 0 }}</NTag>
          <NTag type="warning">终端用户：{{ detailOverview?.end_user_count ?? 0 }}</NTag>
          <NTag type="primary">维保总数：{{ detailOverview?.warranty_total ?? 0 }}</NTag>
        </NSpace>

        <NDivider class="my-12px" />

        <NSpace>
          <NButton type="primary" @click="goBatteryListByDealer">查看名下电池</NButton>
          <NButton @click="goEndUsersByDealer">查看终端用户</NButton>
        </NSpace>

        <div class="mt-12px text-12px text-gray-500">
          说明：维保列表目前暂不支持按经销商直接筛选（仅展示聚合数字）；后续如需可扩展维保列表增加 dealer_id 过滤。
        </div>
      </div>
      <div v-else class="text-12px text-gray-500">暂无数据</div>
    </NModal>

    <NModal v-model:show="authVisible" preset="dialog" title="经销商授权模板" positive-text="保存" negative-text="取消" :loading="authLoading" @positive-click="submitAuth">
      <NSpace vertical :size="12">
        <div class="text-13px text-gray-500">经销商：{{ authDealer?.name || authDealer?.id || '--' }}</div>
        <div class="text-13px text-gray-500">当前模板：{{ authCurrent === 'ADVANCED' ? '高级版' : authCurrent === 'BASIC' ? '基础版' : '未设置' }}</div>
        <NRadioGroup v-model:value="authTemplate">
          <NSpace>
            <NRadioButton value="BASIC">基础版（看板/电池列表/维保/终端用户）</NRadioButton>
            <NRadioButton value="ADVANCED">高级版（含转移记录）</NRadioButton>
          </NSpace>
        </NRadioGroup>
        <div class="text-12px text-gray-500">
          说明：该配置会将经销商名下用户绑定到模板角色（Casbin），从而控制其可见菜单与可访问页面。
        </div>
      </NSpace>
    </NModal>
  </div>
</template>
