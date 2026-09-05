import type { EventRecord } from '../types'

const STORAGE_KEY = 'roll.events.v1'

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}
