<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue';
import { NButton, NCard, NDataTable, NDatePicker, NForm, NFormItem, NInput, NSelect, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import dayjs from 'dayjs';
import { useTable } from '@/hooks/common/table';
import { useRouterPush } from '@/hooks/common/router';
import { getBatteryList, getBatteryModelList, getDealerList } from '@/service/api/bms';

interface BatteryItem {
  device_id: string;
  device_number: string;
  device_name?: string | null;
  battery_model_id?: string | null;
  battery_model_name?: string | null;
  production_date?: string | null;
  warranty_expire_date?: string | null;
  dealer_id?: string | null;
  dealer_name?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  user_phone?: string | null;
  activation_date?: string | null;
  activation_status?: string | null;
  is_online: number;
  soc?: number | null;
  soh?: number | null;
  current_version?: string | null;
  transfer_status?: string | null;
}

interface ListResp<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

const { routerPushByKey } = useRouterPush();

const dealerOptions = ref<Array<{ label: string; value: string }>>([]);
const modelOptions = ref<Array<{ label: string; value: string }>>([]);

const onlineOptions = [
  { label: '在线', value: 1 },
  { label: '离线', value: 0 }
];

const activationOptions = [
  { label: '已激活', value: 'ACTIVE' },
  { label: '未激活', value: 'INACTIVE' }
];

const warrantyOptions = [
  { label: '在保', value: 'IN' },
  { label: '过保', value: 'OVER' }
];

function onlineTagType(isOnline: number) {
  return isOnline === 1 ? 'success' : 'default';
}

function activationTagType(status?: string | null) {
  if (status === 'ACTIVE') return 'success';
  return 'warning';
}

function activationLabel(status?: string | null) {
  if (status === 'ACTIVE') return '已激活';
  if (status === 'INACTIVE') return '未激活';
  return '--';
}

const searchForm = ref<{
  device_number: string;
  battery_model_id: string | null;
  dealer_id: string | null;
  is_online: number | null;
  activation_status: string | null;
  production_range: [number, number] | null;
  warranty_status: string | null;
}>({
  device_number: '',
  battery_model_id: null,
  dealer_id: null,
  is_online: null,
  activation_status: null,
  production_range: null,
  warranty_status: null
});

const createColumns = (): DataTableColumns<BatteryItem> => [
  { key: 'device_number', title: '序列号', minWidth: 150 },
  { key: 'battery_model_name', title: '型号', minWidth: 140, render: row => row.battery_model_name || '--' },
  { key: 'production_date', title: '出厂日期', minWidth: 120, render: row => row.production_date || '--' },
  { key: 'dealer_name', title: '经销商', minWidth: 140, render: row => row.dealer_name || <NTag type="info">厂家</NTag> },
  { key: 'user_phone', title: '终端用户', minWidth: 140, render: row => row.user_phone || '--' },
  {
    key: 'activation_status',
    title: '激活状态',
    minWidth: 110,
    render: row => <NTag type={activationTagType(row.activation_status)}>{activationLabel(row.activation_status)}</NTag>
  },
  { key: 'activation_date', title: '激活时间', minWidth: 160, render: row => row.activation_date || '--' },
  { key: 'is_online', title: '在线状态', minWidth: 110, render: row => <NTag type={onlineTagType(row.is_online)}>{row.is_online === 1 ? '在线' : '离线'}</NTag> },
  { key: 'soc', title: 'SOC(%)', minWidth: 100, render: row => (row.soc ?? '--') },
  { key: 'soh', title: 'SOH(%)', minWidth: 100, render: row => (row.soh ?? '--') },
  { key: 'warranty_expire_date', title: '质保到期', minWidth: 120, render: row => row.warranty_expire_date || '--' },
  { key: 'current_version', title: '固件版本', minWidth: 120, render: row => row.current_version || '--' },
  {
    key: 'actions',
    title: '操作',
    minWidth: 120,
    fixed: 'right',
    render: row => (
      <NSpace>
        <NButton size="small" type="primary" onClick={() => goDeviceDetail(row)}>
          查看详情
        </NButton>
      </NSpace>
    )
  }
];

const {
  data,
  loading,
  columns,
  pagination,
  getData,
  updateSearchParams
} = useTable<BatteryItem, typeof getBatteryList>({
  apiFn: getBatteryList,
  apiParams: {
    page: 1,
    page_size: 10
  },
  transformer: (res: any) => {
    const payload: ListResp<BatteryItem> | undefined = res?.data;
    return {
      data: payload?.list ?? [],
      pageNum: payload?.page ?? 1,
      pageSize: payload?.page_size ?? 10,
      total: payload?.total ?? 0
    };
  },
  columns: (): any => createColumns()
});

function handleSearch() {
  const [start, end] = searchForm.value.production_range || [];

  updateSearchParams({
    page: 1,
    page_size: pagination.pageSize,
    device_number: searchForm.value.device_number || undefined,
    battery_model_id: searchForm.value.battery_model_id || undefined,
    dealer_id: searchForm.value.dealer_id || undefined,
    is_online: searchForm.value.is_online ?? undefined,
    activation_status: searchForm.value.activation_status || undefined,
    warranty_status: searchForm.value.warranty_status || undefined,
    production_date_start: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
    production_date_end: end ? dayjs(end).format('YYYY-MM-DD') : undefined
  });
  getData();
}

function handleReset() {
  searchForm.value = {
    device_number: '',
    battery_model_id: null,
    dealer_id: null,
    is_online: null,
    activation_status: null,
    production_range: null,
    warranty_status: null
  };
  handleSearch();
}

function goDeviceDetail(row: BatteryItem) {
  routerPushByKey('device_details', {
    query: {
      d_id: row.device_id
    }
  });
}

async function initSelectOptions() {
  // 经销商下拉（取前 1000 条，满足常规测试；后续可改为远程搜索）
  try {
    const dealerRes: any = await getDealerList({ page: 1, page_size: 1000 });
    const list = (dealerRes?.data?.list || []) as Array<{ id: string; name: string }>;
    dealerOptions.value = list.map(i => ({ label: i.name, value: i.id }));
  } catch {
    dealerOptions.value = [];
  }

  // 电池型号下拉（取前 1000 条）
  try {
    const modelRes: any = await getBatteryModelList({ page: 1, page_size: 1000 });
    const list = (modelRes?.data?.list || []) as Array<{ id: string; name: string }>;
    modelOptions.value = list.map(i => ({ label: i.name, value: i.id }));
  } catch {
    modelOptions.value = [];
  }
}

const scrollX = computed(() => 1400);

onMounted(() => {
  initSelectOptions();
});
</script>

<template>
  <div class="flex-vertical-stretch gap-16px overflow-hidden <sm:overflow-auto">
    <NCard title="电池列表" :bordered="false" size="small" class="sm:flex-1-hidden card-wrapper">
      <NForm
        inline
        :model="searchForm"
        label-placement="left"
        label-width="auto"
        class="mb-4 flex flex-wrap gap-4 items-end"
      >
        <NFormItem label="序列号" path="device_number">
          <NInput v-model:value="searchForm.device_number" placeholder="请输入序列号" style="width: 220px" clearable />
        </NFormItem>

        <NFormItem label="电池型号" path="battery_model_id">
          <NSelect
            v-model:value="searchForm.battery_model_id"
            :options="modelOptions"
            placeholder="请选择型号"
            clearable
            style="width: 220px"
          />
        </NFormItem>

        <NFormItem label="经销商" path="dealer_id">
          <NSelect
            v-model:value="searchForm.dealer_id"
            :options="dealerOptions"
            placeholder="请选择经销商"
            clearable
            style="width: 220px"
          />
        </NFormItem>

        <NFormItem label="在线状态" path="is_online">
          <NSelect
            v-model:value="searchForm.is_online"
            :options="onlineOptions"
            placeholder="请选择"
            clearable
            style="width: 160px"
          />
        </NFormItem>

        <NFormItem label="激活状态" path="activation_status">
          <NSelect
            v-model:value="searchForm.activation_status"
            :options="activationOptions"
            placeholder="请选择"
            clearable
            style="width: 160px"
          />
        </NFormItem>

        <NFormItem label="出厂日期" path="production_range">
          <NDatePicker v-model:value="searchForm.production_range" type="daterange" clearable style="width: 260px" />
        </NFormItem>

        <NFormItem label="质保状态" path="warranty_status">
          <NSelect
            v-model:value="searchForm.warranty_status"
            :options="warrantyOptions"
            placeholder="请选择"
            clearable
            style="width: 160px"
          />
        </NFormItem>

        <NFormItem>
          <NSpace>
            <NButton type="primary" @click="handleSearch">查询</NButton>
            <NButton @click="handleReset">重置</NButton>
          </NSpace>
        </NFormItem>
      </NForm>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.device_id"
        :scroll-x="scrollX"
      />
    </NCard>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>

