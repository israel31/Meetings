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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Multi-Device Attendance for Google Meetings</h1>
            <p>
              Import rosters from multiple Google Sheet links, take attendance simultaneously across devices with Supabase live sync, and export consolidated reports.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowSettings(true)}
            title="Database & Device Settings"
          >
            ⚙️ Device: {deviceName}
          </button>
        </div>

        <div className="hero-actions" style={{ marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-accent" onClick={onCreate}>
            + Create New Multi-Link Event
          </button>

          <form onSubmit={handleJoinSubmit} className="join-room-form" style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Enter Room Sync Code (e.g. MEET-1234)"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              style={{ width: '260px', textTransform: 'uppercase', fontWeight: 600 }}
            />
            <button type="submit" className="btn btn-primary">
              Join Room
            </button>
          </form>
        </div>
      </section>

      <div className="section-head" style={{ marginTop: '2rem' }}>
        <div>
          <h2>Your Events</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {events.length === 0 ? 'No events created yet' : `${events.length} event${events.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <h3>Start by adding Google Sheet links</h3>
          <p className="muted">Create an event with 1 or more Google Sheet URLs or uploaded spreadsheets.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onCreate}>
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
                className={`event-row ${isEnded ? 'is-ended' : ''}`}
                onClick={() => onOpen(event.id)}
              >
                <div>
                  <div className="event-title-line">
                    <h3>{event.title}</h3>
                    {isEnded ? (
                      <span className="pill pill-ended">Ended</span>
                    ) : (
                      <span className="pill pill-active">Live</span>
                    )}
                    <span className="pill pill-lime">{listCount} Google Link{listCount === 1 ? '' : 's'}</span>
                    {event.syncCode && <span className="pill">Code: {event.syncCode}</span>}
                  </div>
                  <div className="event-meta">
                    <span>{dateLabel}</span>
                    {event.location && <span>{event.location}</span>}
                    <span>{event.attendees.length} people</span>
                  </div>
                </div>
                <span className={`pill ${isEnded ? 'pill-neutral' : 'pill-lime'}`}>
                  {present}/{event.attendees.length} present
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
