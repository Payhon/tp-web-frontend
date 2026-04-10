import { getDemoServerUrl } from '@/utils/common/tool'
import { localStg } from '@/utils/storage'

export type UploadStage = 'preparing' | 'uploading' | 'registering'

interface UploadWithStrategyOptions {
  file: File
  bizType: string
  onProgress?: (percentage: number) => void
  onStageChange?: (stage: UploadStage) => void
}

interface BackendEnvelope<T> {
  code: number
  message: string
  data: T
}

interface UploadErrorPayload {
  code?: number
  message?: string
  data?: Record<string, any>
}

class UploadFlowError extends Error {
  payload?: UploadErrorPayload

  constructor(message: string, payload?: UploadErrorPayload) {
    super(message)
    this.name = 'UploadFlowError'
    this.payload = payload
  }
}

function getApiUrl(path: string) {
  const baseUrl = getDemoServerUrl().replace(/\/$/, '')
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function createAuthHeaders(extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    ...extraHeaders
  }

  const token = String(localStg.get('token') || '').trim()
  if (token) headers['x-token'] = token

  const language = String(localStg.get('lang') || '').trim()
  if (language) headers['Accept-Language'] = language

  return headers
}

async function postJson<T>(path: string, body: Record<string, any>) {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: createAuthHeaders({
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(body)
  })

  const rawText = await response.text()
  let payload: BackendEnvelope<T> | null = null

  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    payload = null
  }

  if (response.ok && payload?.code === 200) {
    return payload
  }

  throw new UploadFlowError(payload?.message || `HTTP ${response.status}`, {
    code: payload?.code,
    message: payload?.message,
    data: payload?.data
  })
}

function sendLocalUpload(
  file: File,
  bizType: string,
  onProgress?: (percentage: number) => void
): Promise<BackendEnvelope<Api.File.UploadRsp>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', getApiUrl('/file/up'))

    const headers = createAuthHeaders()
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value))

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }

    xhr.onerror = () => reject(new UploadFlowError('文件上传失败，请检查网络连接'))
    xhr.onabort = () => reject(new UploadFlowError('文件上传已取消'))

    xhr.onload = () => {
      let payload: BackendEnvelope<Api.File.UploadRsp> | null = null
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        payload = null
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.code === 200) {
        resolve(payload)
        return
      }

      reject(
        new UploadFlowError(payload?.message || `HTTP ${xhr.status}`, {
          code: payload?.code,
          message: payload?.message,
          data: payload?.data
        })
      )
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', bizType)
    xhr.send(formData)
  })
}

function uploadToAliyun(
  file: File,
  upload: Record<string, any>,
  onProgress?: (percentage: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(String(upload.method || 'PUT').toUpperCase(), String(upload.url || ''))

    const headers = (upload.headers || {}) as Record<string, string>
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value))

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)))
    }

    xhr.onerror = () => reject(new UploadFlowError('阿里云直传失败，请检查存储配置或跨域设置'))
    xhr.onabort = () => reject(new UploadFlowError('阿里云直传已取消'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new UploadFlowError(`阿里云直传失败（HTTP ${xhr.status}）`))
    }

    xhr.send(file)
  })
}

function uploadToQiniu(
  file: File,
  upload: Record<string, any>,
  onProgress?: (percentage: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(String(upload.method || 'POST').toUpperCase(), String(upload.url || ''))

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)))
    }

    xhr.onerror = () => reject(new UploadFlowError('七牛云直传失败，请检查存储配置或跨域设置'))
    xhr.onabort = () => reject(new UploadFlowError('七牛云直传已取消'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new UploadFlowError(`七牛云直传失败（HTTP ${xhr.status}）`))
    }

    const formData = new FormData()
    const fields = (upload.fields || {}) as Record<string, string>
    Object.entries(fields).forEach(([key, value]) => formData.append(key, value))
    formData.append('file', file)
    xhr.send(formData)
  })
}

function shouldFallbackToLocalUpload(error: unknown) {
  if (!(error instanceof UploadFlowError)) return false
  return error.payload?.data?.storage_type === 'cloud storage not enabled'
}

export async function uploadFileWithStorageStrategy(options: UploadWithStrategyOptions) {
  const { file, bizType, onProgress, onStageChange } = options
  const mimeType = file.type || 'application/octet-stream'

  onStageChange?.('preparing')
  onProgress?.(0)

  try {
    const credentialEnvelope = await postJson<Api.File.CloudCredentialRsp>('/file/cloud/credential', {
      biz_type: bizType,
      file_name: file.name,
      mime_type: mimeType,
      file_size: file.size
    })

    const credential = credentialEnvelope.data
    onStageChange?.('uploading')

    if (credential.provider === 'aliyun') {
      await uploadToAliyun(file, credential.upload, onProgress)
    } else if (credential.provider === 'qiniu') {
      await uploadToQiniu(file, credential.upload, onProgress)
    } else {
      throw new UploadFlowError(`未知云存储提供商：${credential.provider}`)
    }

    onStageChange?.('registering')
    onProgress?.(96)

    const registerEnvelope = await postJson<Api.File.UploadRsp>('/file/cloud/register', {
      biz_type: bizType,
      file_name: file.name,
      file_size: file.size,
      mime_type: mimeType,
      object_key: credential.object_key
    })

    onProgress?.(100)
    return registerEnvelope.data
  } catch (error) {
    if (shouldFallbackToLocalUpload(error)) {
      onStageChange?.('uploading')
      const localEnvelope = await sendLocalUpload(file, bizType, onProgress)
      onProgress?.(100)
      return localEnvelope.data
    }

    if (error instanceof UploadFlowError) {
      throw error
    }

    throw new UploadFlowError(error instanceof Error ? error.message : '上传失败，请稍后重试')
  }
}
