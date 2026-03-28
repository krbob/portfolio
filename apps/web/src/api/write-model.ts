import type { components } from './generated/portfolio-api'
import { requestEmpty, requestJson, requestResponse } from './http'

export type Account =
  components['schemas']['AccountResponse']

export type Instrument =
  components['schemas']['InstrumentResponse']

export type Transaction =
  components['schemas']['TransactionResponse']

export type CreateAccountPayload =
  components['schemas']['CreateAccountRequest']

export type CreateInstrumentPayload =
  components['schemas']['CreateInstrumentRequest']

export type CreateTransactionPayload =
  components['schemas']['CreateTransactionRequest']

export interface UpdateTransactionPayload extends CreateTransactionPayload {
  id: string
}

export type ImportTransactionsPayload =
  components['schemas']['ImportTransactionsRequest']

export type ImportTransactionsResult =
  components['schemas']['ImportTransactionsResponse']

export type ImportTransactionsPreviewResult =
  components['schemas']['ImportTransactionsPreviewResponse']

export type ImportTransactionsPreviewRow =
  components['schemas']['ImportTransactionsPreviewRowResponse']

export type TransactionImportProfile =
  components['schemas']['TransactionImportProfileResponse']

export type TransactionImportHeaderMappings =
  components['schemas']['TransactionImportHeaderMappingsRequest']

export type TransactionImportDefaults =
  components['schemas']['TransactionImportDefaultsRequest']

export type SaveTransactionImportProfilePayload =
  components['schemas']['SaveTransactionImportProfileRequest']

export interface UpdateTransactionImportProfilePayload extends SaveTransactionImportProfilePayload {
  id: string
}

export type CsvTransactionsImportPayload =
  components['schemas']['CsvTransactionsImportRequest']

export type PortfolioStateSnapshot =
  components['schemas']['PortfolioSnapshotResponse']

export type ImportPortfolioStatePayload =
  components['schemas']['ImportPortfolioStateRequest']

export type PortfolioImportIssue =
  components['schemas']['PortfolioImportIssueResponse']

export type PreviewPortfolioStateImportResult =
  components['schemas']['PortfolioImportPreviewResponse']

export type ImportPortfolioStateResult =
  components['schemas']['PortfolioImportResultResponse']

export type PortfolioBackupRecord =
  components['schemas']['PortfolioBackupRecordResponse']

export type PortfolioBackupStatus =
  components['schemas']['PortfolioBackupStatusResponse']

export type RestorePortfolioBackupPayload =
  components['schemas']['RestorePortfolioBackupRequest']

export type RestorePortfolioBackupResult =
  components['schemas']['PortfolioBackupRestoreResultResponse']

export type PortfolioTarget =
  components['schemas']['PortfolioTargetResponse']

export type ReplacePortfolioTargetsPayload =
  components['schemas']['ReplacePortfolioTargetsRequest']

export type PortfolioBenchmarkSettings =
  components['schemas']['PortfolioBenchmarkSettingsResponse']

export type BenchmarkOption =
  components['schemas']['BenchmarkOptionResponse']

export type SavePortfolioBenchmarkSettingsPayload =
  components['schemas']['SavePortfolioBenchmarkSettingsRequest']

export type PortfolioRebalancingSettings =
  components['schemas']['PortfolioRebalancingSettingsResponse']

export type SavePortfolioRebalancingSettingsPayload =
  components['schemas']['SavePortfolioRebalancingSettingsRequest']

export type ReadModelRefreshStatus =
  components['schemas']['ReadModelRefreshStatusResponse']

export type ReadModelRefreshRunResult =
  components['schemas']['ReadModelRefreshRunResponse']

export interface ReadModelCacheInvalidationResult {
  clearedSnapshotCount: number
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

export interface UpdateInstrumentPayload {
  id: string
  name: string
  symbol?: string | null
  currency: string
  valuationSource: string
  edoTerms?: { seriesMonth: string; firstPeriodRateBps: number; marginBps: number } | null
}

export function updateInstrument(payload: UpdateInstrumentPayload) {
  const { id, ...body } = payload
  return requestJson<Instrument>(`/api/v1/instruments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
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
  await requestEmpty(`/api/v1/transactions/${id}`, {
    method: 'DELETE',
  })
}

export function importTransactions(payload: ImportTransactionsPayload) {
  return requestJson<ImportTransactionsResult>('/api/v1/transactions/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function previewTransactionsImport(payload: ImportTransactionsPayload) {
  return requestJson<ImportTransactionsPreviewResult>('/api/v1/transactions/import/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listTransactionImportProfiles() {
  return requestJson<TransactionImportProfile[]>('/api/v1/transactions/import/profiles')
}

export function createTransactionImportProfile(payload: SaveTransactionImportProfilePayload) {
  return requestJson<TransactionImportProfile>('/api/v1/transactions/import/profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTransactionImportProfile(payload: UpdateTransactionImportProfilePayload) {
  const { id, ...body } = payload
  return requestJson<TransactionImportProfile>(`/api/v1/transactions/import/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteTransactionImportProfile(id: string) {
  await requestEmpty(`/api/v1/transactions/import/profiles/${id}`, {
    method: 'DELETE',
  })
}

export function previewTransactionsCsvImport(payload: CsvTransactionsImportPayload) {
  return requestJson<ImportTransactionsPreviewResult>('/api/v1/transactions/import/csv/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function importTransactionsCsv(payload: CsvTransactionsImportPayload) {
  return requestJson<ImportTransactionsResult>('/api/v1/transactions/import/csv', {
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

export function getPortfolioBenchmarkSettings() {
  return requestJson<PortfolioBenchmarkSettings>('/api/v1/portfolio/benchmark-settings')
}

export function savePortfolioBenchmarkSettings(payload: SavePortfolioBenchmarkSettingsPayload) {
  return requestJson<PortfolioBenchmarkSettings>('/api/v1/portfolio/benchmark-settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getPortfolioRebalancingSettings() {
  return requestJson<PortfolioRebalancingSettings>('/api/v1/portfolio/rebalancing-settings')
}

export function savePortfolioRebalancingSettings(payload: SavePortfolioRebalancingSettingsPayload) {
  return requestJson<PortfolioRebalancingSettings>('/api/v1/portfolio/rebalancing-settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function invalidateReadModelCache() {
  return requestJson<ReadModelCacheInvalidationResult>('/api/v1/portfolio/read-model-cache/invalidate', {
    method: 'POST',
  })
}

export function getReadModelRefreshStatus() {
  return requestJson<ReadModelRefreshStatus>('/api/v1/portfolio/read-model-refresh')
}

export function runReadModelRefresh() {
  return requestJson<ReadModelRefreshRunResult>('/api/v1/portfolio/read-model-refresh/run', {
    method: 'POST',
  })
}

export async function downloadPortfolioBackup(fileName: string) {
  const response = await requestResponse(
    `/api/v1/portfolio/backups/download?fileName=${encodeURIComponent(fileName)}`,
    { contentType: null },
  )

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
