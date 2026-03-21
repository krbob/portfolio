import type {
  PortfolioDailyHistory,
  PortfolioOverview,
  PortfolioReturns,
  ReadModelCacheSnapshot,
} from '../api/read-model'
import type { ReadModelRefreshStatus } from '../api/write-model'
import { formatYearMonth } from './format'

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
}

export function buildPortfolioDataQualitySummary({
  overview,
  history,
  returns,
  cacheSnapshots = [],
  refreshStatus,
  isPolish,
}: BuildPortfolioDataQualitySummaryInput): PortfolioDataQualitySummary | null {
  if (!overview || !history || !returns || !refreshStatus) {
    return null
  }

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
    buildValuationCheck(overview, isPolish),
    buildInstrumentHistoryCheck(history.instrumentHistoryIssueCount, isPolish),
    buildFxCheck(overview.missingFxTransactions, usdSeriesAvailable, isPolish),
    buildGoldCheck(goldSeriesAvailable, isPolish),
    buildBenchmarkCheck({
      issueCount: history.benchmarkSeriesIssueCount,
      availableBenchmarkCount,
      totalBenchmarkCount,
      isPolish,
    }),
    buildCpiCheck(cpiCoverageThroughMonth, isPolish),
    buildRefreshCheck({
      historyRefreshAt: historySnapshot?.generatedAt ?? null,
      returnsRefreshAt: returnsSnapshot?.generatedAt ?? null,
      refreshStatus,
      isPolish,
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
    cpiCoverageThroughLabel: cpiCoverageThroughMonth ? formatYearMonth(cpiCoverageThroughMonth) : notAvailableLabel(isPolish),
    lastRefreshAt,
    lastHistoryRefreshAt: historySnapshot?.generatedAt ?? null,
    lastReturnsRefreshAt: returnsSnapshot?.generatedAt ?? null,
    schedulerEnabled: refreshStatus.schedulerEnabled,
    usdSeriesAvailable,
    goldSeriesAvailable,
    noticeMessages: checks.filter((check) => check.status === 'WARN').map((check) => check.message).slice(0, 3),
  }
}

function buildValuationCheck(overview: PortfolioOverview, isPolish: boolean): PortfolioDataQualityCheck {
  if (overview.activeHoldingCount === 0) {
    return {
      key: 'valuation',
      label: isPolish ? 'Pokrycie wyceny' : 'Valuation coverage',
      status: 'INFO',
      message: isPolish ? 'Brak aktywnych pozycji do zweryfikowania.' : 'No active holdings to validate yet.',
    }
  }

  if (overview.valuedHoldingCount === overview.activeHoldingCount && overview.valuationIssueCount === 0) {
    return {
      key: 'valuation',
      label: isPolish ? 'Pokrycie wyceny' : 'Valuation coverage',
      status: 'PASS',
      message: isPolish
        ? `Wszystkie ${overview.activeHoldingCount} pozycje mają bieżącą wycenę.`
        : `All ${overview.activeHoldingCount} holdings have current valuations.`,
    }
  }

  return {
    key: 'valuation',
    label: isPolish ? 'Pokrycie wyceny' : 'Valuation coverage',
    status: 'WARN',
    message: isPolish
      ? `${overview.valuedHoldingCount} z ${overview.activeHoldingCount} pozycji jest wycenionych; otwarte luki: ${overview.valuationIssueCount}.`
      : `${overview.valuedHoldingCount} of ${overview.activeHoldingCount} holdings are valued; open valuation gaps: ${overview.valuationIssueCount}.`,
  }
}

function buildInstrumentHistoryCheck(issueCount: number, isPolish: boolean): PortfolioDataQualityCheck {
  return issueCount === 0
    ? {
        key: 'instrument-history',
        label: isPolish ? 'Historia instrumentów' : 'Instrument history',
        status: 'PASS',
        message: isPolish
          ? 'Historia instrumentów odtwarza się bez luk wyceny.'
          : 'Instrument history rebuilds without valuation gaps.',
      }
    : {
        key: 'instrument-history',
        label: isPolish ? 'Historia instrumentów' : 'Instrument history',
        status: 'WARN',
        message: isPolish
          ? `Problemy z historią wyceny instrumentów: ${issueCount}.`
          : `Instrument valuation history issues: ${issueCount}.`,
      }
}

function buildFxCheck(missingFxTransactions: number, usdSeriesAvailable: boolean, isPolish: boolean): PortfolioDataQualityCheck {
  if (missingFxTransactions === 0 && usdSeriesAvailable) {
    return {
      key: 'fx',
      label: isPolish ? 'FX i USD' : 'FX and USD',
      status: 'PASS',
      message: isPolish
        ? 'Przeliczenia FX i referencyjny widok USD są dostępne.'
        : 'FX conversions and the USD reference view are available.',
    }
  }

  return {
    key: 'fx',
    label: isPolish ? 'FX i USD' : 'FX and USD',
    status: 'WARN',
    message: isPolish
      ? `Brakujące przeliczenia FX: ${missingFxTransactions}. Widok USD ${usdSeriesAvailable ? 'działa częściowo' : 'jest niedostępny'}.`
      : `Missing FX conversions: ${missingFxTransactions}. USD view is ${usdSeriesAvailable ? 'partially available' : 'unavailable'}.`,
  }
}

function buildGoldCheck(goldSeriesAvailable: boolean, isPolish: boolean): PortfolioDataQualityCheck {
  return goldSeriesAvailable
    ? {
        key: 'gold',
        label: isPolish ? 'Złoto' : 'Gold',
        status: 'PASS',
        message: isPolish
          ? 'Referencyjny widok złota jest dostępny dla bieżącego zakresu.'
          : 'The gold reference view is available for the current window.',
      }
    : {
        key: 'gold',
        label: isPolish ? 'Złoto' : 'Gold',
        status: 'WARN',
        message: isPolish
          ? 'Referencyjny widok złota jest obecnie niedostępny dla bieżącego zakresu.'
          : 'The gold reference view is currently unavailable for the active window.',
      }
}

function buildBenchmarkCheck({
  issueCount,
  availableBenchmarkCount,
  totalBenchmarkCount,
  isPolish,
}: {
  issueCount: number
  availableBenchmarkCount: number
  totalBenchmarkCount: number
  isPolish: boolean
}): PortfolioDataQualityCheck {
  if (totalBenchmarkCount === 0) {
    return {
      key: 'benchmarks',
      label: isPolish ? 'Benchmarki' : 'Benchmarks',
      status: 'INFO',
      message: isPolish ? 'Nie skonfigurowano jeszcze benchmarków.' : 'No benchmarks are configured yet.',
    }
  }

  if (issueCount === 0 && availableBenchmarkCount === totalBenchmarkCount) {
    return {
      key: 'benchmarks',
      label: isPolish ? 'Benchmarki' : 'Benchmarks',
      status: 'PASS',
      message: isPolish
        ? `Dostępne benchmarki: ${availableBenchmarkCount} z ${totalBenchmarkCount}.`
        : `Available benchmarks: ${availableBenchmarkCount} of ${totalBenchmarkCount}.`,
    }
  }

  return {
    key: 'benchmarks',
    label: isPolish ? 'Benchmarki' : 'Benchmarks',
    status: 'WARN',
    message: isPolish
      ? `Dostępne benchmarki: ${availableBenchmarkCount} z ${totalBenchmarkCount}; problemy serii: ${issueCount}.`
      : `Available benchmarks: ${availableBenchmarkCount} of ${totalBenchmarkCount}; series issues: ${issueCount}.`,
  }
}

function buildCpiCheck(cpiCoverageThroughMonth: string | null, isPolish: boolean): PortfolioDataQualityCheck {
  if (cpiCoverageThroughMonth) {
    return {
      key: 'cpi',
      label: isPolish ? 'CPI' : 'CPI',
      status: 'PASS',
      message: isPolish
        ? `Pokrycie CPI do ${formatYearMonth(cpiCoverageThroughMonth)}.`
        : `CPI coverage through ${formatYearMonth(cpiCoverageThroughMonth)}.`,
    }
  }

  return {
    key: 'cpi',
    label: isPolish ? 'CPI' : 'CPI',
    status: 'WARN',
    message: isPolish
      ? 'Brak dostępnego okna CPI dla realnego PLN.'
      : 'No CPI coverage window is currently available for real PLN.',
  }
}

function buildRefreshCheck({
  historyRefreshAt,
  returnsRefreshAt,
  refreshStatus,
  isPolish,
}: {
  historyRefreshAt: string | null
  returnsRefreshAt: string | null
  refreshStatus: ReadModelRefreshStatus
  isPolish: boolean
}): PortfolioDataQualityCheck {
  const lastSuccessfulRefreshAt = latestTimestamp([
    refreshStatus.lastSuccessAt,
    historyRefreshAt,
    returnsRefreshAt,
  ])

  if (
    refreshStatus.lastFailureAt &&
    (!lastSuccessfulRefreshAt || compareTimestamps(refreshStatus.lastFailureAt, lastSuccessfulRefreshAt) > 0)
  ) {
    const failureMessage = refreshStatus.lastFailureMessage ?? (isPolish ? 'Ostatni refresh zakończył się błędem.' : 'The latest refresh failed.')
    return {
      key: 'refresh',
      label: isPolish ? 'Odświeżanie read modeli' : 'Read-model refresh',
      status: 'WARN',
      message: isPolish
        ? `Ostatni refresh nie powiódł się ${refreshStatus.lastFailureAt}: ${failureMessage}`
        : `The latest refresh failed at ${refreshStatus.lastFailureAt}: ${failureMessage}`,
    }
  }

  if (lastSuccessfulRefreshAt) {
    return {
      key: 'refresh',
      label: isPolish ? 'Odświeżanie read modeli' : 'Read-model refresh',
      status: 'PASS',
      message: isPolish
        ? `Ostatnie udane odświeżenie: ${lastSuccessfulRefreshAt}.`
        : `Last successful refresh: ${lastSuccessfulRefreshAt}.`,
    }
  }

  return {
    key: 'refresh',
    label: isPolish ? 'Odświeżanie read modeli' : 'Read-model refresh',
    status: 'INFO',
    message: isPolish
      ? 'Read modele nie były jeszcze odświeżane w tle.'
      : 'Read models have not been refreshed in the background yet.',
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

function notAvailableLabel(isPolish: boolean) {
  return isPolish ? 'b/d' : 'N/A'
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
