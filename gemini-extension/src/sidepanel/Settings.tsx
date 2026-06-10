import { useState } from 'react'
import { useStore } from './store'
import { DEFAULT_MODEL } from './summarize'

export function Settings({ onClose }: { onClose: () => void }) {
  const { apiKey, model, autoSummary, setSettings } = useStore()
  const [key, setKey] = useState(apiKey)
  const [mdl, setMdl] = useState(model || DEFAULT_MODEL)
  const [auto, setAuto] = useState(autoSummary)

  function save() {
    setSettings(key.trim(), mdl.trim() || DEFAULT_MODEL, auto)
    onClose()
  }

  return (
    <div className="settings">
      <div className="settings-head">
        <strong>AI 摘要設定</strong>
        <button className="ins-close" onClick={onClose} title="關閉">
          ✕
        </button>
      </div>
      <label className="ins-field">
        <span>金鑰</span>
        <input
          type="password"
          value={key}
          placeholder="Gemini API key"
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <label className="ins-field">
        <span>模型</span>
        <input value={mdl} placeholder={DEFAULT_MODEL} onChange={(e) => setMdl(e.target.value)} />
      </label>
      <label className="settings-toggle">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        送出後自動摘要新節點（關閉可省額度）
      </label>
      <div className="settings-foot">
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          取得免費金鑰 ↗
        </a>
        <button className="primary tiny" onClick={save}>
          儲存
        </button>
      </div>
      <p className="settings-note">金鑰只存在本機，僅用於呼叫 Google 的 Gemini API。</p>
    </div>
  )
}
