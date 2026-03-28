import type { PortfolioOverview } from '../api/read-model'
import {
  missingDataLabel,
  notApplicableLabel,
} from './availability'
import { formatNumber, formatPercent, formatSignedCurrencyPln } from './format'
import type { UiLanguage } from './i18n'
import { formatMessage, tFor } from './messages'
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
  const lang = toLanguage(isPolish)

  if (activeHoldingCount === 0) {
    return tFor('presentation.noActiveHoldings', lang)
  }

  if (valuedHoldingCount === 0) {
    return tFor('presentation.noMarketValuationActive', lang)
  }

  if (valuedHoldingCount < activeHoldingCount) {
    return withGainScope(
      formatMessage(tFor('presentation.partialValuationDescription', lang), {
        valued: valuedHoldingCount,
        active: activeHoldingCount,
      }),
      lang,
      options,
    )
  }

  return withGainScope(
    tFor('presentation.activeHoldingsOnly', lang),
    lang,
    options,
  )
}

export function describeHoldingGainRate(
  activeHoldingCount: number,
  valuedHoldingCount: number,
  gainPct: number | null,
  isPolish: boolean,
) {
  const lang = toLanguage(isPolish)

  if (activeHoldingCount === 0) {
    return tFor('presentation.noActiveHoldings', lang)
  }

  if (valuedHoldingCount === 0) {
    return tFor('presentation.noMarketValuation', lang)
  }

  if (valuedHoldingCount < activeHoldingCount) {
    return formatMessage(tFor('presentation.partialValuationRate', lang), {
      valued: valuedHoldingCount,
      active: activeHoldingCount,
    })
  }

  return gainPct == null ? notApplicableLabel(isPolish) : formatPercent(gainPct, { signed: true })
}

export function describeHoldingGainValue(
  activeHoldingCount: number,
  valuedHoldingCount: number,
  value: string | number | null | undefined,
  isPolish: boolean,
) {
  const lang = toLanguage(isPolish)

  if (activeHoldingCount === 0) {
    return tFor('presentation.noActiveHoldings', lang)
  }

  if (valuedHoldingCount === 0) {
    return tFor('presentation.noMarketValuationHoldings', lang)
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
  const lang = toLanguage(isPolish)

  switch (valuationState) {
    case 'MARK_TO_MARKET':
      return tFor('presentation.valuationMarket', lang)
    case 'STALE':
      return tFor('presentation.valuationStale', lang)
    case 'PARTIALLY_VALUED':
      return tFor('presentation.valuationPartial', lang)
    case 'BOOK_ONLY':
      return tFor('presentation.valuationBook', lang)
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
  const lang = toLanguage(isPolish)

  if (valuationState === 'BOOK_ONLY') {
    return tFor('presentation.metricBookValue', lang)
  }
  if (valuationState === 'PARTIALLY_VALUED') {
    return tFor('presentation.metricEstimatedValue', lang)
  }
  return tFor('presentation.metricPortfolioValue', lang)
}

export function labelPortfolioValuationBasis(valuationState: string, isPolish: boolean) {
  const lang = toLanguage(isPolish)

  if (valuationState === 'BOOK_ONLY') {
    return tFor('presentation.basisBook', lang)
  }
  if (valuationState === 'STALE') {
    return tFor('presentation.basisStale', lang)
  }
  if (valuationState === 'PARTIALLY_VALUED') {
    return tFor('presentation.basisPartial', lang)
  }
  return tFor('presentation.basisMarket', lang)
}

export function describePrimaryPortfolioValue(
  overview: PortfolioOverview,
  valuationState: string,
  isPolish: boolean,
) {
  const lang = toLanguage(isPolish)

  if (valuationState === 'BOOK_ONLY') {
    return formatMessage(tFor('presentation.descBookOnly', lang), {
      accounts: overview.accountCount,
      holdings: overview.activeHoldingCount,
    })
  }

  if (valuationState === 'PARTIALLY_VALUED') {
    return formatMessage(tFor('presentation.descPartiallyValued', lang), {
      accounts: overview.accountCount,
      valued: overview.valuedHoldingCount,
      active: overview.activeHoldingCount,
    })
  }

  if (valuationState === 'STALE') {
    return formatMessage(tFor('presentation.descStale', lang), {
      accounts: overview.accountCount,
      holdings: overview.activeHoldingCount,
    })
  }

  return formatMessage(tFor('presentation.descMarket', lang), {
    accounts: overview.accountCount,
    holdings: overview.activeHoldingCount,
  })
}

export function describeAssetSliceValuation(pct: number, valuationState: string, isPolish: boolean) {
  const lang = toLanguage(isPolish)
  const base = formatMessage(tFor('presentation.sliceBase', lang), { pct: formatPercent(pct) })

  if (valuationState === 'BOOK_ONLY') {
    return `${base} · ${tFor('presentation.sliceBookBasis', lang)}`
  }

  if (valuationState === 'PARTIALLY_VALUED') {
    return `${base} · ${tFor('presentation.slicePartiallyValued', lang)}`
  }

  if (valuationState === 'STALE') {
    return `${base} · ${tFor('presentation.sliceStalePricing', lang)}`
  }

  return base
}

export function describePortfolioValuationBasis(overview: PortfolioOverview, isPolish: boolean) {
  const lang = toLanguage(isPolish)

  if (overview.activeHoldingCount === 0) {
    return tFor('presentation.noActiveHoldingsToValue', lang)
  }

  if (overview.valuationState === 'STALE') {
    return formatMessage(tFor('presentation.staleValuationBasis', lang), {
      valued: overview.valuedHoldingCount,
      active: overview.activeHoldingCount,
    })
  }

  return formatMessage(tFor('presentation.marketValuationBasis', lang), {
    valued: overview.valuedHoldingCount,
    active: overview.activeHoldingCount,
  })
}

function toLanguage(isPolish: boolean): UiLanguage {
  return isPolish ? 'pl' : 'en'
}

function withGainScope(
  message: string,
  lang: UiLanguage,
  options: PortfolioGainDescriptionOptions,
) {
  if (!options.cashExcluded) {
    return message
  }

  return `${message} · ${tFor('presentation.cashExcluded', lang)}`
}
