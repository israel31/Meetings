import { useEffect, useState } from 'react'
import type { Attendee, EventRecord, View } from './types'
import { loadEvents, saveEvents } from './lib/storage'
import { Home } from './components/Home'
import { CreateEvent } from './components/CreateEvent'
import { EventAttendance } from './components/EventAttendance'

export default function App() {
  const [events, setEvents] = useState<EventRecord[]>(() => loadEvents())
  const [view, setView] = useState<View>({ name: 'home' })

  useEffect(() => {
    saveEvents(events)
  }, [events])

  function createEvent(payload: {
    title: string
    date: string
    location: string
    notes: string
    sourceLabel: string
    attendees: Attendee[]
  }) {
    const event: EventRecord = {
      id: crypto.randomUUID(),
      title: payload.title,
      date: payload.date,
      location: payload.location,
      notes: payload.notes,
      sourceLabel: payload.sourceLabel,
      attendees: payload.attendees,
      createdAt: new Date().toISOString(),
    }
    setEvents((prev) => [event, ...prev])
    setView({ name: 'event', eventId: event.id })
  }

  function updateEvent(updated: EventRecord) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  function deleteEvent(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
    setView({ name: 'home' })
  }

  const activeEvent =
    view.name === 'event' ? events.find((e) => e.id === view.eventId) : undefined

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setView({ name: 'home' })}>
          <span className="brand-mark">✓</span>
          <span className="brand-name">Meetings</span>
        </button>
        <span className="brand-tag">Event attendance from spreadsheets</span>
      </header>

      {view.name === 'home' && (
        <Home
          events={events}
          onCreate={() => setView({ name: 'create' })}
          onOpen={(eventId) => setView({ name: 'event', eventId })}
        />
      )}

      {view.name === 'create' && (
        <CreateEvent onCancel={() => setView({ name: 'home' })} onCreate={createEvent} />
      )}

      {view.name === 'event' && activeEvent && (
        <EventAttendance
          event={activeEvent}
          onBack={() => setView({ name: 'home' })}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
        />
      )}

      {view.name === 'event' && !activeEvent && (
        <div className="panel">
          <h1>Event not found</h1>
          <p className="muted">It may have been deleted.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setView({ name: 'home' })}>
            Back home
          </button>
        </div>
      )}
    </div>
  )
}
