import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { EventRecord, SupabaseConfig } from '../types'

const CONFIG_STORAGE_KEY = 'meetings_supabase_config_v1'
const DEVICE_ID_KEY = 'meetings_device_id_v1'
const DEVICE_NAME_KEY = 'meetings_device_name_v1'

const DEFAULT_SUPABASE_URL = 'https://ekoylhztqkxjpntyjkym.supabase.co'
const DEFAULT_SUPABASE_KEY = 'sb_publishable_QeTkM3_Lw0zVrw17LqMCkA_DXVIJAlu'

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
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
  }
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = 'dev-' + crypto.randomUUID().slice(0, 8)
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

let supabaseInstance: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig()
  const url =
    config?.url ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL
  const key =
    config?.anonKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    DEFAULT_SUPABASE_KEY

  if (!url || !key || url.includes('your-project') || url.includes('xyzcompany')) {
    return null
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: { persistSession: false },
      })
    } catch {
      supabaseInstance = null
    }
  }
  return supabaseInstance
}

export interface BroadcastAttendeeMessage {
  type: 'CHECKIN_UPDATE'
  syncCode: string
  attendeeId: string
  present: boolean
  checkedInAt?: string
  checkedInBy: string
}

export interface BroadcastFullSyncMessage {
  type: 'FULL_EVENT_SYNC'
  syncCode: string
  event: EventRecord
}

export interface BroadcastRequestSyncMessage {
  type: 'REQUEST_SYNC'
  syncCode: string
  requestingDevice: string
}

export type SyncMessage =
  | BroadcastAttendeeMessage
  | BroadcastFullSyncMessage
  | BroadcastRequestSyncMessage

type SyncCallback = (msg: SyncMessage) => void

class MeetingSyncManager {
  private activeChannels: Map<string, RealtimeChannel> = new Map()
  private broadcastChannels: Map<string, BroadcastChannel> = new Map()

  /** Attempt to fetch event data from Supabase Cloud DB table if available */
  async fetchEventFromCloud(syncCode: string): Promise<EventRecord | null> {
    const client = getSupabaseClient()
    if (!client) return null

    try {
      const cleanCode = syncCode.trim().toUpperCase()
      const { data, error } = await client
        .from('meetings_events')
        .select('*')
        .eq('sync_code', cleanCode)
        .single()

      if (error || !data) return null
      return data.event_data as EventRecord
    } catch {
      return null
    }
  }

  /** Attempt to save event data to Supabase Cloud DB table if table exists */
  async saveEventToCloud(event: EventRecord): Promise<void> {
    const client = getSupabaseClient()
    if (!client || !event.syncCode) return

    try {
      const cleanCode = event.syncCode.trim().toUpperCase()
      await client.from('meetings_events').upsert(
        {
          sync_code: cleanCode,
          event_id: event.id,
          title: event.title,
          event_data: event,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'sync_code' },
      )
    } catch {
      // Graceful fallback if table is not created yet
    }
  }

  subscribeToSync(syncCode: string, onSync: SyncCallback): () => void {
    const cleanCode = syncCode.trim().toLowerCase()
    const channelName = `meeting-room-${cleanCode}`

    let bc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(channelName)
        bc.onmessage = (event) => {
          if (event.data?.syncCode?.toLowerCase() === cleanCode) {
            onSync(event.data)
          }
        }
        this.broadcastChannels.set(cleanCode, bc)
      } catch {
        // Fallback
      }
    }

    const client = getSupabaseClient()
    let channel: RealtimeChannel | null = null

    if (client) {
      try {
        channel = client
          .channel(channelName, {
            config: { broadcast: { self: true, ack: true } },
          })
          .on('broadcast', { event: 'ATTENDANCE_EVENT' }, (payload) => {
            if (payload.payload?.syncCode?.toLowerCase() === cleanCode) {
              onSync(payload.payload)
            }
          })

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Upon joining channel, broadcast sync request
            this.requestSync(syncCode)
          }
        })

        this.activeChannels.set(cleanCode, channel)
      } catch {
        // Fallback
      }
    }

    return () => {
      if (bc) {
        bc.close()
        this.broadcastChannels.delete(cleanCode)
      }
      if (channel && client) {
        client.removeChannel(channel)
        this.activeChannels.delete(cleanCode)
      }
    }
  }

  requestSync(syncCode: string): void {
    const cleanCode = syncCode.trim().toLowerCase()
    const msg: BroadcastRequestSyncMessage = {
      type: 'REQUEST_SYNC',
      syncCode,
      requestingDevice: getDeviceName(),
    }

    const bc = this.broadcastChannels.get(cleanCode)
    if (bc) {
      bc.postMessage(msg)
    }

    const channel = this.activeChannels.get(cleanCode)
    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'ATTENDANCE_EVENT',
        payload: msg,
      })
    }
  }

  broadcastCheckIn(
    syncCode: string,
    attendeeId: string,
    present: boolean,
    checkedInAt?: string,
  ): void {
    const cleanCode = syncCode.trim().toLowerCase()
    const msg: BroadcastAttendeeMessage = {
      type: 'CHECKIN_UPDATE',
      syncCode,
      attendeeId,
      present,
      checkedInAt,
      checkedInBy: getDeviceName(),
    }

    const bc = this.broadcastChannels.get(cleanCode)
    if (bc) {
      bc.postMessage(msg)
    }

    const channel = this.activeChannels.get(cleanCode)
    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'ATTENDANCE_EVENT',
        payload: msg,
      })
    }
  }

  broadcastFullSync(syncCode: string, event: EventRecord): void {
    const cleanCode = syncCode.trim().toLowerCase()
    const msg: BroadcastFullSyncMessage = {
      type: 'FULL_EVENT_SYNC',
      syncCode,
      event,
    }

    const bc = this.broadcastChannels.get(cleanCode)
    if (bc) {
      bc.postMessage(msg)
    }

    const channel = this.activeChannels.get(cleanCode)
    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'ATTENDANCE_EVENT',
        payload: msg,
      })
    }

    // Also persist to Supabase Cloud DB
    void this.saveEventToCloud(event)
  }
}

export const syncManager = new MeetingSyncManager()
