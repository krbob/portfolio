import type { PortfolioOverview } from '../api/read-model'
import {
  missingDataLabel,
  notApplicableLabel,
} from './availability'
import { formatNumber, formatPercent, formatSignedCurrencyPln } from './format'
import { badgeVariants } from './styles'

interface PortfolioGainDescriptionOptions {
  cashExcluded?: boolean
}

export function parsePortfolioNumber(value: string | number | null | undefined) {
  if (value == null || value === '') {
    return 0
  }

  return typeof value === 'number' ? value : Number(value)
}

export function calculateGainPct(
  currentValue: string | number | null | undefined,
  bookValue: string | number | null | undefined,
) {
  const current = parsePortfolioNumber(currentValue)
  const book = parsePortfolioNumber(bookValue)
  if (book <= 0) {
    return null
  }

  return ((current - book) / book) * 100
}

export function formatPortfolioGainDisplay(value: number, valuedHoldingCount: number, isPolish: boolean) {
  if (valuedHoldingCount === 0) {
    return missingDataLabel(isPolish)
  }

  return formatSignedCurrencyPln(value)
}

export function describePortfolioGain(
  activeHoldingCount: number,
  valuedHoldingCount: number,
  isPolish: boolean,
  options: PortfolioGainDescriptionOptions = {},
) {
  if (activeHoldingCount === 0) {
    return isPolish ? 'Brak aktywnych pozycji' : 'No active holdings'
  }

  if (valuedHoldingCount === 0) {
    return isPolish
      ? 'Brak wyceny rynkowej aktywnych pozycji'
      : 'No market valuation for active holdings'
  }

  if (valuedHoldingCount < activeHoldingCount) {
    return withGainScope(
      isPolish
        ? `${valuedHoldingCount}/${activeHoldingCount} pozycji z wyceną rynkową`
        : `${valuedHoldingCount}/${activeHoldingCount} holdings with market valuation`,
      isPolish,
      options,
    )
  }

  return withGainScope(
    isPolish ? 'Tylko aktywne pozycje' : 'Active holdings only',
    isPolish,
    options,
  )
}

export function describeHoldingGainRate(
  activeHoldingCount: number,
  valuedHoldingCount: number,
  gainPct: number | null,
  isPolish: boolean,
) {
  if (activeHoldingCount === 0) {
    return isPolish ? 'Brak aktywnych pozycji' : 'No active holdings'
  }

  if (valuedHoldingCount === 0) {
    return isPolish ? 'Brak wyceny rynkowej' : 'No market valuation'
  }

  if (valuedHoldingCount < activeHoldingCount) {
    return isPolish
      ? `${valuedHoldingCount}/${activeHoldingCount} pozycji wycenionych`
      : `${valuedHoldingCount}/${activeHoldingCount} holdings valued`
  }

  return gainPct == null ? notApplicableLabel(isPolish) : formatPercent(gainPct, { signed: true })
}

export function describeHoldingGainValue(
  activeHoldingCount: number,
  valuedHoldingCount: number,
  value: string | number | null | undefined,
  isPolish: boolean,
) {
  if (activeHoldingCount === 0) {
    return isPolish ? 'Brak aktywnych pozycji' : 'No active holdings'
  }

  if (valuedHoldingCount === 0) {
    return isPolish ? 'Brak wyceny rynkowej pozycji' : 'No market valuation for holdings'
  }

  return formatSignedCurrencyPln(value ?? 0)
}

export function formatHoldingGainPreview(value: string | number | null | undefined, isPolish: boolean) {
  return value == null ? missingDataLabel(isPolish) : formatSignedCurrencyPln(value)
}

export function formatHoldingQuantity(value: string | number) {
  const amount = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(amount)) {
    return formatNumber(value, { maximumFractionDigits: 2 })
  }

  if (Number.isInteger(amount)) {
    return formatNumber(amount, { maximumFractionDigits: 0 })
  }

  return formatNumber(amount, { maximumFractionDigits: 2 })
}

export function labelPortfolioValuationState(valuationState: string, isPolish: boolean) {
  switch (valuationState) {
    case 'MARK_TO_MARKET':
      return isPolish ? 'Rynkowa' : 'Market'
    case 'STALE':
      return isPolish ? 'Opóźniona' : 'Stale'
    case 'PARTIALLY_VALUED':
      return isPolish ? 'Niepełna' : 'Partial'
    case 'BOOK_ONLY':
      return isPolish ? 'Księgowa' : 'Book'
    default:
      return valuationState
  }
}

export function portfolioValuationStateVariant(valuationState: string) {
  switch (valuationState) {
    case 'MARK_TO_MARKET':
      return badgeVariants.success
    case 'STALE':
      return badgeVariants.info
    case 'PARTIALLY_VALUED':
      return badgeVariants.warning
    case 'BOOK_ONLY':
      return badgeVariants.warning
    default:
      return badgeVariants.default
  }
}

export function labelPrimaryPortfolioValueMetric(valuationState: string, isPolish: boolean) {
  if (valuationState === 'BOOK_ONLY') {
    return isPolish ? 'Wartość księgowa' : 'Book Value'
  }
  if (valuationState === 'PARTIALLY_VALUED') {
    return isPolish ? 'Wartość szacunkowa' : 'Estimated Value'
  }
  return isPolish ? 'Wartość portfela' : 'Portfolio Value'
}

export function labelPortfolioValuationBasis(valuationState: string, isPolish: boolean) {
  if (valuationState === 'BOOK_ONLY') {
    return isPolish ? 'Księgowa' : 'Book basis'
  }
  if (valuationState === 'STALE') {
    return isPolish ? 'Rynkowa z opóźnieniem' : 'Stale market'
  }
  if (valuationState === 'PARTIALLY_VALUED') {
    return isPolish ? 'Częściowa' : 'Partial'
  }
  return isPolish ? 'Rynkowa' : 'Market'
}

export function describePrimaryPortfolioValue(
  overview: PortfolioOverview,
  valuationState: string,
  isPolish: boolean,
) {
  if (valuationState === 'BOOK_ONLY') {
    return isPolish
      ? `${overview.accountCount} kont · ${overview.activeHoldingCount} pozycji · wycena księgowa`
      : `${overview.accountCount} accounts · ${overview.activeHoldingCount} holdings · book basis`
  }

  if (valuationState === 'PARTIALLY_VALUED') {
    return isPolish
      ? `${overview.accountCount} kont · ${overview.valuedHoldingCount}/${overview.activeHoldingCount} pozycji wycenionych`
      : `${overview.accountCount} accounts · ${overview.valuedHoldingCount}/${overview.activeHoldingCount} holdings valued`
  }

  if (valuationState === 'STALE') {
    return isPolish
      ? `${overview.accountCount} kont · ${overview.activeHoldingCount} pozycji · ostatnie dostępne ceny`
      : `${overview.accountCount} accounts · ${overview.activeHoldingCount} holdings · latest available prices`
  }

  return isPolish
    ? `${overview.accountCount} kont · ${overview.activeHoldingCount} pozycji`
    : `${overview.accountCount} accounts · ${overview.activeHoldingCount} holdings`
}

export function describeAssetSliceValuation(pct: number, valuationState: string, isPolish: boolean) {
  const base = isPolish ? `${formatPercent(pct)} portfela` : `${formatPercent(pct)} of portfolio`

  if (valuationState === 'BOOK_ONLY') {
    return isPolish ? `${base} · wycena księgowa` : `${base} · book basis`
  }

  if (valuationState === 'PARTIALLY_VALUED') {
    return isPolish ? `${base} · wycena częściowa` : `${base} · partially valued`
  }

  if (valuationState === 'STALE') {
    return isPolish ? `${base} · ceny z opóźnieniem` : `${base} · stale pricing`
  }

  return base
}

export function describePortfolioValuationBasis(overview: PortfolioOverview, isPolish: boolean) {
  if (overview.activeHoldingCount === 0) {
    return isPolish ? 'Brak aktywnych pozycji do wyceny' : 'No active holdings to value'
  }

  if (overview.valuationState === 'STALE') {
    return isPolish
      ? `${overview.valuedHoldingCount} z ${overview.activeHoldingCount} pozycji ma ostatnią dostępną wycenę rynkową`
      : `${overview.valuedHoldingCount} of ${overview.activeHoldingCount} holdings have the latest available market valuation`
  }

  return isPolish
    ? `${overview.valuedHoldingCount} z ${overview.activeHoldingCount} pozycji ma wycenę rynkową`
    : `${overview.valuedHoldingCount} of ${overview.activeHoldingCount} holdings have market valuations`
}

function withGainScope(
  message: string,
  isPolish: boolean,
  options: PortfolioGainDescriptionOptions,
) {
  if (!options.cashExcluded) {
    return message
  }

  return `${message} · ${isPolish ? 'bez gotówki' : 'cash excluded'}`
}
