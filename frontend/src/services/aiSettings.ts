import { api } from './http'

/** AI 配置回读（不含 api_key） */
export interface AiSettings {
  baseUrl: string | null
  model: string | null
  hasKey: boolean
  usingDefault: boolean
}

/** 保存/测试请求：apiKey 留空表示保留原值；clearKey=true 清除 */
export interface AiSettingsInput {
  baseUrl: string
  apiKey?: string
  model: string
  clearKey?: boolean
}

export interface AiTestResult {
  ok: boolean
  message: string
}

export const aiSettingsService = {
  get: () => api.get<AiSettings>('/api/ai/settings'),
  save: (input: AiSettingsInput) => api.put<AiSettings>('/api/ai/settings', input),
  test: (input: AiSettingsInput) => api.post<AiTestResult>('/api/ai/settings/test', input),
}
