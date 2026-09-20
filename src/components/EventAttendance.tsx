import { useEffect, useMemo, useState } from 'react'
import type { EventRecord } from '../types'
import { exportAttendanceCsv, exportAttendanceXlsx, type ExportFilter } from '../lib/spreadsheet'
import { getDeviceName, syncManager } from '../lib/supabase'
import { ShareRoomModal } from './ShareRoomModal'
import { DatabaseSettingsModal } from './DatabaseSettingsModal'

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
  const [selectedListId, setSelectedListId] = useState<string>('all')
  const [showShareModal, setShowShareModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [syncStatus] = useState<string>('⚡ Live Supabase / Device Sync Active')

  const isEnded = event.status === 'ended'
  const deviceName = getDeviceName()

  // Subscribe to real-time broadcasts from other devices
  useEffect(() => {
    if (!event.syncCode) return

    const unsubscribe = syncManager.subscribeToSync(event.syncCode, (msg) => {
      if (msg.type === 'CHECKIN_UPDATE') {
        onUpdate({
          ...event,
          attendees: event.attendees.map((a) => {
            if (a.id !== msg.attendeeId) return a
            return {
              ...a,
              present: msg.present,
              checkedInAt: msg.checkedInAt,
              checkedInBy: msg.checkedInBy,
            }
          }),
        })
      } else if (msg.type === 'FULL_EVENT_SYNC') {
        onUpdate(msg.event)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [event.syncCode, event.attendees])

  const lists = event.lists || []

  // Calculate statistics across all devices and all lists
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

  // Filter attendees by list assignment, search query, and attendance filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return event.attendees.filter((a) => {
      if (selectedListId !== 'all' && a.listId !== selectedListId) return false
      if (filter === 'present' && !a.present) return false
      if (filter === 'absent' && a.present) return false
      if (!q) return true
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.familyName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q) ||
        a.externalId.toLowerCase().includes(q)
      )
    })
  }, [event.attendees, selectedListId, query, filter])

  function toggle(attendeeId: string) {
    const now = new Date().toISOString()
    let updatedPresent = false
    let updatedTime: string | undefined = undefined

    const updatedAttendees = event.attendees.map((a) => {
      if (a.id !== attendeeId) return a
      updatedPresent = !a.present
      updatedTime = updatedPresent ? now : undefined
      return {
        ...a,
        present: updatedPresent,
        checkedInAt: updatedTime,
        checkedInBy: updatedPresent ? deviceName : undefined,
      }
    })

    const updatedEvent: EventRecord = {
      ...event,
      attendees: updatedAttendees,
      updatedAt: now,
    }

    onUpdate(updatedEvent)

    // Broadcast change to all other devices in real-time!
    if (event.syncCode) {
      syncManager.broadcastCheckIn(event.syncCode, attendeeId, updatedPresent, updatedTime)
    }
  }

  function markAll(present: boolean) {
    const now = new Date().toISOString()
    const updatedAttendees = event.attendees.map((a) => {
      // If list filter is active, only mark attendees in selected list
      if (selectedListId !== 'all' && a.listId !== selectedListId) return a
      return {
        ...a,
        present,
        checkedInAt: present ? a.checkedInAt || now : undefined,
        checkedInBy: present ? a.checkedInBy || deviceName : undefined,
      }
    })

    const updatedEvent: EventRecord = {
      ...event,
      attendees: updatedAttendees,
      updatedAt: now,
    }

    onUpdate(updatedEvent)

    if (event.syncCode) {
      syncManager.broadcastFullSync(event.syncCode, updatedEvent)
    }
  }

  function handleEndEvent() {
    if (
      window.confirm(
        `Are you sure you want to end “${event.title}”? Live attendance will be finalized.`,
      )
    ) {
      const updatedEvent: EventRecord = {
        ...event,
        status: 'ended',
        endedAt: new Date().toISOString(),
      }
      onUpdate(updatedEvent)
      if (event.syncCode) {
        syncManager.broadcastFullSync(event.syncCode, updatedEvent)
      }
    }
  }

  function handleReopenEvent() {
    if (window.confirm(`Reopen “${event.title}” for live check-ins?`)) {
      const updatedEvent: EventRecord = {
        ...event,
        status: 'active',
        endedAt: undefined,
      }
      onUpdate(updatedEvent)
      if (event.syncCode) {
        syncManager.broadcastFullSync(event.syncCode, updatedEvent)
      }
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

  return (
    <div className="panel">
      <div className="top-nav-bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← All events
        </button>

        <div className="nav-actions">
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => setShowShareModal(true)}
            title="Connect multiple devices to this meeting room"
          >
            📲 Add Device / Share
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowSettingsModal(true)}
            title="Database & Device Settings"
          >
            ⚙️ Settings
          </button>

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
              <span className="badge badge-active">Live Meeting</span>
            )}
          </div>

          <div className="event-meta" style={{ marginTop: '0.5rem' }}>
            <span>{dateLabel}</span>
            {event.location && <span>{event.location}</span>}
            <span>{event.attendees.length} total on roster</span>
            <span>Device: <strong>{deviceName}</strong></span>
          </div>

          {event.syncCode && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="pill pill-lime">{syncStatus}</span>
              <span className="pill">Room Code: <strong>{event.syncCode}</strong></span>
            </div>
          )}
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

      {/* Device Roster Assignment Bar */}
      <div className="device-assignment-bar" style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <strong style={{ color: 'var(--jci-navy)' }}>📱 Device Roster Assignment:</strong>
            <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.9rem' }}>
              Select which list this device is handling
            </span>
          </div>

          <div className="filter-group">
            <button
              type="button"
              className={`tab ${selectedListId === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedListId('all')}
            >
              All Lists ({event.attendees.length})
            </button>

            {lists.map((list) => {
              const listCount = event.attendees.filter((a) => a.listId === list.id).length
              return (
                <button
                  key={list.id}
                  type="button"
                  className={`tab ${selectedListId === list.id ? 'active' : ''}`}
                  onClick={() => setSelectedListId(list.id)}
                >
                  {list.name} ({listCount})
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Meeting Concluded & Export Card */}
      <div className="ended-summary-card" style={{ marginTop: '1.25rem' }}>
        <div className="ended-info">
          <div className="ended-icon">📊</div>
          <div>
            <h3>Consolidated Attendance Report</h3>
            <p className="muted">
              Turnout: <strong>{stats.present} of {stats.total}</strong> attendees ({stats.rate}% attendance rate).
              Any device can export combined attendance data from all devices and lists.
            </p>
          </div>
        </div>

        <div className="export-controls">
          <div className="export-scope-selector">
            <label htmlFor="export-scope" className="export-scope-label">
              Filter export:
            </label>
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

      <div className="toolbar" style={{ marginTop: '1rem' }}>
        <input
          type="search"
          placeholder="Search full name, family name, email, phone, status..."
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
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No matches found</h3>
          <p className="muted">Try adjusting your search query or list filter.</p>
        </div>
      ) : (
        <div className="attendee-list" style={{ marginTop: '1rem' }}>
          {filtered.map((a) => (
            <div key={a.id} className={`attendee ${a.present ? 'present' : ''}`}>
              <button
                type="button"
                className="check"
                onClick={() => toggle(a.id)}
                aria-label={a.present ? `Mark ${a.fullName} absent` : `Mark ${a.fullName} present`}
                aria-pressed={a.present}
              >
                ✓
              </button>
              <div className="attendee-info">
                <h4>
                  {a.fullName} {a.familyName ? `(${a.familyName})` : ''}
                </h4>
                <p>
                  {a.email ? `✉️ ${a.email} · ` : ''}
                  {a.phone ? `📞 ${a.phone} · ` : ''}
                  Status: <strong>{a.status}</strong> · Financial: <strong>{a.financialMember}</strong>
                </p>
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  List: <span className="pill" style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>{a.listName}</span>
                  {a.present && a.checkedInAt ? (
                    <span> · Checked in at {new Date(a.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {a.checkedInBy ? `by ${a.checkedInBy}` : ''}</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                className={`btn mark-btn ${a.present ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => toggle(a.id)}
              >
                {a.present ? 'Present' : 'Mark In'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showShareModal && event.syncCode && (
        <ShareRoomModal
          syncCode={event.syncCode}
          eventTitle={event.title}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showSettingsModal && (
        <DatabaseSettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  )
}
