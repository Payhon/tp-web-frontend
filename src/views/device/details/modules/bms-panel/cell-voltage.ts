export type DisplayCellVoltageMv = number | null

const INVALID_U16 = 0xffff

function normalizeCellVoltageMv(raw: unknown): DisplayCellVoltageMv {
  if (raw == null || raw === '' || typeof raw === 'boolean') return null
  const value = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(value) && value > 0 && value < INVALID_U16 ? value : null
}

function normalizeCellVoltageArray(raw: readonly unknown[] | null | undefined): DisplayCellVoltageMv[] {
  return Array.isArray(raw) ? raw.map(normalizeCellVoltageMv) : []
}

/**
 * 选择 Web 电芯页可展示的电压数组。
 *
 * BMS 使用 0xFFFF 表示寄存器无有效数据。实时数组全部无效时，应回退到云端数组；
 * 部分无效时保留 null 占位，避免压缩数组后电芯序号错位。
 */
export function selectDisplayCellVoltagesMv(
  realtime: readonly unknown[] | null | undefined,
  cloud: readonly unknown[] | null | undefined
): DisplayCellVoltageMv[] {
  const realtimeValues = normalizeCellVoltageArray(realtime)
  if (realtimeValues.some(value => value != null)) return realtimeValues

  const cloudValues = normalizeCellVoltageArray(cloud)
  if (cloudValues.some(value => value != null)) return cloudValues

  return []
}
