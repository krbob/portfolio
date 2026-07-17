import type { MarketDataSnapshot } from '../api/read-model'

type GeneratedProvenance = NonNullable<MarketDataSnapshot['provenance']>

export type MarketProvenanceStatus = 'FRESH' | 'PARTIAL' | 'STALE' | 'ERROR' | 'UNKNOWN'

export interface MarketDataProvenanceSummary {
  datasetCount: number
  sources: string[]
  observedAt: string | null
  retrievedAt: string | null
  coverageFrom: string | null
  coverageTo: string | null
  currencies: string[]
  unitScales: number[]
  adjustments: string[]
  status: MarketProvenanceStatus
  limitedAnalyticsCount: number
  refreshFailureCount: number
}

export function summarizeMarketDataProvenance(
  snapshots: MarketDataSnapshot[],
): MarketDataProvenanceSummary | null {
  const withProvenance = snapshots.filter(
    (snapshot): snapshot is MarketDataSnapshot & { provenance: GeneratedProvenance } =>
      snapshot.provenance != null && isLiveMarketSnapshot(snapshot),
  )
  if (withProvenance.length === 0) return null

  const provenance = withProvenance.map((snapshot) => snapshot.provenance)
  const coverageFrom = provenance.map((item) => cleanDate(item.coverageFrom ?? item.marketDate)).filter(isPresent)
  const coverageTo = provenance.map((item) => cleanDate(item.coverageTo ?? item.marketDate)).filter(isPresent)
  const observations = provenance
    .map((item) => cleanInstant(item.marketTimestamp) ?? cleanDate(item.marketDate))
    .filter(isPresent)
  const limitedAnalyticsCount = withProvenance.filter(hasLimitedQuoteAnalytics).length

  return {
    datasetCount: withProvenance.length,
    sources: uniqueText(provenance.map((item) => item.source)),
    observedAt: latestTemporalValue(observations),
    retrievedAt: latestTemporalValue(provenance.map((item) => cleanInstant(item.retrievedAt)).filter(isPresent)),
    coverageFrom: coverageFrom.sort()[0] ?? null,
    coverageTo: coverageTo.sort().at(-1) ?? null,
    currencies: uniqueText(provenance.map((item) => item.currency)),
    unitScales: [...new Set(provenance.map((item) => item.unitScale).filter(validUnitScale))].sort((a, b) => a - b),
    adjustments: uniqueText(provenance.map((item) => item.adjustment)),
    status: worstStatus(withProvenance.map(headlineProvenanceStatus)),
    limitedAnalyticsCount,
    refreshFailureCount: withProvenance.filter((snapshot) => snapshot.status === 'FAILED').length,
  }
}

/**
 * The global bar describes data used for current valuations and live reference
 * series. Transaction FX lookups are bounded historical requests: an old end
 * date is expected there and must not degrade the live market-data headline.
 * They remain visible in the detailed market-data diagnostics screen.
 */
function isLiveMarketSnapshot(snapshot: MarketDataSnapshot) {
  return !snapshot.identity.startsWith('fx-history:')
}

/**
 * Stock quote provenance covers both the current price and derived statistics
 * such as the five-year gain. Portfolio consumes the current valuation fields,
 * not those optional statistics. A PARTIAL quote therefore describes limited
 * analytics, not a partial current valuation. The raw provenance remains
 * unchanged in snapshot data, while the limitation is counted separately in
 * the global bar.
 */
function hasLimitedQuoteAnalytics(
  snapshot: MarketDataSnapshot & { provenance: GeneratedProvenance },
) {
  return snapshot.identity.startsWith('stock-quote:') && normalizeStatus(snapshot.provenance.status) === 'PARTIAL'
}

function headlineProvenanceStatus(
  snapshot: MarketDataSnapshot & { provenance: GeneratedProvenance },
): MarketProvenanceStatus {
  return hasLimitedQuoteAnalytics(snapshot) ? 'FRESH' : normalizeStatus(snapshot.provenance.status)
}

function uniqueText(values: Array<string | null | undefined>) {
  return [...new Set(values.map(cleanText).filter(isPresent))].sort()
}

function cleanText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized.slice(0, 120) : null
}

function cleanDate(value: string | null | undefined): string | null {
  const normalized = cleanText(value)
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

function cleanInstant(value: string | null | undefined): string | null {
  const normalized = cleanText(value)
  return normalized && !Number.isNaN(Date.parse(normalized)) ? normalized : null
}

function latestTemporalValue(values: string[]): string | null {
  return values.sort((first, second) => Date.parse(first) - Date.parse(second)).at(-1) ?? null
}

function validUnitScale(value: number) {
  return Number.isFinite(value) && value > 0
}

function worstStatus(values: string[]): MarketProvenanceStatus {
  const priority: Record<MarketProvenanceStatus, number> = {
    FRESH: 0,
    PARTIAL: 1,
    STALE: 2,
    UNKNOWN: 3,
    ERROR: 4,
  }
  return values
    .map(normalizeStatus)
    .reduce((worst, status) => priority[status] > priority[worst] ? status : worst, 'FRESH')
}

function normalizeStatus(value: string): MarketProvenanceStatus {
  const normalized = value.trim().toUpperCase()
  return normalized === 'FRESH' || normalized === 'PARTIAL' || normalized === 'STALE' || normalized === 'ERROR'
    ? normalized
    : 'UNKNOWN'
}

function isPresent<T>(value: T | null): value is T {
  return value != null
}
