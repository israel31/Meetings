export interface Attendee {
  id: string
  name: string
  email: string
  externalId: string
  present: boolean
  checkedInAt?: string
}

export interface EventRecord {
  id: string
  title: string
  date: string
  location: string
  notes: string
  sourceLabel: string
  attendees: Attendee[]
  createdAt: string
  status?: 'active' | 'ended'
  endedAt?: string
}

export type View =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'event'; eventId: string }
