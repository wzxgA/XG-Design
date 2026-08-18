import { useEffect, useState } from 'react'
import { aiSettingsService } from '../../services/aiSettings'
import type { AiSettings, AiSettingsInput } from '../../services/aiSettings'

interface Props {
  onClose: () => void
}

/** 常用模型快捷填充 */
const COMMON_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'deepseek-chat', 'deepseek-v4-flash',
  'qwen-plus', 'qwen-max', 'glm-4', 'kimi-k2',
]

/** AI 服务设置弹窗：Base URL / API Key / 模型 + 测试连接（配置按用户存后端，回退全局） */
export function AiSettingsModal({ onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [usingDefault, setUsingDefault] = useState(true)
  const [savedMsg, setSavedMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    aiSettingsService.get()
      .then((s: AiSettings) => {
        setBaseUrl(s.baseUrl ?? '')
        setModel(s.model ?? '')
        setHasKey(s.hasKey)
        setUsingDefault(s.usingDefault)
      })
      .catch(() => setSavedMsg({ ok: false, text: '加载配置失败' }))
      .finally(() => setLoading(false))
  }, [])

  const buildInput = (withKey = true): AiSettingsInput => ({
    baseUrl,
    model,
    ...(withKey && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
  })

  const handleTest = async () => {
    setTesting(true)
    setTestMsg(null)
    try {
      const r = await aiSettingsService.test(buildInput())
      setTestMsg({ ok: r.ok, text: r.message })
    } catch (e) {
      setTestMsg({ ok: false, text: e instanceof Error ? e.message : '测试失败' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSavedMsg(null)
    try {
      const s = await aiSettingsService.save(buildInput())
      setHasKey(s.hasKey)
      setUsingDefault(s.usingDefault)
      setApiKey('')
      setSavedMsg({ ok: true, text: '已保存，下次对话生效' })
    } catch (e) {
      setSavedMsg({ ok: false, text: e instanceof Error ? e.message : '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">AI 服务设置</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="projects-state"><span>加载中…</span></div>
          ) : (
            <div className="ai-settings-form">
              <div className="auth-field">
                <span>Base URL</span>
                <input
                  className="new-project-input"
                  value={baseUrl}
                  placeholder="https://api.deepseek.com"
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <span>API Key {hasKey && <em className="settings-has-key">（已保存，留空不修改）</em>}</span>
                <input
                  className="new-project-input"
                  type="password"
                  value={apiKey}
                  placeholder={hasKey ? '已配置，输入新 Key 覆盖' : 'sk-...'}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              {hasKey && (
                <button
                  className="settings-clear-key"
                  onClick={() => { setApiKey(''); aiSettingsService.save({ baseUrl, model, clearKey: true }).then((s) => { setHasKey(s.hasKey) }) }}
                >
                  清除已保存的 Key
                </button>
              )}
              <div className="auth-field">
                <span>模型</span>
                <div className="settings-model-row">
                  <input
                    className="new-project-input"
                    value={model}
                    placeholder="如 deepseek-v4-flash"
                    onChange={(e) => setModel(e.target.value)}
                  />
                  <select
                    className="proto-select settings-model-select"
                    value=""
                    onChange={(e) => { if (e.target.value) setModel(e.target.value) }}
                  >
                    <option value="" disabled>常用模型…</option>
                    {COMMON_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="settings-hint">
                {usingDefault ? '当前使用全局配置；保存后将按你的配置调用 AI。' : '已使用你的自定义配置。'}
                地址含路径时会自动拼接 /chat/completions（OpenAI 兼容协议）。
              </div>
              {testMsg && (
                <div className={`settings-test ${testMsg.ok ? 'ok' : 'fail'}`}>{testMsg.text}</div>
              )}
              {savedMsg && (
                <div className={`settings-test ${savedMsg.ok ? 'ok' : 'fail'}`}>{savedMsg.text}</div>
              )}
              <div className="settings-actions">
                <button className="btn" disabled={testing} onClick={handleTest}>
                  {testing ? '测试中…' : '测试连接'}
                </button>
                <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
