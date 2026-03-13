export interface Account {
  id: string
  name: string
  institution: string
  type: string
  baseCurrency: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Instrument {
  id: string
  name: string
  kind: string
  assetClass: string
  symbol: string | null
  currency: string
  valuationSource: string
  edoTerms: {
    purchaseDate: string
    firstPeriodRateBps: number
    marginBps: number
    principalUnits: number
    maturityDate: string
  } | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  accountId: string
  instrumentId: string | null
  type: string
  tradeDate: string
  settlementDate: string | null
  quantity: string | null
  unitPrice: string | null
  grossAmount: string
  feeAmount: string
  taxAmount: string
  currency: string
  fxRateToPln: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CreateAccountPayload {
  name: string
  institution: string
  type: string
  baseCurrency: string
}

export interface CreateInstrumentPayload {
  name: string
  kind: string
  assetClass: string
  symbol?: string | null
  currency: string
  valuationSource: string
  edoTerms?: {
    purchaseDate: string
    firstPeriodRateBps: number
    marginBps: number
    principalUnits: number
    maturityDate: string
  } | null
}

export interface CreateTransactionPayload {
  accountId: string
  instrumentId?: string | null
  type: string
  tradeDate: string
  settlementDate?: string | null
  quantity?: string | null
  unitPrice?: string | null
  grossAmount: string
  feeAmount?: string
  taxAmount?: string
  currency: string
  fxRateToPln?: string | null
  notes?: string
}

export interface UpdateTransactionPayload extends CreateTransactionPayload {
  id: string
}

export interface ImportTransactionsPayload {
  rows: CreateTransactionPayload[]
}

export interface ImportTransactionsResult {
  createdCount: number
  transactions: Transaction[]
}

export interface PortfolioStateSnapshot {
  schemaVersion: number
  exportedAt: string
  accounts: Array<{
    id: string
    name: string
    institution: string
    type: string
    baseCurrency: string
    isActive: boolean
    createdAt: string
    updatedAt: string
  }>
  instruments: Array<{
    id: string
    name: string
    kind: string
    assetClass: string
    symbol: string | null
    currency: string
    valuationSource: string
    edoTerms: {
      purchaseDate: string
      firstPeriodRateBps: number
      marginBps: number
      principalUnits: number
      maturityDate: string
    } | null
    isActive: boolean
    createdAt: string
    updatedAt: string
  }>
  transactions: Array<{
    id: string
    accountId: string
    instrumentId: string | null
    type: string
    tradeDate: string
    settlementDate: string | null
    quantity: string | null
    unitPrice: string | null
    grossAmount: string
    feeAmount: string
    taxAmount: string
    currency: string
    fxRateToPln: string | null
    notes: string
    createdAt: string
    updatedAt: string
  }>
}

export interface ImportPortfolioStatePayload {
  mode: 'MERGE' | 'REPLACE'
  snapshot: PortfolioStateSnapshot
}

export interface PortfolioImportIssue {
  severity: 'ERROR' | 'WARNING'
  code: string
  message: string
}

export interface PreviewPortfolioStateImportResult {
  mode: 'MERGE' | 'REPLACE'
  schemaVersion: number
  isValid: boolean
  snapshotAccountCount: number
  snapshotInstrumentCount: number
  snapshotTransactionCount: number
  existingAccountCount: number
  existingInstrumentCount: number
  existingTransactionCount: number
  matchingAccountCount: number
  matchingInstrumentCount: number
  matchingTransactionCount: number
  blockingIssueCount: number
  warningCount: number
  issues: PortfolioImportIssue[]
}

export interface ImportPortfolioStateResult {
  mode: 'MERGE' | 'REPLACE'
  accountCount: number
  instrumentCount: number
  transactionCount: number
}

export interface PortfolioBackupRecord {
  fileName: string
  createdAt: string
  exportedAt: string | null
  sizeBytes: number
  schemaVersion: number | null
  accountCount: number | null
  instrumentCount: number | null
  transactionCount: number | null
  isReadable: boolean
  errorMessage: string | null
}

export interface PortfolioBackupStatus {
  schedulerEnabled: boolean
  directory: string
  intervalMinutes: number
  retentionCount: number
  running: boolean
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
  backups: PortfolioBackupRecord[]
}

export interface RestorePortfolioBackupPayload {
  fileName: string
  mode: 'MERGE' | 'REPLACE'
}

export interface RestorePortfolioBackupResult {
  fileName: string
  mode: 'MERGE' | 'REPLACE'
  accountCount: number
  instrumentCount: number
  transactionCount: number
}

export interface PortfolioTarget {
  id: string
  assetClass: 'EQUITIES' | 'BONDS' | 'CASH'
  targetWeight: string
  createdAt: string
  updatedAt: string
}

export interface ReplacePortfolioTargetsPayload {
  items: Array<{
    assetClass: 'EQUITIES' | 'BONDS' | 'CASH'
    targetWeight: string
  }>
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // Keep generic fallback.
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function listAccounts() {
  return requestJson<Account[]>('/api/v1/accounts')
}

export function createAccount(payload: CreateAccountPayload) {
  return requestJson<Account>('/api/v1/accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listInstruments() {
  return requestJson<Instrument[]>('/api/v1/instruments')
}

export function createInstrument(payload: CreateInstrumentPayload) {
  return requestJson<Instrument>('/api/v1/instruments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listTransactions() {
  return requestJson<Transaction[]>('/api/v1/transactions')
}

export function createTransaction(payload: CreateTransactionPayload) {
  return requestJson<Transaction>('/api/v1/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTransaction(payload: UpdateTransactionPayload) {
  const { id, ...body } = payload
  return requestJson<Transaction>(`/api/v1/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteTransaction(id: string) {
  const response = await fetch(`/api/v1/transactions/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // Keep generic fallback.
    }
    throw new Error(message)
  }
}

export function importTransactions(payload: ImportTransactionsPayload) {
  return requestJson<ImportTransactionsResult>('/api/v1/transactions/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function exportPortfolioState() {
  return requestJson<PortfolioStateSnapshot>('/api/v1/portfolio/state/export')
}

export function listPortfolioBackups() {
  return requestJson<PortfolioBackupStatus>('/api/v1/portfolio/backups')
}

export function listPortfolioTargets() {
  return requestJson<PortfolioTarget[]>('/api/v1/portfolio/targets')
}

export function replacePortfolioTargets(payload: ReplacePortfolioTargetsPayload) {
  return requestJson<PortfolioTarget[]>('/api/v1/portfolio/targets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function downloadPortfolioBackup(fileName: string) {
  const response = await fetch(`/api/v1/portfolio/backups/download?fileName=${encodeURIComponent(fileName)}`)

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // Keep generic fallback.
    }
    throw new Error(message)
  }

  const suggestedFileName = extractFileName(response.headers.get('Content-Disposition')) ?? fileName
  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = suggestedFileName
  document.body.append(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)

  return suggestedFileName
}

export function runPortfolioBackup() {
  return requestJson<PortfolioBackupRecord>('/api/v1/portfolio/backups/run', {
    method: 'POST',
  })
}

export function restorePortfolioBackup(payload: RestorePortfolioBackupPayload) {
  return requestJson<RestorePortfolioBackupResult>('/api/v1/portfolio/backups/restore', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function previewPortfolioStateImport(payload: ImportPortfolioStatePayload) {
  return requestJson<PreviewPortfolioStateImportResult>('/api/v1/portfolio/state/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function importPortfolioState(payload: ImportPortfolioStatePayload) {
  return requestJson<ImportPortfolioStateResult>('/api/v1/portfolio/state/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

function extractFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null
  }

  const match = /filename="?([^"]+)"?/i.exec(contentDisposition)
  return match?.[1] ?? null
}
