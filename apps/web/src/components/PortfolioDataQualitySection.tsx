import { Card, ErrorState, LoadingState, SectionHeader } from './ui'
import { usePortfolioDataQuality } from '../hooks/use-portfolio-data-quality'
import { notApplicableLabel } from '../lib/availability'
import { formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { badge, badgeVariants } from '../lib/styles'

export function PortfolioDataQualitySection() {
  const { isPolish } = useI18n()
  const { summary, isLoading, error, refetchAll } = usePortfolioDataQuality()

  return (
    <Card as="section" id="data-quality">
      <SectionHeader
        eyebrow={isPolish ? 'Jakość danych' : 'Data quality'}
        title={isPolish ? 'Zaufanie do danych portfela' : 'Portfolio data trust'}
        description={isPolish
          ? 'Sprawdź pokrycie wyceny, benchmarków, CPI oraz ostatnie odświeżenie większych modeli odczytowych.'
          : 'Inspect valuation coverage, benchmark coverage, CPI coverage and the latest heavy read-model refresh.'}
      />

      {isLoading && (
        <LoadingState
          title={isPolish ? 'Ładowanie jakości danych' : 'Loading data quality'}
          description={isPolish
            ? 'Składanie sygnałów z wyceny, historii, benchmarków i pamięci modeli odczytowych.'
            : 'Combining valuation, history, benchmark and read-model cache signals.'}
          variant="inline"
          blocks={3}
        />
      )}

      {!isLoading && error && !summary && (
        <ErrorState
          title={isPolish ? 'Jakość danych niedostępna' : 'Data quality unavailable'}
          description={isPolish
            ? 'Nie udało się złożyć sygnałów jakości danych. Spróbuj ponownie.'
            : 'Portfolio could not assemble the current data-quality signals. Retry now.'}
          onRetry={() => void refetchAll()}
          className="border-0 bg-transparent px-0 py-8"
        />
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4 xl:grid-cols-5">
            <MetricCard
              label={isPolish ? 'Status' : 'Status'}
              value={overallStatusLabel(summary.overallStatus, isPolish)}
            />
            <MetricCard
              label={isPolish ? 'Wycena' : 'Valuation'}
              value={summary.valuationCoverageLabel}
            />
            <MetricCard
              label={isPolish ? 'Benchmarki' : 'Benchmarks'}
              value={summary.benchmarkCoverageLabel}
            />
            <MetricCard
              label={isPolish ? 'CPI do' : 'CPI through'}
              value={summary.cpiCoverageThroughLabel}
            />
            <MetricCard
              label={isPolish ? 'Ostatni refresh' : 'Last refresh'}
              value={summary.lastRefreshAt ? formatDateTime(summary.lastRefreshAt) : notApplicableLabel(isPolish)}
            />
          </div>

          <div className="space-y-3">
            {summary.checks.map((check) => (
              <article className="rounded-lg border border-zinc-800/50 p-4" key={check.key}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <strong className="text-sm text-zinc-100">{check.label}</strong>
                    <p className="mt-1 text-sm text-zinc-500">{check.message}</p>
                  </div>
                  <span className={`${badge} ${qualityBadgeVariant(check.status)}`}>
                    {overallStatusLabel(check.status, isPolish)}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {summary.checks.some((check) => check.status === 'WARN') ? (
            <p className="mt-4 text-sm text-zinc-500">
              {isPolish
                ? 'Szczegóły awarii upstreamów znajdziesz niżej w audycie operacyjnym i panelu gotowości środowiska.'
                : 'Detailed upstream failures appear below in the operational audit and runtime readiness panels.'}
            </p>
          ) : null}
        </>
      )}
    </Card>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-zinc-800/50 p-4">
      <span className="text-xs text-zinc-500">{label}</span>
      <strong className="mt-1 block text-sm text-zinc-100">{value}</strong>
    </article>
  )
}

function overallStatusLabel(status: 'PASS' | 'WARN' | 'INFO', isPolish: boolean) {
  if (isPolish) {
    switch (status) {
      case 'PASS':
        return 'OK'
      case 'WARN':
        return 'UWAGA'
      case 'INFO':
        return 'INFO'
    }
  }

  switch (status) {
    case 'PASS':
      return 'Healthy'
    case 'WARN':
      return 'Degraded'
    case 'INFO':
      return 'Info'
  }
}

function qualityBadgeVariant(status: 'PASS' | 'WARN' | 'INFO') {
  switch (status) {
    case 'PASS':
      return badgeVariants.success
    case 'WARN':
      return badgeVariants.warning
    case 'INFO':
      return badgeVariants.info
  }
}
