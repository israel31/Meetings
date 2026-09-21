import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  syncCode: string
  eventTitle: string
  onClose: () => void
}

export function ShareRoomModal({ syncCode, eventTitle, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const shareUrl = `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(
    syncCode,
  )}`

  function copyLink() {
    void navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const qrDataUri = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    shareUrl,
  )}`

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div className="modal-header">
          <h2>Room Sync</h2>
          <button type="button" className="btn-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="muted" style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.88rem' }}>
          Connect secondary phones, tablets, or laptops to <strong>{eventTitle}</strong> for simultaneous check-in.
        </p>

        <div className="sync-code-box">
          <span className="sync-code-label">ROOM SYNC CODE</span>
          <div className="sync-code-val">{syncCode}</div>
        </div>

        <div style={{ margin: '1rem 0' }}>
          <img
            src={qrDataUri}
            alt="Scan QR code"
            style={{ width: '160px', height: '160px', borderRadius: '12px', border: '1px solid var(--line-subtle)' }}
          />
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.4rem' }}>
            Scan with any phone camera to join check-in
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input type="text" readOnly value={shareUrl} style={{ fontSize: '0.84rem' }} />
          <button type="button" className="btn btn-accent" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <button type="button" className="btn btn-ghost" style={{ marginTop: '1rem', width: '100%' }} onClick={onClose}>
          Done
        </button>
      </div>
    </div>,
    document.body,
  )
}