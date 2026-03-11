<script setup lang="ts">
import { computed, h, onUnmounted, reactive, ref } from 'vue'
import { NBadge, NButton, NDataTable, NEmpty, NPopover, NTag } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import type { BmsHistoryPendingJob } from '@/service/api/bms'
import { useBmsHistoryExportNotice } from '@/hooks/business/use-bms-history-export-notice'

defineOptions({
  name: 'ExportMessageCenter'
})

const showPopover = ref(false)
const downloadingMap = reactive<Record<string, boolean>>({})

const { state, hasUnread, pendingCount, init, clearUnread, refreshTasks, downloadTask, closeWs } =
  useBmsHistoryExportNotice()

init()
onUnmounted(() => {
  closeWs()
})

const columns = computed<DataTableColumns<BmsHistoryPendingJob>>(() => [
  {
    title: '设备',
    key: 'device_number',
    width: 120,
    ellipsis: { tooltip: true }
  },
  {
    title: '视图',
    key: 'view_mode',
    width: 80,
    render: row => h(NTag, { size: 'small', type: row.view_mode === 'wide' ? 'warning' : 'info' }, () => row.view_mode)
  },
  {
    title: '完成时间',
    key: 'finished_at',
    width: 160
  },
  {
    title: '下载',
    key: 'download',
    width: 90,
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          tertiary: true,
          loading: Boolean(downloadingMap[row.task_id]),
          onClick: () => handleDownload(row)
        },
        { default: () => '下载' }
      )
  }
])

async function handleDownload(row: BmsHistoryPendingJob) {
  const taskId = row.task_id
  if (!taskId || downloadingMap[taskId]) return
  try {
    downloadingMap[taskId] = true
    await downloadTask(row)
    window.$message?.success('下载成功')
  } catch (error: any) {
    window.$message?.error(error?.message || '下载失败')
  } finally {
    downloadingMap[taskId] = false
  }
}

function handleShow(show: boolean) {
  showPopover.value = show
  if (show) {
    clearUnread()
    void refreshTasks()
  }
}
</script>

<template>
  <NPopover trigger="click" placement="bottom-end" :show="showPopover" @update:show="handleShow">
    <template #trigger>
      <div class="notify-trigger" :class="{ 'is-blink': hasUnread }">
        <NBadge :show="pendingCount > 0" :value="pendingCount" :max="99">
          <ButtonIcon icon="mdi:bell-outline" tooltip-content="导出消息" />
        </NBadge>
      </div>
    </template>

    <div class="w-520px">
      <div class="mb-8px flex items-center justify-between">
        <span class="text-14px font-600">历史导出消息</span>
        <span class="text-12px text-#999">未下载：{{ pendingCount }}</span>
      </div>
      <NDataTable v-if="state.tasks.length > 0" size="small" :max-height="320" :columns="columns" :data="state.tasks" />
      <NEmpty v-else description="暂无已完成未下载任务" />
    </div>
  </NPopover>
</template>

<style scoped lang="scss">
.notify-trigger {
  display: inline-flex;
  border-radius: 9999px;
}

.is-blink {
  animation: notify-blink 1s linear infinite;
}

@keyframes notify-blink {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(24, 160, 88, 0);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(24, 160, 88, 0.15);
  }
}
</style>
