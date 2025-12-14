<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue';
import { NButton, NCard, NDataTable, NDatePicker, NForm, NFormItem, NInput, NModal, NSelect, NSpace, NTag, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import dayjs from 'dayjs';
import { useTable } from '@/hooks/common/table';
import { useRouterPush } from '@/hooks/common/router';
import { commandDataById } from '@/service/api/device';
import {
  getBatteryList,
  getBatteryModelList,
  getDealerList,
  exportBatteryList,
  getBatteryImportTemplate,
  importBatteryList,
  batchAssignDealer,
  assignBatteryTags,
  getBatteryTagList,
  createOfflineCommand,
  batchSendBatteryCommand
} from '@/service/api/bms';

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
const message = useMessage();

const dealerOptions = ref<Array<{ label: string; value: string }>>([]);
const modelOptions = ref<Array<{ label: string; value: string }>>([]);

// 批量选择
const selectedRowKeys = ref<string[]>([]);
const showBatchAssignModal = ref(false);
const batchAssignForm = ref({
  dealer_id: null as string | null
});
const importLoading = ref(false);
const batchAssignLoading = ref(false);

// 批量设置标签
const showBatchTagModal = ref(false);
const batchTagLoading = ref(false);
const tagOptions = ref<Array<{ label: string; value: string }>>([]);
const batchTagForm = ref({
  tag_ids: [] as string[],
  mode: 'REPLACE' as 'REPLACE' | 'APPEND'
});

// 单设备：离线指令
type CmdOption = { label: string; value: string; params?: string; description?: string };
const showOfflineCmdModal = ref(false);
const offlineCmdLoading = ref(false);
const offlineCmdOptions = ref<CmdOption[]>([]);
const offlineCmdForm = ref({
  device_id: '',
  identify: '' as string,
  command_type: '' as string,
  value: '' as string
});
const offlineCmdHint = ref<string>('');

// 批量下发指令（在线）
const showBatchCmdModal = ref(false);
const batchCmdLoading = ref(false);
const batchCmdOptions = ref<CmdOption[]>([]);
const batchCmdForm = ref({
  identify: '' as string,
  command_type: '' as string,
  value: '' as string
});
const batchCmdHint = ref<string>('');

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
  {
    type: 'selection',
    multiple: true
  },
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
    minWidth: 220,
    fixed: 'right',
    render: row => (
      <NSpace>
        <NButton size="small" type="primary" onClick={() => goDeviceDetail(row)}>
          查看详情
        </NButton>
        <NButton size="small" type="warning" onClick={() => openOfflineCmd(row)}>
          离线指令
        </NButton>
      </NSpace>
    )
  }
];

const { data, loading, columns, pagination, getData, updateSearchParams } = useTable<BatteryItem, typeof getBatteryList>({
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

// 导出
async function handleExport() {
  try {
    const [start, end] = searchForm.value.production_range || [];
    const params: any = {
      device_number: searchForm.value.device_number || undefined,
      battery_model_id: searchForm.value.battery_model_id || undefined,
      dealer_id: searchForm.value.dealer_id || undefined,
      is_online: searchForm.value.is_online ?? undefined,
      activation_status: searchForm.value.activation_status || undefined,
      warranty_status: searchForm.value.warranty_status || undefined,
      production_date_start: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
      production_date_end: end ? dayjs(end).format('YYYY-MM-DD') : undefined
    };

    const response = await exportBatteryList(params);
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `电池列表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
    message.success('导出成功');
  } catch (error: any) {
    message.error(error?.message || '导出失败');
  }
}

// 下载模板
async function handleDownloadTemplate() {
  try {
    const response = await getBatteryImportTemplate();
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '电池导入模板.xlsx';
    link.click();
    window.URL.revokeObjectURL(url);
    message.success('模板下载成功');
  } catch (error: any) {
    message.error(error?.message || '下载失败');
  }
}

// 导入
function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    importLoading.value = true;
    try {
      const res: any = await importBatteryList(file);
      const result = res?.data;
      if (result) {
        const msg = `导入完成：总计 ${result.total} 条，成功 ${result.success} 条，失败 ${result.failed} 条`;
        if (result.failed > 0 && result.failures?.length > 0) {
          const failures = result.failures.map((f: any) => `第${f.row}行：${f.device_number || '未知'} - ${f.message}`).join('\n');
          message.warning(msg + '\n失败明细：\n' + failures, { duration: 10000 });
        } else {
          message.success(msg);
        }
        getData();
      }
    } catch (error: any) {
      message.error(error?.message || '导入失败');
    } finally {
      importLoading.value = false;
    }
  };
  input.click();
}

// 批量分配经销商
function handleBatchAssign() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要分配的电池');
    return;
  }
  showBatchAssignModal.value = true;
}

async function handleBatchTag() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要设置标签的电池');
    return;
  }
  // lazy load tags
  if (tagOptions.value.length === 0) {
    try {
      const res: any = await getBatteryTagList({ page: 1, page_size: 1000 });
      const list = (res?.data?.list || []) as Array<{ id: string; name: string }>;
      tagOptions.value = list.map(i => ({ label: i.name, value: i.id }));
    } catch {
      tagOptions.value = [];
    }
  }
  showBatchTagModal.value = true;
}

async function handleBatchCommand() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要下发指令的电池');
    return;
  }
  showBatchCmdModal.value = true;
  batchCmdLoading.value = true;
  batchCmdForm.value = { identify: '', command_type: '', value: '' };
  batchCmdHint.value = '';
  try {
    const firstDeviceID = selectedRowKeys.value[0];
    const res: any = await commandDataById(firstDeviceID);
    const list = (res?.data || []) as Array<{ data_name: string; data_identifier: string; params: string; description: string }>;
    batchCmdOptions.value = list.map(i => ({
      label: i.data_name,
      value: i.data_identifier,
      params: i.params,
      description: i.description
    }));
  } catch {
    batchCmdOptions.value = [];
  } finally {
    batchCmdLoading.value = false;
  }
}

function handleBatchCmdSelect(v: string) {
  batchCmdForm.value.identify = v;
  const opt = batchCmdOptions.value.find(i => i.value === v);
  batchCmdForm.value.command_type = opt?.label || v;
  batchCmdHint.value = opt?.params || opt?.description || '';
}

async function confirmBatchCommand() {
  if (!batchCmdForm.value.identify) {
    message.warning('请选择指令');
    return;
  }
  batchCmdLoading.value = true;
  try {
    const res: any = await batchSendBatteryCommand({
      device_ids: selectedRowKeys.value,
      command_type: batchCmdForm.value.command_type || batchCmdForm.value.identify,
      identify: batchCmdForm.value.identify,
      value: batchCmdForm.value.value?.trim() ? batchCmdForm.value.value.trim() : undefined
    });
    const r = res?.data;
    if (r) {
      const msg = `下发完成：总计 ${r.total} 台，成功 ${r.success} 台，失败 ${r.failed} 台`;
      if (r.failed > 0 && r.failures?.length) {
        const failures = r.failures.map((f: any) => `${f.device_number || f.device_id}：${f.message}`).join('\n');
        message.warning(msg + '\n失败明细：\n' + failures, { duration: 10000 });
      } else {
        message.success(msg);
      }
    } else {
      message.success('批量下发成功');
    }
    showBatchCmdModal.value = false;
    selectedRowKeys.value = [];
  } catch (e: any) {
    message.error(e?.message || '批量下发失败');
  } finally {
    batchCmdLoading.value = false;
  }
}

async function confirmBatchAssign() {
  if (!batchAssignForm.value.dealer_id) {
    message.warning('请选择经销商');
    return;
  }

  batchAssignLoading.value = true;
  try {
    await batchAssignDealer({
      device_ids: selectedRowKeys.value,
      dealer_id: batchAssignForm.value.dealer_id
    });
    message.success('批量分配成功');
    showBatchAssignModal.value = false;
    selectedRowKeys.value = [];
    batchAssignForm.value.dealer_id = null;
    getData();
  } catch (error: any) {
    message.error(error?.message || '批量分配失败');
  } finally {
    batchAssignLoading.value = false;
  }
}

async function confirmBatchTag() {
  batchTagLoading.value = true;
  try {
    await assignBatteryTags({
      device_ids: selectedRowKeys.value,
      tag_ids: batchTagForm.value.tag_ids,
      mode: batchTagForm.value.mode
    });
    message.success('标签设置成功');
    showBatchTagModal.value = false;
    selectedRowKeys.value = [];
    batchTagForm.value.tag_ids = [];
    batchTagForm.value.mode = 'REPLACE';
    getData();
  } catch (error: any) {
    message.error(error?.message || '标签设置失败');
  } finally {
    batchTagLoading.value = false;
  }
}

async function openOfflineCmd(row: BatteryItem) {
  showOfflineCmdModal.value = true;
  offlineCmdLoading.value = true;
  offlineCmdForm.value = {
    device_id: row.device_id,
    identify: '',
    command_type: '',
    value: ''
  };
  offlineCmdHint.value = '';

  try {
    const res: any = await commandDataById(row.device_id);
    const list = (res?.data || []) as Array<{ data_name: string; data_identifier: string; params: string; description: string }>;
    offlineCmdOptions.value = list.map(i => ({
      label: i.data_name,
      value: i.data_identifier,
      params: i.params,
      description: i.description
    }));
  } catch {
    offlineCmdOptions.value = [];
  } finally {
    offlineCmdLoading.value = false;
  }
}

function handleOfflineCmdSelect(v: string) {
  offlineCmdForm.value.identify = v;
  const opt = offlineCmdOptions.value.find(i => i.value === v);
  offlineCmdForm.value.command_type = opt?.label || v;
  offlineCmdHint.value = opt?.params || opt?.description || '';
}

async function confirmOfflineCmd() {
  if (!offlineCmdForm.value.device_id) return;
  if (!offlineCmdForm.value.identify) {
    message.warning('请选择指令');
    return;
  }
  offlineCmdLoading.value = true;
  try {
    await createOfflineCommand({
      device_id: offlineCmdForm.value.device_id,
      command_type: offlineCmdForm.value.command_type || offlineCmdForm.value.identify,
      identify: offlineCmdForm.value.identify,
      value: offlineCmdForm.value.value?.trim() ? offlineCmdForm.value.value.trim() : undefined
    });
    message.success('离线指令已存储（设备上线后自动执行）');
    showOfflineCmdModal.value = false;
  } catch (e: any) {
    message.error(e?.message || '存储失败');
  } finally {
    offlineCmdLoading.value = false;
  }
}

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
  try {
    const dealerRes: any = await getDealerList({ page: 1, page_size: 1000 });
    const list = (dealerRes?.data?.list || []) as Array<{ id: string; name: string }>;
    dealerOptions.value = list.map(i => ({ label: i.name, value: i.id }));
  } catch {
    dealerOptions.value = [];
  }

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
      <NForm inline :model="searchForm" label-placement="left" label-width="auto" class="mb-4 flex flex-wrap gap-4 items-end">
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
          <NSelect v-model:value="searchForm.is_online" :options="onlineOptions" placeholder="请选择" clearable style="width: 160px" />
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

      <NSpace class="mb-4" justify="space-between">
        <NSpace>
          <NButton type="primary" @click="handleExport">导出</NButton>
          <NButton @click="handleDownloadTemplate">下载模板</NButton>
          <NButton @click="handleImport" :loading="importLoading">导入</NButton>
          <NButton v-if="selectedRowKeys.length > 0" type="warning" @click="handleBatchAssign">
            批量分配经销商({{ selectedRowKeys.length }})
          </NButton>
          <NButton v-if="selectedRowKeys.length > 0" type="info" @click="handleBatchTag">
            批量设置标签({{ selectedRowKeys.length }})
          </NButton>
          <NButton v-if="selectedRowKeys.length > 0" type="primary" @click="handleBatchCommand">
            批量下发指令({{ selectedRowKeys.length }})
          </NButton>
        </NSpace>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        :row-key="row => row.device_id"
        :scroll-x="scrollX"
        v-model:checked-row-keys="selectedRowKeys"
      />
    </NCard>

    <NModal
      v-model:show="showBatchAssignModal"
      preset="dialog"
      title="批量分配经销商"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmBatchAssign"
      :loading="batchAssignLoading"
    >
      <NForm :model="batchAssignForm" label-placement="left" label-width="100px">
        <NFormItem label="经销商" path="dealer_id" required>
          <NSelect
            v-model:value="batchAssignForm.dealer_id"
            :options="dealerOptions"
            placeholder="请选择经销商"
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">已选择 {{ selectedRowKeys.length }} 个电池，将分配给选中的经销商</div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showBatchTagModal"
      preset="dialog"
      title="批量设置标签"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmBatchTag"
      :loading="batchTagLoading"
    >
      <NForm :model="batchTagForm" label-placement="left" label-width="100px">
        <NFormItem label="设置方式" path="mode" required>
          <NSelect
            v-model:value="batchTagForm.mode"
            :options="[
              { label: '覆盖（替换原标签）', value: 'REPLACE' },
              { label: '追加（保留原标签）', value: 'APPEND' }
            ]"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="标签" path="tag_ids">
          <NSelect
            v-model:value="batchTagForm.tag_ids"
            :options="tagOptions"
            placeholder="请选择标签（可多选；留空表示清空标签）"
            multiple
            clearable
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">已选择 {{ selectedRowKeys.length }} 个电池</div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showOfflineCmdModal"
      preset="dialog"
      title="离线指令（设备离线时存储，上线后执行）"
      positive-text="确认存储"
      negative-text="取消"
      @positive-click="confirmOfflineCmd"
      :loading="offlineCmdLoading"
    >
      <NForm :model="offlineCmdForm" label-placement="left" label-width="100px">
        <NFormItem label="指令" path="identify" required>
          <NSelect
            v-model:value="offlineCmdForm.identify"
            :options="offlineCmdOptions"
            placeholder="请选择指令"
            clearable
            style="width: 100%"
            @update:value="handleOfflineCmdSelect"
          />
        </NFormItem>
        <NFormItem v-if="offlineCmdHint" label="参数说明">
          <div style="color: #999; font-size: 12px; white-space: pre-wrap">{{ offlineCmdHint }}</div>
        </NFormItem>
        <NFormItem label="参数(JSON)" path="value">
          <NInput
            v-model:value="offlineCmdForm.value"
            type="textarea"
            placeholder="可选：JSON 字符串，例如：{} 或 {\"mode\":1}"
            :autosize="{ minRows: 3, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            提示：离线指令仅用于设备离线时存储；上线后会自动执行并在“离线指令”页面查看结果。
          </div>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="showBatchCmdModal"
      preset="dialog"
      title="批量下发指令（仅在线设备）"
      positive-text="确认下发"
      negative-text="取消"
      @positive-click="confirmBatchCommand"
      :loading="batchCmdLoading"
    >
      <NForm :model="batchCmdForm" label-placement="left" label-width="100px">
        <NFormItem label="指令" path="identify" required>
          <NSelect
            v-model:value="batchCmdForm.identify"
            :options="batchCmdOptions"
            placeholder="请选择指令（基于第一个设备加载物模型命令）"
            clearable
            style="width: 100%"
            @update:value="handleBatchCmdSelect"
          />
        </NFormItem>
        <NFormItem v-if="batchCmdHint" label="参数说明">
          <div style="color: #999; font-size: 12px; white-space: pre-wrap">{{ batchCmdHint }}</div>
        </NFormItem>
        <NFormItem label="参数(JSON)" path="value">
          <NInput
            v-model:value="batchCmdForm.value"
            type="textarea"
            placeholder="可选：JSON 字符串，例如：{} 或 {\"mode\":1}"
            :autosize="{ minRows: 3, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem>
          <div style="color: #999; font-size: 12px">
            提示：离线设备会被跳过并返回失败原因；如需离线执行请使用“离线指令”。
          </div>
        </NFormItem>
      </NForm>
    </NModal>
  </div>
</template>

<style scoped>
.card-wrapper {
  height: 100%;
}
</style>

