import type { PortfolioHolding } from '../../api/read-model'
import type { Instrument } from '../../api/write-model'
import { getActiveUiLanguage } from '../../lib/i18n'
import { labelAssetClass, labelInstrumentKind, labelValuationSource } from '../../lib/labels'
import { t } from '../../lib/messages'
import { parsePortfolioNumber } from '../../lib/portfolio-presentation'
import { badgeVariants } from '../../lib/styles'
import { isMarketValuedStatus } from '../../lib/valuation'

export type SortField =
  | 'instrumentName'
  | 'catalog'
  | 'accountCount'
  | 'quantity'
  | 'totalCurrentValuePln'
  | 'totalUnrealizedGainPln'
  | 'status'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  field: SortField
  direction: SortDirection
}

export const defaultSort: SortState = { field: 'instrumentName', direction: 'asc' }

export interface InstrumentRow {
  instrument: Instrument
  accountCount: number
  holdingCount: number
  valuedHoldingCount: number
  quantity: number
  totalBookValuePln: number
  totalCurrentValuePln: number
  totalUnrealizedGainPln: number
  gainPct: number | null
  transactionCount: number
  status: 'VALUED' | 'STALE' | 'DEGRADED' | 'CATALOG_ONLY'
}

export function isSortField(value: unknown): value is SortField {
  return value === 'instrumentName'
    || value === 'catalog'
    || value === 'accountCount'
    || value === 'quantity'
    || value === 'totalCurrentValuePln'
    || value === 'totalUnrealizedGainPln'
    || value === 'status'
}

export function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc'
}

export function isSortState(value: unknown): value is SortState {
  if (typeof value !== 'object' || value == null) {
    return false
  }

  const candidate = value as Partial<SortState>
  return isSortField(candidate.field) && isSortDirection(candidate.direction)
}

export function buildInstrumentRows(
  catalog: Instrument[],
  holdings: PortfolioHolding[],
): InstrumentRow[] {
  const holdingsByInstrument = new Map<string, PortfolioHolding[]>()

  for (const holding of holdings) {
    const bucket = holdingsByInstrument.get(holding.instrumentId) ?? []
    bucket.push(holding)
    holdingsByInstrument.set(holding.instrumentId, bucket)
  }

  return [...catalog].map((instrument) => {
    const instrumentHoldings = holdingsByInstrument.get(instrument.id) ?? []
    const accountIds = new Set(instrumentHoldings.map((holding) => holding.accountId))
    const valuedHoldingCount = instrumentHoldings.filter((holding) => isMarketValuedStatus(holding.valuationStatus)).length
    const staleHoldingCount = instrumentHoldings.filter((holding) => holding.valuationStatus === 'STALE').length
    const quantity = instrumentHoldings.reduce((sum, holding) => sum + parsePortfolioNumber(holding.quantity), 0)
    const totalBookValuePln = instrumentHoldings.reduce((sum, holding) => sum + parsePortfolioNumber(holding.bookValuePln), 0)
    const totalCurrentValuePln = instrumentHoldings.reduce(
      (sum, holding) => sum + parsePortfolioNumber(holding.currentValuePln ?? holding.bookValuePln),
      0,
    )
    const totalUnrealizedGainPln = instrumentHoldings.reduce(
      (sum, holding) => sum + parsePortfolioNumber(holding.unrealizedGainPln),
      0,
    )
    const gainPct = totalBookValuePln > 0 ? ((totalCurrentValuePln - totalBookValuePln) / totalBookValuePln) * 100 : null
    const transactionCount = instrumentHoldings.reduce((sum, holding) => sum + holding.transactionCount, 0)
    const status = instrumentHoldings.length === 0
      ? 'CATALOG_ONLY'
      : instrumentHoldings.every((holding) => isMarketValuedStatus(holding.valuationStatus))
        ? staleHoldingCount > 0
          ? 'STALE'
          : 'VALUED'
        : 'DEGRADED'

    return {
      instrument,
      accountCount: accountIds.size,
      holdingCount: instrumentHoldings.length,
      valuedHoldingCount,
      quantity,
      totalBookValuePln,
      totalCurrentValuePln,
      totalUnrealizedGainPln,
      gainPct,
      transactionCount,
      status,
    } satisfies InstrumentRow
  })
}

export function compareRows(a: InstrumentRow, b: InstrumentRow, sort: SortState) {
  const factor = sort.direction === 'asc' ? 1 : -1

  switch (sort.field) {
    case 'instrumentName':
      return factor * a.instrument.name.localeCompare(b.instrument.name)
    case 'catalog':
      return factor * instrumentCatalogLabel(a).localeCompare(instrumentCatalogLabel(b))
    case 'accountCount':
      return factor * (a.accountCount - b.accountCount)
    case 'quantity':
      return factor * (a.quantity - b.quantity)
    case 'totalCurrentValuePln':
      return factor * (a.totalCurrentValuePln - b.totalCurrentValuePln)
    case 'totalUnrealizedGainPln':
      return factor * (a.totalUnrealizedGainPln - b.totalUnrealizedGainPln)
    case 'status':
      return factor * instrumentStatusLabel(a.status).localeCompare(instrumentStatusLabel(b.status))
    default:
      return 0
  }
}

export function statusVariant(status: InstrumentRow['status']) {
  switch (status) {
    case 'VALUED':
      return badgeVariants.success
    case 'STALE':
      return badgeVariants.info
    case 'DEGRADED':
      return badgeVariants.warning
    case 'CATALOG_ONLY':
      return badgeVariants.default
  }
}

export function labelInstrumentStatus(status: InstrumentRow['status'], _isPolish?: boolean) {
  switch (status) {
    case 'VALUED':
      return t('instrumentModel.valued')
    case 'STALE':
      return t('instrumentModel.stale')
    case 'DEGRADED':
      return t('instrumentModel.degraded')
    case 'CATALOG_ONLY':
      return t('instrumentModel.catalogOnly')
  }
}

function instrumentCatalogLabel(row: InstrumentRow) {
  return `${labelInstrumentKind(row.instrument.kind)} ${labelAssetClass(row.instrument.assetClass)} ${labelValuationSource(row.instrument.valuationSource)}`
}

function instrumentStatusLabel(status: InstrumentRow['status']) {
  return labelInstrumentStatus(status, getActiveUiLanguage() === 'pl')
}
