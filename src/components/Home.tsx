import { useState } from 'react'
import type { EventRecord } from '../types'
import { DatabaseSettingsModal } from './DatabaseSettingsModal'
import { getDeviceName } from '../lib/supabase'

interface Props {
  events: EventRecord[]
  onCreate: () => void
  onOpen: (eventId: string) => void
  onJoinRoomCode: (syncCode: string) => void
}

export function Home({ events, onCreate, onOpen, onJoinRoomCode }: Props) {
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const deviceName = getDeviceName()

  function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomCodeInput.trim()) return
    onJoinRoomCode(roomCodeInput.trim().toUpperCase())
  }

  return (
    <>
      <section className="hero">
        <div className="hero-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Multi-Device Attendance</h1>
            <p>
              Import Google Sheets, sync simultaneously across phones or tablets via live real-time sync, and export consolidated reports.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowSettings(true)}
            title="Database & Device Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.35rem' }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Device: <strong>{deviceName}</strong>
          </button>
        </div>

        <div className="hero-actions">
          <button type="button" className="btn btn-accent" onClick={onCreate}>
            + Create New Event
          </button>
          <form onSubmit={handleJoinSubmit} className="join-room-form">
            <input
              type="text"
              placeholder="Sync Code (e.g. MEET-1234)"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              style={{ width: '230px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}
            />
            <button type="submit" className="btn btn-primary">
              Join Room
            </button>
          </form>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--jci-navy)', fontSize: '1.4rem' }}>
            Your Events
          </h2>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
            {events.length === 0 ? 'No events recorded' : `${events.length} active meeting${events.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--jci-navy)' }}>Start by creating an event</h3>
          <p className="muted" style={{ marginTop: '0.4rem' }}>Connect Google Sheet URLs or upload CSV and Excel spreadsheets.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={onCreate}>
            Create First Event
          </button>
        </div>
      ) : (
        <div className="event-list">
          {sorted.map((event) => {
            const present = event.attendees.filter((a) => a.present).length
            const isEnded = event.status === 'ended'
            const dateLabel = event.date
              ? new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              : 'No date'
            const listCount = event.lists?.length || 1

            return (
              <button
                key={event.id}
                type="button"
                className="event-row"
                onClick={() => onOpen(event.id)}
              >
                <div>
                  <div className="event-title-line">
                    <h3>{event.title}</h3>
                    {isEnded ? (
                      <span className="badge badge-ended">Ended</span>
                    ) : (
                      <span className="badge badge-active">Live</span>
                    )}
                    <span className="pill pill-lime">{listCount} Sheet{listCount === 1 ? '' : 's'}</span>
                    {event.syncCode && <span className="pill">Code: {event.syncCode}</span>}
                  </div>
                  <div className="event-meta">
                    <span>{dateLabel}</span>
                    {event.location && <span>• {event.location}</span>}
                    <span>• {event.attendees.length} members</span>
                  </div>
                </div>
                <span className={`pill ${isEnded ? 'pill-ended' : 'pill-lime'}`} style={{ padding: '0.4rem 0.85rem' }}>
                  {present} / {event.attendees.length} present
                </span>
              </button>
            )
          })}
        </div>
      )}

      {showSettings && <DatabaseSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}