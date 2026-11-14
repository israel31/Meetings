import type { EventRecord } from '../types'

export interface PendingSyncOperation {
  id: string
  syncCode: string
  createdAt: string
  kind:
    | 'create_event'
    | 'attendee_upsert'
    | 'attendee_delete'
    | 'event_patch'
    | 'delete_event'
  event?: EventRecord
  attendee?: EventRecord['attendees'][number]
  attendeeId?: string
  patch?: Partial<EventRecord>
}

const STORAGE_KEY = 'roll.events.v1'
const PENDING_SYNC_KEY = 'roll.pending-sync.v1'

export function loadEvents(): EventRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as EventRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveEvents(events: EventRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch (error) {
    console.error('Could not save events locally:', error)
  }
}

export function loadPendingOperations(): PendingSyncOperation[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as PendingSyncOperation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePendingOperations(
  operations: PendingSyncOperation[],
): void {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(operations))
  } catch (error) {
    console.error('Could not save pending sync operations:', error)
  }
}
