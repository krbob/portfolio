import { useMemo } from 'react'
import { usePortfolioOverview, useMarketDataSnapshots } from './use-read-model'
import { useAppReadiness } from './use-app-readiness'
import { buildStaleMarketDataAlert } from '../lib/stale-market-data-alert'
import { useI18n } from '../lib/i18n'

export function useStaleMarketDataAlert() {
  const { language } = useI18n()
  const overviewQuery = usePortfolioOverview()
  const snapshotsQuery = useMarketDataSnapshots()
  const readinessQuery = useAppReadiness()

  const alert = useMemo(
    () =>
      buildStaleMarketDataAlert({
        overview: overviewQuery.data,
        snapshots: snapshotsQuery.data,
        readiness: readinessQuery.data,
        language,
      }),
    [overviewQuery.data, snapshotsQuery.data, readinessQuery.data, language],
  )

  const isLoading =
    (overviewQuery.isLoading || snapshotsQuery.isLoading || readinessQuery.isLoading) &&
    !alert

  const error =
    overviewQuery.error ??
    snapshotsQuery.error ??
    readinessQuery.error ??
    null

  async function refetchAll() {
    await Promise.all([
      overviewQuery.refetch(),
      snapshotsQuery.refetch(),
      readinessQuery.refetch(),
    ])
  }

  return {
    alert,
    isLoading,
    error,
    refetchAll,
  }
}
