import { request } from '../request'

export type BmsCommDebugLogListParams = {
  page: number
  page_size: number
  device_id?: string
  device_number?: string
  event_type?: string
  status?: string
  start_time?: string
  end_time?: string
}

export type BmsCommDebugLogItem = {
  id: number
  occurred_at: string
  device_id: string
  device_number: string
  source: string
  access_mode: string
  event_type: string
  direction: string
  mqtt_topic?: string
  qos?: number
  message_id?: string
  payload_raw?: string
  payload_format?: string
  parsed_summary?: any
  status: string
  error_message?: string
}

export const getBmsCommDebugLogList = (params: BmsCommDebugLogListParams) => {
  return request.get<any>('/bms/comm-debug/logs', { params })
}
