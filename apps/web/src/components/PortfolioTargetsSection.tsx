import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { usePortfolioAllocation } from '../hooks/use-read-model'
import { usePortfolioTargets, useReplacePortfolioTargets } from '../hooks/use-write-model'
import { formatCurrencyPln, formatPercent } from '../lib/format'
import {
  badge,
  badgeVariants,
  btnPrimary,
  btnSecondary,
  input,
  label as labelClass,
} from '../lib/styles'
import { Card, SectionHeader, StatePanel } from './ui'

type AssetClass = 'EQUITIES' | 'BONDS' | 'CASH'

const TARGET_FIELDS: Array<{ assetClass: AssetClass; label: string }> = [
  { assetClass: 'EQUITIES', label: 'Equities' },
  { assetClass: 'BONDS', label: 'Bonds' },
  { assetClass: 'CASH', label: 'Cash' },
]

const DEFAULT_TARGET_INPUTS: Record<AssetClass, string> = {
  EQUITIES: '80',
  BONDS: '20',
  CASH: '0',
}

export function PortfolioTargetsSection() {
  const targetsQuery = usePortfolioTargets()
  const allocationQuery = usePortfolioAllocation()
  const replaceTargetsMutation = useReplacePortfolioTargets()

  const [inputs, setInputs] = useState<Record<AssetClass, string>>(DEFAULT_TARGET_INPUTS)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (targetsQuery.data == null) {
      return
    }

    if (targetsQuery.data.length === 0) {
      setInputs(DEFAULT_TARGET_INPUTS)
      return
    }

    const nextInputs = { ...DEFAULT_TARGET_INPUTS }
    targetsQuery.data.forEach((target) => {
      const key = target.assetClass as AssetClass
      nextInputs[key] = String(Number(target.targetWeight) * 100)
    })
    setInputs(nextInputs)
  }, [targetsQuery.data])

  const totalPct = useMemo(
    () => TARGET_FIELDS.reduce((sum, field) => sum + toNumber(inputs[field.assetClass]), 0),
    [inputs],
  )
  const totalIsValid = Math.abs(totalPct - 100) < 0.0001
  const configuredMixLabel = TARGET_FIELDS
    .map((field) => `${formatPercent(inputs[field.assetClass], { maximumFractionDigits: 2 })} ${field.label.toLowerCase()}`)
    .join(' / ')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    if (!totalIsValid) {
      setActionError('Target weights must add up to exactly 100%.')
      return
    }

    try {
      const items = TARGET_FIELDS
        .map((field) => ({
          assetClass: field.assetClass,
          value: toNumber(inputs[field.assetClass]),
        }))
        .filter((item) => item.value > 0)
        .map((item) => ({
          assetClass: item.assetClass,
          targetWeight: (item.value / 100).toFixed(6),
        }))

      const result = await replaceTargetsMutation.mutateAsync({ items })
      setFeedback(`Saved target mix: ${result.map((item) => `${item.assetClass} ${formatPercent(item.targetWeight, { scale: 100, maximumFractionDigits: 2 })}`).join(' · ')}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Saving targets failed.')
    }
  }

  function applyPreset(inputsPreset: Record<AssetClass, string>) {
    setFeedback(null)
    setActionError(null)
    setInputs(inputsPreset)
  }

  const allocation = allocationQuery.data

  return (
    <Card as="section" id="targets">
      <SectionHeader
        eyebrow="Strategy"
        title="Target allocation"
        description="Configure the target mix used for allocation drift, contribution-first rebalance suggestions and the synthetic target-mix benchmark in Performance."
        actions={(
          <>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => applyPreset(DEFAULT_TARGET_INPUTS)}
            >
              Preset 80/20
            </button>
            <button
              type="submit"
              form="portfolio-targets-form"
              className={btnPrimary}
              disabled={replaceTargetsMutation.isPending || !totalIsValid}
            >
              {replaceTargetsMutation.isPending ? 'Saving...' : 'Save targets'}
            </button>
          </>
        )}
      />

      <form id="portfolio-targets-form" className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TARGET_FIELDS.map((field) => (
            <label key={field.assetClass}>
              <span className={labelClass}>{field.label}</span>
              <div className="relative">
                <input
                  className={`${input} pr-10`}
                  inputMode="decimal"
                  value={inputs[field.assetClass]}
                  onChange={(event) =>
                    setInputs((current) => ({ ...current, [field.assetClass]: sanitizePercentInput(event.target.value) }))
                  }
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
                  %
                </span>
              </div>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={`${badge} ${totalIsValid ? badgeVariants.success : badgeVariants.warning}`}>
            Sum {formatPercent(totalPct, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-sm text-zinc-500">Current mix: {configuredMixLabel}</span>
        </div>

        {feedback && <p className="text-sm text-emerald-400">{feedback}</p>}
        {actionError && <p className="text-sm text-red-400">{actionError}</p>}
      </form>

      {targetsQuery.isLoading || allocationQuery.isLoading ? (
        <p className="mt-5 text-sm text-zinc-500">Loading target allocation and drift summary...</p>
      ) : null}
      {targetsQuery.isError ? <p className="mt-5 text-sm text-red-400">{targetsQuery.error.message}</p> : null}
      {allocationQuery.isError ? <p className="mt-5 text-sm text-red-400">{allocationQuery.error.message}</p> : null}

      {!targetsQuery.isLoading && !allocationQuery.isLoading && !targetsQuery.isError && !allocationQuery.isError && allocation ? (
        <>
          {!allocation.configured ? (
            <StatePanel
              eyebrow="Targets"
              title="No target allocation configured yet"
              description="Save target weights above to unlock drift diagnostics and the target-mix benchmark."
              className="mt-5"
            />
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">Target sum</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {formatPercent(allocation.targetWeightSumPct, { maximumFractionDigits: 2 })}
                  </strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">Allocation status</span>
                  <strong className="mt-1 block text-sm text-zinc-100">{allocation.valuationState}</strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">Available cash</span>
                  <strong className="mt-1 block text-sm text-zinc-100">{formatCurrencyPln(allocation.availableCashPln)}</strong>
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {allocation.buckets.map((bucket) => (
                  <article key={bucket.assetClass} className="rounded-lg border border-zinc-800/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-100">{prettyAssetClass(bucket.assetClass)}</h4>
                        <p className="mt-1 text-sm text-zinc-500">
                          Current {formatPercent(bucket.currentWeightPct, { maximumFractionDigits: 2 })} · target {formatPercent(bucket.targetWeightPct, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <span className={`${badge} ${statusVariant(bucket.status)}`}>{bucket.status}</span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-zinc-500">Current value</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.currentValuePln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Target value</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.targetValuePln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Drift</dt>
                        <dd className={driftColor(bucket.driftPctPoints)}>
                          {formatPercent(bucket.driftPctPoints, { signed: true, maximumFractionDigits: 2, suffix: ' pp' })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Suggest contribution</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.suggestedContributionPln)}</dd>
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

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function prettyAssetClass(assetClass: string) {
  switch (assetClass) {
    case 'EQUITIES':
      return 'Equities'
    case 'BONDS':
      return 'Bonds'
    case 'CASH':
      return 'Cash'
    default:
      return assetClass
  }
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
