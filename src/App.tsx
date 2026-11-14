
import { useEffect, useRef, useState } from 'react'
import type {
  Attendee,
  EventRecord,
  RosterListInput,
  View,
} from './types'

import { loadEvents, saveEvents } from './lib/storage'
import { Home } from './components/Home'
import { CreateEvent } from './components/CreateEvent'
import { EventAttendance } from './components/EventAttendance'
import { DatabaseSettingsModal } from './components/DatabaseSettingsModal'
import { syncManager } from './lib/supabase'

export default function App() {
  const [events, setEvents] = useState<EventRecord[]>(() => loadEvents())
  const [view, setView] = useState<View>({ name: 'home' })
  const [joiningSyncCode, setJoiningSyncCode] = useState<string | null>(null)

  // Keep the latest events available to background sync and event handlers.
  const eventsRef = useRef(events)

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  // Save every local change immediately.
  useEffect(() => {
    saveEvents(events)
  }, [events])

  // Start background synchronization.
  useEffect(() => {
    const stopSync = syncManager.startBackgroundSync({
      getEvents: () => eventsRef.current,

      onRemoteEvent: (remoteEvent) => {
        const current = eventsRef.current

        const index = current.findIndex(
          (event) =>
            event.syncCode.toUpperCase() ===
            remoteEvent.syncCode.toUpperCase(),
        )

        if (index === -1) return

        if (
          JSON.stringify(current[index]) ===
          JSON.stringify(remoteEvent)
        ) {
          return
        }

        const next = [...current]
        next[index] = remoteEvent

        eventsRef.current = next
        setEvents(next)
      },

      onRemoteDeleted: (syncCode) => {
        const next = eventsRef.current.filter(
          (event) =>
            event.syncCode.toUpperCase() !==
            syncCode.toUpperCase(),
        )

        eventsRef.current = next
        setEvents(next)

        setView((current) => {
          if (current.name !== 'event') return current

          const deletedEvent = eventsRef.current.find(
            (event) => event.syncCode.toUpperCase() === syncCode.toUpperCase(),
          )

          return deletedEvent ? current : { name: 'home' }
        })
      },
    })

    return stopSync
  }, [])

  // Check whether this page was opened through a shared event link.
  useEffect(() => {
    function getEventCodeFromUrl(): string | null {
      const searchParams = new URLSearchParams(window.location.search)
      let code = searchParams.get('event')

      if (code) return code

      if (window.location.hash) {
        const hash = window.location.hash
        const qIdx = hash.indexOf('?')

        if (qIdx !== -1) {
          const hashParams = new URLSearchParams(hash.slice(qIdx))
          code = hashParams.get('event')

          if (code) return code
        } else if (hash.includes('event=')) {
          const cleanHash = hash.replace(/^#\/?/, '')
          const hashParams = new URLSearchParams(cleanHash)
          code = hashParams.get('event')

          if (code) return code
        }
      }

      return null
    }

    const code = getEventCodeFromUrl()

    if (code) {
      void handleJoinRoomCode(code.trim().toUpperCase())
    }
  }, [])

  function createEvent(payload: {
    title: string
    date: string
    location: string
    notes: string
    sourceLabel: string
    lists: RosterListInput[]
    attendees: Attendee[]
    syncCode: string
  }) {
    const event: EventRecord = {
      id: crypto.randomUUID(),
      title: payload.title,
      date: payload.date,
      location: payload.location,
      notes: payload.notes,
      sourceLabel: payload.sourceLabel,
      lists: payload.lists,
      attendees: payload.attendees,
      syncCode: payload.syncCode,
      createdAt: new Date().toISOString(),
    }

    // Queue cloud creation without waiting for internet access.
    syncManager.enqueueCreate(event)

    const next = [event, ...eventsRef.current]

    eventsRef.current = next
    setEvents(next)

    setView({ name: 'event', eventId: event.id })
  }

  function updateEvent(updated: EventRecord) {
    const previous = eventsRef.current.find(
      (event) => event.id === updated.id,
    )

    if (previous && updated.syncCode) {
      syncManager.enqueueEventChanges(previous, updated)
    }

    const next = eventsRef.current.map((event) =>
      event.id === updated.id ? updated : event,
    )

    eventsRef.current = next
    setEvents(next)
  }

  function deleteEvent(eventId: string) {
    const event = eventsRef.current.find(
      (item) => item.id === eventId,
    )

    if (event?.syncCode) {
      syncManager.enqueueDelete(event)
    }

    const next = eventsRef.current.filter(
      (item) => item.id !== eventId,
    )

    eventsRef.current = next
    setEvents(next)

    setView({ name: 'home' })
  }

  // Join a shared room by retrieving its event from Supabase.
  async function handleJoinRoomCode(syncCode: string) {
    const clean = syncCode.trim().toUpperCase()

    const found = eventsRef.current.find(
      (event) =>
        event.syncCode &&
        event.syncCode.toUpperCase() === clean,
    )

    if (found) {
      setView({ name: 'event', eventId: found.id })
      return
    }

    setJoiningSyncCode(clean)

    const cloudEvent = await syncManager.fetchEventFromCloud(clean)

    if (cloudEvent) {
      const next = [
        cloudEvent,
        ...eventsRef.current.filter(
          (event) =>
            event.syncCode.toUpperCase() !== clean,
        ),
      ]

      eventsRef.current = next
      setEvents(next)

      setJoiningSyncCode(null)
      setView({ name: 'event', eventId: cloudEvent.id })
      return
    }

    setJoiningSyncCode(null)

    alert(
      `Could not find an active cloud event for room "${clean}". Check the room code and internet connection, then try again.`,
    )
  }

  const activeEvent =
    view.name === 'event'
      ? events.find((event) => event.id === view.eventId)
      : undefined

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => setView({ name: 'home' })}
        >
          <span className="brand-mark">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <span className="brand-name">Meetings</span>
        </button>

        <span className="brand-tag">Event Attendance Platform</span>
      </header>

      {joiningSyncCode && (
        <div
          className="panel"
          style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}
        >
          <div
            className="brand-mark"
            style={{
              margin: '0 auto 1.25rem',
              width: '3.5rem',
              height: '3.5rem',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </div>

          <h2>Connecting to Live Room "{joiningSyncCode}"</h2>

          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Retrieving the event and attendee register...
          </p>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: '1.75rem' }}
            onClick={() => setJoiningSyncCode(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {!joiningSyncCode && view.name === 'home' && (
        <Home
          events={events}
          onCreate={() => setView({ name: 'create' })}
          onOpen={(eventId) =>
            setView({ name: 'event', eventId })
          }
          onJoinRoomCode={(code) =>
            void handleJoinRoomCode(code)
          }
        />
      )}

      {!joiningSyncCode && view.name === 'create' && (
        <CreateEvent
          onCancel={() => setView({ name: 'home' })}
          onCreate={createEvent}
        />
      )}

      {!joiningSyncCode && view.name === 'event' && activeEvent && (
        <EventAttendance
          event={activeEvent}
          onBack={() => setView({ name: 'home' })}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
        />
      )}

      {!joiningSyncCode && view.name === 'settings' && (
        <DatabaseSettingsModal
          onClose={() => setView({ name: 'home' })}
        />
      )}

      {!joiningSyncCode && view.name === 'event' && !activeEvent && (
        <div
          className="panel"
          style={{ textAlign: 'center', padding: '3rem 1.5rem' }}
        >
          <h2>Event Not Found</h2>

          <p className="muted">
            This event may have been removed or the link is invalid.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '1.5rem' }}
            onClick={() => setView({ name: 'home' })}
          >
            Back Home
          </button>
        </div>
      )}
    </div>
  )
}
