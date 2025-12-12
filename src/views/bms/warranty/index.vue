<script setup lang="tsx">
import { ref, computed } from 'vue';
import { NButton, NCard, NDataTable, NForm, NFormItem, NInput, NSelect, NTag, NDatePicker, NModal, NSpace, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { useTable } from '@/hooks/common/table';
import { getWarrantyList, getWarrantyDetail, updateWarrantyStatus } from '@/service/api/bms';
import dayjs from 'dayjs';

interface WarrantyItem {
  id: string;
  device_id: string;
  device_number: string;
  device_name: string;
  user_id: string;
  user_name?: string | null;
  user_phone: string;
  type: string;
  description?: string | null;
  images?: string[];
  status: string;
  result_info?: Record<string, any>;
  handler_id?: string | null;
  handler_name?: string | null;
  created_at: string;
  updated_at: string;
}

interface WarrantyListResponse {
  list: WarrantyItem[];
  total: number;
  page: number;
  page_size: number;
}

const message = useMessage();

// 列配置（提前声明为函数，避免初始化顺序问题）
function createColumns(): DataTableColumns<WarrantyItem> {
  return [
    {
      key: 'device_number',
      title: '设备编号',
      minWidth: 150
    },
    {
      key: 'device_name',
      title: '设备名称',
      minWidth: 140
    },
    {
      key: 'type',
      title: '申请类型',
      minWidth: 100,
      render: row => <NTag>{typeLabel(row.type)}</NTag>
    },
    {
      key: 'user_name',
      title: '申请人',
      minWidth: 120,
      render: row => row.user_name || '--'
    },
    {
      key: 'user_phone',
      title: '联系电话',
      minWidth: 130
    },
    {
      key: 'status',
      title: '状态',
      minWidth: 110,
      render: row => <NTag type={statusTagType(row.status)}>{statusLabel(row.status)}</NTag>
    },
    {
      key: 'handler_name',
      title: '处理人',
      minWidth: 120,
      render: row => row.handler_name || '--'
    },
    {
      key: 'created_at',
      title: '创建时间',
      minWidth: 160
    },
    {
      key: 'operate',
      title: '操作',
      minWidth: 180,
      align: 'center',
      render: row => (
        <NSpace>
          <NButton size="small" type="primary" onClick={() => handleView(row.id)}>
            查看
          </NButton>
          <NButton size="small" type="success" onClick={() => handleProcess(row.id)}>
            处理
          </NButton>
        </NSpace>
      )
    }
  ];
}

// 列表与分页
const {
  data,
  loading,
  columns,
  filteredColumns,
  pagination,
  getData,
  updateSearchParams
} = useTable<WarrantyItem, typeof getWarrantyList>({
  apiFn: getWarrantyList,
  apiParams: {
    page: 1,
    page_size: 10
  },
  transformer: (res: any) => {
    const payload: WarrantyListResponse | undefined = res?.data;
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
const searchForm = ref<{
  device_number: string;
  type: string | null;
  status: string | null;
  create_time: [number, number] | null;
}>({
  device_number: '',
  type: null,
  status: null,
  create_time: null
});

const typeOptions = [
  { label: '维修', value: 'REPAIR' },
  { label: '退货', value: 'RETURN' },
  { label: '换货', value: 'EXCHANGE' }
];

const statusOptions = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已完成', value: 'COMPLETED' }
];

const handleSearch = () => {
  const [start, end] = searchForm.value.create_time || [];

  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    device_number: searchForm.value.device_number || undefined,
    type: searchForm.value.type || undefined,
    status: searchForm.value.status || undefined,
    start_time: start ? dayjs(start).format('YYYY-MM-DD HH:mm:ss') : undefined,
    end_time: end ? dayjs(end).format('YYYY-MM-DD HH:mm:ss') : undefined
  });

  getData();
};

const handleReset = () => {
  searchForm.value = {
    device_number: '',
    type: null,
    status: null,
    create_time: null
  };
  handleSearch();
};

// 状态样式
function statusTagType(status: string): 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'PROCESSING':
      return 'info';
    case 'COMPLETED':
      return 'success';
    default:
      return 'info';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return '待审核';
    case 'APPROVED':
      return '已通过';
    case 'REJECTED':
      return '已驳回';
    case 'PROCESSING':
      return '处理中';
    case 'COMPLETED':
      return '已完成';
    default:
      return status;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'REPAIR':
      return '维修';
    case 'RETURN':
      return '退货';
    case 'EXCHANGE':
      return '换货';
    default:
      return type;
  }
}

// 详情 & 处理弹窗
const detailVisible = ref(false);
const processVisible = ref(false);
const detailData = ref<WarrantyItem | null>(null);

const processForm = ref({
  id: '',
  status: '' as string,
  result: ''
});

const processing = ref(false);
const detailLoading = ref(false);

const handleView = async (id: string) => {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res: any = await getWarrantyDetail(id);
    detailData.value = res?.data as WarrantyItem;
  } catch (error) {
    // 错误提示已由 request 统一处理
  } finally {
    detailLoading.value = false;
  }
};

const handleProcess = async (id: string) => {
  processVisible.value = true;
  processForm.value.id = id;
  processForm.value.status = '';
  processForm.value.result = '';
};

const handleProcessSubmit = async () => {
  if (!processForm.value.status) {
    message.warning('请选择处理状态');
    return;
  }

  processing.value = true;
  try {
    await updateWarrantyStatus(processForm.value.id, {
      status: processForm.value.status,
      result_info: processForm.value.result ? { remark: processForm.value.result } : undefined
    });
    message.success('处理成功');
    processVisible.value = false;
    getData();
  } catch (error) {
    // 错误提示已由 request 统一处理
  } finally {
    processing.value = false;
  }
};

const detailResultText = computed(() => {
  if (!detailData.value?.result_info) return '';
  try {
    // 后端 result_info 是 map[string]interface{}，前端收到已是对象
    const info = detailData.value.result_info as Record<string, any>;
    if (info.remark) return String(info.remark);
    return JSON.stringify(info);
  } catch {
    return '';
  }
});
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden <sm:overflow-auto">
    <NCard title="维保中心" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <!-- 搜索区域 -->
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem label="设备编号" path="device_number">
          <NInput
            v-model:value="searchForm.device_number"
            placeholder="请输入设备编号"
            style="width: 220px"
            clearable
          />
        </NFormItem>
        <NFormItem label="申请类型" path="type">
          <NSelect
            v-model:value="searchForm.type"
            :options="typeOptions"
            placeholder="请选择申请类型"
            clearable
            style="width: 200px"
          />
        </NFormItem>
        <NFormItem label="状态" path="status">
          <NSelect
            v-model:value="searchForm.status"
            :options="statusOptions"
            placeholder="请选择状态"
            clearable
            style="width: 200px"
          />
        </NFormItem>
        <NFormItem label="创建时间" path="create_time">
          <NDatePicker
            v-model:value="searchForm.create_time"
            type="datetimerange"
            clearable
            style="width: 320px"
          />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
          </NSpace>
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

    <!-- 详情弹窗 -->
    <NModal v-model:show="detailVisible" preset="card" title="维保详情" style="width: 640px">
      <n-spin :show="detailLoading">
        <div v-if="detailData">
          <p><strong>设备编号：</strong>{{ detailData.device_number }}</p>
          <p><strong>设备名称：</strong>{{ detailData.device_name }}</p>
          <p><strong>申请类型：</strong>{{ typeLabel(detailData.type) }}</p>
          <p>
            <strong>申请人：</strong>{{ detailData.user_name || '--' }}（{{ detailData.user_phone }}）
          </p>
          <p>
            <strong>状态：</strong>
            <NTag :type="statusTagType(detailData.status)">{{ statusLabel(detailData.status) }}</NTag>
          </p>
          <p><strong>处理人：</strong>{{ detailData.handler_name || '--' }}</p>
          <p><strong>创建时间：</strong>{{ detailData.created_at }}</p>
          <p><strong>更新时间：</strong>{{ detailData.updated_at }}</p>
          <p class="mt-2">
            <strong>问题描述：</strong>
          </p>
          <p>{{ detailData.description || '--' }}</p>
          <p v-if="detailResultText" class="mt-2">
            <strong>处理结果：</strong>
          </p>
          <p v-if="detailResultText">{{ detailResultText }}</p>
        </div>
      </n-spin>
    </NModal>

    <!-- 处理弹窗 -->
    <NModal v-model:show="processVisible" preset="card" title="处理维保申请" style="width: 520px">
      <NForm :model="processForm">
        <NFormItem label="处理状态" path="status" required>
          <NSelect
            v-model:value="processForm.status"
            :options="statusOptions"
            placeholder="请选择处理状态"
            style="width: 260px"
          />
        </NFormItem>
        <NFormItem label="处理说明" path="result">
          <NInput
            v-model:value="processForm.result"
            type="textarea"
            placeholder="请输入处理结果说明"
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="processVisible = false">取消</NButton>
          <NButton type="primary" :loading="processing" @click="handleProcessSubmit">确定</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>
