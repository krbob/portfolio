import { useEffect, useMemo, useState } from 'react'
import { SectionCard } from './SectionCard'
import { usePortfolioAllocation } from '../hooks/use-read-model'
import { usePortfolioTargets, useReplacePortfolioTargets } from '../hooks/use-write-model'

type AllocationFieldKey = 'EQUITIES' | 'BONDS' | 'CASH'

type AllocationFormState = Record<AllocationFieldKey, string>

const emptyFormState: AllocationFormState = {
  EQUITIES: '',
  BONDS: '',
  CASH: '',
}

const eightyTwentyPreset: AllocationFormState = {
  EQUITIES: '80.00',
  BONDS: '20.00',
  CASH: '0.00',
}

export function PortfolioAllocationSection() {
  const allocationQuery = usePortfolioAllocation()
  const targetsQuery = usePortfolioTargets()
  const replaceTargetsMutation = useReplacePortfolioTargets()
  const [formState, setFormState] = useState<AllocationFormState>(emptyFormState)

  useEffect(() => {
    if (!targetsQuery.data) {
      return
    }

    if (targetsQuery.data.length === 0) {
      setFormState(eightyTwentyPreset)
      return
    }

    setFormState({
      EQUITIES: formatTargetWeightToPercent(targetsQuery.data.find((target) => target.assetClass === 'EQUITIES')?.targetWeight),
      BONDS: formatTargetWeightToPercent(targetsQuery.data.find((target) => target.assetClass === 'BONDS')?.targetWeight),
      CASH: formatTargetWeightToPercent(targetsQuery.data.find((target) => target.assetClass === 'CASH')?.targetWeight),
    })
  }, [targetsQuery.data])

  const totalWeightPct = useMemo(
    () => ['EQUITIES', 'BONDS', 'CASH']
      .map((assetClass) => Number(formState[assetClass as AllocationFieldKey] || 0))
      .reduce((sum, value) => sum + value, 0),
    [formState],
  )
  const isValidSum = Math.abs(totalWeightPct - 100) < 0.001

  function updateField(assetClass: AllocationFieldKey, value: string) {
    setFormState((current) => ({
      ...current,
      [assetClass]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidSum) {
      return
    }

    await replaceTargetsMutation.mutateAsync({
      items: [
        { assetClass: 'EQUITIES', targetWeight: percentFieldToWeight(formState.EQUITIES) },
        { assetClass: 'BONDS', targetWeight: percentFieldToWeight(formState.BONDS) },
        { assetClass: 'CASH', targetWeight: percentFieldToWeight(formState.CASH) },
      ],
    })
  }

  return (
    <SectionCard
      eyebrow="Portfolio intelligence"
      title="Target allocation and rebalancing"
      description="Define target weights once and review drift, value gaps and contribution-first rebalance suggestions based on currently available cash."
    >
      <div className="allocation-workspace">
        <section className="allocation-target-panel">
          <div className="allocation-summary-grid">
            <article className="overview-stat">
              <span>Targets configured</span>
              <strong>{allocationQuery.data?.configured ? 'Yes' : 'No'}</strong>
            </article>

            <article className="overview-stat">
              <span>Available cash</span>
              <strong>{allocationQuery.data ? formatCurrency(allocationQuery.data.availableCashPln) : '...'}</strong>
            </article>

            <article className="overview-stat">
              <span>Target sum</span>
              <strong>{targetsQuery.data ? `${totalWeightPct.toFixed(2)}%` : '...'}</strong>
            </article>
          </div>

          <form className="entity-form allocation-form" onSubmit={handleSubmit}>
            <label>
              <span>Equities %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formState.EQUITIES}
                onChange={(event) => updateField('EQUITIES', event.target.value)}
              />
            </label>

            <label>
              <span>Bonds %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formState.BONDS}
                onChange={(event) => updateField('BONDS', event.target.value)}
              />
            </label>

            <label>
              <span>Cash %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formState.CASH}
                onChange={(event) => updateField('CASH', event.target.value)}
              />
            </label>

            <div className="allocation-form-note">
              <strong>As of {allocationQuery.data?.asOf ?? '...'}</strong>
              <p>
                {allocationQuery.data?.configured
                  ? `Valuation state ${allocationQuery.data.valuationState}.`
                  : 'No target set has been saved yet.'}
              </p>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setFormState(eightyTwentyPreset)}
              >
                Use 80/20
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setFormState(emptyFormState)}
              >
                Clear
              </button>
              <button type="submit" disabled={replaceTargetsMutation.isPending || !isValidSum}>
                {replaceTargetsMutation.isPending ? 'Saving...' : 'Save targets'}
              </button>
            </div>
          </form>

          {!isValidSum && (
            <p className="form-error">
              Target weights must add up to exactly 100.00%.
            </p>
          )}
          {replaceTargetsMutation.isError && (
            <p className="form-error">{replaceTargetsMutation.error.message}</p>
          )}
          {replaceTargetsMutation.isSuccess && !replaceTargetsMutation.isPending && (
            <p className="muted-copy">Targets updated.</p>
          )}
        </section>

        <section className="allocation-bucket-list">
          {allocationQuery.isLoading && <p className="muted-copy">Loading allocation summary...</p>}
          {allocationQuery.isError && <p className="form-error">{allocationQuery.error.message}</p>}
          {allocationQuery.data?.buckets.map((bucket) => (
            <article className="allocation-bucket-card" key={bucket.assetClass}>
              <div className="allocation-bucket-header">
                <div>
                  <strong>{assetClassLabel(bucket.assetClass)}</strong>
                  <p>
                    Current {formatPercent(bucket.currentWeightPct)}
                    {bucket.targetWeightPct ? ` · Target ${formatPercent(bucket.targetWeightPct)}` : ' · No target'}
                  </p>
                </div>

                <span className={`status-badge ${allocationStatusClassName(bucket.status)}`}>
                  {bucket.status.replace('_', ' ')}
                </span>
              </div>

              <dl className="allocation-bucket-stats">
                <div>
                  <dt>Current value</dt>
                  <dd>{formatCurrency(bucket.currentValuePln)}</dd>
                </div>
                <div>
                  <dt>Target value</dt>
                  <dd>{formatCurrency(bucket.targetValuePln)}</dd>
                </div>
                <div>
                  <dt>Drift</dt>
                  <dd className={gainClassName(bucket.driftPctPoints)}>
                    {formatSignedPercent(bucket.driftPctPoints)}
                  </dd>
                </div>
                <div>
                  <dt>Value gap</dt>
                  <dd className={gainClassName(bucket.gapValuePln)}>
                    {formatSignedCurrency(bucket.gapValuePln)}
                  </dd>
                </div>
                <div>
                  <dt>Suggested contribution</dt>
                  <dd>{formatCurrency(bucket.suggestedContributionPln)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      </div>
    </SectionCard>
  )
}

function formatTargetWeightToPercent(value: string | undefined) {
  if (!value) {
    return '0.00'
  }
  return (Number(value) * 100).toFixed(2)
}

function percentFieldToWeight(value: string) {
  return (Number(value || 0) / 100).toFixed(6)
}

function assetClassLabel(assetClass: string) {
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

function formatCurrency(value: string | null | undefined) {
  if (value == null) {
    return 'Unavailable'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatSignedCurrency(value: string | null | undefined) {
  if (value == null) {
    return 'Unavailable'
  }
  const amount = Number(value)
  const formatted = formatCurrency(value)
  if (amount > 0) {
    return `+${formatted}`
  }
  return formatted
}

function formatPercent(value: string | null | undefined) {
  if (value == null) {
    return 'Unavailable'
  }
  return `${Number(value).toFixed(2)}%`
}

function formatSignedPercent(value: string | null | undefined) {
  if (value == null) {
    return 'Unavailable'
  }
  const amount = Number(value)
  const absolute = `${Math.abs(amount).toFixed(2)} pp`
  if (amount > 0) {
    return `+${absolute}`
  }
  if (amount < 0) {
    return `-${absolute}`
  }
  return absolute
}

function gainClassName(value: string | null | undefined) {
  if (value == null) {
    return undefined
  }
  const amount = Number(value)
  if (amount > 0) {
    return 'value-positive'
  }
  if (amount < 0) {
    return 'value-negative'
  }
  return undefined
}

function allocationStatusClassName(status: string) {
  switch (status) {
    case 'UNDERWEIGHT':
      return 'status-underweight'
    case 'OVERWEIGHT':
      return 'status-overweight'
    case 'ON_TARGET':
      return 'status-valued'
    default:
      return 'status-unconfigured'
  }
}
