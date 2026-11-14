import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

import type {
  Attendee,
  EventRecord,
  SupabaseConfig,
} from '../types'

import {
  loadPendingOperations,
  savePendingOperations,
  type PendingSyncOperation,
} from './storage'

const CONFIG_STORAGE_KEY = 'meetings_supabase_config_v1'
const DEVICE_ID_KEY = 'meetings_device_id_v1'
const DEVICE_NAME_KEY = 'meetings_device_name_v1'

const DEFAULT_SUPABASE_URL =
  'https://ekoylhztqkxjpntyjkym.supabase.co'

const DEFAULT_SUPABASE_KEY =
  'sb_publishable_QeTkM3_Lw0zVrw17LqMCkA_DXVIJAlu'

let supabaseInstance: SupabaseClient | null = null

export function getStoredSupabaseConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveSupabaseConfig(config: SupabaseConfig | null): void {
  if (!config) {
    localStorage.removeItem(CONFIG_STORAGE_KEY)
  } else {
    localStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify(config),
    )
  }

  // Recreate the client if settings change.
  supabaseInstance = null
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)

  if (!id) {
    id = 'dev-' + crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }

  return id
}

export function getDeviceName(): string {
  let name = localStorage.getItem(DEVICE_NAME_KEY)

  if (!name) {
    const platform =
      typeof navigator !== 'undefined' && navigator.platform
        ? navigator.platform.includes('Win')
          ? 'Windows'
          : navigator.platform.includes('Mac')
            ? 'Mac'
            : /Android|iPhone|iPad/i.test(navigator.userAgent)
              ? 'Mobile Device'
              : 'Device'
        : 'Device'

    const rand = Math.floor(100 + Math.random() * 900)

    name = `${platform} (${rand})`
    localStorage.setItem(DEVICE_NAME_KEY, name)
  }

  return name
}

export function setDeviceName(name: string): void {
  localStorage.setItem(DEVICE_NAME_KEY, name)
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig()

  const url =
    config?.url ||
    import.meta.env.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL

  const key =
    config?.anonKey ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_KEY

  if (!url || !key) return null

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
        },
      })
    } catch (error) {
      console.error('Could not initialize Supabase:', error)
      supabaseInstance = null
    }
  }

  return supabaseInstance
}

export async function testSupabaseConnection(): Promise<{
  ok: boolean
  message: string
}> {
  const client = getSupabaseClient()

  if (!client) {
    return {
      ok: false,
      message: 'Supabase client is not configured.',
    }
  }

  try {
    const { data, error } = await client
      .from('meetings_events')
      .select('sync_code')
      .limit(1)

    if (error) {
      return {
        ok: false,
        message: `Supabase Error: ${error.message}`,
      }
    }

    return {
      ok: true,
      message: `Connected. ${data?.length ?? 0} event records found.`,
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Could not reach Supabase.',
    }
  }
}

interface BackgroundSyncOptions {
  getEvents: () => EventRecord[]
  onRemoteEvent: (event: EventRecord) => void
  onRemoteDeleted: (syncCode: string) => void
}

class MeetingSyncManager {
  private syncing = false

  private addOperation(operation: PendingSyncOperation): void {
    const operations = loadPendingOperations()

    operations.push(operation)

    savePendingOperations(operations)
  }

  enqueueCreate(event: EventRecord): void {
    this.addOperation({
      id: crypto.randomUUID(),
      syncCode: event.syncCode,
      createdAt: new Date().toISOString(),
      kind: 'create_event',
      event,
    })
  }

  enqueueDelete(event: EventRecord): void {
    this.addOperation({
      id: crypto.randomUUID(),
      syncCode: event.syncCode,
      createdAt: new Date().toISOString(),
      kind: 'delete_event',
    })
  }

  enqueueEventChanges(
    previous: EventRecord,
    updated: EventRecord,
  ): void {
    const previousAttendees = new Map(
      previous.attendees.map((attendee) => [
        attendee.id,
        attendee,
      ]),
    )

    const updatedAttendees = new Map(
      updated.attendees.map((attendee) => [
        attendee.id,
        attendee,
      ]),
    )

    // Queue changed or newly added attendees individually.
    updated.attendees.forEach((attendee) => {
      const oldAttendee = previousAttendees.get(attendee.id)

      if (
        !oldAttendee ||
        JSON.stringify(oldAttendee) !== JSON.stringify(attendee)
      ) {
        this.addOperation({
          id: crypto.randomUUID(),
          syncCode: updated.syncCode,
          createdAt: new Date().toISOString(),
          kind: 'attendee_upsert',
          attendee,
        })
      }
    })

    // Queue removed attendees individually.
    previous.attendees.forEach((attendee) => {
      if (!updatedAttendees.has(attendee.id)) {
        this.addOperation({
          id: crypto.randomUUID(),
          syncCode: updated.syncCode,
          createdAt: new Date().toISOString(),
          kind: 'attendee_delete',
          attendeeId: attendee.id,
        })
      }
    })

    // Queue event details separately from the attendee roster.
    const fields: Array<keyof EventRecord> = [
      'title',
      'date',
      'location',
      'notes',
      'sourceLabel',
      'lists',
      'status',
      'endedAt',
      'updatedAt',
    ]

    const patch: Partial<EventRecord> = {}

    fields.forEach((field) => {
      if (
        JSON.stringify(previous[field]) !==
        JSON.stringify(updated[field])
      ) {
        ;(patch as Record<string, unknown>)[field] = updated[field]
      }
    })

    if (Object.keys(patch).length > 0) {
      this.addOperation({
        id: crypto.randomUUID(),
        syncCode: updated.syncCode,
        createdAt: new Date().toISOString(),
        kind: 'event_patch',
        patch,
      })
    }
  }

  private operationPayload(
    operation: PendingSyncOperation,
  ): Record<string, unknown> {
    switch (operation.kind) {
      case 'create_event':
        return {
          type: 'create_event',
          event: operation.event,
        }

      case 'attendee_upsert':
        return {
          type: 'attendee_upsert',
          attendee: operation.attendee,
        }

      case 'attendee_delete':
        return {
          type: 'attendee_delete',
          attendeeId: operation.attendeeId,
        }

      case 'event_patch':
        return {
          type: 'event_patch',
          patch: operation.patch,
        }

      case 'delete_event':
        return {
          type: 'delete_event',
        }
    }
  }

  async flushPendingOperations(): Promise<void> {
    const client = getSupabaseClient()
    if (!client) return

    const operations = loadPendingOperations().sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt),
    )

    for (const operation of operations) {
      const { error } = await client.rpc(
        'apply_meeting_sync_operation',
        {
          p_operation_id: operation.id,
          p_sync_code: operation.syncCode,
          p_operation: this.operationPayload(operation),
        },
      )

      if (error) {
        console.warn(
          'Sync operation is still pending:',
          operation.id,
          error.message,
        )

        // Keep this operation and all later operations for retry.
        break
      }

      const latest = loadPendingOperations().filter(
        (item) => item.id !== operation.id,
      )

      savePendingOperations(latest)
    }
  }

async fetchEventFromCloud(
  syncCode: string,
): Promise<EventRecord | null | undefined> {
  const client = getSupabaseClient()
  if (!client) return undefined

  try {
    const { data, error } = await client
      .from('meetings_events')
      .select('event_data')
      .eq('sync_code', syncCode.trim().toUpperCase())
      .maybeSingle()

    if (error) {
      console.error('Cloud event fetch failed:', error)
      return undefined
    }

    // No cloud record. This may simply be an old local-only event.
    if (!data?.event_data) return undefined

    // A deletion marker means another device deleted this event.
    if (data.event_data.__deleted === true) return null

    return data.event_data as EventRecord
  } catch (error) {
    console.error('Cloud event fetch failed:', error)
    return undefined
  }
}

  applyPendingOperations(
    remoteEvent: EventRecord,
  ): EventRecord | null {
    let event: EventRecord | null = remoteEvent

    const operations = loadPendingOperations()
      .filter(
        (operation) =>
          operation.syncCode.toUpperCase() ===
          remoteEvent.syncCode.toUpperCase(),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    for (const operation of operations) {
      if (!event) break

      switch (operation.kind) {
        case 'attendee_upsert': {
          if (!operation.attendee) break

          const exists = event.attendees.some(
            (a) => a.id === operation.attendee?.id,
          )

          event = {
            ...event,
            attendees: exists
              ? event.attendees.map((a) =>
                  a.id === operation.attendee?.id
                    ? operation.attendee
                    : a,
                )
              : [...event.attendees, operation.attendee],
          }

          break
        }

        case 'attendee_delete':
          event = {
            ...event,
            attendees: event.attendees.filter(
              (a) => a.id !== operation.attendeeId,
            ),
          }
          break

        case 'event_patch':
          event = {
            ...event,
            ...(operation.patch || {}),
          }
          break

        case 'delete_event':
          event = null
          break

        case 'create_event':
          break
      }
    }

    return event
  }

  hasPendingOperations(syncCode: string): boolean {
    return loadPendingOperations().some(
      (operation) =>
        operation.syncCode.toUpperCase() ===
        syncCode.toUpperCase(),
    )
  }

  startBackgroundSync(
    options: BackgroundSyncOptions,
  ): () => void {
    let stopped = false

    const run = async () => {
      if (this.syncing || stopped) return

      this.syncing = true

      try {
        // Upload pending changes first.
        await this.flushPendingOperations()

        if (stopped) return

        // Then retrieve the latest cloud version of each local event.
        const events = options.getEvents()

        for (const localEvent of events) {
          if (stopped) break

          const remoteEvent = await this.fetchEventFromCloud(
            localEvent.syncCode,
          )

if (remoteEvent) {
  const merged = this.applyPendingOperations(remoteEvent)

  if (merged) {
    options.onRemoteEvent(merged)
  }
} else if (
  remoteEvent === null &&
  !this.hasPendingOperations(localEvent.syncCode)
) {
  options.onRemoteDeleted(localEvent.syncCode)
}
        }
      } catch (error) {
        console.error('Background sync failed:', error)
      } finally {
        this.syncing = false
      }
    }

    // Try immediately, then every five seconds.
    void run()

    const interval = window.setInterval(() => {
      void run()
    }, 5000)

    // Retry immediately when internet connectivity returns.
    window.addEventListener('online', run)

    return () => {
      stopped = true
      window.clearInterval(interval)
      window.removeEventListener('online', run)
    }
  }
}

export const syncManager = new MeetingSyncManager()
