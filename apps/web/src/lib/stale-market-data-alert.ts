import type { MarketDataSnapshot, PortfolioOverview } from '../api/read-model'
import type { AppReadiness } from '../api/system'
import type { UiLanguage } from './i18n'
import { formatMessage, tFor } from './messages'

export interface StaleMarketDataAlert {
  title: string
  message: string
  latestSnapshotAt: string | null
  valuationCoverageLabel: string
  valuationIssueCount: number
  upstreamLabel: string | null
}

interface BuildStaleMarketDataAlertInput {
  overview?: PortfolioOverview
  snapshots?: MarketDataSnapshot[]
  readiness?: AppReadiness
  language: UiLanguage
}

const MARKET_DATA_WARNING_KEYS = new Set(['stock-analyst', 'edo-calculator', 'gold-market-data'])

export function buildStaleMarketDataAlert({
  overview,
  snapshots = [],
  readiness,
  language,
}: BuildStaleMarketDataAlertInput): StaleMarketDataAlert | null {
  if (!overview || overview.valuationState !== 'STALE') {
    return null
  }

  const latestSnapshotAt = latestTimestamp(snapshots.map((snapshot) => snapshot.cachedAt))
  const upstreamWarning = readiness?.checks.find(
    (check) => check.status === 'WARN' && MARKET_DATA_WARNING_KEYS.has(check.key),
  )
  const upstreamLabel = upstreamWarning ? localizeUpstreamLabel(upstreamWarning.key, upstreamWarning.label, language) : null
  const valuationCoverageLabel = `${overview.valuedHoldingCount} / ${overview.activeHoldingCount}`

  const parts = [
    tFor('staleAlert.messageBase', language),
    latestSnapshotAt
      ? formatMessage(tFor('staleAlert.messageSnapshot', language), { timestamp: latestSnapshotAt })
      : tFor('staleAlert.messageSnapshotMissing', language),
    upstreamLabel
      ? formatMessage(tFor('staleAlert.messageUpstream', language), { upstream: upstreamLabel })
      : null,
    overview.valuationIssueCount > 0
      ? formatMessage(tFor('staleAlert.messageIssues', language), { count: overview.valuationIssueCount })
      : null,
  ]

  return {
    title: tFor('staleAlert.title', language),
    message: parts.filter(Boolean).join(' '),
    latestSnapshotAt,
    valuationCoverageLabel,
    valuationIssueCount: overview.valuationIssueCount,
    upstreamLabel,
  }
}

function latestTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null
}

function localizeUpstreamLabel(key: string, fallbackLabel: string, language: UiLanguage) {
  switch (key) {
    case 'stock-analyst':
      return tFor('staleAlert.upstreamStockAnalyst', language)
    case 'edo-calculator':
      return tFor('staleAlert.upstreamEdoCalculator', language)
    case 'gold-market-data':
      return tFor('staleAlert.upstreamGold', language)
    default:
      return fallbackLabel
  }
}
