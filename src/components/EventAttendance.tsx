import { useMemo, useState } from 'react'
import type { EventRecord } from '../types'
import { exportAttendanceCsv, exportAttendanceXlsx, type ExportFilter } from '../lib/spreadsheet'

interface Props {
  event: EventRecord
  onBack: () => void
  onUpdate: (event: EventRecord) => void
  onDelete: (eventId: string) => void
}

type Filter = 'all' | 'present' | 'absent'

export function EventAttendance({ event, onBack, onUpdate, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [exportScope, setExportScope] = useState<ExportFilter>('all')

  const isEnded = event.status === 'ended'

  const stats = useMemo(() => {
    const present = event.attendees.filter((a) => a.present).length
    const total = event.attendees.length
    const rate = total > 0 ? Math.round((present / total) * 100) : 0
    return {
      total,
      present,
      absent: total - present,
      rate,
    }
  }, [event.attendees])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return event.attendees.filter((a) => {
      if (filter === 'present' && !a.present) return false
      if (filter === 'absent' && a.present) return false
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.externalId.toLowerCase().includes(q)
      )
    })
  }, [event.attendees, query, filter])

  function toggle(attendeeId: string) {
    const attendees = event.attendees.map((a) => {
      if (a.id !== attendeeId) return a
      const present = !a.present
      return {
        ...a,
        present,
        checkedInAt: present ? new Date().toISOString() : undefined,
      }
    })
    onUpdate({ ...event, attendees })
  }

  function markAll(present: boolean) {
    const now = new Date().toISOString()
    onUpdate({
      ...event,
      attendees: event.attendees.map((a) => ({
        ...a,
        present,
        checkedInAt: present ? a.checkedInAt || now : undefined,
      })),
    })
  }

  function handleEndEvent() {
    if (
      window.confirm(
        `Are you sure you want to end “${event.title}”? Live attendance check-in will be finalized.`,
      )
    ) {
      onUpdate({
        ...event,
        status: 'ended',
        endedAt: new Date().toISOString(),
      })
    }
  }

  function handleReopenEvent() {
    if (window.confirm(`Reopen “${event.title}” for live check-ins?`)) {
      onUpdate({
        ...event,
        status: 'active',
        endedAt: undefined,
      })
    }
  }

  function confirmDelete() {
    if (window.confirm(`Delete “${event.title}”? This cannot be undone.`)) {
      onDelete(event.id)
    }
  }

  const dateLabel = event.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No date'

  const endedAtLabel = event.endedAt
    ? new Date(event.endedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  return (
    <div className="panel">
      <div className="top-nav-bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← All events
        </button>

        <div className="nav-actions">
          {isEnded ? (
            <button type="button" className="btn btn-ghost" onClick={handleReopenEvent}>
              ↻ Reopen event
            </button>
          ) : (
            <button type="button" className="btn btn-end-event" onClick={handleEndEvent}>
              ⏹ End Event
            </button>
          )}
          <button type="button" className="btn btn-danger" onClick={confirmDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="event-header" style={{ marginTop: '1rem' }}>
        <div>
          <div className="title-row">
            <h1>{event.title}</h1>
            {isEnded ? (
              <span className="badge badge-ended">Meeting Ended</span>
            ) : (
              <span className="badge badge-active">Live Event</span>
            )}
          </div>

          <div className="event-meta" style={{ marginTop: '0.5rem' }}>
            <span>{dateLabel}</span>
            {event.location && <span>{event.location}</span>}
            <span>{event.attendees.length} on roster</span>
            {isEnded && endedAtLabel && <span>Ended on {endedAtLabel}</span>}
          </div>
          {event.notes && <p className="muted" style={{ marginTop: '0.65rem' }}>{event.notes}</p>}
          <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
            Source: {event.sourceLabel}
          </p>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="num">{stats.total}</div>
            <div className="label">Total</div>
          </div>
          <div className="stat present">
            <div className="num">{stats.present}</div>
            <div className="label">Present ({stats.rate}%)</div>
          </div>
          <div className="stat absent">
            <div className="num">{stats.absent}</div>
            <div className="label">Absent</div>
          </div>
        </div>
      </div>

      {isEnded && (
        <div className="ended-summary-card">
          <div className="ended-info">
            <div className="ended-icon">📊</div>
            <div>
              <h3>Meeting Concluded - Attendance Report Ready</h3>
              <p className="muted">
                Final turnout: <strong>{stats.present} of {stats.total}</strong> attendees ({stats.rate}% attendance rate).
                {endedAtLabel ? ` Closed at ${endedAtLabel}.` : ''}
              </p>
            </div>
          </div>

          <div className="export-controls">
            <div className="export-scope-selector">
              <label htmlFor="export-scope" className="export-scope-label">Filter export:</label>
              <select
                id="export-scope"
                className="export-select"
                value={exportScope}
                onChange={(e) => setExportScope(e.target.value as ExportFilter)}
              >
                <option value="all">All Attendees ({stats.total})</option>
                <option value="present">Present Only ({stats.present})</option>
                <option value="absent">Absent Only ({stats.absent})</option>
              </select>
            </div>

            <div className="export-btn-group">
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => exportAttendanceCsv(event.attendees, event.title, exportScope)}
              >
                📥 Export CSV
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => exportAttendanceXlsx(event.attendees, event.title, exportScope)}
              >
                📊 Export Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, email, or ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search attendees"
        />
        <div className="filter-group">
          {(['all', 'present', 'absent'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {!isEnded && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => markAll(true)}>
              Mark all present
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => markAll(false)}>
              Clear
            </button>
          </>
        )}
        {!isEnded && (
          <div className="export-dropdown-inline">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => exportAttendanceCsv(event.attendees, event.title, 'all')}
              title="Download CSV attendance"
            >
              Export CSV
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No matches</h3>
          <p className="muted">Try another search or filter.</p>
        </div>
      ) : (
        <div className="attendee-list">
          {filtered.map((a) => (
            <div key={a.id} className={`attendee ${a.present ? 'present' : ''}`}>
              <button
                type="button"
                className="check"
                onClick={() => toggle(a.id)}
                aria-label={a.present ? `Mark ${a.name} absent` : `Mark ${a.name} present`}
                aria-pressed={a.present}
              >
                ✓
              </button>
              <div className="attendee-info">
                <h4>{a.name}</h4>
                <p>
                  {a.externalId}
                  {a.email ? ` · ${a.email}` : ''}
                  {a.present && a.checkedInAt
                    ? ` · ${new Date(a.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                className={`btn mark-btn ${a.present ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => toggle(a.id)}
              >
                {a.present ? 'Present' : 'Mark in'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

