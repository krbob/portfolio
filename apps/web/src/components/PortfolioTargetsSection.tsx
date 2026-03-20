import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { usePortfolioAllocation } from '../hooks/use-read-model'
import {
  usePortfolioRebalancingSettings,
  usePortfolioTargets,
  useReplacePortfolioTargets,
  useSavePortfolioRebalancingSettings,
} from '../hooks/use-write-model'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAssetClass } from '../lib/labels'
import {
  badge,
  badgeVariants,
  btnPrimary,
  btnSecondary,
  input,
  label as labelClass,
} from '../lib/styles'
import { Badge, Card, SectionHeader, SegmentedControl, StatePanel } from './ui'

type AssetClass = 'EQUITIES' | 'BONDS' | 'CASH'
type RebalancingMode = 'CONTRIBUTIONS_ONLY' | 'ALLOW_TRIMS'

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
  const { isPolish } = useI18n()
  const targetsQuery = usePortfolioTargets()
  const allocationQuery = usePortfolioAllocation()
  const rebalancingSettingsQuery = usePortfolioRebalancingSettings()
  const replaceTargetsMutation = useReplacePortfolioTargets()
  const saveRebalancingSettingsMutation = useSavePortfolioRebalancingSettings()

  const [inputs, setInputs] = useState<Record<AssetClass, string>>(DEFAULT_TARGET_INPUTS)
  const [toleranceBandInput, setToleranceBandInput] = useState('5.00')
  const [rebalancingMode, setRebalancingMode] = useState<RebalancingMode>('CONTRIBUTIONS_ONLY')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null)
  const [settingsActionError, setSettingsActionError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!rebalancingSettingsQuery.data) {
      return
    }
    setToleranceBandInput(rebalancingSettingsQuery.data.toleranceBandPctPoints)
    setRebalancingMode(rebalancingSettingsQuery.data.mode as RebalancingMode)
  }, [rebalancingSettingsQuery.data])

  const totalPct = useMemo(
    () => TARGET_FIELDS.reduce((sum, field) => sum + toNumber(inputs[field.assetClass]), 0),
    [inputs],
  )
  const totalIsValid = Math.abs(totalPct - 100) < 0.0001
  const configuredMixLabel = TARGET_FIELDS
    .map((field) => `${formatPercent(inputs[field.assetClass], { maximumFractionDigits: 2 })} ${isPolish ? labelAssetClass(field.assetClass).toLowerCase() : field.label.toLowerCase()}`)
    .join(' / ')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    if (!totalIsValid) {
      setActionError(isPolish ? 'Wagi docelowe muszą sumować się dokładnie do 100%.' : 'Target weights must add up to exactly 100%.')
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
      setFeedback(
        isPolish
          ? `Zapisano miks docelowy: ${result.map((item) => `${labelAssetClass(item.assetClass)} ${formatPercent(item.targetWeight, { scale: 100, maximumFractionDigits: 2 })}`).join(' · ')}.`
          : `Saved target mix: ${result.map((item) => `${item.assetClass} ${formatPercent(item.targetWeight, { scale: 100, maximumFractionDigits: 2 })}`).join(' · ')}.`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : isPolish ? 'Nie udało się zapisać targetów.' : 'Saving targets failed.')
    }
  }

  function applyPreset(inputsPreset: Record<AssetClass, string>) {
    setFeedback(null)
    setActionError(null)
    setInputs(inputsPreset)
  }

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
        isPolish
          ? `Zapisano pasmo tolerancji ±${formatPercent(result.toleranceBandPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })} i tryb ${labelRebalancingMode(result.mode, true).toLowerCase()}.`
          : `Saved a ±${formatPercent(result.toleranceBandPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })} tolerance band and ${labelRebalancingMode(result.mode, false).toLowerCase()} mode.`,
      )
    } catch (error) {
      setSettingsActionError(
        error instanceof Error
          ? error.message
          : isPolish
            ? 'Nie udało się zapisać ustawień rebalansowania.'
            : 'Saving rebalancing settings failed.',
      )
    }
  }

  const allocation = allocationQuery.data
  const strategyModeOptions: Array<{ value: RebalancingMode; label: string }> = [
    {
      value: 'CONTRIBUTIONS_ONLY',
      label: isPolish ? 'Tylko nowymi wpłatami' : 'Contributions only',
    },
    {
      value: 'ALLOW_TRIMS',
      label: isPolish ? 'Dopuszczaj przycięcia' : 'Allow trims',
    },
  ]

  return (
    <Card as="section" id="targets">
      <SectionHeader
        eyebrow={isPolish ? 'Strategia' : 'Strategy'}
        title={isPolish ? 'Alokacja docelowa' : 'Target allocation'}
        description={isPolish
          ? 'Skonfiguruj miks docelowy używany do odchyleń alokacji, sugestii rebalansowania przez wpłaty i syntetycznego benchmarku target mix w Wynikach.'
          : 'Configure the target mix used for allocation drift, contribution-first rebalance suggestions and the synthetic target-mix benchmark in Performance.'}
        actions={(
          <>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => applyPreset(DEFAULT_TARGET_INPUTS)}
            >
              {isPolish ? 'Preset 80/20' : 'Preset 80/20'}
            </button>
            <button
              type="submit"
              form="portfolio-targets-form"
              className={btnPrimary}
              disabled={replaceTargetsMutation.isPending || !totalIsValid}
            >
              {replaceTargetsMutation.isPending ? (isPolish ? 'Zapisywanie...' : 'Saving...') : (isPolish ? 'Zapisz targety' : 'Save targets')}
            </button>
          </>
        )}
      />

      <form id="portfolio-targets-form" className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TARGET_FIELDS.map((field) => (
            <label key={field.assetClass}>
              <span className={labelClass}>{isPolish ? labelAssetClass(field.assetClass) : field.label}</span>
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
            {isPolish ? 'Suma' : 'Sum'} {formatPercent(totalPct, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-sm text-zinc-500">{isPolish ? 'Bieżący miks' : 'Current mix'}: {configuredMixLabel}</span>
        </div>

        {feedback && <p className="text-sm text-emerald-400">{feedback}</p>}
        {actionError && <p className="text-sm text-red-400">{actionError}</p>}
      </form>

      <form className="mt-5 rounded-lg border border-zinc-800/50 p-4 space-y-4" onSubmit={handleRebalancingSettingsSubmit}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">{isPolish ? 'Polityka rebalansowania' : 'Rebalancing policy'}</h4>
            <p className="mt-1 text-sm text-zinc-500">
              {isPolish
                ? 'Ustal pasmo tolerancji i to, czy aplikacja ma sugerować wyłącznie nowe wpłaty, czy również pełne przycięcia i przesunięcia między koszykami.'
                : 'Choose the tolerance band and whether the app should suggest only new contributions or a full trim-and-redeploy rebalance.'}
            </p>
          </div>

          <button
            type="submit"
            className={btnPrimary}
            disabled={saveRebalancingSettingsMutation.isPending}
          >
            {saveRebalancingSettingsMutation.isPending
              ? (isPolish ? 'Zapisywanie...' : 'Saving...')
              : (isPolish ? 'Zapisz politykę' : 'Save policy')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <label>
            <span className={labelClass}>{isPolish ? 'Pasmo tolerancji' : 'Tolerance band'}</span>
            <div className="relative">
              <input
                className={`${input} pr-14`}
                inputMode="decimal"
                value={toleranceBandInput}
                onChange={(event) => setToleranceBandInput(sanitizePercentInput(event.target.value))}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
                pp
              </span>
            </div>
          </label>

          <div>
            <span className={labelClass}>{isPolish ? 'Tryb rebalansowania' : 'Rebalancing mode'}</span>
            <SegmentedControl
              value={rebalancingMode}
              onChange={setRebalancingMode}
              options={strategyModeOptions}
              ariaLabel={isPolish ? 'Tryb rebalansowania' : 'Rebalancing mode'}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="info">
            {isPolish ? 'Pasmo' : 'Band'} ±{formatPercent(toleranceBandInput || '0', { maximumFractionDigits: 2, suffix: ' pp' })}
          </Badge>
          <Badge variant="default">{labelRebalancingMode(rebalancingMode, isPolish)}</Badge>
        </div>

        {settingsFeedback && <p className="text-sm text-emerald-400">{settingsFeedback}</p>}
        {settingsActionError && <p className="text-sm text-red-400">{settingsActionError}</p>}
        {rebalancingSettingsQuery.isError && <p className="text-sm text-red-400">{rebalancingSettingsQuery.error.message}</p>}
      </form>

      {targetsQuery.isLoading || allocationQuery.isLoading || rebalancingSettingsQuery.isLoading ? (
        <p className="mt-5 text-sm text-zinc-500">{isPolish ? 'Ładowanie alokacji docelowej i podsumowania odchyleń...' : 'Loading target allocation and drift summary...'}</p>
      ) : null}
      {targetsQuery.isError ? <p className="mt-5 text-sm text-red-400">{targetsQuery.error.message}</p> : null}
      {allocationQuery.isError ? <p className="mt-5 text-sm text-red-400">{allocationQuery.error.message}</p> : null}

      {!targetsQuery.isLoading && !allocationQuery.isLoading && !rebalancingSettingsQuery.isLoading && !targetsQuery.isError && !allocationQuery.isError && allocation ? (
        <>
          {!allocation.configured ? (
            <StatePanel
              eyebrow={isPolish ? 'Targety' : 'Targets'}
              title={isPolish ? 'Brak skonfigurowanej alokacji docelowej' : 'No target allocation configured yet'}
              description={isPolish
                ? 'Zapisz powyżej wagi docelowe, aby odblokować diagnostykę odchyleń i benchmark target mix.'
                : 'Save target weights above to unlock drift diagnostics and the target-mix benchmark.'}
              className="mt-5"
            />
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{isPolish ? 'Suma targetów' : 'Target sum'}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {formatPercent(allocation.targetWeightSumPct, { maximumFractionDigits: 2 })}
                  </strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{isPolish ? 'Pasmo tolerancji' : 'Tolerance band'}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    ±{formatPercent(allocation.toleranceBandPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })}
                  </strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{isPolish ? 'Akcja strategiczna' : 'Strategy action'}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">{labelAllocationAction(allocation.recommendedAction, isPolish)}</strong>
                  <p className="mt-1 text-xs text-zinc-500">
                    {labelRebalancingMode(allocation.rebalancingMode, isPolish)}
                  </p>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{isPolish ? 'Poza pasmem' : 'Outside band'}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {allocation.breachedBucketCount}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-500">
                    {allocation.largestBandBreachPctPoints
                      ? `${isPolish ? 'Największe przekroczenie' : 'Largest breach'} ${formatPercent(allocation.largestBandBreachPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })}`
                      : isPolish
                        ? 'Wszystkie koszyki mieszczą się w paśmie.'
                        : 'All buckets are within the configured band.'}
                  </p>
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{isPolish ? 'Dostępna gotówka' : 'Available cash'}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">{formatCurrencyPln(allocation.availableCashPln)}</strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{isPolish ? 'Kolejna wpłata / deploy' : 'Next contribution / deploy'}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {allocation.recommendedAssetClass
                      ? `${formatCurrencyPln(allocation.recommendedContributionPln)} -> ${labelAssetClass(allocation.recommendedAssetClass)}`
                      : isPolish
                        ? 'Brak priorytetu'
                        : 'No active priority'}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-500">
                    {allocation.remainingContributionGapPln !== '0.00'
                      ? isPolish
                        ? `Pozostała luka po deployu gotówki: ${formatCurrencyPln(allocation.remainingContributionGapPln)}`
                        : `Remaining funding gap after deploying cash: ${formatCurrencyPln(allocation.remainingContributionGapPln)}`
                      : isPolish
                        ? 'Dostępna gotówka pokrywa bieżący niedobór.'
                        : 'Available cash can cover the current underweight gap.'}
                  </p>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{isPolish ? 'Pełny rebalance' : 'Full rebalance'}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {formatCurrencyPln(allocation.fullRebalanceBuyAmountPln)} / {formatCurrencyPln(allocation.fullRebalanceSellAmountPln)}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-500">
                    {allocation.requiresSelling
                      ? isPolish
                        ? 'Przywrócenie miksu do celu wymaga także sprzedaży/przycięć.'
                        : 'Restoring the target mix requires trims or sells in addition to cash deployment.'
                      : isPolish
                        ? 'Do celu można wrócić samą gotówką lub nową wpłatą.'
                        : 'The target mix can be restored without selling.'}
                  </p>
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {allocation.buckets.map((bucket) => (
                  <article key={bucket.assetClass} className="rounded-lg border border-zinc-800/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-semibold text-zinc-100">{prettyAssetClass(bucket.assetClass)}</h4>
                        <p className="mt-1 text-sm text-zinc-500">
                          {isPolish ? 'Obecnie' : 'Current'} {formatPercent(bucket.currentWeightPct, { maximumFractionDigits: 2 })} · {isPolish ? 'cel' : 'target'} {formatPercent(bucket.targetWeightPct, { maximumFractionDigits: 2 })}
                        </p>
                        {bucket.targetWeightPct && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {isPolish ? 'Pasmo' : 'Band'} {formatPercent(bucket.toleranceLowerPct, { maximumFractionDigits: 2 })} - {formatPercent(bucket.toleranceUpperPct, { maximumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <span className={`${badge} ${statusVariant(bucket.status)}`}>{labelTargetStatus(bucket.status, isPolish)}</span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                      <div>
                        <dt className="text-zinc-500">{isPolish ? 'Bieżąca wartość' : 'Current value'}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.currentValuePln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{isPolish ? 'Wartość docelowa' : 'Target value'}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.targetValuePln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{isPolish ? 'Odchylenie' : 'Drift'}</dt>
                        <dd className={driftColor(bucket.driftPctPoints)}>
                          {formatPercent(bucket.driftPctPoints, { signed: true, maximumFractionDigits: 2, suffix: ' pp' })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{isPolish ? 'Luka do celu' : 'Gap to target'}</dt>
                        <dd className={gapColor(bucket.gapValuePln)}>
                          {formatSignedCurrencyPln(bucket.gapValuePln)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{isPolish ? 'Sugerowana wpłata' : 'Suggest contribution'}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.suggestedContributionPln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{isPolish ? 'Akcja' : 'Action'}</dt>
                        <dd className="text-zinc-100">{labelBucketAction(bucket.rebalanceAction, isPolish)}</dd>
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
  return labelAssetClass(assetClass)
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

function labelTargetStatus(status: string, isPolish: boolean) {
  if (isPolish) {
    switch (status) {
      case 'UNDERWEIGHT':
        return 'Niedoważone'
      case 'OVERWEIGHT':
        return 'Przeważone'
      case 'ON_TARGET':
        return 'W normie'
      default:
        return status
    }
  }

  return status
}

function labelRebalancingMode(mode: string, isPolish: boolean) {
  if (isPolish) {
    return mode === 'ALLOW_TRIMS' ? 'Dopuszczaj przycięcia' : 'Tylko nowymi wpłatami'
  }
  return mode === 'ALLOW_TRIMS' ? 'Allow trims and redeploy' : 'New contributions only'
}

function labelAllocationAction(action: string, isPolish: boolean) {
  if (isPolish) {
    switch (action) {
      case 'WITHIN_TOLERANCE':
        return 'W paśmie'
      case 'DEPLOY_EXISTING_CASH':
        return 'Przekieruj gotówkę'
      case 'WAIT_FOR_NEXT_CONTRIBUTION':
        return 'Poczekaj na kolejną wpłatę'
      case 'FULL_REBALANCE':
        return 'Pełny rebalance'
      default:
        return 'Brak konfiguracji'
    }
  }

  switch (action) {
    case 'WITHIN_TOLERANCE':
      return 'Within tolerance'
    case 'DEPLOY_EXISTING_CASH':
      return 'Deploy existing cash'
    case 'WAIT_FOR_NEXT_CONTRIBUTION':
      return 'Wait for the next contribution'
    case 'FULL_REBALANCE':
      return 'Full rebalance'
    default:
      return 'Not configured'
  }
}

function labelBucketAction(action: string, isPolish: boolean) {
  if (isPolish) {
    switch (action) {
      case 'BUY':
        return 'Dokup'
      case 'SELL':
        return 'Przytnij'
      case 'HOLD':
        return 'Trzymaj'
      default:
        return 'Brak'
    }
  }

  switch (action) {
    case 'BUY':
      return 'Buy'
    case 'SELL':
      return 'Trim / sell'
    case 'HOLD':
      return 'Hold'
    default:
      return 'N/A'
  }
}
