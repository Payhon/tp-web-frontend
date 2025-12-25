<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NPopconfirm, NSpace, NTag, NTabs, NTabPane, useMessage } from 'naive-ui';
import { getOrgList, deleteOrg, createOrg, updateOrg, OrgTypeLabels, OrgTypes } from '@/service/api/bms';
import type { SearchConfig } from '@/components/data-table-page/index.vue';
import OrgModal from './modules/org-modal.vue';

const route = useRoute();
const message = useMessage();
const tablePageRef = ref();
const modalVisible = ref(false);
const modalType = ref<'add' | 'edit'>('add');
const currentData = ref(null);

// 从路由路径或查询参数获取固定的组织类型
const fixedOrgType = computed(() => {
  // 先检查查询参数
  const queryOrgType = route.query.org_type as string;
  if (queryOrgType && Object.keys(OrgTypes).includes(queryOrgType)) {
    return queryOrgType;
  }
  // 再检查路由meta
  const metaQuery = route.meta?.query as Record<string, string> | undefined;
  if (metaQuery?.org_type && Object.keys(OrgTypes).includes(metaQuery.org_type)) {
    return metaQuery.org_type;
  }
  // 最后检查路由路径
  const path = route.path;
  if (path.includes('/pack-factory')) return 'PACK_FACTORY';
  if (path.includes('/dealer')) return 'DEALER';
  if (path.includes('/store')) return 'STORE';
  return null;
});

// 是否隐藏 Tab（通过快捷入口进入时隐藏）
const hideTabs = computed(() => !!fixedOrgType.value);

// 当前选中的 Tab
const activeTab = ref<string>(fixedOrgType.value || 'PACK_FACTORY');

// 页面标题
const pageTitle = computed(() => {
  if (fixedOrgType.value) {
    return `${OrgTypeLabels[fixedOrgType.value]}管理`;
  }
  return '组织管理';
});

// Tab 选项（不包含 BMS_FACTORY，因为它是顶级厂家）
const tabOptions = [
  { key: 'PACK_FACTORY', label: 'PACK厂家' },
  { key: 'DEALER', label: '经销商' },
  { key: 'STORE', label: '门店' }
];

// 搜索配置
const searchConfigs = ref<SearchConfig[]>([
  {
    key: 'name',
    label: '组织名称',
    type: 'input',
    placeholder: '请输入组织名称'
  },
  {
    key: 'phone',
    label: '联系电话',
    type: 'input',
    placeholder: '请输入联系电话'
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { label: '正常', value: 'N' },
      { label: '禁用', value: 'F' }
    ]
  }
]);

// 表格列配置
const columns = ref([
  {
    key: 'name',
    title: '组织名称',
    minWidth: 150
  },
  {
    key: 'org_type',
    title: '类型',
    minWidth: 100,
    render: (row: any) => {
      return <NTag type="info">{OrgTypeLabels[row.org_type] || row.org_type}</NTag>;
    }
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
      return `${row.province || ''} ${row.city || ''} ${row.district || ''}`.trim() || '--';
    }
  },
  {
    key: 'status',
    title: '状态',
    minWidth: 80,
    render: (row: any) => {
      return row.status === 'F' ? (
        <NTag type="error">禁用</NTag>
      ) : (
        <NTag type="success">正常</NTag>
      );
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
    width: 150,
    fixed: 'right',
    render: (row: any) => {
      return (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => handleEdit(row)}>
            编辑
          </NButton>
          <NPopconfirm onPositiveClick={() => handleDelete(row)}>
            {{
              default: () => '确认删除该组织吗？删除后不可恢复。',
              trigger: () => (
                <NButton size="small" type="error">
                  删除
                </NButton>
              )
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

// 当前类型标签
const currentTypeLabel = computed(() => OrgTypeLabels[activeTab.value] || '组织');

// 顶部操作按钮
const topActions = computed(() => [
  {
    element: () => (
      <NButton type="primary" onClick={handleAdd}>
        + 新增{currentTypeLabel.value}
      </NButton>
    )
  }
]);

// 封装数据获取函数，自动附加 org_type 参数
const fetchData = (params: any) => {
  return getOrgList({
    ...params,
    org_type: fixedOrgType.value || activeTab.value
  });
};

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

// 处理删除
const handleDelete = async (row: any) => {
  try {
    const { error } = await deleteOrg(row.id);
    if (!error) {
      message.success('删除成功');
      tablePageRef.value?.reload();
    }
  } catch (err: any) {
    message.error(err?.message || '删除失败');
  }
};

// 模态框提交
const handleModalSubmit = async (formData: any) => {
  try {
    if (modalType.value === 'add') {
      const { error } = await createOrg({
        ...formData,
        org_type: fixedOrgType.value || activeTab.value
      });
      if (!error) {
        message.success('创建成功');
        modalVisible.value = false;
        tablePageRef.value?.reload();
      }
    } else {
      const { error } = await updateOrg(currentData.value.id, formData);
      if (!error) {
        message.success('更新成功');
        modalVisible.value = false;
        tablePageRef.value?.reload();
      }
    }
  } catch (err: any) {
    message.error(err?.message || '操作失败');
  }
};

// Tab 切换时刷新列表
watch(activeTab, () => {
  tablePageRef.value?.reload();
});

// 监听路由变化
watch(
  () => [route.query.org_type, route.path],
  () => {
    if (fixedOrgType.value) {
      activeTab.value = fixedOrgType.value;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 页面标题 -->
    <div v-if="hideTabs" class="mb-16px">
      <h2 class="text-18px font-medium m-0">{{ pageTitle }}</h2>
    </div>

    <!-- Tab 切换（非快捷入口时显示） -->
    <NTabs v-if="!hideTabs" v-model:value="activeTab" type="line" class="mb-16px">
      <NTabPane v-for="tab in tabOptions" :key="tab.key" :name="tab.key" :tab="tab.label" />
    </NTabs>

    <!-- 数据表格 -->
    <div class="flex-1 min-h-0">
      <DataTablePage
        ref="tablePageRef"
        :fetch-data="fetchData"
        :columns-to-show="columnsToShow"
        :search-configs="searchConfigs"
        :top-actions="topActions"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <OrgModal
      v-model:visible="modalVisible"
      :type="modalType"
      :data="currentData"
      :fixed-org-type="fixedOrgType || activeTab"
      @submit="handleModalSubmit"
    />
  </div>
</template>
