
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
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

export function DatabaseSettingsModal({ onClose }: Props) {
  const currentConfig = getStoredSupabaseConfig()

  const [url, setUrl] = useState(currentConfig?.url || '')
  const [anonKey, setAnonKey] = useState(currentConfig?.anonKey || '')
  const [deviceNameInput, setDeviceNameInput] = useState(getDeviceName())

  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)

  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)

    try {
      const result = await testSupabaseConnection()
      setTestResult(result)
    } catch {
      setTestResult({
        ok: false,
        message: 'Unable to test the Supabase connection.',
      })
    } finally {
      setTesting(false)
    }
  }

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!deviceNameInput.trim()) {
      return
    }

    setDeviceName(deviceNameInput.trim())

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

    setSaved(false)
    setTestResult(null)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px' }}
      >
        <div className="modal-header">
          <h2>Supabase Cloud DB & Device Settings</h2>

          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="form-grid"
          style={{ marginTop: '1rem' }}
        >
          {/* DEVICE SETTINGS */}

          <label>
            Device Name
            <span
              className="muted"
              style={{
                display: 'block',
                fontSize: '0.78rem',
                marginTop: '0.2rem',
              }}
            >
              Identifies this station during multi-device attendance.
            </span>

            <input
              type="text"
              value={deviceNameInput}
              onChange={(e) => setDeviceNameInput(e.target.value)}
              placeholder="e.g. Gate A Check-in Station"
              required
            />
          </label>

          <div
            style={{
              margin: '1rem 0 0.5rem',
              borderTop: '1px solid var(--line-subtle)',
            }}
          />

          {/* DATABASE SETTINGS */}

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  color: 'var(--jci-navy)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                Supabase Cloud Database
              </h3>

              <span
                className="pill pill-lime"
                style={{ fontSize: '0.75rem' }}
              >
                Background Sync
              </span>
            </div>

            <p
              className="muted"
              style={{
                fontSize: '0.84rem',
                marginTop: '0.4rem',
                lineHeight: 1.6,
              }}
            >
              Attendance changes are saved locally first and synchronized
              with Supabase in the background. Other connected devices
              periodically retrieve cloud updates.
            </p>
          </div>

          <label>
            Supabase Project URL

            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setTestResult(null)
              }}
              placeholder="https://your-project.supabase.co"
            />
          </label>

          <label>
            Supabase Anon / Publishable API Key

            <input
              type="password"
              value={anonKey}
              onChange={(e) => {
                setAnonKey(e.target.value)
                setTestResult(null)
              }}
              placeholder="Your Supabase public API key"
              autoComplete="off"
            />
          </label>

          <p
            className="muted"
            style={{
              fontSize: '0.76rem',
              margin: '-0.5rem 0 0',
              lineHeight: 1.5,
            }}
          >
            Use your Supabase project's public anon or publishable key.
            Never enter your service-role key here.
          </p>

          {/* CONNECTION TEST RESULT */}

          {testResult && (
            <div
              role="status"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,

                background: testResult.ok
                  ? 'rgba(11, 107, 107, 0.1)'
                  : 'rgba(220, 38, 38, 0.1)',

                color: testResult.ok
                  ? '#0b6b6b'
                  : '#dc2626',

                border: `1px solid ${
                  testResult.ok
                    ? 'rgba(11, 107, 107, 0.3)'
                    : 'rgba(220, 38, 38, 0.3)'
                }`,
              }}
            >
              {testResult.ok ? '✓ ' : '✕ '}
              {testResult.message}
            </div>
          )}

          {/* SAVE MESSAGE */}

          {saved && (
            <p
              style={{
                margin: '0.25rem 0 0',
                color: 'var(--jci-navy)',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              ✓ Settings saved successfully.
            </p>
          )}

          {/* ACTION BUTTONS */}

          <div
            style={{
              display: 'flex',
              gap: '0.65rem',
              flexWrap: 'wrap',
              marginTop: '0.5rem',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              {testing ? 'Testing...' : '⚡ Test Connection'}
            </button>
          </div>

          <p
            className="muted"
            style={{
              fontSize: '0.76rem',
              margin: '-0.35rem 0 0',
            }}
          >
            Save your connection settings first. Test Connection checks
            the currently saved Supabase configuration.
          </p>

          {/* FOOTER */}

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginTop: '1.25rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="submit"
              className="btn btn-accent"
            >
              Save Settings
            </button>

            {currentConfig && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleClear}
              >
                Clear Custom Settings
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
