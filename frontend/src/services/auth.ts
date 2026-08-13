/**
 * 认证服务：注册 / 登录 / 当前用户恢复。
 * token 持久化到 localStorage，登录后所有 /api 请求自动附带 Authorization 头。
 */
import { api } from './http'

export interface UserDto {
  id: string
  email: string
  displayName: string
}

export interface AuthResponse {
  token: string
  user: UserDto
}

const TOKEN_KEY = 'xgdesign:auth-token:v1'
const USER_KEY = 'xgdesign:auth-user:v1'

/** 读取持久化 token（未登录返回 null） */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** 写入 token 与用户信息 */
export function saveAuth(token: string, user: UserDto): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

/** 读取当前登录用户（可能为 null） */
export function getCurrentUser(): UserDto | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as UserDto) : null
  } catch {
    return null
  }
}

/** 是否已登录（有 token 即视为已登录，有效性由后端校验） */
export function isAuthenticated(): boolean {
  return !!getToken()
}

/** 登出：清除本地凭证 */
export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

/** 注册并自动登录 */
export async function register(email: string, password: string, displayName: string): Promise<UserDto> {
  const res = await api.post<AuthResponse>('/api/auth/register', { email, password, displayName })
  saveAuth(res.token, res.user)
  return res.user
}

/** 登录 */
export async function login(email: string, password: string): Promise<UserDto> {
  const res = await api.post<AuthResponse>('/api/auth/login', { email, password })
  saveAuth(res.token, res.user)
  return res.user
}

/** 恢复会话：用本地 token 向后端校验并刷新用户信息；失败则清空凭证 */
export async function fetchMe(): Promise<UserDto | null> {
  if (!isAuthenticated()) return null
  try {
    const user = await api.get<UserDto>('/api/auth/me')
    if (getCurrentUser()?.id !== user.id) {
      saveAuth(getToken() ?? '', user)
    }
    return user
  } catch {
    clearAuth()
    return null
  }
}
