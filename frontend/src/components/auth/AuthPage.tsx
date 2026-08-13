import { useState } from 'react'
import { login, register } from '../../services/auth'
import { Watermelon } from '../common/brand'

interface Props {
  /** 登录/注册成功后跳转地址（通常是原目标页） */
  redirectTo?: string
}

type Mode = 'login' | 'register'

function go(redirectTo?: string): void {
  window.location.hash = redirectTo && redirectTo.startsWith('/') ? `#${redirectTo}` : '#/editor'
  window.location.reload()
}

/** 登录 / 注册页（F1） */
export function AuthPage({ redirectTo }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, displayName)
      }
      go(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand"><Watermelon /><strong>XG<span>Design</span></strong></div>
        <h1 className="auth-title">{mode === 'login' ? '登录' : '注册'} XGDesign</h1>
        <p className="auth-sub">{mode === 'login' ? '继续你的设计，进入工作台' : '创建账号，开始协同设计'}</p>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label className="auth-field">
              <span>昵称</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="你的昵称" required maxLength={80} />
            </label>
          )}
          <label className="auth-field">
            <span>邮箱</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </label>
          <label className="auth-field">
            <span>密码</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? '至少 8 位' : '你的密码'} required minLength={mode === 'register' ? 8 : 1} maxLength={72} />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? '请稍候…' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <span>还没有账号？<button className="auth-link" onClick={() => switchMode('register')}>立即注册</button></span>
          ) : (
            <span>已有账号？<button className="auth-link" onClick={() => switchMode('login')}>返回登录</button></span>
          )}
        </div>
      </div>
    </div>
  )
}
