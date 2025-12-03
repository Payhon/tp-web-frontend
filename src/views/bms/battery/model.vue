<script setup lang="tsx">
import { ref } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag, useMessage } from 'naive-ui';
import { getBatteryModelList, deleteBatteryModel, createBatteryModel, updateBatteryModel } from '@/service/api/bms';
import type { SearchConfig } from '@/components/data-table-page/index.vue';
import BatteryModelModal from './modules/battery-model-modal.vue';

const message = useMessage();
const tablePageRef = ref();
const modalVisible = ref(false);
const modalType = ref<'add' | 'edit'>('add');
const currentData = ref(null);

// 搜索配置
const searchConfigs = ref<SearchConfig[]>([
  {
    key: 'name',
    label: '型号名称',
    type: 'input',
    placeholder: '请输入型号名称'
  }
]);

// 表格列配置
const columns = ref([
  {
    key: 'name',
    title: '型号名称',
    minWidth: 150
  },
  {
    key: 'voltage_rated',
    title: '额定电压(V)',
    minWidth: 120
  },
  {
    key: 'capacity_rated',
    title: '额定容量(Ah)',
    minWidth: 120
  },
  {
    key: 'cell_count',
    title: '电芯数量',
    minWidth: 100
  },
  {
    key: 'nominal_power',
    title: '标称功率(W)',
    minWidth: 120
  },
  {
    key: 'warranty_months',
    title: '质保期(月)',
    minWidth: 100
  },
  {
    key: 'device_count',
    title: '关联设备',
    minWidth: 100,
    render: (row: any) => {
      return <NTag type="info">{row.device_count || 0}</NTag>;
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
              default: () => '确认删除该电池型号吗？',
              trigger: () => <NButton size="small" type="error">删除</NButton>
            }}
          </NPopconfirm>
        </NSpace>
      );
    }
  }
]);

// 顶部操作按钮
const topActions = [
  {
    element: () => (
      <NButton type="primary" onClick={handleAdd}>
        + 新增电池型号
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
    const { error } = await deleteBatteryModel(row.id);
    if (!error) {
      message.success('删除成功');
      tablePageRef.value?.reload();
    }
  } catch (err) {
    // 错误处理
  }
};

// 模态框提交
const handleModalSubmit = async (formData: any) => {
  try {
    if (modalType.value === 'add') {
      const { error } = await createBatteryModel(formData);
      if (!error) {
        message.success('创建成功');
        modalVisible.value = false;
        tablePageRef.value?.reload();
      }
    } else {
      const { error } = await updateBatteryModel(currentData.value.id, formData);
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
      :api="getBatteryModelList"
      :columns="columns"
      :search-configs="searchConfigs"
      :top-actions="topActions"
      row-key="id"
    />

    <BatteryModelModal
      v-model:visible="modalVisible"
      :type="modalType"
      :data="currentData"
      @submit="handleModalSubmit"
    />
  </div>
</template>
