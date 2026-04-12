import { useId, useState, type FormEvent } from 'react'
import type { PortfolioAllocationSummary } from '../api/read-model'
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

export function ContributionPlannerPanel({
  allocation,
  autoFocus = false,
}: ContributionPlannerPanelProps) {
  const contributionAmountInputId = useId()
  const [contributionAmountInput, setContributionAmountInput] = useState('')
  const [submittedContributionAmount, setSubmittedContributionAmount] = useState<string | null>(null)
  const [contributionPlanRevision, setContributionPlanRevision] = useState(0)
  const [contributionPlannerActionError, setContributionPlannerActionError] = useState<string | null>(null)
  const contributionPlanQuery = usePortfolioContributionPlan(submittedContributionAmount, contributionPlanRevision)

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
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-400">{t('targets.contributionPlannerDescription')}</p>
        <p className="mt-2 text-xs text-zinc-500">{t('targets.contributionPlannerAssumption')}</p>
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{t('targets.contributionAmount')}</span>
              <strong className="mt-1 block text-sm text-zinc-100">{formatCurrencyPln(contributionPlanQuery.data.amountPln)}</strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{t('targets.projectedAction')}</span>
              <strong className="mt-1 block text-sm text-zinc-100">
                {labelAllocationAction(contributionPlanQuery.data.projected.recommendedAction)}
              </strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{t('targets.projectedOutsideBand')}</span>
              <strong className="mt-1 block text-sm text-zinc-100">
                {contributionPlanQuery.data.projected.breachedBucketCount}
              </strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{t('targets.projectedRemainingGap')}</span>
              <strong className="mt-1 block text-sm text-zinc-100">
                {formatCurrencyPln(contributionPlanQuery.data.projected.remainingContributionGapPln)}
              </strong>
            </article>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {contributionPlanQuery.data.buckets.map((bucket) => (
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

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-2">
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
