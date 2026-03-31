import { Card, ErrorState, LoadingState, SectionHeader } from './ui'
import { usePortfolioDataQuality } from '../hooks/use-portfolio-data-quality'
import { notApplicableLabel } from '../lib/availability'
import { formatDateTime } from '../lib/format'
import { getActiveUiLanguage } from '../lib/i18n'
import { t } from '../lib/messages'
import { badge, badgeVariants } from '../lib/styles'

export function PortfolioDataQualitySection() {
  const { summary, isLoading, error, refetchAll } = usePortfolioDataQuality()

  return (
    <Card as="section" id="data-quality">
      <SectionHeader
        eyebrow={t('dataQuality.eyebrow')}
        title={t('dataQuality.title')}
        description={t('dataQuality.description')}
      />

      {isLoading && (
        <LoadingState
          title={t('dataQuality.loadingTitle')}
          description={t('dataQuality.loadingDescription')}
          variant="inline"
          blocks={3}
        />
      )}

      {!isLoading && error && !summary && (
        <ErrorState
          title={t('dataQuality.errorTitle')}
          description={t('dataQuality.errorDescription')}
          onRetry={() => void refetchAll()}
          className="border-0 bg-transparent px-0 py-8"
        />
      )}

      {summary && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 gap-4 mb-4 xl:grid-cols-5">
            <MetricCard
              label={t('dataQuality.status')}
              value={overallStatusLabel(summary.overallStatus)}
            />
            <MetricCard
              label={t('dataQuality.valuation')}
              value={summary.valuationCoverageLabel}
            />
            <MetricCard
              label={t('dataQuality.benchmarks')}
              value={summary.benchmarkCoverageLabel}
            />
            <MetricCard
              label={t('dataQuality.cpiThrough')}
              value={summary.cpiCoverageThroughLabel}
            />
            <MetricCard
              label={t('dataQuality.lastRefresh')}
              value={summary.lastRefreshAt ? formatDateTime(summary.lastRefreshAt) : notApplicableLabel(getActiveUiLanguage() === 'pl')}
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
                    {overallStatusLabel(check.status)}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {summary.checks.some((check) => check.status === 'WARN') ? (
            <p className="mt-4 text-sm text-zinc-500">
              {t('dataQuality.upstreamHint')}
            </p>
          ) : null}
        </div>
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

function overallStatusLabel(status: 'PASS' | 'WARN' | 'INFO') {
  switch (status) {
    case 'PASS':
      return t('dataQuality.statusPass')
    case 'WARN':
      return t('dataQuality.statusWarn')
    case 'INFO':
      return t('dataQuality.statusInfo')
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
