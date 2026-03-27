import { missingDataLabel } from './availability'
import type {
  PortfolioDailyHistory,
  PortfolioOverview,
  PortfolioReturns,
  ReadModelCacheSnapshot,
} from '../api/read-model'
import type { ReadModelRefreshStatus } from '../api/write-model'
import { formatYearMonth } from './format'
import type { UiLanguage } from './i18n'
import { formatMessage, tFor } from './messages'

export type DataQualityStatus = 'PASS' | 'WARN' | 'INFO'

export interface PortfolioDataQualityCheck {
  key: string
  label: string
  status: DataQualityStatus
  message: string
}

export interface PortfolioDataQualitySummary {
  overallStatus: DataQualityStatus
  warningCount: number
  checks: PortfolioDataQualityCheck[]
  valuationCoverageLabel: string
  benchmarkCoverageLabel: string
  availableBenchmarkCount: number
  totalBenchmarkCount: number
  cpiCoverageThroughMonth: string | null
  cpiCoverageThroughLabel: string
  lastRefreshAt: string | null
  lastHistoryRefreshAt: string | null
  lastReturnsRefreshAt: string | null
  schedulerEnabled: boolean
  usdSeriesAvailable: boolean
  goldSeriesAvailable: boolean
  noticeMessages: string[]
}

interface BuildPortfolioDataQualitySummaryInput {
  overview?: PortfolioOverview
  history?: PortfolioDailyHistory
  returns?: PortfolioReturns
  cacheSnapshots?: ReadModelCacheSnapshot[]
  refreshStatus?: ReadModelRefreshStatus
  isPolish: boolean
  now?: Date
}

export function buildPortfolioDataQualitySummary({
  overview,
  history,
  returns,
  cacheSnapshots = [],
  refreshStatus,
  isPolish,
  now = new Date(),
}: BuildPortfolioDataQualitySummaryInput): PortfolioDataQualitySummary | null {
  if (!overview || !history || !returns || !refreshStatus) {
    return null
  }

  const lang = toLanguage(isPolish)

  const latestPoint = history.points.at(-1)
  const usdSeriesAvailable = Boolean(latestPoint?.totalCurrentValueUsd && latestPoint?.netContributionsUsd)
  const goldSeriesAvailable = Boolean(latestPoint?.totalCurrentValueAu && latestPoint?.netContributionsAu)

  const benchmarkPeriod =
    returns.periods.find((period) => period.key === 'MAX') ??
    returns.periods.find((period) => period.benchmarks.length > 0) ??
    returns.periods.at(0)
  const totalBenchmarkCount = benchmarkPeriod?.benchmarks.length ?? 0
  const availableBenchmarkCount = benchmarkPeriod?.benchmarks.filter((benchmark) => benchmark.nominalPln != null).length ?? 0

  const cpiCoverageThroughMonth = findCpiCoverageThroughMonth(returns)
  const historySnapshot = cacheSnapshots.find((snapshot) => snapshot.cacheKey === 'portfolio.daily-history')
  const returnsSnapshot = cacheSnapshots.find((snapshot) => snapshot.cacheKey === 'portfolio.returns')
  const lastSuccessfulRefreshAt = latestTimestamp([
    refreshStatus.lastSuccessAt,
    historySnapshot?.generatedAt,
    returnsSnapshot?.generatedAt,
  ])
  const lastRefreshAt = latestTimestamp([
    refreshStatus.lastRunAt,
    refreshStatus.lastFailureAt,
    lastSuccessfulRefreshAt,
  ])

  const checks: PortfolioDataQualityCheck[] = [
    buildValuationCheck(overview, lang),
    buildInstrumentHistoryCheck(history.instrumentHistoryIssueCount, lang),
    buildFxCheck(overview.missingFxTransactions, usdSeriesAvailable, lang),
    buildGoldCheck(goldSeriesAvailable, lang),
    buildBenchmarkCheck({
      availableBenchmarkCount,
      totalBenchmarkCount,
      lang,
    }),
    buildCpiCheck(cpiCoverageThroughMonth, lang, now),
    buildRefreshCheck({
      historyRefreshAt: historySnapshot?.generatedAt ?? null,
      returnsRefreshAt: returnsSnapshot?.generatedAt ?? null,
      refreshStatus,
      lang,
    }),
  ]

  const warningCount = checks.filter((check) => check.status === 'WARN').length
  const overallStatus: DataQualityStatus =
    warningCount > 0 ? 'WARN' : checks.some((check) => check.status === 'PASS') ? 'PASS' : 'INFO'

  return {
    overallStatus,
    warningCount,
    checks,
    valuationCoverageLabel: `${overview.valuedHoldingCount} / ${overview.activeHoldingCount}`,
    benchmarkCoverageLabel: totalBenchmarkCount > 0 ? `${availableBenchmarkCount} / ${totalBenchmarkCount}` : '0 / 0',
    availableBenchmarkCount,
    totalBenchmarkCount,
    cpiCoverageThroughMonth,
    cpiCoverageThroughLabel: cpiCoverageThroughMonth ? formatYearMonth(cpiCoverageThroughMonth) : missingDataLabel(isPolish),
    lastRefreshAt,
    lastHistoryRefreshAt: historySnapshot?.generatedAt ?? null,
    lastReturnsRefreshAt: returnsSnapshot?.generatedAt ?? null,
    schedulerEnabled: refreshStatus.schedulerEnabled,
    usdSeriesAvailable,
    goldSeriesAvailable,
    noticeMessages: checks.filter((check) => check.status === 'WARN').map((check) => check.message).slice(0, 3),
  }
}

function toLanguage(isPolish: boolean): UiLanguage {
  return isPolish ? 'pl' : 'en'
}

function buildValuationCheck(overview: PortfolioOverview, lang: UiLanguage): PortfolioDataQualityCheck {
  const label = tFor('dataQualityLib.valuationCoverage', lang)

  if (overview.activeHoldingCount === 0) {
    return {
      key: 'valuation',
      label,
      status: 'INFO',
      message: tFor('dataQualityLib.noActiveHoldings', lang),
    }
  }

  if (overview.valuedHoldingCount === overview.activeHoldingCount && overview.valuationIssueCount === 0) {
    return {
      key: 'valuation',
      label,
      status: 'PASS',
      message: formatMessage(tFor('dataQualityLib.valuationCoveragePass', lang), {
        count: overview.activeHoldingCount,
      }),
    }
  }

  return {
    key: 'valuation',
    label,
    status: 'WARN',
    message: formatMessage(tFor('dataQualityLib.valuationCoverageWarn', lang), {
      valuedCount: overview.valuedHoldingCount,
      activeCount: overview.activeHoldingCount,
      issueCount: overview.valuationIssueCount,
    }),
  }
}

function buildInstrumentHistoryCheck(issueCount: number, lang: UiLanguage): PortfolioDataQualityCheck {
  const label = tFor('dataQualityLib.instrumentHistory', lang)

  return issueCount === 0
    ? {
        key: 'instrument-history',
        label,
        status: 'PASS',
        message: tFor('dataQualityLib.instrumentHistoryPass', lang),
      }
    : {
        key: 'instrument-history',
        label,
        status: 'WARN',
        message: formatMessage(tFor('dataQualityLib.instrumentHistoryWarn', lang), {
          issueCount,
        }),
      }
}

function buildFxCheck(missingFxTransactions: number, usdSeriesAvailable: boolean, lang: UiLanguage): PortfolioDataQualityCheck {
  const label = tFor('dataQualityLib.fxAndUsd', lang)

  if (missingFxTransactions === 0 && usdSeriesAvailable) {
    return {
      key: 'fx',
      label,
      status: 'PASS',
      message: tFor('dataQualityLib.fxPass', lang),
    }
  }

  return {
    key: 'fx',
    label,
    status: 'WARN',
    message: formatMessage(tFor('dataQualityLib.fxWarn', lang), {
      missingFxTransactions,
      usdViewStatus: tFor(
        usdSeriesAvailable ? 'dataQualityLib.fxWarnUsdPartial' : 'dataQualityLib.fxWarnUsdUnavailable',
        lang,
      ),
    }),
  }
}

function buildGoldCheck(goldSeriesAvailable: boolean, lang: UiLanguage): PortfolioDataQualityCheck {
  const label = tFor('dataQualityLib.gold', lang)

  return goldSeriesAvailable
    ? {
        key: 'gold',
        label,
        status: 'PASS',
        message: tFor('dataQualityLib.goldPass', lang),
      }
    : {
        key: 'gold',
        label,
        status: 'WARN',
        message: tFor('dataQualityLib.goldWarn', lang),
      }
}

function buildBenchmarkCheck({
  availableBenchmarkCount,
  totalBenchmarkCount,
  lang,
}: {
  availableBenchmarkCount: number
  totalBenchmarkCount: number
  lang: UiLanguage
}): PortfolioDataQualityCheck {
  const label = tFor('dataQualityLib.benchmarks', lang)

  if (totalBenchmarkCount === 0) {
    return {
      key: 'benchmarks',
      label,
      status: 'INFO',
      message: tFor('dataQualityLib.noBenchmarksConfigured', lang),
    }
  }

  if (availableBenchmarkCount === totalBenchmarkCount) {
    return {
      key: 'benchmarks',
      label,
      status: 'PASS',
      message: formatMessage(tFor('dataQualityLib.benchmarksPass', lang), {
        availableCount: availableBenchmarkCount,
        totalCount: totalBenchmarkCount,
      }),
    }
  }

  return {
    key: 'benchmarks',
    label,
    status: 'WARN',
    message: formatMessage(tFor('dataQualityLib.benchmarksWarn', lang), {
      availableCount: availableBenchmarkCount,
      totalCount: totalBenchmarkCount,
    }),
  }
}

function buildCpiCheck(cpiCoverageThroughMonth: string | null, lang: UiLanguage, now: Date): PortfolioDataQualityCheck {
  const label = tFor('dataQualityLib.cpi', lang)

  if (cpiCoverageThroughMonth) {
    const minimumCoverageThroughMonth = minimumFreshCpiCoverageThroughMonth(now)
    if (compareYearMonth(cpiCoverageThroughMonth, minimumCoverageThroughMonth) < 0) {
      return {
        key: 'cpi',
        label,
        status: 'WARN',
        message: formatMessage(tFor('dataQualityLib.cpiWarnStale', lang), {
          currentCoverageThrough: formatYearMonth(cpiCoverageThroughMonth),
          minimumCoverageThrough: formatYearMonth(minimumCoverageThroughMonth),
        }),
      }
    }

    return {
      key: 'cpi',
      label,
      status: 'PASS',
      message: formatMessage(tFor('dataQualityLib.cpiPass', lang), {
        coverageThrough: formatYearMonth(cpiCoverageThroughMonth),
      }),
    }
  }

  return {
    key: 'cpi',
    label,
    status: 'WARN',
    message: tFor('dataQualityLib.noCpiCoverage', lang),
  }
}

function buildRefreshCheck({
  historyRefreshAt,
  returnsRefreshAt,
  refreshStatus,
  lang,
}: {
  historyRefreshAt: string | null
  returnsRefreshAt: string | null
  refreshStatus: ReadModelRefreshStatus
  lang: UiLanguage
}): PortfolioDataQualityCheck {
  const label = tFor('dataQualityLib.refreshLabel', lang)
  const lastSuccessfulRefreshAt = latestTimestamp([
    refreshStatus.lastSuccessAt,
    historyRefreshAt,
    returnsRefreshAt,
  ])

  if (
    refreshStatus.lastFailureAt &&
    (!lastSuccessfulRefreshAt || compareTimestamps(refreshStatus.lastFailureAt, lastSuccessfulRefreshAt) > 0)
  ) {
    const failureMessage = refreshStatus.lastFailureMessage ?? tFor('dataQualityLib.refreshFallbackFailure', lang)
    return {
      key: 'refresh',
      label,
      status: 'WARN',
      message: formatMessage(tFor('dataQualityLib.refreshWarn', lang), {
        failureAt: refreshStatus.lastFailureAt,
        failureMessage,
      }),
    }
  }

  if (lastSuccessfulRefreshAt) {
    return {
      key: 'refresh',
      label,
      status: 'PASS',
      message: formatMessage(tFor('dataQualityLib.refreshPass', lang), {
        refreshedAt: lastSuccessfulRefreshAt,
      }),
    }
  }

  return {
    key: 'refresh',
    label,
    status: 'INFO',
    message: tFor('dataQualityLib.noRefreshYet', lang),
  }
}

function findCpiCoverageThroughMonth(returns: PortfolioReturns): string | null {
  const exclusiveCoverageMonth = returns.periods
    .map((period) => period.inflationUntil)
    .find((value): value is string => Boolean(value))

  if (!exclusiveCoverageMonth) {
    return null
  }

  const match = /^(\d{4})-(\d{2})$/.exec(exclusiveCoverageMonth)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (Number.isNaN(year) || Number.isNaN(month)) {
    return null
  }

  const coverageDate = new Date(Date.UTC(year, month - 2, 1))
  return `${coverageDate.getUTCFullYear()}-${String(coverageDate.getUTCMonth() + 1).padStart(2, '0')}`
}

function minimumFreshCpiCoverageThroughMonth(now: Date): string {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const day = now.getUTCDate()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const latestCompletePortfolioMonthExclusive = shiftYearMonth(
    `${year}-${String(month).padStart(2, '0')}`,
    day === daysInMonth ? 1 : 0,
  )
  return shiftYearMonth(latestCompletePortfolioMonthExclusive, -2)
}

function compareYearMonth(left: string, right: string) {
  const leftParsed = parseYearMonth(left)
  const rightParsed = parseYearMonth(right)
  if (!leftParsed || !rightParsed) {
    return 0
  }

  return (leftParsed.year - rightParsed.year) * 12 + (leftParsed.month - rightParsed.month)
}

function shiftYearMonth(value: string, deltaMonths: number): string {
  const parsed = parseYearMonth(value)
  if (!parsed) {
    return value
  }

  const totalMonths = parsed.year * 12 + (parsed.month - 1) + deltaMonths
  const year = Math.floor(totalMonths / 12)
  const month = (totalMonths % 12 + 12) % 12 + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseYearMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return null
  }

  return { year, month }
}


function latestTimestamp(values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .sort(compareTimestamps)
    .at(-1) ?? null
}

function compareTimestamps(left: string, right: string) {
  return Date.parse(left) - Date.parse(right)
}
