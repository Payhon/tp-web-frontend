import type { BmsStatus } from '@/common/lib/bms-protocol'

function parseSnapshot(raw: unknown): BmsStatus | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as BmsStatus
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as BmsStatus) : null
  } catch {
    return null
  }
}

export function selectSharedBmsSnapshot(interactive: unknown, reported: unknown): BmsStatus | null {
  return parseSnapshot(interactive) || parseSnapshot(reported)
}
