<script setup lang="tsx">
import { ref } from 'vue';
import {
  NButton,
  NPopconfirm,
  NSpace,
  NTag,
  useMessage,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NDataTable
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { useTable } from '@/hooks/common/table';
import { getBatteryModelList, deleteBatteryModel, createBatteryModel, updateBatteryModel } from '@/service/api/bms';
import BatteryModelModal from './modules/battery-model-modal.vue';

interface BatteryModelItem {
  id: string;
  name: string;
  voltage_rated?: number | null;
  capacity_rated?: number | null;
  cell_count?: number | null;
  nominal_power?: number | null;
  warranty_months?: number | null;
  description?: string | null;
  device_count?: number | null;
  created_at: string;
}

interface BatteryModelListResponse {
  list: BatteryModelItem[];
  total: number;
  page: number;
  page_size: number;
}

const message = useMessage();
const modalVisible = ref(false);
const modalType = ref<'add' | 'edit'>('add');
const currentData = ref<BatteryModelItem | null>(null);

// 列定义
const createColumns = (): DataTableColumns<BatteryModelItem> => [
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
    render: row => <NTag type="info">{row.device_count || 0}</NTag>
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
    render: row => (
      <NSpace>
        <NButton size="small" type="primary" onClick={() => handleEdit(row)}>
          编辑
        </NButton>
        <NPopconfirm onPositiveClick={() => handleDelete(row.id)}>
          {{
            default: () => '确认删除该电池型号吗？',
            trigger: () => (
              <NButton size="small" type="error">
                删除
              </NButton>
            )
          }}
        </NPopconfirm>
      </NSpace>
    )
  }
];

// 表格与分页
const {
  data,
  loading,
  columns,
  filteredColumns,
  pagination,
  getData,
  updateSearchParams
} = useTable<BatteryModelItem, typeof getBatteryModelList>({
  apiFn: getBatteryModelList,
  apiParams: {
    page: 1,
    page_size: 10,
    name: ''
  },
  transformer: (res: any) => {
    const payload: BatteryModelListResponse | undefined = res?.data;
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    };
  },
  columns: (): any => createColumns()
});

// 搜索表单
const searchForm = ref({
  name: ''
});

const handleSearch = () => {
  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    name: searchForm.value.name || undefined
  });
  getData();
};

const handleReset = () => {
  searchForm.value.name = '';
  handleSearch();
};

// 新增
const handleAdd = () => {
  modalType.value = 'add';
  currentData.value = null;
  modalVisible.value = true;
};

// 编辑
const handleEdit = (row: BatteryModelItem) => {
  modalType.value = 'edit';
  currentData.value = { ...row };
  modalVisible.value = true;
};

// 删除
const handleDelete = async (id: string) => {
  try {
    const { error } = await deleteBatteryModel(id);
    if (!error) {
      message.success('删除成功');
      getData();
    }
  } catch {
    // 错误提示已由 request 统一处理
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
        getData();
      }
    } else if (currentData.value) {
      const { error } = await updateBatteryModel(currentData.value.id, formData);
      if (!error) {
        message.success('更新成功');
        modalVisible.value = false;
        getData();
      }
    }
  } catch {
    // 错误提示已由 request 统一处理
  }
};
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden <sm:overflow-auto">
    <NCard title="电池型号管理" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <!-- 搜索区域 -->
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem label="型号名称" path="name">
          <NInput
            v-model:value="searchForm.name"
            placeholder="请输入型号名称"
            style="width: 220px"
            clearable
          />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
          </NSpace>
        </NFormItem>
        <NFormItem>
          <NButton type="primary" @click="handleAdd">+ 新增电池型号</NButton>
        </NFormItem>
      </NForm>

      <!-- 表格 -->
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.id"
        :scroll-x="960"
      />
    </NCard>

    <BatteryModelModal
      v-model:visible="modalVisible"
      :type="modalType"
      :data="currentData"
      @submit="handleModalSubmit"
    />
  </div>
</template>
