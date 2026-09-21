import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { Attendee } from '../types'

const FULL_NAME_KEYS = [
  'full name ( suname first )',
  'full name ( surname first )',
  'full name',
  'fullname name',
  'fullname',
  'name',
  'attendee',
  'participant',
  'member name',
]
const FAMILY_NAME_KEYS = ['family name', 'surname', 'last name', 'family']
const EMAIL_KEYS = ['email address', 'email', 'e-mail', 'mail', 'e mail']
const STATUS_KEYS = ['status', 'membership status', 'role', 'type', 'category']
const PHONE_KEYS = [
  'phone number',
  'phone',
  'mobile number',
  'mobile',
  'contact',
  'telephone',
  'phone no',
]
const FINANCIAL_KEYS = [
  'financial member',
  'financial',
  'dues paid',
  'paid member',
  'financial status',
  'paid',
]
const ID_KEYS = [
  'id',
  'member id',
  'student id',
  'employee id',
  'uid',
  'user id',
  'staff id',
  'matric no',
  'matric number',
  'reg no',
  'registration',
  'sn',
  's/n',
  's_n',
]

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function pickColumn(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map((h) => ({ raw: h, key: normalizeHeader(h) }))
  for (const candidate of candidates) {
    const match = normalized.find((h) => h.key === candidate)
    if (match) return match.raw
  }
  for (const candidate of candidates) {
    const match = normalized.find((h) => h.key.includes(candidate) || candidate.includes(h.key))
    if (match) return match.raw
  }
  return undefined
}

function cell(row: Record<string, unknown>, key?: string): string {
  if (!key) return ''
  const value = row[key]
  if (value == null) return ''
  return String(value).trim()
}

export function rowsToAttendees(
  rows: Record<string, unknown>[],
  listId: string = 'default-list',
  listName: string = 'Main Roster',
): Attendee[] {
  if (rows.length === 0) {
    throw new Error('No rows found in the spreadsheet.')
  }

  const headers = Object.keys(rows[0] ?? {})
  if (headers.length === 0) {
    throw new Error('Could not read column headers from the spreadsheet.')
  }

  const fullNameCol = pickColumn(headers, FULL_NAME_KEYS)
  const familyNameCol = pickColumn(headers, FAMILY_NAME_KEYS)
  const emailCol = pickColumn(headers, EMAIL_KEYS)
  const statusCol = pickColumn(headers, STATUS_KEYS)
  const phoneCol = pickColumn(headers, PHONE_KEYS)
  const financialCol = pickColumn(headers, FINANCIAL_KEYS)
  const idCol = pickColumn(headers, ID_KEYS)

  if (!fullNameCol && !emailCol && !idCol) {
    throw new Error(
      'Could not find Name, Email, or ID columns. Expecting columns like FULL NAME ( SUNAME FIRST ), EMAIL ADDRESS, etc.',
    )
  }

  const attendees: Attendee[] = []
  const seen = new Set<string>()

  rows.forEach((row, index) => {
    const fullName = cell(row, fullNameCol)
    const familyName = cell(row, familyNameCol)
    const email = cell(row, emailCol)
    const status = cell(row, statusCol)
    const phone = cell(row, phoneCol)
    const financialMember = cell(row, financialCol)
    const externalId = cell(row, idCol)

    if (!fullName && !email && !externalId) return

    const dedupeKey = `${externalId}|${email}|${fullName}`.toLowerCase()
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)

    attendees.push({
      id: crypto.randomUUID(),
      fullName: fullName || email || `Attendee ${index + 1}`,
      familyName: familyName || '',
      email: email || '',
      status: status || 'Member',
      phone: phone || '',
      financialMember: financialMember || '—',
      externalId: externalId || String(index + 1),
      present: false,
      listId,
      listName,
    })
  })

  if (attendees.length === 0) {
    throw new Error('Spreadsheet has headers but no valid attendee rows.')
  }

  return attendees
}

function parseCsvText(
  text: string,
  listId: string = 'default-list',
  listName: string = 'Main Roster',
): Attendee[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(parsed.errors[0]?.message || 'Failed to parse CSV.')
  }

  return rowsToAttendees(parsed.data, listId, listName)
}

function parseWorkbook(
  buffer: ArrayBuffer,
  listId: string = 'default-list',
  listName: string = 'Main Roster',
): Attendee[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Workbook has no sheets.')
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return rowsToAttendees(rows, listId, listName)
}

/** Convert common Google Sheets / Excel Online URLs into downloadable CSV candidate URLs. */
export function getSpreadsheetCandidateUrls(rawUrl: string): string[] {
  const url = rawUrl.trim()

  // Published sheet: https://docs.google.com/spreadsheets/d/e/2PACX-.../pubhtml
  const pubMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/)
  if (pubMatch) {
    const pubId = pubMatch[1]
    return [
      `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv`,
      url,
    ]
  }

  // Standard sheet: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (sheetsMatch) {
    const id = sheetsMatch[1]
    const gidMatch = url.match(/[#&?]gid=([0-9]+)/)
    const gid = gidMatch?.[1] ?? '0'
    return [
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,
    ]
  }

  return [url]
}

export async function parseSpreadsheetFile(
  file: File,
  listId: string = 'file-list',
  listName: string = 'Uploaded Sheet',
): Promise<Attendee[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text/')) {
    const text = await file.text()
    return parseCsvText(text, listId, listName)
  }

  const buffer = await file.arrayBuffer()
  return parseWorkbook(buffer, listId, listName)
}

const CORS_PROXIES = [
  (target: string) => target,
  (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
  (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
]

async function fetchSpreadsheetBytes(rawUrl: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const candidates = getSpreadsheetCandidateUrls(rawUrl)
  let detectedLoginHtml = false

  for (const candidate of candidates) {
    for (const proxyFn of CORS_PROXIES) {
      try {
        const fetchUrl = proxyFn(candidate)
        const response = await fetch(fetchUrl)
        if (!response.ok) continue

        const contentType = response.headers.get('content-type') || ''
        const buffer = await response.arrayBuffer()

        // Peek at content to see if it's a HTML response (e.g. Google Login or Access Denied page)
        const snippet = new TextDecoder().decode(buffer.slice(0, 800)).toLowerCase()
        if (snippet.includes('<!doctype') || snippet.includes('<html')) {
          if (
            snippet.includes('servicelogin') ||
            snippet.includes('accounts.google.com') ||
            snippet.includes('sign in')
          ) {
            detectedLoginHtml = true
          }
          continue
        }

        return { buffer, contentType }
      } catch {
        // try next proxy
      }
    }
  }

  if (detectedLoginHtml) {
    throw new Error(
      'This Google Sheet is private or requires login. Please open the sheet in Google Sheets, click "Share" → set Access to "Anyone with the link" (Viewer), or download as CSV and upload the file.',
    )
  }

  throw new Error(
    'Could not access the spreadsheet URL (CORS/Network error). Ensure sheet sharing is set to "Anyone with the link", or click "File → Download → CSV" in Google Sheets and upload the file.',
  )
}

export async function parseSpreadsheetUrl(
  rawUrl: string,
  listId: string = 'link-list',
  listName: string = 'Google Sheet Link',
): Promise<Attendee[]> {
  const { buffer, contentType } = await fetchSpreadsheetBytes(rawUrl)

  if (
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    rawUrl.toLowerCase().includes('.xlsx') ||
    rawUrl.toLowerCase().includes('.xls')
  ) {
    return parseWorkbook(buffer, listId, listName)
  }

  const text = new TextDecoder().decode(buffer)
  return parseCsvText(text, listId, listName)
}

export type ExportFilter = 'all' | 'present' | 'absent'

function filterAttendees(attendees: Attendee[], filter: ExportFilter = 'all'): Attendee[] {
  if (filter === 'present') return attendees.filter((a) => a.present)
  if (filter === 'absent') return attendees.filter((a) => !a.present)
  return attendees
}

function sanitizeFilename(title: string, filter: ExportFilter, ext: string): string {
  const cleanTitle = title.replace(/[^\w\s-]/g, '').trim() || 'attendance'
  const filterSuffix = filter !== 'all' ? `-${filter}` : ''
  return `${cleanTitle}-attendance${filterSuffix}.${ext}`
}

export function exportAttendanceCsv(
  attendees: Attendee[],
  eventTitle: string,
  filter: ExportFilter = 'all',
): void {
  const filtered = filterAttendees(attendees, filter)
  const rows = filtered.map((a) => ({
    'EMAIL ADDRESS': a.email,
    'FULL NAME ( SUNAME FIRST )': a.fullName,
    'FAMILY NAME': a.familyName,
    'PHONE NUMBER': a.phone,
    'FINANCIAL MEMBER': a.financialMember,
    'ATTENDANCE STATUS': a.present ? 'Present' : 'Absent',
    'CHECK-IN TIME': a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : '',
    'ROSTER LIST': a.listName,
    'CHECKED IN BY': a.checkedInBy || '',
  }))

  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = sanitizeFilename(eventTitle, filter, 'csv')
  link.click()
  URL.revokeObjectURL(url)
}

export function exportAttendanceXlsx(
  attendees: Attendee[],
  eventTitle: string,
  filter: ExportFilter = 'all',
): void {
  const filtered = filterAttendees(attendees, filter)

  const rows = filtered.map((a) => ({
    'EMAIL ADDRESS': a.email,
    'FULL NAME ( SUNAME FIRST )': a.fullName,
    'FAMILY NAME': a.familyName,
    'PHONE NUMBER': a.phone,
    'FINANCIAL MEMBER': a.financialMember,
    'ATTENDANCE STATUS': a.present ? 'Present' : 'Absent',
    'CHECK-IN TIME': a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : '—',
    'ROSTER LIST': a.listName,
    'CHECKED IN BY': a.checkedInBy || '—',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Roster')

  worksheet['!cols'] = [
    { wch: 28 }, // EMAIL ADDRESS
    { wch: 30 }, // FULL NAME ( SUNAME FIRST )
    { wch: 20 }, // FAMILY NAME
    { wch: 18 }, // PHONE NUMBER
    { wch: 18 }, // FINANCIAL MEMBER
    { wch: 18 }, // ATTENDANCE STATUS
    { wch: 22 }, // CHECK-IN TIME
    { wch: 22 }, // ROSTER LIST
    { wch: 18 }, // CHECKED IN BY
  ]

  XLSX.writeFile(workbook, sanitizeFilename(eventTitle, filter, 'xlsx'))
}
