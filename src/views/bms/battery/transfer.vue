<script setup lang="tsx">
import { ref } from 'vue';
import { NTag } from 'naive-ui';
import { getTransferHistory } from '@/service/api/bms';
import type { SearchConfig } from '@/components/data-table-page/index.vue';

// 搜索配置
const searchConfigs = ref<SearchConfig[]>([
  {
    key: 'device_number',
    label: '设备编号',
    type: 'input',
    placeholder: '请输入设备编号'
  },
  {
    key: 'start_time',
    label: '开始时间',
    type: 'date-picker',
    placeholder: '请选择开始时间'
  },
  {
    key: 'end_time',
    label: '结束时间',
    type: 'date-picker',
    placeholder: '请选择结束时间'
  }
]);

// 表格列配置
const columns = ref([
  {
    key: 'device_number',
    title: '设备编号',
    minWidth: 150
  },
  {
    key: 'device_model',
    title: '设备型号',
    minWidth: 120
  },
  {
    key: 'from_dealer_name',
    title: '原经销商',
    minWidth: 150,
    render: (row: any) => {
      return row.from_dealer_name || <NTag type="info">厂家</NTag>;
    }
  },
  {
    key: 'to_dealer_name',
    title: '目标经销商',
    minWidth: 150,
    render: (row: any) => {
      return row.to_dealer_name || <NTag type="info">厂家</NTag>;
    }
  },
  {
    key: 'operator_name',
    title: '操作人',
    minWidth: 100
  },
  {
    key: 'transfer_time',
    title: '转移时间',
    minWidth: 160
  },
  {
    key: 'remark',
    title: '备注',
    minWidth: 200,
    ellipsis: {
      tooltip: true
    }
  }
]);

</script>

<template>
  <div class="h-full">
    <DataTablePage
      :api="getTransferHistory"
      :columns="columns"
      :search-configs="searchConfigs"
      row-key="id"
    />
  </div>
</template>
