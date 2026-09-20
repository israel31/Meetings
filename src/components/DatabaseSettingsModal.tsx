import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getDeviceName,
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  setDeviceName,
} from '../lib/supabase'

interface Props {
  onClose: () => void
}

export function DatabaseSettingsModal({ onClose }: Props) {
  const currentConfig = getStoredSupabaseConfig()
  const [url, setUrl] = useState(currentConfig?.url || '')
  const [anonKey, setAnonKey] = useState(currentConfig?.anonKey || '')
  const [deviceNameInput, setDeviceNameInput] = useState(getDeviceName())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (deviceNameInput.trim()) {
      setDeviceName(deviceNameInput.trim())
    }

    if (url.trim() && anonKey.trim()) {
      saveSupabaseConfig({
        url: url.trim(),
        anonKey: anonKey.trim(),
      })
    } else {
      saveSupabaseConfig(null)
    }

    setSaved(true)
    setTimeout(() => {
      onClose()
    }, 800)
  }

  function handleClear() {
    saveSupabaseConfig(null)
    setUrl('')
    setAnonKey('')
    setSaved(true)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚡ Supabase & Device Settings</h2>
          <button type="button" className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="form-grid" style={{ marginTop: '1rem' }}>
          <label>
            Device Name (Identifies your device during check-ins)
            <input
              type="text"
              value={deviceNameInput || ''}
              onChange={(e) => setDeviceNameInput(e.target.value)}
              placeholder="e.g. Front Desk iPad"
              required
            />
          </label>

          <div className="divider" style={{ margin: '1rem 0', borderTop: '1px solid var(--line)' }} />

          <div>
            <h3>Shared Database Configuration (Supabase)</h3>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Enter your Supabase credentials for cloud database cross-device real-time sync across distant networks.
              Leave blank to use instant peer-to-peer / local multi-tab broadcast sync.
            </p>
          </div>

          <label>
            Supabase Project URL
            <input
              type="url"
              value={url || ''}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
            />
          </label>

          <label>
            Supabase Anon API Key
            <input
              type="password"
              value={anonKey || ''}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
            />
          </label>

          {saved && <p className="success-msg">✓ Settings saved successfully!</p>}

          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-accent">
              Save Settings
            </button>
            {currentConfig && (
              <button type="button" className="btn btn-ghost" onClick={handleClear}>
                Reset to Default
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
