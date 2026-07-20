import assert from 'node:assert/strict'
import test from 'node:test'
import { selectDisplayCellVoltagesMv } from './cell-voltage'

test('全 0xFFFF 实时数组回退到有效云端数组', () => {
  assert.deepEqual(selectDisplayCellVoltagesMv([65535, 65535], [3298, 3301]), [3298, 3301])
})

test('实时与云端数组均无有效电压时返回空数组', () => {
  assert.deepEqual(selectDisplayCellVoltagesMv([65535, 65535], [0, null, 65535]), [])
})

test('部分无效电压保留原数组位置', () => {
  assert.deepEqual(selectDisplayCellVoltagesMv([3300, 65535, 0, null, 3295], [3200]), [3300, null, null, null, 3295])
})

test('空实时数组使用云端数组并归一化数值字符串', () => {
  assert.deepEqual(selectDisplayCellVoltagesMv([], ['3302', '']), [3302, null])
})
