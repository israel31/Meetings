import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getDeviceName,
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  setDeviceName,
  testSupabaseConnection,
} from '../lib/supabase'

interface Props {
  onClose: () => void
}

const SUPABASE_SQL_SCHEMA = `-- Supabase Table Setup for Meetings Attendance App

CREATE TABLE IF NOT EXISTS public.meetings_events (
  sync_code TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  event_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) & Public Policies
ALTER TABLE public.meetings_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on meetings_events" ON public.meetings_events FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings_events;`

export function DatabaseSettingsModal({ onClose }: Props) {
  const currentConfig = getStoredSupabaseConfig()
  const [url, setUrl] = useState(currentConfig?.url || '')
  const [anonKey, setAnonKey] = useState(currentConfig?.anonKey || '')
  const [deviceNameInput, setDeviceNameInput] = useState(getDeviceName())
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showSql, setShowSql] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const res = await testSupabaseConnection()
    setTestResult(res)
    setTesting(false)
  }

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
    setTestResult(null)
  }

  function copySql() {
    void navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2>Supabase Cloud DB & Device Settings</h2>
          <button type="button" className="btn-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="form-grid" style={{ marginTop: '1rem' }}>
          <label>
            Device Name (Identifies your station during multi-device check-ins)
            <input
              type="text"
              value={deviceNameInput || ''}
              onChange={(e) => setDeviceNameInput(e.target.value)}
              placeholder="e.g. Gate A Check-in Station"
              required
            />
          </label>

          <div style={{ margin: '1rem 0 0.5rem', borderTop: '1px solid var(--line-subtle)' }} />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--jci-navy)', fontFamily: 'var(--font-heading)' }}>
                Supabase Cloud Database Storage
              </h3>
              <span className="pill pill-lime" style={{ fontSize: '0.75rem' }}>Cloud Synced</span>
            </div>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
              Events, roster lists, and live check-in timestamps are automatically saved to Supabase Cloud DB.
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

          {testResult && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                background: testResult.ok ? 'rgba(11, 107, 107, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                color: testResult.ok ? '#0b6b6b' : '#dc2626',
                border: `1px solid ${testResult.ok ? 'rgba(11, 107, 107, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
              }}
            >
              {testResult.ok ? '✓ ' : '✕ '} {testResult.message}
            </div>
          )}

          {saved && (
            <p style={{ margin: '0.25rem 0 0', color: 'var(--jci-navy)', fontWeight: 600, fontSize: '0.85rem' }}>
              ✓ Settings saved successfully.
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => void handleTest()} disabled={testing}>
              {testing ? 'Testing...' : '⚡ Test Connection'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowSql(!showSql)}>
              {showSql ? 'Hide SQL Script' : '📜 SQL Setup Script'}
            </button>
          </div>

          {showSql && (
            <div style={{ marginTop: '0.75rem', background: '#1e293b', color: '#f8fafc', padding: '0.85rem', borderRadius: '8px', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: '#93c5fd' }}>Supabase SQL Setup Code</span>
                <button type="button" className="btn btn-ghost" onClick={copySql} style={{ padding: '0.2rem 0.5rem', color: '#67e8f9', fontSize: '0.75rem' }}>
                  {copiedSql ? '✓ Copied' : 'Copy SQL'}
                </button>
              </div>
              <pre style={{ margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
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