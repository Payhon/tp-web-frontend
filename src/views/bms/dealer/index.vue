<script setup lang="tsx">
import { computed, ref } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag, useMessage } from 'naive-ui';
import { getDealerList, deleteDealer, createDealer, updateDealer } from '@/service/api/bms';
import type { SearchConfig } from '@/components/data-table-page/index.vue';
import { $t } from '@/locales';
import DealerModal from './modules/dealer-modal.vue';

const message = useMessage();
const tablePageRef = ref();
const modalVisible = ref(false);
const modalType = ref<'add' | 'edit'>('add');
const currentData = ref(null);

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
  </div>
</template>
