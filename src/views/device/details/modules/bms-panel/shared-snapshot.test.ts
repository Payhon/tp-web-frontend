import assert from 'node:assert/strict'
import test from 'node:test'
import { selectSharedBmsSnapshot } from './shared-snapshot'

test('owner 共享快照优先于设备主动上报快照', () => {
  const shared = { energy: { socPct: 88 } }
  const reported = { energy: { socPct: 41 } }
  assert.deepEqual(selectSharedBmsSnapshot(JSON.stringify(shared), reported), shared)
})

test('共享快照无效时保留原云端快照', () => {
  const reported = { energy: { socPct: 41 } }
  assert.deepEqual(selectSharedBmsSnapshot('{invalid', JSON.stringify(reported)), reported)
})
