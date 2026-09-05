import type { EventRecord } from '../types'

interface Props {
  events: EventRecord[]
  onCreate: () => void
  onOpen: (eventId: string) => void
}

export function Home({ events, onCreate, onOpen }: Props) {
  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <>
      <section className="hero">
        <h1>Attendance by event, roster from your sheet.</h1>
        <p>
          Create an event, pull names, emails, and IDs from a spreadsheet link or upload, then mark who showed up.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn btn-accent" onClick={onCreate}>
            New event
          </button>
        </div>
      </section>

      <div className="section-head">
        <div>
          <h2>Your events</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {events.length === 0 ? 'No events yet' : `${events.length} event${events.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <h3>Start with a roster</h3>
          <p className="muted">Upload a CSV/Excel file or paste a Google Sheets link when you create an event.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onCreate}>
            Create first event
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
    </>
  )
}
