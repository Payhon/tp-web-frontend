import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMqttSocketBmsTransport } from './web-mqtt-socket-transport'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  sent: string[] = []

  constructor() {
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.onclose?.({} as CloseEvent)
  }
}

test('Web transport 获取唯一 owner session 后才完成连接', async t => {
  const originalWebSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
  t.after(() => {
    globalThis.WebSocket = originalWebSocket
    FakeWebSocket.instances = []
  })

  const transport = new WebMqttSocketBmsTransport({
    wsUrl: 'wss://example.test/socket',
    deviceId: 'device-1',
    token: 'token-1',
    platform: 'web-admin'
  })
  const connected = transport.connect()
  const socket = FakeWebSocket.instances[0]
  socket.onopen?.({} as Event)

  assert.deepEqual(JSON.parse(socket.sent[0]), {
    device_id: 'device-1',
    token: 'token-1',
    features: ['mqtt_socket_owner_v1'],
    platform: 'web-admin'
  })
  socket.onmessage?.({
    data: JSON.stringify({ type: 'socket_ready', session_id: 'session-1' })
  } as MessageEvent)

  await connected
  assert.equal(transport.connected, true)
  assert.equal(transport.getSessionId(), 'session-1')
  await transport.disconnect()
})

test('Web transport 被其他终端占用时拒绝建立第二条透传连接', async t => {
  const originalWebSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
  t.after(() => {
    globalThis.WebSocket = originalWebSocket
    FakeWebSocket.instances = []
  })

  const transport = new WebMqttSocketBmsTransport({
    wsUrl: 'wss://example.test/socket',
    deviceId: 'device-1',
    token: 'token-1'
  })
  const connected = transport.connect()
  const socket = FakeWebSocket.instances[0]
  socket.onopen?.({} as Event)
  socket.onmessage?.({
    data: JSON.stringify({ type: 'socket_occupied', message: '设备已由其他终端建立实时连接' })
  } as MessageEvent)

  await assert.rejects(connected, /其他终端/)
  assert.equal(transport.connected, false)
  assert.equal(transport.getSessionId(), '')
})
