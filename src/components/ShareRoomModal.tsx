import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  syncCode: string
  eventTitle: string
  onClose: () => void
}

export function ShareRoomModal({ syncCode, eventTitle, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  // Prevent background scrolling when modal is open
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
          <h2>📲 Multi-Device Sync: {eventTitle}</h2>
          <button type="button" className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
          Open this meeting event on other phones, tablets, or laptops to take attendance together in real-time.
        </p>

        <div className="sync-code-box">
          <span className="sync-code-label">ROOM SYNC CODE</span>
          <div className="sync-code-val">{syncCode}</div>
        </div>

        <div className="qr-box" style={{ margin: '1.25rem 0' }}>
          <img
            src={qrDataUri}
            alt="Scan to join event"
            style={{ width: '180px', height: '180px', borderRadius: '12px', border: '1px solid var(--line)' }}
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Scan with any phone camera to join live check-in
          </p>
        </div>

        <div className="share-link-row">
          <input type="text" readOnly value={shareUrl || ''} className="share-input" />
          <button type="button" className="btn btn-accent" onClick={copyLink}>
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
