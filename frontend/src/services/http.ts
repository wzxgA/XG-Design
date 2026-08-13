/**
 * 轻量 fetch 封装：处理后端统一响应包裹 { code, message, data }。
 * 非 2xx 或业务 code !== 0 时抛出 ApiError。
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: number | string

  constructor(status: number, code: number | string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

function authHeader(): Record<string, string> {
  try {
    const token = localStorage.getItem('xgdesign:auth-token:v1')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, 'network', '无法连接服务器，请确认后端服务已启动')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(response.status, 'parse', '服务器响应格式错误')
  }

  const { code, message, data } = (payload ?? {}) as { code?: number; message?: string; data?: T }
  if (response.ok && code === 0) return data as T
  // 401：会话失效，清空本地凭证（路由守卫会引导重新登录）
  if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/register') {
    try {
      localStorage.removeItem('xgdesign:auth-token:v1')
      localStorage.removeItem('xgdesign:auth-user:v1')
    } catch {
      /* ignore */
    }
  }
  throw new ApiError(response.status, code ?? response.status, message ?? `请求失败（${response.status}）`)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** 判断是否为 409 版本冲突错误 */
export function isConflictError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409
}
