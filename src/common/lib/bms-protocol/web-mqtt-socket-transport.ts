import { BmsProtocolError, parseFrame } from './frame'
import type { LoggerLike } from './types'

type ReqExpect = {
  functionCode: number
  targetAddress: number
  sourceAddress: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function bytesToHexUpper(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 1) s += (bytes[i] & 0xff).toString(16).padStart(2, '0')
  return s.toUpperCase()
}

function hexToBytes(hex: string): Uint8Array {
  const clean = String(hex || '')
    .trim()
    .replace(/^0x/i, '')
    .replace(/[^0-9a-fA-F]/g, '')
  if (!clean || clean.length % 2 !== 0) throw new BmsProtocolError('Invalid hex payload')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) out[i / 2] = parseInt(clean.slice(i, i + 2), 16) & 0xff
  return out
}

class FrameCollector {
  private buf: Uint8Array
  private logger?: LoggerLike

  constructor({ logger }: { logger?: LoggerLike }) {
    this.logger = logger
    this.buf = new Uint8Array(0)
  }

  push(bytes: Uint8Array | ArrayLike<number>) {
    const chunk = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes)
    const merged = new Uint8Array(this.buf.length + chunk.length)
    merged.set(this.buf, 0)
    merged.set(chunk, this.buf.length)
    this.buf = merged
  }

  tryShiftOneValidFrame(): Uint8Array | null {
    const bytes = this.buf
    if (bytes.length < 6) return null

    let start = -1
    for (let i = 0; i < bytes.length - 1; i += 1) {
      if (bytes[i] === 0x7f && bytes[i + 1] === 0x55) {
        start = i
        break
      }
    }
    if (start < 0) {
      this.buf = bytes.slice(Math.max(0, bytes.length - 1))
      return null
    }
    if (start > 0) this.buf = bytes.slice(start)

    for (let j = 2; j < this.buf.length; j += 1) {
      if (this.buf[j] !== 0xfd) continue
      const candidate = this.buf.slice(0, j + 1)
      try {
        parseFrame(candidate)
        this.buf = this.buf.slice(j + 1)
        return candidate
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        this.logger?.debug?.('[bms-socket] drop invalid frame:', msg)
      }
    }
    return null
  }
}

function defer<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export type WebMqttSocketBmsTransportOptions = {
  wsUrl: string
  deviceId: string
  token: string
  minFrameIntervalMs?: number
  requestTimeoutMs?: number
  logger?: LoggerLike
}

// 基于后端 WebSocket 桥接的“MQTT透传”Transport（payload 为 JSON {hex}，由后端完成 MQTT publish/subscribe）
export class WebMqttSocketBmsTransport {
  wsUrl: string
  deviceId: string
  token: string
  minFrameIntervalMs: number
  requestTimeoutMs: number
  logger: LoggerLike

  private ws: WebSocket | null
  private connectedFlag: boolean
  private collector: FrameCollector
  private queue: Promise<any>
  private pending: null | {
    resolve: (frame: Uint8Array) => void
    reject: (err: unknown) => void
    expect: ReqExpect
    timer: ReturnType<typeof setTimeout>
  }

  private lastTxAt: number

  constructor(options: WebMqttSocketBmsTransportOptions) {
    this.wsUrl = options.wsUrl
    this.deviceId = options.deviceId
    this.token = options.token
    this.minFrameIntervalMs = options.minFrameIntervalMs ?? 80
    this.requestTimeoutMs = options.requestTimeoutMs ?? 2500
    this.logger = options.logger ?? console

    this.ws = null
    this.connectedFlag = false
    this.collector = new FrameCollector({ logger: this.logger })
    this.queue = Promise.resolve()
    this.pending = null
    this.lastTxAt = 0
  }

  get connected() {
    return this.connectedFlag
  }

  async connect(): Promise<void> {
    if (this.connectedFlag) return
    if (!this.wsUrl) throw new BmsProtocolError('wsUrl is required')
    if (!this.deviceId) throw new BmsProtocolError('deviceId is required')
    if (!this.token) throw new BmsProtocolError('token is required')

    const { promise, resolve, reject } = defer<void>()

    try {
      const ws = new WebSocket(this.wsUrl)
      this.ws = ws

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({ device_id: this.deviceId, token: this.token }))
          this.connectedFlag = true
          resolve()
        } catch (e) {
          reject(new BmsProtocolError('WebSocket auth send failed', e))
        }
      }

      ws.onclose = () => {
        this.connectedFlag = false
        if (this.pending) {
          const p = this.pending
          clearTimeout(p.timer)
          this.pending = null
          p.reject(new BmsProtocolError('WebSocket closed'))
        }
      }

      ws.onerror = () => {
        this.connectedFlag = false
        reject(new BmsProtocolError('WebSocket error'))
      }

      ws.onmessage = evt => {
        try {
          const txt = typeof evt.data === 'string' ? evt.data : String(evt.data || '')
          if (!txt || txt === 'pong') return
          let payloadHex = ''
          try {
            const obj = JSON.parse(txt)
            payloadHex = String(obj?.hex || '')
          } catch {
            // ignore
          }
          if (!payloadHex) return
          const bytes = hexToBytes(payloadHex)
          this.collector.push(bytes)
          for (;;) {
            const frame = this.collector.tryShiftOneValidFrame()
            if (!frame) break
            this.handleFrame(frame)
          }
        } catch (e) {
          this.logger?.debug?.('[bms-socket] onMessage parse failed:', e)
        }
      }
    } catch (e) {
      reject(new BmsProtocolError('WebSocket connect failed', e))
    }

    await promise
  }

  async disconnect(): Promise<void> {
    this.connectedFlag = false
    if (this.pending) {
      const p = this.pending
      clearTimeout(p.timer)
      this.pending = null
      p.reject(new BmsProtocolError('Disconnected'))
    }
    try {
      this.ws?.close()
    } catch {
      // ignore
    }
    this.ws = null
  }

  request(
    frameBytes: Uint8Array | ArrayLike<number>,
    { timeoutMs = this.requestTimeoutMs }: { timeoutMs?: number } = {}
  ): Promise<Uint8Array> {
    this.queue = this.queue.then(() => this.requestSerial(frameBytes, { timeoutMs }))
    return this.queue
  }

  private async requestSerial(
    frameBytes: Uint8Array | ArrayLike<number>,
    { timeoutMs }: { timeoutMs: number }
  ): Promise<Uint8Array> {
    const ws = this.ws
    if (!this.connectedFlag || !ws) throw new BmsProtocolError('WebSocket is not connected')
    if (this.pending) throw new BmsProtocolError('Previous request still pending')

    const req = frameBytes instanceof Uint8Array ? frameBytes : Uint8Array.from(frameBytes)
    if (req.length < 6) throw new BmsProtocolError('Invalid request frame bytes')

    const now = Date.now()
    const delta = now - this.lastTxAt
    if (delta < this.minFrameIntervalMs) await sleep(this.minFrameIntervalMs - delta)

    const expect: ReqExpect = {
      functionCode: req[4] & 0xff,
      targetAddress: req[2] & 0xff,
      sourceAddress: req[3] & 0xff
    }

    const deferred = defer<Uint8Array>()
    const timer = setTimeout(() => {
      if (this.pending && this.pending.reject === deferred.reject) this.pending = null
      deferred.reject(new BmsProtocolError(`Socket request timeout after ${timeoutMs}ms`, { expect }))
    }, timeoutMs)
    this.pending = { resolve: deferred.resolve, reject: deferred.reject, expect, timer }

    try {
      const hex = bytesToHexUpper(req)
      ws.send(hex)
      this.lastTxAt = Date.now()
      return await deferred.promise
    } catch (e) {
      const pending = this.pending
      if (pending) clearTimeout(pending.timer)
      this.pending = null
      throw e
    }
  }

  private handleFrame(frameBytes: Uint8Array) {
    if (!this.pending) return
    const { expect, resolve, timer } = this.pending
    if (!this.isExpectedResponse(frameBytes, expect)) return
    clearTimeout(timer)
    this.pending = null
    resolve(frameBytes)
  }

  private isExpectedResponse(frameBytes: Uint8Array, expect: ReqExpect): boolean {
    try {
      const parsed = parseFrame(frameBytes)
      if (parsed.type === 'error') {
        return (
          parsed.targetAddress === expect.targetAddress &&
          parsed.sourceAddress === expect.sourceAddress &&
          parsed.functionCode === (expect.functionCode | 0x80)
        )
      }
      return (
        parsed.targetAddress === expect.targetAddress &&
        parsed.sourceAddress === expect.sourceAddress &&
        parsed.functionCode === expect.functionCode
      )
    } catch {
      return false
    }
  }
}

export function createWebMqttSocketBmsTransport(options: WebMqttSocketBmsTransportOptions): WebMqttSocketBmsTransport {
  return new WebMqttSocketBmsTransport(options)
}
