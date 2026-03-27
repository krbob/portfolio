import type {
  ImportTransactionsPayload,
  ImportTransactionsPreviewResult,
  SaveTransactionImportProfilePayload,
  TransactionImportProfile,
} from '../../api/write-model'
import { getActiveUiLanguage } from '../../lib/i18n'
import { t } from '../../lib/messages'

export type { ImportTransactionsPayload, ImportTransactionsPreviewResult, SaveTransactionImportProfilePayload }
export type { Transaction, TransactionImportProfile } from '../../api/write-model'

export const today = new Date().toISOString().slice(0, 10)
export const transactionTypes = ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'REDEEM', 'FEE', 'TAX', 'INTEREST', 'CORRECTION'] as const
export const NEW_IMPORT_PROFILE_ID = '__new_import_profile__'
export const STRUCTURED_IMPORT_TEMPLATE = `[
  {
    "accountId": "00000000-0000-0000-0000-000000000001",
    "instrumentId": "00000000-0000-0000-0000-000000000002",
    "type": "BUY",
    "tradeDate": "2026-03-18",
    "settlementDate": "2026-03-20",
    "quantity": "2",
    "unitPrice": "123.45",
    "grossAmount": "246.90",
    "feeAmount": "1.20",
    "taxAmount": "0",
    "currency": "EUR",
    "fxRateToPln": "4.2711",
    "notes": "Canonical JSON import"
  }
]`

export const initialForm = {
  accountId: '',
  instrumentId: '',
  type: 'DEPOSIT',
  tradeDate: today,
  settlementDate: today,
  quantity: '',
  unitPrice: '',
  grossAmount: '',
  feeAmount: '0',
  taxAmount: '0',
  currency: 'PLN',
  fxRateToPln: '',
  notes: '',
}

export type TransactionFormState = typeof initialForm

export const initialJournalFilters = {
  search: '',
  accountId: 'ALL',
  instrumentId: 'ALL',
  type: 'ALL',
  currency: 'ALL',
  sort: 'tradeDate-desc',
  pageSize: '10',
}

export type JournalFilters = typeof initialJournalFilters

export type ImportMappingField =
  | 'account'
  | 'type'
  | 'tradeDate'
  | 'settlementDate'
  | 'instrument'
  | 'quantity'
  | 'unitPrice'
  | 'grossAmount'
  | 'feeAmount'
  | 'taxAmount'
  | 'currency'
  | 'fxRateToPln'
  | 'notes'

export interface ImportProfileFormState {
  name: string
  description: string
  delimiter: string
  dateFormat: string
  decimalSeparator: string
  skipDuplicatesByDefault: boolean
  headerMappings: Record<ImportMappingField, string>
  defaults: {
    accountId: string
    currency: string
  }
}

export interface JournalRow {
  transaction: import('../../api/write-model').Transaction
  accountName: string
  instrumentName: string | null
  instrumentSymbol: string | null
}

export type TransactionsWorkspace = 'journal' | 'import' | 'profiles'
export type ImportBatchMode = 'csv' | 'structured'
export type ImportPreviewStatusFilter =
  | 'ALL'
  | 'IMPORTABLE'
  | 'DUPLICATE_EXISTING'
  | 'DUPLICATE_BATCH'
  | 'INVALID'

export const importMappingFields: Array<{
  key: ImportMappingField
  label: string
  placeholder: string
  required?: boolean
}> = [
  { key: 'account', label: 'Account column', placeholder: 'account' },
  { key: 'type', label: 'Type column', placeholder: 'type', required: true },
  { key: 'tradeDate', label: 'Trade date column', placeholder: 'tradeDate', required: true },
  { key: 'settlementDate', label: 'Settlement date column', placeholder: 'settlementDate' },
  { key: 'instrument', label: 'Instrument column', placeholder: 'instrument' },
  { key: 'quantity', label: 'Quantity column', placeholder: 'quantity' },
  { key: 'unitPrice', label: 'Unit price column', placeholder: 'unitPrice' },
  { key: 'grossAmount', label: 'Gross amount column', placeholder: 'grossAmount', required: true },
  { key: 'feeAmount', label: 'Fee column', placeholder: 'feeAmount' },
  { key: 'taxAmount', label: 'Tax column', placeholder: 'taxAmount' },
  { key: 'currency', label: 'Currency column', placeholder: 'currency' },
  { key: 'fxRateToPln', label: 'FX to PLN column', placeholder: 'fxRateToPln' },
  { key: 'notes', label: 'Notes column', placeholder: 'notes' },
]

export function createInitialImportProfileForm(): ImportProfileFormState {
  return {
    name: t('txHelpers.defaultProfileName'),
    description: t('txHelpers.defaultProfileDescription'),
    delimiter: 'COMMA',
    dateFormat: 'ISO_LOCAL_DATE',
    decimalSeparator: 'DOT',
    skipDuplicatesByDefault: true,
    headerMappings: {
      account: 'account',
      type: 'type',
      tradeDate: 'tradeDate',
      settlementDate: 'settlementDate',
      instrument: 'instrument',
      quantity: 'quantity',
      unitPrice: 'unitPrice',
      grossAmount: 'grossAmount',
      feeAmount: 'feeAmount',
      taxAmount: 'taxAmount',
      currency: 'currency',
      fxRateToPln: 'fxRateToPln',
      notes: 'notes',
    },
    defaults: {
      accountId: '',
      currency: '',
    },
  }
}

export function importProfileToForm(profile: TransactionImportProfile): ImportProfileFormState {
  return {
    name: profile.name,
    description: profile.description,
    delimiter: profile.delimiter,
    dateFormat: profile.dateFormat,
    decimalSeparator: profile.decimalSeparator,
    skipDuplicatesByDefault: profile.skipDuplicatesByDefault,
    headerMappings: {
      account: profile.headerMappings.account ?? '',
      type: profile.headerMappings.type ?? '',
      tradeDate: profile.headerMappings.tradeDate ?? '',
      settlementDate: profile.headerMappings.settlementDate ?? '',
      instrument: profile.headerMappings.instrument ?? '',
      quantity: profile.headerMappings.quantity ?? '',
      unitPrice: profile.headerMappings.unitPrice ?? '',
      grossAmount: profile.headerMappings.grossAmount ?? '',
      feeAmount: profile.headerMappings.feeAmount ?? '',
      taxAmount: profile.headerMappings.taxAmount ?? '',
      currency: profile.headerMappings.currency ?? '',
      fxRateToPln: profile.headerMappings.fxRateToPln ?? '',
      notes: profile.headerMappings.notes ?? '',
    },
    defaults: {
      accountId: profile.defaults.accountId ?? '',
      currency: profile.defaults.currency ?? '',
    },
  }
}

export function buildImportProfilePayload(form: ImportProfileFormState): SaveTransactionImportProfilePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    delimiter: form.delimiter,
    dateFormat: form.dateFormat,
    decimalSeparator: form.decimalSeparator,
    skipDuplicatesByDefault: form.skipDuplicatesByDefault,
    headerMappings: {
      account: normalizeOptionalValue(form.headerMappings.account),
      type: normalizeOptionalValue(form.headerMappings.type),
      tradeDate: normalizeOptionalValue(form.headerMappings.tradeDate),
      settlementDate: normalizeOptionalValue(form.headerMappings.settlementDate),
      instrument: normalizeOptionalValue(form.headerMappings.instrument),
      quantity: normalizeOptionalValue(form.headerMappings.quantity),
      unitPrice: normalizeOptionalValue(form.headerMappings.unitPrice),
      grossAmount: normalizeOptionalValue(form.headerMappings.grossAmount),
      feeAmount: normalizeOptionalValue(form.headerMappings.feeAmount),
      taxAmount: normalizeOptionalValue(form.headerMappings.taxAmount),
      currency: normalizeOptionalValue(form.headerMappings.currency),
      fxRateToPln: normalizeOptionalValue(form.headerMappings.fxRateToPln),
      notes: normalizeOptionalValue(form.headerMappings.notes),
    },
    defaults: {
      accountId: normalizeOptionalValue(form.defaults.accountId),
      currency: normalizeOptionalValue(form.defaults.currency)?.toUpperCase() ?? null,
    },
  }
}

export function parseStructuredImportPayload(raw: string, skipDuplicates: boolean): ImportTransactionsPayload {
  const trimmed = raw.trim()
  if (trimmed === '') {
    throw new Error(t('txHelpers.pasteJsonFirst'))
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(t('txHelpers.invalidJson'))
  }

  if (Array.isArray(parsed)) {
    return {
      skipDuplicates,
      rows: parsed as ImportTransactionsPayload['rows'],
    }
  }

  if (typeof parsed === 'object' && parsed !== null && 'rows' in parsed) {
    const rows = (parsed as { rows?: unknown }).rows
    if (!Array.isArray(rows)) {
      throw new Error(t('txHelpers.rowsArrayRequired'))
    }

    return {
      skipDuplicates,
      rows: rows as ImportTransactionsPayload['rows'],
    }
  }

  throw new Error(t('txHelpers.invalidPayloadShape'))
}

export function normalizeOptionalValue(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function serializeImportProfilePayload(payload: SaveTransactionImportProfilePayload) {
  return JSON.stringify(payload)
}

export function buildImportProfileTemplate(form: ImportProfileFormState): string {
  const isPolish = getActiveUiLanguage() === 'pl'
  const delimiter = delimiterCharacter(form.delimiter)
  const mappedFields = getImportMappingFields(isPolish).filter((field) => form.headerMappings[field.key].trim() !== '')
  if (mappedFields.length === 0) {
    return t('txHelpers.mapAtLeastOneColumn')
  }

  const headers = mappedFields.map((field) => form.headerMappings[field.key].trim())
  const row = mappedFields.map((field) => escapeCsvCell(delimiter, exampleValueForField(field.key, form)))

  return `${headers.map((header) => escapeCsvCell(delimiter, header)).join(delimiter)}\n${row.join(delimiter)}`
}

export function exampleValueForField(field: ImportMappingField, form: ImportProfileFormState) {
  switch (field) {
    case 'account':
      return 'Primary'
    case 'type':
      return 'BUY'
    case 'tradeDate':
      return formatExampleDate(form.dateFormat)
    case 'settlementDate':
      return formatExampleDate(form.dateFormat)
    case 'instrument':
      return 'VWRA.L'
    case 'quantity':
      return formatExampleDecimal('2.5', form.decimalSeparator)
    case 'unitPrice':
      return formatExampleDecimal('123.45', form.decimalSeparator)
    case 'grossAmount':
      return formatExampleDecimal('308.63', form.decimalSeparator)
    case 'feeAmount':
      return formatExampleDecimal('1.20', form.decimalSeparator)
    case 'taxAmount':
      return formatExampleDecimal('0', form.decimalSeparator)
    case 'currency':
      return form.defaults.currency.trim() || 'USD'
    case 'fxRateToPln':
      return formatExampleDecimal('4.0123', form.decimalSeparator)
    case 'notes':
      return t('txHelpers.exampleNotes')
    default:
      return ''
  }
}

export function formatExampleDate(format: string) {
  switch (format) {
    case 'DMY_DOTS':
      return '14.03.2026'
    case 'DMY_SLASH':
      return '14/03/2026'
    case 'MDY_SLASH':
      return '03/14/2026'
    case 'ISO_LOCAL_DATE':
    default:
      return '2026-03-14'
  }
}

export function formatExampleDecimal(value: string, decimalSeparator: string) {
  return decimalSeparator === 'COMMA' ? value.replace('.', ',') : value
}

export function delimiterCharacter(delimiter: string) {
  switch (delimiter) {
    case 'SEMICOLON':
      return ';'
    case 'TAB':
      return '\t'
    case 'COMMA':
    default:
      return ','
  }
}

export function escapeCsvCell(delimiter: string, value: string) {
  if (value.includes('"') || value.includes('\n') || value.includes('\r') || value.includes(delimiter)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

export function buildImportResultMessage(createdCount: number, skippedDuplicateCount: number) {
  const isPolish = getActiveUiLanguage() === 'pl'
  if (skippedDuplicateCount === 0) {
    return isPolish
      ? `Zaimportowano ${createdCount} transakcji.`
      : `Imported ${createdCount} transactions.`
  }

  return isPolish
    ? `Zaimportowano ${createdCount} transakcji i pominięto ${skippedDuplicateCount} duplikatów.`
    : `Imported ${createdCount} transactions and skipped ${skippedDuplicateCount} duplicates.`
}

export function buildImportPreviewSummary(
  preview: ImportTransactionsPreviewResult,
  skipDuplicates: boolean,
) {
  const isPolish = getActiveUiLanguage() === 'pl'
  if (preview.invalidRowCount > 0) {
    return skipDuplicates
      ? isPolish
        ? `${preview.invalidRowCount} błędnych wierszy nadal blokuje import. Duplikaty można pominąć automatycznie, ale błędne wiersze trzeba najpierw poprawić.`
        : `${preview.invalidRowCount} invalid rows still block the import. Duplicate rows can be skipped automatically, but invalid rows must be fixed first.`
      : isPolish
        ? `${preview.invalidRowCount} błędnych wierszy i ${preview.duplicateRowCount} duplikatów blokuje obecnie import.`
        : `${preview.invalidRowCount} invalid rows and ${preview.duplicateRowCount} duplicate rows currently block the import.`
  }

  if (preview.duplicateRowCount > 0) {
    return skipDuplicates
      ? isPolish
        ? `${preview.duplicateRowCount} duplikatów zostanie pominiętych, jeśli będziesz kontynuować.`
        : `${preview.duplicateRowCount} duplicate rows will be skipped if you continue.`
      : isPolish
        ? `${preview.duplicateRowCount} duplikatów blokuje obecnie import. Włącz pomijanie duplikatów albo popraw paczkę.`
        : `${preview.duplicateRowCount} duplicate rows currently block the import. Enable duplicate skipping or adjust the batch.`
  }

  return isPolish
    ? 'Wszystkie wiersze nadają się do importu. Możesz bezpiecznie zatwierdzić tę paczkę.'
    : 'All rows are importable. You can safely commit this batch.'
}

export function getImportMappingFields(isPolish: boolean) {
  return importMappingFields.map((field) => ({
    ...field,
    label: translateImportMappingLabel(field.key, isPolish),
  }))
}

export function translateImportMappingLabel(field: ImportMappingField, isPolish: boolean) {
  if (!isPolish) {
    return importMappingFields.find((candidate) => candidate.key === field)?.label ?? field
  }

  switch (field) {
    case 'account':
      return 'Kolumna konta'
    case 'type':
      return 'Kolumna typu'
    case 'tradeDate':
      return 'Kolumna daty transakcji'
    case 'settlementDate':
      return 'Kolumna daty rozliczenia'
    case 'instrument':
      return 'Kolumna instrumentu'
    case 'quantity':
      return 'Kolumna liczby sztuk'
    case 'unitPrice':
      return 'Kolumna ceny jednostkowej'
    case 'grossAmount':
      return 'Kolumna kwoty brutto'
    case 'feeAmount':
      return 'Kolumna prowizji'
    case 'taxAmount':
      return 'Kolumna podatku'
    case 'currency':
      return 'Kolumna waluty'
    case 'fxRateToPln':
      return 'Kolumna kursu FX do PLN'
    case 'notes':
      return 'Kolumna notatek'
    default:
      return field
  }
}

export function importPreviewBadgeVariant(status: string) {
  switch (status) {
    case 'IMPORTABLE':
      return 'bg-emerald-500/15 text-emerald-400'
    case 'DUPLICATE_EXISTING':
    case 'DUPLICATE_BATCH':
      return 'bg-amber-500/15 text-amber-400'
    case 'INVALID':
      return 'bg-red-500/15 text-red-400'
    default:
      return 'bg-zinc-800 text-zinc-400'
  }
}

export function compareJournalRows(left: JournalRow, right: JournalRow, sort: string) {
  switch (sort) {
    case 'tradeDate-asc':
      return compareStrings(left.transaction.tradeDate, right.transaction.tradeDate)
    case 'grossAmount-desc':
      return compareNumbers(right.transaction.grossAmount, left.transaction.grossAmount)
    case 'grossAmount-asc':
      return compareNumbers(left.transaction.grossAmount, right.transaction.grossAmount)
    case 'type-asc':
      return compareStrings(left.transaction.type, right.transaction.type)
    case 'account-asc':
      return compareStrings(left.accountName, right.accountName)
    case 'createdAt-desc':
      return compareStrings(right.transaction.createdAt, left.transaction.createdAt)
    case 'tradeDate-desc':
    default:
      return compareStrings(right.transaction.tradeDate, left.transaction.tradeDate)
  }
}

export function compareStrings(left: string, right: string) {
  return left.localeCompare(right)
}

export function compareNumbers(left: string, right: string) {
  return Number(left) - Number(right)
}

export function compareAccountsByDisplayOrder(
  left: { displayOrder?: number; createdAt: string; name: string },
  right: { displayOrder?: number; createdAt: string; name: string },
) {
  const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt)
  }

  return left.name.localeCompare(right.name)
}

export function compareInstrumentsByName(
  left: { name: string; symbol?: string | null },
  right: { name: string; symbol?: string | null },
) {
  const nameComparison = left.name.localeCompare(right.name)
  if (nameComparison !== 0) {
    return nameComparison
  }

  return (left.symbol ?? '').localeCompare(right.symbol ?? '')
}

export function compareEdoLotsByPurchaseDate(
  left: { purchaseDate: string },
  right: { purchaseDate: string },
) {
  return left.purchaseDate.localeCompare(right.purchaseDate)
}

export function normalizeDecimalInput(value: string): string {
  return value.trim().replace(',', '.')
}

export function normalizeIntegerInput(value: string): string {
  const normalized = value.trim().replace(',', '.')
  const match = normalized.match(/^\d+/)
  return match?.[0] ?? ''
}

export function normalizeDecimalForPayload(value: string): string {
  return normalizeDecimalInput(value)
}

export function normalizeOptionalDecimalForPayload(value: string): string | null {
  const normalized = normalizeDecimalInput(value)
  return normalized === '' ? null : normalized
}

export function multiplyDecimalInputs(left: string, right: string, decimalSeparator: '.' | ','): string {
  const leftParts = parseDecimalParts(normalizeDecimalInput(left))
  const rightParts = parseDecimalParts(normalizeDecimalInput(right))

  if (leftParts == null || rightParts == null) {
    return ''
  }

  const unscaled = leftParts.unscaled * rightParts.unscaled
  const scale = leftParts.scale + rightParts.scale
  return formatDecimalInput(unscaled, scale, decimalSeparator, 2)
}

export function buildRedeemPreview(
  lots: Array<{ purchaseDate: string; quantity: string | number }>,
  requestedQuantityRaw: string,
) {
  const requestedQuantity = toWholeUnits(requestedQuantityRaw)
  const byPurchaseDate = new Map<
    string,
    {
      consumedQuantity: number
      remainingQuantity: number
    }
  >()
  let remaining = requestedQuantity
  let totalAvailableQuantity = 0

  for (const lot of lots) {
    const availableQuantity = toWholeUnits(lot.quantity)
    totalAvailableQuantity += availableQuantity

    const consumedQuantity = Math.min(remaining, availableQuantity)
    const remainingQuantity = Math.max(availableQuantity - consumedQuantity, 0)
    byPurchaseDate.set(lot.purchaseDate, {
      consumedQuantity,
      remainingQuantity,
    })
    remaining = Math.max(remaining - consumedQuantity, 0)
  }

  return {
    requestedQuantity,
    totalAvailableQuantity,
    unmatchedQuantity: remaining,
    byPurchaseDate,
  }
}

export function toWholeUnits(value: string | number | null | undefined) {
  const amount =
    typeof value === 'number'
      ? value
      : Number(normalizeDecimalInput(value == null ? '' : String(value)))

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0
  }

  return Math.trunc(amount)
}

export function parseDecimalParts(value: string): { unscaled: bigint; scale: number } | null {
  if (value === '' || !/^[+-]?\d*(?:\.\d*)?$/.test(value)) {
    return null
  }

  const negative = value.startsWith('-')
  const unsignedValue = negative || value.startsWith('+') ? value.slice(1) : value
  const [integerPart = '', fractionalPart = ''] = unsignedValue.split('.')
  const digits = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, '')

  if (digits === '') {
    return null
  }

  const magnitude = BigInt(digits)
  return {
    unscaled: negative ? -magnitude : magnitude,
    scale: fractionalPart.length,
  }
}

export function formatDecimalInput(
  unscaled: bigint,
  scale: number,
  decimalSeparator: '.' | ',',
  minimumFractionDigits: number,
): string {
  const negative = unscaled < 0n
  const magnitude = negative ? -unscaled : unscaled
  const digits = magnitude.toString()
  const paddedDigits = scale > 0 ? digits.padStart(scale + 1, '0') : digits
  const integerPart = scale > 0 ? paddedDigits.slice(0, -scale) : paddedDigits
  let fractionalPart = scale > 0 ? paddedDigits.slice(-scale) : ''

  while (fractionalPart.length > minimumFractionDigits && fractionalPart.endsWith('0')) {
    fractionalPart = fractionalPart.slice(0, -1)
  }

  if (fractionalPart.length < minimumFractionDigits) {
    fractionalPart = fractionalPart.padEnd(minimumFractionDigits, '0')
  }

  const sign = negative ? '-' : ''
  if (fractionalPart.length === 0) {
    return `${sign}${integerPart}`
  }

  return `${sign}${integerPart}${decimalSeparator}${fractionalPart}`
}
