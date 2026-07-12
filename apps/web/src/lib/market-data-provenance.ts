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
  refreshFailureCount: number
}

export function summarizeMarketDataProvenance(
  snapshots: MarketDataSnapshot[],
): MarketDataProvenanceSummary | null {
  const withProvenance = snapshots.filter(
    (snapshot): snapshot is MarketDataSnapshot & { provenance: GeneratedProvenance } => snapshot.provenance != null,
  )
  if (withProvenance.length === 0) return null

  const provenance = withProvenance.map((snapshot) => snapshot.provenance)
  const coverageFrom = provenance.map((item) => cleanDate(item.coverageFrom ?? item.marketDate)).filter(isPresent)
  const coverageTo = provenance.map((item) => cleanDate(item.coverageTo ?? item.marketDate)).filter(isPresent)
  const observations = provenance
    .map((item) => cleanInstant(item.marketTimestamp) ?? cleanDate(item.marketDate))
    .filter(isPresent)

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
    status: worstStatus(provenance.map((item) => item.status)),
    refreshFailureCount: withProvenance.filter((snapshot) => snapshot.status === 'FAILED').length,
  }
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
