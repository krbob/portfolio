import { useMemo } from 'react'
import { useReadModelRefreshStatus } from './use-write-model'
import { usePortfolioDailyHistory, usePortfolioOverview, usePortfolioReturns, useReadModelCacheSnapshots } from './use-read-model'
import { buildPortfolioDataQualitySummary } from '../lib/data-quality'
import { useI18n } from '../lib/i18n'

export function usePortfolioDataQuality() {
  const { isPolish } = useI18n()
  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const returnsQuery = usePortfolioReturns()
  const cacheQuery = useReadModelCacheSnapshots()
  const refreshStatusQuery = useReadModelRefreshStatus()

  const summary = useMemo(
    () =>
      buildPortfolioDataQualitySummary({
        overview: overviewQuery.data,
        history: historyQuery.data,
        returns: returnsQuery.data,
        cacheSnapshots: cacheQuery.data,
        refreshStatus: refreshStatusQuery.data,
        isPolish,
      }),
    [overviewQuery.data, historyQuery.data, returnsQuery.data, cacheQuery.data, refreshStatusQuery.data, isPolish],
  )

  const isLoading =
    (overviewQuery.isLoading || historyQuery.isLoading || returnsQuery.isLoading) &&
    !summary

  const error =
    overviewQuery.error ??
    historyQuery.error ??
    returnsQuery.error ??
    cacheQuery.error ??
    refreshStatusQuery.error ??
    null

  async function refetchAll() {
    await Promise.all([
      overviewQuery.refetch(),
      historyQuery.refetch(),
      returnsQuery.refetch(),
      cacheQuery.refetch(),
      refreshStatusQuery.refetch(),
    ])
  }

  return {
    summary,
    isLoading,
    error,
    refetchAll,
  }
}
