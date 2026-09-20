export interface Attendee {
  id: string
  fullName: string
  familyName: string
  email: string
  status: string
  phone: string
  financialMember: string
  externalId: string
  present: boolean
  checkedInAt?: string
  checkedInBy?: string
  listId: string
  listName: string
}

export interface RosterListInput {
  id: string
  name: string
  url?: string
  type: 'link' | 'upload'
  attendeesCount: number
}

export interface EventRecord {
  id: string
  title: string
  date: string
  location: string
  notes: string
  sourceLabel: string
  lists: RosterListInput[]
  attendees: Attendee[]
  createdAt: string
  syncCode: string
  status?: 'active' | 'ended'
  endedAt?: string
  updatedAt?: string
}

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export type View =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'event'; eventId: string }
  | { name: 'settings' }

