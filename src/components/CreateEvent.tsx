import { useMemo, useState, type FormEvent } from 'react'
import type { Attendee, RosterListInput } from '../types'
import { parseSpreadsheetFile, parseSpreadsheetUrl } from '../lib/spreadsheet'

interface Props {
  onCancel: () => void
  onCreate: (payload: {
    title: string
    date: string
    location: string
    notes: string
    sourceLabel: string
    lists: RosterListInput[]
    attendees: Attendee[]
    syncCode: string
  }) => void
}

interface PendingListEntry {
  id: string
  name: string
  type: 'link' | 'upload'
  url: string
  file?: File
  loading: boolean
  error?: string
  attendees: Attendee[]
}

export function CreateEvent({ onCancel, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const [entries, setEntries] = useState<PendingListEntry[]>([
    {
      id: crypto.randomUUID(),
      name: 'Google Link 1',
      type: 'link',
      url: '',
      loading: false,
      attendees: [],
    },
  ])

  function addLinkEntry() {
    const num = entries.filter((e) => e.type === 'link').length + 1
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Google Link ${num}`,
        type: 'link',
        url: '',
        loading: false,
        attendees: [],
      },
    ])
  }

  function addFileEntry() {
    const num = entries.filter((e) => e.type === 'upload').length + 1
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Spreadsheet File ${num}`,
        type: 'upload',
        url: '',
        loading: false,
        attendees: [],
      },
    ])
  }

  function removeEntry(id: string) {
    if (entries.length <= 1) return
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function updateEntry(id: string, update: Partial<PendingListEntry>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...update } : e)),
    )
  }

  async function loadList(id: string) {
    const target = entries.find((e) => e.id === id)
    if (!target) return

    updateEntry(id, { loading: true, error: undefined })

    try {
      let list: Attendee[] = []
      if (target.type === 'link') {
        if (!target.url.trim()) {
          throw new Error('Please paste a Google Sheet link.')
        }
        list = await parseSpreadsheetUrl(target.url.trim(), id, target.name.trim() || 'Link Roster')
      } else {
        if (!target.file) {
          throw new Error('Please select a spreadsheet file (.csv or .xlsx).')
        }
        list = await parseSpreadsheetFile(target.file, id, target.name.trim() || 'File Roster')
      }

      updateEntry(id, { attendees: list, loading: false })
    } catch (err) {
      updateEntry(id, {
        attendees: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to parse list.',
      })
    }
  }

  const allAttendees = useMemo(() => {
    const combined: Attendee[] = []
    entries.forEach((e) => {
      combined.push(...e.attendees)
    })
    return combined
  }, [entries])

  const preview = useMemo(() => allAttendees.slice(0, 8), [allAttendees])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      alert('Event title is required.')
      return
    }

    if (allAttendees.length === 0) {
      alert('Please load at least one Google Sheet link or spreadsheet file with attendees.')
      return
    }

    const rosterLists: RosterListInput[] = entries
      .filter((e) => e.attendees.length > 0)
      .map((e) => ({
        id: e.id,
        name: e.name.trim() || 'Roster List',
        url: e.type === 'link' ? e.url : undefined,
        type: e.type,
        attendeesCount: e.attendees.length,
      }))

    const randNum = Math.floor(1000 + Math.random() * 9000)
    const syncCode = `MEET-${randNum}`

    const mainSourceLabel = `${rosterLists.length} list${rosterLists.length === 1 ? '' : 's'} (${allAttendees.length} total attendees)`

    onCreate({
      title: title.trim(),
      date,
      location: location.trim(),
      notes: notes.trim(),
      sourceLabel: mainSourceLabel,
      lists: rosterLists,
      attendees: allAttendees,
      syncCode,
    })
  }

  return (
    <div className="panel">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        ← Back
      </button>
      <h1 style={{ marginTop: '1rem' }}>Create Multi-Link Event</h1>
      <p className="muted">
        Add one or more Google Sheet links or spreadsheet files. Multiple devices can connect to handle specific lists!
      </p>

      <form className="form-grid" onSubmit={submit}>
        <div className="form-row two">
          <label>
            Event title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="General Meeting & Attendance"
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
            Location / Link (optional)
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Google Meet / Main Hall"
            />
          </label>
          <label>
            Notes (optional)
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Attendance taking guidelines"
            />
          </label>
        </div>

        <div className="import-box" style={{ marginTop: '1rem' }}>
          <div>
            <strong style={{ color: 'var(--jci-navy)', fontSize: '1.1rem' }}>
              Google Sheet Links & Rosters ({entries.length} List Sources)
            </strong>
            <p className="muted" style={{ margin: '0.25rem 0 1rem' }}>
              Columns expected: <code>EMAIL ADDRESS</code>, <code>FULL NAME ( SUNAME FIRST )</code>, <code>FAMILY NAME</code>, <code>STATUS</code>, <code>PHONE NUMBER</code>, <code>FINANCIAL MEMBER</code>
            </p>
          </div>

          <div className="entries-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {entries.map((entry, index) => (
              <div key={entry.id} className="entry-card" style={{ padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="pill pill-lime">List #{index + 1}</span>
                    <input
                      type="text"
                      value={entry.name || ''}
                      onChange={(e) => updateEntry(entry.id, { name: e.target.value })}
                      placeholder="List Title (e.g. Executive Members)"
                      style={{ fontWeight: 600, padding: '0.3rem 0.6rem', fontSize: '0.95rem' }}
                    />
                  </div>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)', padding: '0.2rem 0.6rem' }}
                      onClick={() => removeEntry(entry.id)}
                    >
                      Remove List
                    </button>
                  )}
                </div>

                <div className="tabs" role="tablist" style={{ marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    className={`tab ${entry.type === 'link' ? 'active' : ''}`}
                    onClick={() => updateEntry(entry.id, { type: 'link' })}
                  >
                    🔗 Google Link
                  </button>
                  <button
                    type="button"
                    className={`tab ${entry.type === 'upload' ? 'active' : ''}`}
                    onClick={() => updateEntry(entry.id, { type: 'upload' })}
                  >
                    📁 Upload File
                  </button>
                </div>

                {entry.type === 'link' ? (
                  <div className="form-row" style={{ gap: '0.5rem' }}>
                    <input
                      type="url"
                      value={entry.url || ''}
                      onChange={(e) => updateEntry(entry.id, { url: e.target.value })}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void loadList(entry.id)}
                      disabled={entry.loading}
                    >
                      {entry.loading ? 'Fetching…' : 'Load Link'}
                    </button>
                  </div>
                ) : (
                  <div className="form-row" style={{ gap: '0.5rem' }}>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          updateEntry(entry.id, { file })
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void loadList(entry.id)}
                      disabled={entry.loading || !entry.file}
                    >
                      {entry.loading ? 'Reading…' : 'Load File'}
                    </button>
                  </div>
                )}

                {entry.error && <p className="error" style={{ marginTop: '0.5rem' }}>{entry.error}</p>}

                {entry.attendees.length > 0 && (
                  <p className="success-msg" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                    ✓ Loaded {entry.attendees.length} attendees for "{entry.name}"
                  </p>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-ghost" onClick={addLinkEntry}>
              + Add Another Google Link
            </button>
            <button type="button" className="btn btn-ghost" onClick={addFileEntry}>
              + Add Another Spreadsheet File
            </button>
          </div>

          {allAttendees.length > 0 && (
            <div className="preview" style={{ marginTop: '1.5rem' }}>
              <div className="preview-stats">
                <span className="pill pill-lime">{allAttendees.length} Total Attendees Across All Lists</span>
                <span className="pill">Ready for Multi-Device Attendance</span>
              </div>
              <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>FULL NAME</th>
                      <th>EMAIL ADDRESS</th>
                      <th>STATUS</th>
                      <th>ROSTER LIST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((a) => (
                      <tr key={a.id}>
                        <td><strong>{a.fullName}</strong> {a.familyName ? `(${a.familyName})` : ''}</td>
                        <td>{a.email || '—'}</td>
                        <td>{a.status || 'Member'}</td>
                        <td><span className="pill">{a.listName}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allAttendees.length > preview.length && (
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Showing first {preview.length} of {allAttendees.length} attendees
                </p>
              )}
            </div>
          )}
        </div>

        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="submit" className="btn btn-accent" disabled={allAttendees.length === 0}>
            Create Multi-Device Event
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
