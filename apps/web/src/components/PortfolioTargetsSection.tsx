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
import { t } from '../lib/messages'
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

const EMPTY_TARGET_INPUTS: Record<AssetClass, string> = {
  EQUITIES: '0',
  BONDS: '0',
  CASH: '0',
}

const PRESET_80_20_INPUTS: Record<AssetClass, string> = {
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

  const [inputs, setInputs] = useState<Record<AssetClass, string>>(EMPTY_TARGET_INPUTS)
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
      setInputs(EMPTY_TARGET_INPUTS)
      return
    }

    const nextInputs = { ...EMPTY_TARGET_INPUTS }
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
  const editedMixLabel = TARGET_FIELDS
    .map((field) => `${formatPercent(inputs[field.assetClass], { maximumFractionDigits: 2 })} ${isPolish ? labelAssetClass(field.assetClass).toLowerCase() : field.label.toLowerCase()}`)
    .join(' / ')
  const savedMixLabel = targetsQuery.data == null
    ? null
    : targetsQuery.data.length === 0
      ? t('targets.notConfigured')
      : TARGET_FIELDS
        .map((field) => {
          const savedTarget = targetsQuery.data.find((target) => target.assetClass === field.assetClass)
          const savedPct = savedTarget == null ? '0' : String(Number(savedTarget.targetWeight) * 100)
          return `${formatPercent(savedPct, { maximumFractionDigits: 2 })} ${isPolish ? labelAssetClass(field.assetClass).toLowerCase() : field.label.toLowerCase()}`
        })
        .join(' / ')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    if (!totalIsValid) {
      setActionError(t('targets.mustSum100'))
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
          ? `Zapisano alokację docelową: ${result.map((item) => `${labelAssetClass(item.assetClass)} ${formatPercent(item.targetWeight, { scale: 100, maximumFractionDigits: 2 })}`).join(' · ')}.`
          : `Saved target mix: ${result.map((item) => `${item.assetClass} ${formatPercent(item.targetWeight, { scale: 100, maximumFractionDigits: 2 })}`).join(' · ')}.`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('targets.saveFailed'))
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
      <SectionHeader
        eyebrow={t('targets.eyebrow')}
        title={t('targets.title')}
        description={t('targets.description')}
        actions={(
          <>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => applyPreset(PRESET_80_20_INPUTS)}
            >
              {t('targets.preset8020')}
            </button>
            <button
              type="submit"
              form="portfolio-targets-form"
              className={btnPrimary}
              disabled={replaceTargetsMutation.isPending || !totalIsValid}
            >
              {replaceTargetsMutation.isPending ? t('common.saving') : t('targets.saveTargets')}
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
            {t('targets.sum')} {formatPercent(totalPct, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-sm text-zinc-500">{t('targets.editedMix')}: {editedMixLabel}</span>
          {savedMixLabel ? (
            <span className="text-sm text-zinc-500">{t('targets.savedMix')}: {savedMixLabel}</span>
          ) : null}
        </div>

        {targetsQuery.data?.length === 0 ? (
          <p className="text-sm text-amber-400">
            {t('targets.noTargetsSaved')}
          </p>
        ) : null}

        {feedback && <p className="text-sm text-emerald-400">{feedback}</p>}
        {actionError && <p className="text-sm text-red-400">{actionError}</p>}
      </form>

      <form className="mt-5 rounded-lg border border-zinc-800/50 p-4 space-y-4" onSubmit={handleRebalancingSettingsSubmit}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">{t('targets.rebalancingPolicy')}</h4>
            <p className="mt-1 text-sm text-zinc-500">
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
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
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
          <Badge variant="default">{labelRebalancingMode(rebalancingMode, isPolish)}</Badge>
        </div>

        {settingsFeedback && <p className="text-sm text-emerald-400">{settingsFeedback}</p>}
        {settingsActionError && <p className="text-sm text-red-400">{settingsActionError}</p>}
        {rebalancingSettingsQuery.isError && <p className="text-sm text-red-400">{rebalancingSettingsQuery.error.message}</p>}
      </form>

      {targetsQuery.isLoading || allocationQuery.isLoading || rebalancingSettingsQuery.isLoading ? (
        <p className="mt-5 text-sm text-zinc-500">{t('targets.loading')}</p>
      ) : null}
      {targetsQuery.isError ? <p className="mt-5 text-sm text-red-400">{targetsQuery.error.message}</p> : null}
      {allocationQuery.isError ? <p className="mt-5 text-sm text-red-400">{allocationQuery.error.message}</p> : null}

      {!targetsQuery.isLoading && !allocationQuery.isLoading && !rebalancingSettingsQuery.isLoading && !targetsQuery.isError && !allocationQuery.isError && allocation ? (
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
                  <span className="text-xs text-zinc-500">{t('targets.targetSum')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {formatPercent(allocation.targetWeightSumPct, { maximumFractionDigits: 2 })}
                  </strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{t('targets.toleranceBand')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    ±{formatPercent(allocation.toleranceBandPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })}
                  </strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{t('targets.strategyAction')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">{labelAllocationAction(allocation.recommendedAction, isPolish)}</strong>
                  <p className="mt-1 text-xs text-zinc-500">
                    {labelRebalancingMode(allocation.rebalancingMode, isPolish)}
                  </p>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{t('targets.outsideBand')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {allocation.breachedBucketCount}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-500">
                    {allocation.largestBandBreachPctPoints
                      ? `${t('targets.largestBreach')} ${formatPercent(allocation.largestBandBreachPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })}`
                      : t('targets.allWithinBand')}
                  </p>
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{t('targets.availableCash')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">{formatCurrencyPln(allocation.availableCashPln)}</strong>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{t('targets.nextContribution')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {allocation.recommendedAssetClass
                      ? `${formatCurrencyPln(allocation.recommendedContributionPln)} -> ${labelAssetClass(allocation.recommendedAssetClass)}`
                      : t('targets.noPriority')}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-500">
                    {allocation.remainingContributionGapPln !== '0.00'
                      ? `${t('targets.remainingGap')}: ${formatCurrencyPln(allocation.remainingContributionGapPln)}`
                      : t('targets.cashCoversGap')}
                  </p>
                </article>
                <article className="rounded-lg border border-zinc-800/50 p-4">
                  <span className="text-xs text-zinc-500">{t('targets.fullRebalance')}</span>
                  <strong className="mt-1 block text-sm text-zinc-100">
                    {formatCurrencyPln(allocation.fullRebalanceBuyAmountPln)} / {formatCurrencyPln(allocation.fullRebalanceSellAmountPln)}
                  </strong>
                  <p className="mt-1 text-xs text-zinc-500">
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
                        <p className="mt-1 text-sm text-zinc-500">
                          {t('targets.current')} {formatPercent(bucket.currentWeightPct, { maximumFractionDigits: 2 })} · {t('targets.target')} {formatPercent(bucket.targetWeightPct, { maximumFractionDigits: 2 })}
                        </p>
                        {bucket.targetWeightPct && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {t('targets.band')} {formatPercent(bucket.toleranceLowerPct, { maximumFractionDigits: 2 })} - {formatPercent(bucket.toleranceUpperPct, { maximumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <span className={`${badge} ${statusVariant(bucket.status)}`}>{labelTargetStatus(bucket.status)}</span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                      <div>
                        <dt className="text-zinc-500">{t('targets.currentValue')}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.currentValuePln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{t('targets.targetValue')}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.targetValuePln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{t('targets.drift')}</dt>
                        <dd className={driftColor(bucket.driftPctPoints)}>
                          {formatPercent(bucket.driftPctPoints, { signed: true, maximumFractionDigits: 2, suffix: ' pp' })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{t('targets.gapToTarget')}</dt>
                        <dd className={gapColor(bucket.gapValuePln)}>
                          {formatSignedCurrencyPln(bucket.gapValuePln)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{t('targets.suggestContribution')}</dt>
                        <dd className="text-zinc-100">{formatCurrencyPln(bucket.suggestedContributionPln)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{t('targets.action')}</dt>
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

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
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
    default:
      return status
  }
}

function labelRebalancingMode(mode: string, isPolish: boolean) {
  if (isPolish) {
    return mode === 'ALLOW_TRIMS' ? t('targets.modeAllowTrims') : t('targets.modeContributions')
  }
  return mode === 'ALLOW_TRIMS' ? 'Allow trims and redeploy' : 'New contributions only'
}

function labelAllocationAction(action: string, isPolish: boolean) {
  if (isPolish) {
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
