import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import type { Attendee } from '../types'
import { parseSpreadsheetFile, parseSpreadsheetUrl } from '../lib/spreadsheet'

interface Props {
  onCancel: () => void
  onCreate: (payload: {
    title: string
    date: string
    location: string
    notes: string
    sourceLabel: string
    attendees: Attendee[]
  }) => void
}

type ImportMode = 'upload' | 'link'

export function CreateEvent({ onCancel, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<ImportMode>('upload')
  const [url, setUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [sourceLabel, setSourceLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const preview = useMemo(() => attendees.slice(0, 8), [attendees])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const list = await parseSpreadsheetFile(file)
      setAttendees(list)
      setFileName(file.name)
      setSourceLabel(file.name)
    } catch (err) {
      setAttendees([])
      setError(err instanceof Error ? err.message : 'Failed to read file.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFetchUrl() {
    if (!url.trim()) {
      setError('Paste a spreadsheet link first.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const list = await parseSpreadsheetUrl(url.trim())
      setAttendees(list)
      setFileName('')
      setSourceLabel(url.trim())
    } catch (err) {
      setAttendees([])
      setError(err instanceof Error ? err.message : 'Failed to fetch spreadsheet.')
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    void handleFile(e.dataTransfer.files?.[0])
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Event title is required.')
      return
    }
    if (attendees.length === 0) {
      setError('Import a roster before creating the event.')
      return
    }
    onCreate({
      title: title.trim(),
      date,
      location: location.trim(),
      notes: notes.trim(),
      sourceLabel: sourceLabel || 'Spreadsheet',
      attendees,
    })
  }

  return (
    <div className="panel">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        ← Back
      </button>
      <h1 style={{ marginTop: '1rem' }}>Create event</h1>
      <p className="muted">Import names, emails, and IDs from a spreadsheet, then take attendance.</p>

      <form className="form-grid" onSubmit={submit}>
        <div className="form-row two">
          <label>
            Event title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly stand-up"
              required
            />
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>

        <div className="form-row two">
          <label>
            Location (optional)
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Room 4B / Zoom"
            />
          </label>
          <label>
            Notes (optional)
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bring badges"
            />
          </label>
        </div>

        <div className="import-box">
          <div>
            <strong style={{ color: 'var(--jci-navy)' }}>Roster source</strong>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              Expect columns named Name, Email, and ID (flexible matching).
            </p>
          </div>

          <div className="tabs" role="tablist">
            <button
              type="button"
              className={`tab ${mode === 'upload' ? 'active' : ''}`}
              onClick={() => setMode('upload')}
            >
              Upload file
            </button>
            <button
              type="button"
              className={`tab ${mode === 'link' ? 'active' : ''}`}
              onClick={() => setMode('link')}
            >
              Spreadsheet link
            </button>
          </div>

          {mode === 'upload' ? (
            <>
              <input
                ref={fileRef}
                className="file-input"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <div
                className={`dropzone ${dragOver ? 'dragover' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
                }}
              >
                <strong>{fileName || 'Drop CSV / Excel here'}</strong>
                <span className="muted">or click to browse · .csv .xlsx .xls</span>
              </div>
            </>
          ) : (
            <div className="form-row" style={{ gap: '0.75rem' }}>
              <label>
                Spreadsheet URL
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
              </label>
              <button type="button" className="btn btn-ghost" onClick={() => void handleFetchUrl()} disabled={loading}>
                {loading ? 'Fetching…' : 'Load roster'}
              </button>
              <p className="muted" style={{ margin: 0 }}>
                Google Sheets: share as “Anyone with the link” (viewer). Direct .csv links also work.
              </p>
            </div>
          )}

          {loading && mode === 'upload' && <p className="muted">Reading spreadsheet…</p>}
          {error && <p className="error">{error}</p>}

          {attendees.length > 0 && (
            <div className="preview">
              <div className="preview-stats">
                <span className="pill pill-lime">{attendees.length} people loaded</span>
                <span className="pill">Ready for this event</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((a) => (
                      <tr key={a.id}>
                        <td>{a.externalId}</td>
                        <td>{a.name}</td>
                        <td>{a.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {attendees.length > preview.length && (
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Showing {preview.length} of {attendees.length}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-accent" disabled={loading}>
            Create event
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
