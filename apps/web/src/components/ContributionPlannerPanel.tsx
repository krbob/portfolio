import { useEffect, useId, useState, type FormEvent } from 'react'
import type { PortfolioAllocationSummary, PortfolioContributionPlan } from '../api/read-model'
import { usePortfolioContributionPlan } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { labelAssetClass } from '../lib/labels'
import { t } from '../lib/messages'
import { badge, badgeVariants, btnPrimary, input, label as labelClass } from '../lib/styles'
import { StatePanel } from './ui'

interface ContributionPlannerPanelProps {
  allocation: PortfolioAllocationSummary | undefined
  autoFocus?: boolean
}

type ContributionScenario = NonNullable<PortfolioContributionPlan['scenarios']>[number]

export function ContributionPlannerPanel({
  allocation,
  autoFocus = false,
}: ContributionPlannerPanelProps) {
  const currentTargetMix = extractCurrentTargetMix(allocation)
  const contributionAmountInputId = useId()
  const targetEquitiesInputId = useId()
  const [contributionAmountInput, setContributionAmountInput] = useState('')
  const [submittedContributionAmount, setSubmittedContributionAmount] = useState<string | null>(null)
  const [contributionPlanRevision, setContributionPlanRevision] = useState(0)
  const [contributionPlannerActionError, setContributionPlannerActionError] = useState<string | null>(null)
  const [targetEquitiesInput, setTargetEquitiesInput] = useState('')
  const [submittedTargetEquitiesWeightPct, setSubmittedTargetEquitiesWeightPct] = useState<string | null>(null)
  const [targetSimulationRevision, setTargetSimulationRevision] = useState(0)
  const [targetSimulationActionError, setTargetSimulationActionError] = useState<string | null>(null)
  const contributionPlanQuery = usePortfolioContributionPlan(submittedContributionAmount, contributionPlanRevision)
  const targetSimulationQuery = usePortfolioContributionPlan(
    submittedTargetEquitiesWeightPct ? submittedContributionAmount : null,
    targetSimulationRevision,
    { equitiesTargetWeightPct: submittedTargetEquitiesWeightPct },
  )

  useEffect(() => {
    if (currentTargetMix && targetEquitiesInput === '') {
      setTargetEquitiesInput(currentTargetMix.equitiesTargetWeightPct)
    }
  }, [currentTargetMix, targetEquitiesInput])

  function handleContributionPlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setContributionPlannerActionError(null)

    if (!allocation?.configured) {
      setContributionPlannerActionError(t('targets.noConfigDescription'))
      return
    }

    const sanitizedAmount = sanitizeMoneyInput(contributionAmountInput)
    const numericAmount = Number(sanitizedAmount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setContributionPlannerActionError(t('targets.contributionAmountInvalid'))
      return
    }

    setContributionAmountInput(sanitizedAmount)
    setSubmittedContributionAmount(numericAmount.toFixed(2))
    setContributionPlanRevision((current) => current + 1)
    setSubmittedTargetEquitiesWeightPct(null)
    setTargetSimulationActionError(null)
  }

  function handleTargetSimulationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTargetSimulationActionError(null)

    if (!submittedContributionAmount) {
      setTargetSimulationActionError(t('targets.whatIfRequiresBasePlan'))
      return
    }
    if (!currentTargetMix) {
      setTargetSimulationActionError(t('common.unavailable'))
      return
    }

    const sanitizedTarget = sanitizePercentInput(targetEquitiesInput)
    const numericTarget = Number(sanitizedTarget)
    if (!Number.isFinite(numericTarget) || numericTarget < 0 || numericTarget > currentTargetMix.investableWeightPct) {
      setTargetSimulationActionError(t('targets.whatIfInvalidTarget'))
      return
    }
    if (Number(currentTargetMix.equitiesTargetWeightPct) === Number(numericTarget.toFixed(2))) {
      setTargetSimulationActionError(t('targets.whatIfSameTarget'))
      return
    }

    setTargetEquitiesInput(sanitizedTarget)
    setSubmittedTargetEquitiesWeightPct(numericTarget.toFixed(2))
    setTargetSimulationRevision((current) => current + 1)
  }

  const plannerBuckets = visiblePlannerBuckets(contributionPlanQuery.data?.buckets)
  const minimalContribution = contributionPlanQuery.data?.minimalContributionToTolerancePln
  const scenarios = contributionPlanQuery.data?.scenarios ?? []
  const requestedScenarioAmount = contributionPlanQuery.data?.amountPln ?? null
  const minimalScenarioAmount = minimalContribution && Number(minimalContribution) > 0 ? minimalContribution : null
  const targetSimulationMixLabel = submittedTargetEquitiesWeightPct && currentTargetMix
    ? formatTargetMixLabel(
      submittedTargetEquitiesWeightPct,
      (currentTargetMix.investableWeightPct - Number(submittedTargetEquitiesWeightPct)).toFixed(2),
    )
    : null

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-400">{t('targets.contributionPlannerDescription')}</p>
        <p className="mt-2 text-xs text-zinc-500">{t('targets.contributionPlannerAssumption')}</p>
        {currentTargetMix ? (
          <p className="mt-2 text-xs text-zinc-500">
            {t('targets.currentTargetMix')}: {formatTargetMixLabel(
              currentTargetMix.equitiesTargetWeightPct,
              currentTargetMix.bondsTargetWeightPct,
            )}
          </p>
        ) : null}
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleContributionPlanSubmit}>
        <div className="sm:min-w-[220px]">
          <label htmlFor={contributionAmountInputId} className={labelClass}>{t('targets.contributionAmount')}</label>
          <div className="relative">
            <input
              id={contributionAmountInputId}
              className={`${input} pr-14`}
              inputMode="decimal"
              value={contributionAmountInput}
              autoFocus={autoFocus}
              onChange={(event) => setContributionAmountInput(sanitizeMoneyInput(event.target.value))}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
              {t('targets.contributionCurrency')}
            </span>
          </div>
        </div>
        <button
          type="submit"
          className={btnPrimary}
          disabled={contributionPlanQuery.isFetching}
        >
          {contributionPlanQuery.isFetching ? t('targets.calculatingContributionPlan') : t('targets.calculateContributionPlan')}
        </button>
      </form>

      {contributionPlannerActionError ? <p className="text-sm text-red-400">{contributionPlannerActionError}</p> : null}
      {contributionPlanQuery.isError ? <p className="text-sm text-red-400">{contributionPlanQuery.error.message}</p> : null}

      {contributionPlanQuery.isLoading ? (
        <p className="text-sm text-zinc-500">{t('targets.calculatingContributionPlan')}</p>
      ) : contributionPlanQuery.data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PlannerMetricCard
              label={t('targets.contributionAmount')}
              value={formatCurrencyPln(contributionPlanQuery.data.amountPln)}
            />
            <PlannerMetricCard
              label={t('targets.minimalContributionToTolerance')}
              value={formatCurrencyPln(minimalContribution)}
            />
            <PlannerMetricCard
              label={t('targets.projectedAction')}
              value={labelAllocationAction(contributionPlanQuery.data.projected.recommendedAction)}
            />
            <PlannerMetricCard
              label={t('targets.projectedRemainingGap')}
              value={formatCurrencyPln(contributionPlanQuery.data.projected.remainingContributionGapPln)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {plannerBuckets.map((bucket) => (
              <article key={bucket.assetClass} className="rounded-lg border border-zinc-800/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">{labelAssetClass(bucket.assetClass)}</h4>
                    <p className="mt-1 text-sm text-zinc-500">
                      {t('targets.plannedContribution')} {formatCurrencyPln(bucket.plannedContributionPln)}
                    </p>
                  </div>
                  <span className={`${badge} ${statusVariant(bucket.projectedStatus)}`}>{labelTargetStatus(bucket.projectedStatus)}</span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-zinc-500">{t('targets.projectedWeight')}</dt>
                    <dd className="text-zinc-100">{formatPercent(bucket.projectedWeightPct, { maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{t('targets.projectedValue')}</dt>
                    <dd className="text-zinc-100">{formatCurrencyPln(bucket.projectedValuePln)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{t('targets.projectedDrift')}</dt>
                    <dd className={driftColor(bucket.projectedDriftPctPoints)}>
                      {formatPercent(bucket.projectedDriftPctPoints, { signed: true, maximumFractionDigits: 2, suffix: ' pp' })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{t('targets.projectedGap')}</dt>
                    <dd className={gapColor(bucket.projectedGapValuePln)}>
                      {formatSignedCurrencyPln(bucket.projectedGapValuePln)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <section className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-zinc-100">{t('targets.scenariosTitle')}</h4>
              <p className="mt-1 text-xs text-zinc-500">{t('targets.scenariosDescription')}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {scenarios.map((scenario) => (
                <ScenarioCard
                  key={scenario.amountPln}
                  scenario={scenario}
                  requestedScenarioAmount={requestedScenarioAmount}
                  minimalScenarioAmount={minimalScenarioAmount}
                />
              ))}
            </div>
          </section>

          {currentTargetMix ? (
            <section className="space-y-4 rounded-lg border border-zinc-800/50 p-4">
              <div>
                <h4 className="text-sm font-semibold text-zinc-100">{t('targets.whatIfTitle')}</h4>
                <p className="mt-1 text-xs text-zinc-500">{t('targets.whatIfDescription')}</p>
              </div>

              <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={handleTargetSimulationSubmit}>
                <div className="md:min-w-[180px]">
                  <label htmlFor={targetEquitiesInputId} className={labelClass}>{t('targets.whatIfEquitiesTarget')}</label>
                  <div className="relative">
                    <input
                      id={targetEquitiesInputId}
                      className={`${input} pr-10`}
                      inputMode="decimal"
                      value={targetEquitiesInput}
                      onChange={(event) => setTargetEquitiesInput(sanitizePercentInput(event.target.value))}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">%</span>
                  </div>
                </div>
                <div className="md:min-w-[180px]">
                  <span className={labelClass}>{t('targets.whatIfBondsTarget')}</span>
                  <div className="mt-2 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-3 text-sm text-zinc-300">
                    {formatPercent(
                      currentTargetMix.investableWeightPct - Number(targetEquitiesInput || 0),
                      { maximumFractionDigits: 2 },
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={targetSimulationQuery.isFetching}
                >
                  {targetSimulationQuery.isFetching ? t('targets.whatIfCalculating') : t('targets.whatIfCalculate')}
                </button>
              </form>

              {targetSimulationActionError ? <p className="text-sm text-red-400">{targetSimulationActionError}</p> : null}
              {targetSimulationQuery.isError ? <p className="text-sm text-red-400">{targetSimulationQuery.error.message}</p> : null}

              {targetSimulationQuery.data && targetSimulationMixLabel ? (
                <div className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                      {t('targets.whatIfSimulatedTarget')}
                    </span>
                    <span className={`${badge} ${badgeVariants.info}`}>{targetSimulationMixLabel}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <PlannerMetricCard
                      label={t('targets.minimalContributionToTolerance')}
                      value={formatCurrencyPln(targetSimulationQuery.data.minimalContributionToTolerancePln)}
                    />
                    <PlannerMetricCard
                      label={t('targets.projectedAction')}
                      value={labelAllocationAction(targetSimulationQuery.data.projected.recommendedAction)}
                    />
                    <PlannerMetricCard
                      label={t('targets.projectedRemainingGap')}
                      value={formatCurrencyPln(targetSimulationQuery.data.projected.remainingContributionGapPln)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {visiblePlannerBuckets(targetSimulationQuery.data.buckets).map((bucket) => (
                      <article key={bucket.assetClass} className="rounded-lg border border-zinc-800/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-zinc-100">{labelAssetClass(bucket.assetClass)}</h5>
                            <p className="mt-1 text-sm text-zinc-500">
                              {t('targets.plannedContribution')} {formatCurrencyPln(bucket.plannedContributionPln)}
                            </p>
                          </div>
                          <span className={`${badge} ${statusVariant(bucket.projectedStatus)}`}>{labelTargetStatus(bucket.projectedStatus)}</span>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-zinc-500">{t('targets.projectedWeight')}</dt>
                            <dd className="text-zinc-100">{formatPercent(bucket.projectedWeightPct, { maximumFractionDigits: 2 })}</dd>
                          </div>
                          <div>
                            <dt className="text-zinc-500">{t('targets.projectedDrift')}</dt>
                            <dd className={driftColor(bucket.projectedDriftPctPoints)}>
                              {formatPercent(bucket.projectedDriftPctPoints, { signed: true, maximumFractionDigits: 2, suffix: ' pp' })}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : (
        <StatePanel
          eyebrow={t('targets.contributionPlannerTitle')}
          title={t('targets.contributionPlannerEmptyTitle')}
          description={t('targets.contributionPlannerEmptyDescription')}
          className="border-0 bg-transparent px-0 py-6"
        />
      )}
    </div>
  )
}

function sanitizeMoneyInput(value: string) {
  return value.replace(',', '.').replace(/[^0-9.]/g, '')
}

function sanitizePercentInput(value: string) {
  return value.replace(',', '.').replace(/[^0-9.]/g, '')
}

function visiblePlannerBuckets(
  buckets: PortfolioContributionPlan['buckets'] | undefined,
) {
  return (buckets ?? []).filter((bucket) => bucket.assetClass !== 'CASH' && bucket.projectedStatus !== 'UNCONFIGURED')
}

function extractCurrentTargetMix(allocation: PortfolioAllocationSummary | undefined) {
  if (!allocation) {
    return null
  }

  const equities = allocation.buckets.find((bucket) => bucket.assetClass === 'EQUITIES')?.targetWeightPct
  const bonds = allocation.buckets.find((bucket) => bucket.assetClass === 'BONDS')?.targetWeightPct
  if (!equities || !bonds) {
    return null
  }

  const cash = allocation.buckets.find((bucket) => bucket.assetClass === 'CASH')?.targetWeightPct ?? '0.00'
  return {
    equitiesTargetWeightPct: Number(equities).toFixed(2),
    bondsTargetWeightPct: Number(bonds).toFixed(2),
    investableWeightPct: Number((100 - Number(cash)).toFixed(2)),
  }
}

function formatTargetMixLabel(equitiesTargetWeightPct: string | number, bondsTargetWeightPct: string | number) {
  return `${formatPercent(equitiesTargetWeightPct, { maximumFractionDigits: 0 })} / ${formatPercent(bondsTargetWeightPct, { maximumFractionDigits: 0 })}`
}

function PlannerMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-zinc-800/50 p-4">
      <span className="text-xs text-zinc-500">{label}</span>
      <strong className="mt-1 block text-sm text-zinc-100">{value}</strong>
    </article>
  )
}

function ScenarioCard({
  scenario,
  requestedScenarioAmount,
  minimalScenarioAmount,
}: {
  scenario: ContributionScenario
  requestedScenarioAmount: string | null
  minimalScenarioAmount: string | null
}) {
  const equities = scenario.buckets.find((bucket) => bucket.assetClass === 'EQUITIES')
  const bonds = scenario.buckets.find((bucket) => bucket.assetClass === 'BONDS')
  const labels = [
    scenario.amountPln === requestedScenarioAmount ? t('targets.scenarioRequested') : null,
    scenario.amountPln === minimalScenarioAmount ? t('targets.scenarioMinimum') : null,
  ].filter(Boolean)

  return (
    <article className="rounded-lg border border-zinc-800/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold text-zinc-100">{formatCurrencyPln(scenario.amountPln)}</h5>
          <p className="mt-1 text-xs text-zinc-500">{labels.length > 0 ? labels.join(' · ') : t('targets.scenarioSplit')}</p>
        </div>
        <span className={`${badge} ${scenario.withinTolerance ? badgeVariants.success : badgeVariants.warning}`}>
          {labelAllocationAction(scenario.projectedAction)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-zinc-500">{labelAssetClass('EQUITIES')}</dt>
          <dd className="text-zinc-100">{formatCurrencyPln(equities?.plannedContributionPln)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{labelAssetClass('BONDS')}</dt>
          <dd className="text-zinc-100">{formatCurrencyPln(bonds?.plannedContributionPln)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t('targets.projectedOutsideBand')}</dt>
          <dd className="text-zinc-100">{scenario.breachedBucketCount}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t('targets.projectedRemainingGap')}</dt>
          <dd className="text-zinc-100">{formatCurrencyPln(scenario.remainingContributionGapPln)}</dd>
        </div>
      </dl>
    </article>
  )
}

function driftColor(value: string | null | undefined) {
  if (value == null) {
    return 'text-zinc-500'
  }

  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return 'text-zinc-500'
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
    return 'text-zinc-500'
  }

  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return 'text-zinc-500'
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
