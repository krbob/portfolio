import { useEffect, useState, type FormEvent } from 'react'
import { usePortfolioAllocation, usePortfolioAuditEvents } from '../hooks/use-read-model'
import {
  usePortfolioRebalancingSettings,
  useSavePortfolioRebalancingSettings,
} from '../hooks/use-write-model'
import { formatDateTime } from '../lib/format'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { formatAuditEventMessage, formatAuditEventTitle } from '../lib/audit-copy'
import { labelAssetClass } from '../lib/labels'
import { formatMessage, t } from '../lib/messages'
import {
  badge,
  badgeVariants,
  btnPrimary,
  input,
  label as labelClass,
} from '../lib/styles'
import { Badge, Card, SegmentedControl, StatePanel } from './ui'
import { PortfolioTargetScheduleEditor } from './PortfolioTargetScheduleEditor'

type RebalancingMode = 'CONTRIBUTIONS_ONLY' | 'ALLOW_TRIMS'

export function PortfolioTargetsSection() {
  const { language } = useI18n()
  const targetEventsQuery = usePortfolioAuditEvents({ limit: 8, category: 'TARGETS' })
  const allocationQuery = usePortfolioAllocation()
  const rebalancingSettingsQuery = usePortfolioRebalancingSettings()
  const saveRebalancingSettingsMutation = useSavePortfolioRebalancingSettings()

  const [toleranceBandInput, setToleranceBandInput] = useState('5.00')
  const [rebalancingMode, setRebalancingMode] = useState<RebalancingMode>('CONTRIBUTIONS_ONLY')
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null)
  const [settingsActionError, setSettingsActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!rebalancingSettingsQuery.data) {
      return
    }
    setToleranceBandInput(rebalancingSettingsQuery.data.toleranceBandPctPoints)
    setRebalancingMode(rebalancingSettingsQuery.data.mode as RebalancingMode)
  }, [rebalancingSettingsQuery.data])


  async function handleRebalancingSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSettingsFeedback(null)
    setSettingsActionError(null)

    try {
      const result = await saveRebalancingSettingsMutation.mutateAsync({
        toleranceBandPctPoints: sanitizePercentInput(toleranceBandInput) || '0',
        mode: rebalancingMode,
      })
      setSettingsFeedback(
        formatMessage(t('targets.savePolicyFeedback'), {
          band: formatPercent(result.toleranceBandPctPoints, { maximumFractionDigits: 2, suffix: ' pp' }),
          mode: labelRebalancingMode(result.mode).toLowerCase(),
        }),
      )
    } catch (error) {
      setSettingsActionError(
        error instanceof Error
          ? error.message
          : t('targets.savingRebalancingFailed'),
      )
    }
  }

  const allocation = allocationQuery.data
  const strategyModeOptions: Array<{ value: RebalancingMode; label: string }> = [
    {
      value: 'CONTRIBUTIONS_ONLY',
      label: t('targets.contributionsOnly'),
    },
    {
      value: 'ALLOW_TRIMS',
      label: t('targets.allowTrims'),
    },
  ]

  return (
    <Card as="section" id="targets">
      <PortfolioTargetScheduleEditor />

      <form className="mt-5 rounded-lg border border-zinc-800/50 p-4 space-y-4" onSubmit={handleRebalancingSettingsSubmit}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">{t('targets.rebalancingPolicy')}</h4>
            <p className="mt-1 text-sm text-zinc-400">
              {t('targets.rebalancingPolicyDescription')}
            </p>
          </div>

          <button
            type="submit"
            className={btnPrimary}
            disabled={saveRebalancingSettingsMutation.isPending}
          >
            {saveRebalancingSettingsMutation.isPending
              ? t('common.saving')
              : t('targets.savePolicy')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <label>
            <span className={labelClass}>{t('targets.toleranceBand')}</span>
            <div className="relative">
              <input
                className={`${input} pr-14`}
                inputMode="decimal"
                value={toleranceBandInput}
                onChange={(event) => setToleranceBandInput(sanitizePercentInput(event.target.value))}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-400">
                pp
              </span>
            </div>
          </label>

          <div>
            <span className={labelClass}>{t('targets.rebalancingMode')}</span>
            <SegmentedControl
              value={rebalancingMode}
              onChange={setRebalancingMode}
              options={strategyModeOptions}
              ariaLabel={t('targets.rebalancingMode')}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="info">
            {t('targets.band')} ±{formatPercent(toleranceBandInput || '0', { maximumFractionDigits: 2, suffix: ' pp' })}
          </Badge>
          <Badge variant="default">{labelRebalancingMode(rebalancingMode)}</Badge>
        </div>

        {settingsFeedback && <p className="text-sm text-emerald-400">{settingsFeedback}</p>}
        {settingsActionError && <p className="text-sm text-red-400">{settingsActionError}</p>}
        {rebalancingSettingsQuery.isError && <p className="text-sm text-red-400">{rebalancingSettingsQuery.error.message}</p>}
      </form>

      <section className="mt-5 rounded-lg border border-zinc-800/50 p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">{t('targets.historyTitle')}</h4>
            <p className="mt-1 text-sm text-zinc-400">{t('targets.historyDescription')}</p>
          </div>
          <Badge variant="default">{targetEventsQuery.data?.length ?? 0}</Badge>
        </div>

        {targetEventsQuery.isLoading ? <p className="mt-4 text-sm text-zinc-400">{t('targets.loadingHistory')}</p> : null}
        {targetEventsQuery.isError ? <p className="mt-4 text-sm text-red-400">{targetEventsQuery.error.message}</p> : null}

        {!targetEventsQuery.isLoading && !targetEventsQuery.isError && (targetEventsQuery.data?.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">{t('targets.noHistory')}</p>
        ) : null}

        {!targetEventsQuery.isLoading && !targetEventsQuery.isError && (targetEventsQuery.data?.length ?? 0) > 0 ? (
          <div className="mt-4 space-y-3">
            {targetEventsQuery.data?.map((event) => (
              <article key={event.id} className="rounded-lg border border-zinc-800/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-sm text-zinc-100">{formatAuditEventTitle(event.action)}</strong>
                    <p className="mt-1 text-sm text-zinc-400">{formatAuditEventMessage(event, language)}</p>
                  </div>
                  <span className="text-xs text-zinc-400">{formatDateTime(event.occurredAt)}</span>
                </div>

                {event.metadata.previousMix || event.metadata.newMix ? (
                  <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-zinc-400">{t('targets.previousMix')}</dt>
                      <dd className="mt-1 text-zinc-100">{formatMixSummary(event.metadata.previousMix)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">{t('targets.newMix')}</dt>
                      <dd className="mt-1 text-zinc-100">{formatMixSummary(event.metadata.newMix)}</dd>
                    </div>
                  </dl>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {allocationQuery.isLoading || rebalancingSettingsQuery.isLoading ? (
        <p className="mt-5 text-sm text-zinc-400">{t('targets.loading')}</p>
      ) : null}
      {allocationQuery.isError ? <p className="mt-5 text-sm text-red-400">{allocationQuery.error.message}</p> : null}

      {!allocationQuery.isLoading && !rebalancingSettingsQuery.isLoading && !allocationQuery.isError && allocation ? (
        <>
          {!allocation.configured ? (
            <StatePanel
              eyebrow={t('targets.noConfigEyebrow')}
              title={t('targets.noConfigTitle')}
              description={t('targets.noConfigDescription')}
              className="mt-5"
            />
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-400">{t('targets.targetSum')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {formatPercent(allocation.targetWeightSumPct, { maximumFractionDigits: 2 })}
                  </strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-400">{t('targets.toleranceBand')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    ±{formatPercent(allocation.toleranceBandPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })}
                  </strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-400">{t('targets.strategyAction')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">{labelAllocationAction(allocation.recommendedAction)}</strong>
                  <p className="mt-1 text-xs text-zinc-400">
                    {labelRebalancingMode(allocation.rebalancingMode)}
                  </p>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-400">{t('targets.outsideBand')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {allocation.breachedBucketCount}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-400">
                    {allocation.largestBandBreachPctPoints
                      ? `${t('targets.largestBreach')} ${formatPercent(allocation.largestBandBreachPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })}`
                      : t('targets.allWithinBand')}
                  </p>
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-400">{t('targets.availableCash')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">{formatCurrencyPln(allocation.availableCashPln)}</strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-400">{t('targets.nextContribution')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {allocation.recommendedAssetClass
                      ? `${formatCurrencyPln(allocation.recommendedContributionPln)} -> ${labelAssetClass(allocation.recommendedAssetClass)}`
                      : t('targets.noPriority')}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-400">
                    {allocation.remainingContributionGapPln !== '0.00'
                      ? `${t('targets.remainingGap')}: ${formatCurrencyPln(allocation.remainingContributionGapPln)}`
                      : t('targets.cashCoversGap')}
                  </p>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-400">{t('targets.fullRebalance')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {formatCurrencyPln(allocation.fullRebalanceBuyAmountPln)} / {formatCurrencyPln(allocation.fullRebalanceSellAmountPln)}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-400">
                    {allocation.requiresSelling
                      ? t('targets.requiresSelling')
                      : t('targets.noBuysNeeded')}
                  </p>
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {allocation.buckets.map((bucket) => (
                  <article key={bucket.assetClass} className="rounded-lg border border-zinc-800/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-semibold text-zinc-100">{labelAssetClass(bucket.assetClass)}</h4>
                        <p className="mt-1 text-sm text-zinc-400">
                          {t('targets.current')} {formatPercent(bucket.currentWeightPct, { maximumFractionDigits: 2 })} · {t('targets.target')} {formatPercent(bucket.targetWeightPct, { maximumFractionDigits: 2 })}
                        </p>
                        {bucket.targetWeightPct && (
                          <p className="mt-1 text-xs text-zinc-400">
                            {t('targets.band')} {formatPercent(bucket.toleranceLowerPct, { maximumFractionDigits: 2 })} - {formatPercent(bucket.toleranceUpperPct, { maximumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <span className={`${badge} ${statusVariant(bucket.status)}`}>{labelTargetStatus(bucket.status)}</span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                      <div>
                        <dt className="text-zinc-400">{t('targets.currentValue')}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.currentValuePln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">{t('targets.targetValue')}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.targetValuePln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">{t('targets.drift')}</dt>
                        <dd className={driftColor(bucket.driftPctPoints)}>
                          {formatPercent(bucket.driftPctPoints, { signed: true, maximumFractionDigits: 2, suffix: ' pp' })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">{t('targets.gapToTarget')}</dt>
                        <dd className={gapColor(bucket.gapValuePln)}>
                          {formatSignedCurrencyPln(bucket.gapValuePln)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">{t('targets.suggestContribution')}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.suggestedContributionPln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">{t('targets.action')}</dt>
                        <dd className="text-zinc-100">{labelBucketAction(bucket.rebalanceAction)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </Card>
  )
}

function sanitizePercentInput(value: string) {
  return value.replace(',', '.').replace(/[^0-9.]/g, '')
}

function driftColor(value: string | null | undefined) {
  if (value == null) {
    return 'text-zinc-400'
  }

  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return 'text-zinc-400'
  }
  if (numeric > 0) {
    return 'text-emerald-400'
  }
  if (numeric < 0) {
    return 'text-red-400'
  }
  return 'text-zinc-300'
}

function gapColor(value: string | null | undefined) {
  if (value == null) {
    return 'text-zinc-400'
  }

  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return 'text-zinc-400'
  }
  if (numeric > 0) {
    return 'text-amber-400'
  }
  if (numeric < 0) {
    return 'text-sky-400'
  }
  return 'text-zinc-300'
}

function statusVariant(status: string) {
  switch (status) {
    case 'UNDERWEIGHT':
      return badgeVariants.warning
    case 'OVERWEIGHT':
      return badgeVariants.info
    case 'ON_TARGET':
      return badgeVariants.success
    default:
      return badgeVariants.default
  }
}

function labelTargetStatus(status: string) {
  switch (status) {
    case 'UNDERWEIGHT':
      return t('targets.statusUnderweight')
    case 'OVERWEIGHT':
      return t('targets.statusOverweight')
    case 'ON_TARGET':
      return t('targets.statusOnTarget')
    case 'UNCONFIGURED':
      return t('targets.statusUnconfigured')
    default:
      return status
  }
}

function labelRebalancingMode(mode: string) {
  return mode === 'ALLOW_TRIMS' ? t('targets.modeAllowTrims') : t('targets.modeContributions')
}

function labelAllocationAction(action: string) {
  switch (action) {
    case 'WITHIN_TOLERANCE':
      return t('targets.actionWithinTolerance')
    case 'DEPLOY_EXISTING_CASH':
      return t('targets.actionDeployCash')
    case 'WAIT_FOR_NEXT_CONTRIBUTION':
      return t('targets.actionWait')
    case 'FULL_REBALANCE':
      return t('targets.actionFullRebalance')
    default:
      return t('targets.actionNotConfigured')
  }
}

function labelBucketAction(action: string) {
  switch (action) {
    case 'BUY':
      return t('targets.bucketBuy')
    case 'SELL':
      return t('targets.bucketSell')
    case 'HOLD':
      return t('targets.bucketHold')
    default:
      return t('targets.bucketNa')
  }
}

function formatMixSummary(rawMix: string | undefined) {
  if (!rawMix) {
    return t('targets.historyEmptyMix')
  }

  return rawMix
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [assetClass, weight] = entry.split('=')
      const label = labelAssetClass(assetClass)
      const pct = Number(weight) * 100
      return Number.isFinite(pct)
        ? `${label} ${formatPercent(String(pct), { maximumFractionDigits: 2 })}`
        : label
    })
    .join(' · ')
}
