import { useEffect, useState } from 'react'
import type { Attendee, EventRecord, RosterListInput, View } from './types'
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

  useEffect(() => {
    saveEvents(events)
    events.forEach((evt) => {
      if (evt.syncCode) {
        void syncManager.saveEventToCloud(evt)
      }
    })
  }, [events])

  // Automatic join when opening a shared URL parameter e.g. ?event=MEET-7492
  useEffect(() => {
    function getEventCodeFromUrl(): string | null {
      // 1. Check standard query params: ?event=MEET-xxxx
      const searchParams = new URLSearchParams(window.location.search)
      let code = searchParams.get('event')
      if (code) return code

      // 2. Check hash route query params: #/?event=MEET-xxxx or #event=MEET-xxxx
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

  // Auto-respond to sync requests from joining devices & sync cloud updates
  useEffect(() => {
    if (events.length === 0) return

    const cleanupFns: Array<() => void> = []

    events.forEach((evt) => {
      if (!evt.syncCode) return
      // Persist to Cloud DB when loaded
      void syncManager.saveEventToCloud(evt)

      const unsub = syncManager.subscribeToSync(evt.syncCode, (msg) => {
        if (msg.type === 'REQUEST_SYNC') {
          syncManager.broadcastFullSync(evt.syncCode, evt)
        }
      })
      cleanupFns.push(unsub)
    })

    return () => {
      cleanupFns.forEach((fn) => fn())
    }
  }, [events])

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

    setEvents((prev) => [event, ...prev])
    setView({ name: 'event', eventId: event.id })

    // Broadcast and save to Supabase Cloud DB
    syncManager.broadcastFullSync(payload.syncCode, event)
  }

  function updateEvent(updated: EventRecord) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    if (updated.syncCode) {
      syncManager.saveEventToCloud(updated)
    }
  }

  function deleteEvent(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
    setView({ name: 'home' })
  }

  async function handleJoinRoomCode(syncCode: string) {
    const clean = syncCode.trim().toUpperCase()
    const found = events.find(
      (e) => e.syncCode && e.syncCode.toUpperCase() === clean,
    )

    if (found) {
      setView({ name: 'event', eventId: found.id })
      return
    }

    setJoiningSyncCode(clean)

    // 1. Try fetching directly from Supabase Cloud DB
    const cloudEvent = await syncManager.fetchEventFromCloud(clean)
    if (cloudEvent) {
      setEvents((prev) => [cloudEvent, ...prev.filter((e) => e.id !== cloudEvent.id)])
      setJoiningSyncCode(null)
      setView({ name: 'event', eventId: cloudEvent.id })
      return
    }

    // 2. Otherwise listen to Realtime broadcast from active host/peers
    const unsubscribe = syncManager.subscribeToSync(clean, (msg) => {
      if (msg.type === 'FULL_EVENT_SYNC' && msg.event) {
        setEvents((prev) => {
          const exists = prev.some((e) => e.id === msg.event.id)
          if (exists) {
            return prev.map((e) => (e.id === msg.event.id ? msg.event : e))
          }
          return [msg.event, ...prev]
        })
        setJoiningSyncCode(null)
        setView({ name: 'event', eventId: msg.event.id })
        unsubscribe()
      }
    })

    syncManager.requestSync(clean)

    setTimeout(() => {
      setJoiningSyncCode((current) => {
        if (current === clean) {
          alert(`Connecting to Room "${clean}". Make sure the host device has the meeting room open on their screen to sync.`)
          return null
        }
        return current
      })
    }, 8000)
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

      {joiningSyncCode && (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div className="brand-mark" style={{ margin: '0 auto 1rem', width: '3.5rem', height: '3.5rem', fontSize: '1.75rem' }}>
            ⚡
          </div>
          <h2>Connecting to Live Room "{joiningSyncCode}"...</h2>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Fetching roster lists and attendance status across networks...
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: '1.5rem' }}
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
          onOpen={(eventId) => setView({ name: 'event', eventId })}
          onJoinRoomCode={(code) => void handleJoinRoomCode(code)}
        />
      )}

      {!joiningSyncCode && view.name === 'create' && (
        <CreateEvent onCancel={() => setView({ name: 'home' })} onCreate={createEvent} />
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
        <DatabaseSettingsModal onClose={() => setView({ name: 'home' })} />
      )}

      {!joiningSyncCode && view.name === 'event' && !activeEvent && (
        <div className="panel">
          <h1>Event not found</h1>
          <p className="muted">It may have been deleted or the link is invalid.</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => setView({ name: 'home' })}
          >
            Back home
          </button>
        </div>
      )}
    </div>
  )
}
