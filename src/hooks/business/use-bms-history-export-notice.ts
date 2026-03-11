import { computed, reactive } from 'vue'
import { getBmsHistoryPendingExportJobs, downloadBmsHistoryExport } from '@/service/api/bms'
import type { BmsHistoryExportWSMessage, BmsHistoryPendingJob } from '@/service/api/bms'
import { localStg } from '@/utils/storage'
import { getWebsocketServerUrl } from '@/utils/common/tool'

type NoticeState = {
  initialized: boolean
  connecting: boolean
  connected: boolean
  unread: number
  tasks: BmsHistoryPendingJob[]
}

const state = reactive<NoticeState>({
  initialized: false,
  connecting: false,
  connected: false,
  unread: 0,
  tasks: []
})

let ws: WebSocket | null = null
let reconnectTimer: number | null = null
let reconnectAttempts = 0
let manualClose = false
const reconnectDelays = [1500, 3000, 5000, 10000, 15000]

function unwrapApiPayload<T = any>(raw: any): T {
  const level1 = raw?.data ?? raw
  return (level1?.data ?? level1 ?? {}) as T
}

function buildWsUrl() {
  const token = localStg.get('token')
  if (!token) return ''
  return `${getWebsocketServerUrl()}/battery/history/export/ws?x-token=${encodeURIComponent(token)}`
}

async function refreshTasks() {
  if (!localStg.get('token')) {
    state.tasks = []
    return
  }
  try {
    const resp: any = await getBmsHistoryPendingExportJobs({ limit: 50 })
    const data = unwrapApiPayload<any>(resp)
    state.tasks = Array.isArray(data?.list) ? data.list : []
  } catch {
    state.tasks = []
  }
}

function clearReconnectTimer() {
  if (reconnectTimer != null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  clearReconnectTimer()
  const delay = reconnectDelays[Math.min(reconnectAttempts, reconnectDelays.length - 1)]
  reconnectAttempts += 1
  reconnectTimer = window.setTimeout(() => {
    connectWs()
  }, delay)
}

function handleWsMessage(message: BmsHistoryExportWSMessage) {
  if (!message || message.type !== 'bms_history_export_complete') return
  state.unread += 1
  window.$message?.success('历史数据导出任务已完成')
  void refreshTasks()
}

function connectWs() {
  const wsUrl = buildWsUrl()
  if (!wsUrl || state.connecting) return

  state.connecting = true
  if (ws) {
    ws.close()
    ws = null
  }

  try {
    manualClose = false
    ws = new WebSocket(wsUrl)
  } catch {
    state.connecting = false
    state.connected = false
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    state.connecting = false
    state.connected = true
    reconnectAttempts = 0
    clearReconnectTimer()
  }

  ws.onmessage = event => {
    if (!event?.data) return
    try {
      const payload = JSON.parse(String(event.data)) as BmsHistoryExportWSMessage
      handleWsMessage(payload)
    } catch {
      // ignore malformed payload
    }
  }

  ws.onerror = () => {
    state.connected = false
  }

  ws.onclose = () => {
    state.connecting = false
    state.connected = false
    if (manualClose) return
    scheduleReconnect()
  }
}

function init() {
  if (!state.initialized) {
    state.initialized = true
    void refreshTasks()
  }
  connectWs()
}

function clearUnread() {
  state.unread = 0
}

async function downloadTask(task: BmsHistoryPendingJob) {
  const taskId = task?.task_id
  if (!taskId) return

  const response: any = await downloadBmsHistoryExport(taskId)
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = task.file_name || `bms_history_${taskId}.xlsx`
  link.click()
  window.URL.revokeObjectURL(url)

  state.tasks = state.tasks.filter(item => item.task_id !== taskId)
}

function closeWs() {
  clearReconnectTimer()
  if (ws) {
    manualClose = true
    ws.close()
    ws = null
  }
  state.connecting = false
  state.connected = false
  state.initialized = false
}

export function useBmsHistoryExportNotice() {
  const hasUnread = computed(() => state.unread > 0)
  const pendingCount = computed(() => state.tasks.length)

  return {
    state,
    hasUnread,
    pendingCount,
    init,
    refreshTasks,
    clearUnread,
    downloadTask,
    closeWs
  }
}
