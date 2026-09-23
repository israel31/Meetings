import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { Attendee } from '../types'

const FULL_NAME_KEYS = [
  'full name ( suname first )',
  'full name ( surname first )',
  'full name',
  'fullname name',
  'fullname',
  'suname first',
  'surname first',
  'name',
  'attendee',
  'participant',
  'member name',
  'names',
  'student name',
  'member',
  'participant name',
  'attendee name',
]

const FIRST_NAME_KEYS = ['first name', 'firstname', 'given name', 'other names', 'first']
const LAST_NAME_KEYS = ['last name', 'lastname', 'surname']

const FAMILY_NAME_KEYS = [
  'family name',
  'family',
  'house',
  'family/house',
  'family group',
  'family head',
  'group',
]

const EMAIL_KEYS = [
  'email address',
  'email',
  'e mail',
  'e-mail',
  'mail',
  'contact email',
  'user email',
  'email id',
]

const STATUS_KEYS = [
  'status',
  'membership status',
  'role',
  'type',
  'category',
  'year joined',
  'active',
  'active?',
  'designation',
  'position',
]

const PHONE_KEYS = [
  'phone number',
  'phone',
  'mobile number',
  'mobile',
  'contact',
  'telephone',
  'phone no',
  'phone#',
  'whatsapp',
  'tel',
  'contact number',
]

const FINANCIAL_KEYS = [
  'financial member',
  'financial status',
  'financial',
  'dues paid',
  'paid member',
  'financial?',
  'paid',
  'dues',
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
  '#',
  'no.',
  's.n.',
]

function normalizeHeader(str: unknown): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/suname/g, 'surname')
}

function findHeaderRow(matrix: unknown[][]): { headerRowIdx: number; score: number } {
  let bestRowIdx = -1
  let maxScore = 0

  for (let r = 0; r < Math.min(25, matrix.length); r++) {
    const row = matrix[r]
    if (!Array.isArray(row)) continue

    let score = 0
    for (const cell of row) {
      const norm = normalizeHeader(cell)
      if (!norm) continue
      if (FULL_NAME_KEYS.some((k) => norm.includes(k))) score += 3
      if (FAMILY_NAME_KEYS.some((k) => norm.includes(k))) score += 2
      if (EMAIL_KEYS.some((k) => norm.includes(k))) score += 3
      if (PHONE_KEYS.some((k) => norm.includes(k))) score += 2
      if (FINANCIAL_KEYS.some((k) => norm.includes(k))) score += 2
      if (STATUS_KEYS.some((k) => norm.includes(k))) score += 1
      if (ID_KEYS.some((k) => norm.includes(k))) score += 1
    }

    // Check if next row completes missing header cells (e.g. cell in r is empty, next row has "Email Address")
    if (r + 1 < matrix.length) {
      const nextRow = matrix[r + 1]
      if (Array.isArray(nextRow)) {
        for (let c = 0; c < row.length; c++) {
          if (!row[c] && nextRow[c]) {
            const normNext = normalizeHeader(nextRow[c])
            if (
              EMAIL_KEYS.some((k) => normNext.includes(k)) ||
              FULL_NAME_KEYS.some((k) => normNext.includes(k))
            ) {
              score += 2
            }
          }
        }
      }
    }

    if (score > maxScore) {
      maxScore = score
      bestRowIdx = r
    }
  }

  return { headerRowIdx: bestRowIdx, score: maxScore }
}

function matchColumn(headers: string[], keywords: string[]): number {
  const normHeaders = headers.map((h) => normalizeHeader(h))

  // 1. Exact match
  for (const kw of keywords) {
    const idx = normHeaders.findIndex((h) => h && h === kw)
    if (idx !== -1) return idx
  }
  // 2. Substring match (header contains keyword)
  for (const kw of keywords) {
    const idx = normHeaders.findIndex((h) => h && h.length >= 2 && h.includes(kw))
    if (idx !== -1) return idx
  }
  // 3. Keyword contains header (only if header is meaningful length >= 3)
  for (const kw of keywords) {
    const idx = normHeaders.findIndex((h) => h && h.length >= 3 && kw.includes(h))
    if (idx !== -1) return idx
  }
  return -1
}

function inferColumnsFromContent(matrix: unknown[][]): {
  fullNameIdx: number
  emailIdx: number
  phoneIdx: number
  financialIdx: number
} {
  let emailIdx = -1
  let phoneIdx = -1
  let fullNameIdx = -1
  let financialIdx = -1

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
  const phoneRegex = /^\+?\d[\d\s\-()]{6,}\d$/
  const financialRegex = /^(yes|no|paid|unpaid|financial|active|true|false)$/i

  const colScores: Record<number, { email: number; phone: number; name: number; financial: number }> = {}

  const sampleRows = matrix.slice(0, 20)
  sampleRows.forEach((row) => {
    if (!Array.isArray(row)) return
    row.forEach((cell, colIdx) => {
      const val = String(cell || '').trim()
      if (!val) return

      if (!colScores[colIdx]) {
        colScores[colIdx] = { email: 0, phone: 0, name: 0, financial: 0 }
      }

      if (emailRegex.test(val)) {
        colScores[colIdx].email++
      } else if (phoneRegex.test(val)) {
        colScores[colIdx].phone++
      } else if (financialRegex.test(val)) {
        colScores[colIdx].financial++
      } else if (val.includes(' ') && /^[a-zA-Z\s,.'-]+$/.test(val) && val.length >= 4) {
        colScores[colIdx].name++
      }
    })
  })

  let maxEmail = 0
  let maxPhone = 0
  let maxName = 0
  let maxFinancial = 0

  Object.entries(colScores).forEach(([cStr, scores]) => {
    const colIdx = Number(cStr)
    if (scores.email > maxEmail) {
      maxEmail = scores.email
      emailIdx = colIdx
    }
    if (scores.phone > maxPhone) {
      maxPhone = scores.phone
      phoneIdx = colIdx
    }
    if (scores.name > maxName) {
      maxName = scores.name
      fullNameIdx = colIdx
    }
    if (scores.financial > maxFinancial) {
      maxFinancial = scores.financial
      financialIdx = colIdx
    }
  })

  return { fullNameIdx, emailIdx, phoneIdx, financialIdx }
}

function parseSheetMatrix(
  matrix: unknown[][],
  sheetName: string,
  listId: string,
  baseListName: string,
  totalSheetsCount: number,
): Attendee[] {
  if (matrix.length === 0) return []

  const { headerRowIdx, score } = findHeaderRow(matrix)

  let fullNameIdx = -1
  let firstNameIdx = -1
  let lastNameIdx = -1
  let familyNameIdx = -1
  let emailIdx = -1
  let phoneIdx = -1
  let financialIdx = -1
  let statusIdx = -1
  let idIdx = -1
  let startDataRow = 0

  if (headerRowIdx >= 0 && score >= 2) {
    let rawHeaders = matrix[headerRowIdx].map((c) => String(c || '').trim())

    // Merge headers if next row contains labels in empty cells
    if (headerRowIdx + 1 < matrix.length) {
      const nextRow = matrix[headerRowIdx + 1]
      if (Array.isArray(nextRow)) {
        rawHeaders = rawHeaders.map((h, i) => {
          if (h) return h
          const nextVal = String(nextRow[i] || '').trim()
          const norm = normalizeHeader(nextVal)
          if (
            norm &&
            (EMAIL_KEYS.includes(norm) ||
              FULL_NAME_KEYS.includes(norm) ||
              FAMILY_NAME_KEYS.includes(norm))
          ) {
            return nextVal
          }
          return h
        })
      }
    }

    fullNameIdx = matchColumn(rawHeaders, FULL_NAME_KEYS)
    firstNameIdx = matchColumn(rawHeaders, FIRST_NAME_KEYS)
    lastNameIdx = matchColumn(rawHeaders, LAST_NAME_KEYS)
    familyNameIdx = matchColumn(rawHeaders, FAMILY_NAME_KEYS)
    emailIdx = matchColumn(rawHeaders, EMAIL_KEYS)
    phoneIdx = matchColumn(rawHeaders, PHONE_KEYS)
    financialIdx = matchColumn(rawHeaders, FINANCIAL_KEYS)
    statusIdx = matchColumn(rawHeaders, STATUS_KEYS)
    idIdx = matchColumn(rawHeaders, ID_KEYS)
    startDataRow = headerRowIdx + 1
  } else {
    // Fallback: Infer columns from data content
    const inferred = inferColumnsFromContent(matrix)
    fullNameIdx = inferred.fullNameIdx
    emailIdx = inferred.emailIdx
    phoneIdx = inferred.phoneIdx
    financialIdx = inferred.financialIdx
    startDataRow = 0
  }

  const attendees: Attendee[] = []
  const dataRows = matrix.slice(startDataRow)

  const effectiveListName =
    totalSheetsCount > 1 ? `${baseListName} (${sheetName})` : baseListName

  dataRows.forEach((row, idx) => {
    if (!Array.isArray(row)) return

    const getVal = (i: number) => (i >= 0 && row[i] != null ? String(row[i]).trim() : '')

    let fullName = getVal(fullNameIdx)
    const firstName = getVal(firstNameIdx)
    const lastName = getVal(lastNameIdx)
    const familyName = getVal(familyNameIdx)
    let email = getVal(emailIdx)
    const phone = getVal(phoneIdx)
    const financialMember = getVal(financialIdx)
    const status = getVal(statusIdx)
    const externalId = getVal(idIdx)

    // Filter out rows that duplicate column header text in data cells
    const emailLower = email.toLowerCase()
    const nameLower = fullName.toLowerCase()
    if (
      emailLower === 'email address' ||
      emailLower === 'email' ||
      nameLower === 'full name' ||
      nameLower === 'name'
    ) {
      return
    }

    // Combine first & last name if full name not present (never combine family group name)
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, lastName].filter(Boolean).join(' ')
    }

    // Filter out template / example placeholder rows
    if (nameLower.startsWith('e.g.') || emailLower.startsWith('e.g.') || nameLower.includes('example.com')) {
      return
    }

    // Skip blank or garbage rows
    if (!fullName && !email && !externalId && !phone) return

    // Clean email check (if email field has no @, reset if it's not a real email)
    if (email && !email.includes('@')) {
      email = ''
    }

    // Synthesize display name if missing
    if (!fullName && email) {
      const handle = email.split('@')[0] || ''
      fullName = handle.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    attendees.push({
      id: crypto.randomUUID(),
      fullName: fullName || `Attendee ${idx + 1}`,
      familyName: familyName || '',
      email: email || '',
      status: status || 'Member',
      phone: phone || '',
      financialMember: financialMember || '—',
      externalId: externalId || String(idx + 1),
      present: false,
      listId,
      listName: effectiveListName,
    })
  })

  return attendees
}

function parseWorkbook(
  buffer: ArrayBuffer,
  listId: string = 'default-list',
  baseListName: string = 'Main Roster',
): Attendee[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Workbook has no sheets.')
  }

  const allAttendees: Attendee[] = []
  const totalSheets = workbook.SheetNames.length

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    const parsed = parseSheetMatrix(matrix, sheetName, listId, baseListName, totalSheets)
    allAttendees.push(...parsed)
  }

  if (allAttendees.length === 0) {
    throw new Error('No valid attendee data could be extracted from any sheet in the file.')
  }

  // Deduplicate across sheets within this workbook
  const seen = new Set<string>()
  const deduped: Attendee[] = []

  for (const attendee of allAttendees) {
    const key = attendee.email
      ? attendee.email.toLowerCase()
      : `${attendee.fullName}|${attendee.phone}`.toLowerCase()

    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(attendee)
  }

  return deduped
}

function parseCsvText(
  text: string,
  listId: string = 'default-list',
  listName: string = 'Main Roster',
): Attendee[] {
  const parsed = Papa.parse<unknown[]>(text, {
    header: false,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(parsed.errors[0]?.message || 'Failed to parse CSV.')
  }

  const matrix = parsed.data
  const attendees = parseSheetMatrix(matrix, 'CSV', listId, listName, 1)

  if (attendees.length === 0) {
    throw new Error('No valid attendee rows found in the CSV.')
  }

  return attendees
}

/** Convert common Google Sheets / Excel Online URLs into downloadable candidate URLs.
 *  Prioritizes XLSX format to download all worksheet tabs in one go!
 */
export function getSpreadsheetCandidateUrls(rawUrl: string): string[] {
  const url = rawUrl.trim()

  // Published sheet: https://docs.google.com/spreadsheets/d/e/2PACX-.../pubhtml
  const pubMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/)
  if (pubMatch) {
    const pubId = pubMatch[1]
    return [
      `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=xlsx`,
      `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv`,
      url,
    ]
  }

  // Standard sheet: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (sheetsMatch) {
    const id = sheetsMatch[1]
    const gidMatch = url.match(/[#&?]gid=([0-9]+)/)
    const gid = gidMatch?.[1]

    const candidates = [
      `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
    ]

    if (gid) {
      candidates.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`)
      candidates.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`)
    } else {
      candidates.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`)
      candidates.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`)
    }

    return candidates
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
      'This Google Sheet is private or requires login. Please open the sheet in Google Sheets, click "Share" → set Access to "Anyone with the link" (Viewer), or download as XLSX/CSV and upload the file.',
    )
  }

  throw new Error(
    'Could not access the spreadsheet URL (CORS/Network error). Ensure sheet sharing is set to "Anyone with the link", or click "File → Download → XLSX or CSV" in Google Sheets and upload the file.',
  )
}

export async function parseSpreadsheetUrl(
  rawUrl: string,
  listId: string = 'link-list',
  listName: string = 'Google Sheet Link',
): Promise<Attendee[]> {
  const { buffer, contentType } = await fetchSpreadsheetBytes(rawUrl)

  // Try parsing as workbook first if it's binary / xlsx / zip format or standard workbook
  try {
    return parseWorkbook(buffer, listId, listName)
  } catch (err) {
    if (
      contentType.includes('spreadsheet') ||
      contentType.includes('excel') ||
      rawUrl.toLowerCase().includes('.xlsx') ||
      rawUrl.toLowerCase().includes('.xls')
    ) {
      throw err
    }
    // Fall back to CSV text parsing if workbook reading fails
    const text = new TextDecoder().decode(buffer)
    return parseCsvText(text, listId, listName)
  }
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
    'FULL NAME ( SURNAME FIRST )': a.fullName,
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
    'FULL NAME ( SURNAME FIRST )': a.fullName,
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
    { wch: 30 }, // FULL NAME ( SURNAME FIRST )
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
