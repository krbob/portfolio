import { useId, useState, type FormEvent } from 'react'
import type {
  PortfolioAllocationSummary,
  PortfolioContributionPlan,
  PortfolioManualContributionPreview,
} from '../api/read-model'
import { usePortfolioContributionPlan, usePortfolioManualContributionPreview } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent } from '../lib/format'
import { labelAssetClass } from '../lib/labels'
import { t } from '../lib/messages'
import { btnGhost, btnPrimary, btnSecondary, input, label as labelClass } from '../lib/styles'
import { StatePanel } from './ui'

interface ContributionPlannerPanelProps {
  allocation: PortfolioAllocationSummary | undefined
  autoFocus?: boolean
}

type ContributionBucket = PortfolioContributionPlan['buckets'][number]
type MixSegment = {
  assetClass: ContributionBucket['assetClass']
  weightPct: string
}

const MIX_ASSET_CLASSES: Array<ContributionBucket['assetClass']> = ['EQUITIES', 'BONDS', 'CASH']

export function ContributionPlannerPanel({
  allocation,
  autoFocus = false,
}: ContributionPlannerPanelProps) {
  const contributionAmountInputId = useId()
  const manualEquitiesInputId = useId()
  const manualBondsInputId = useId()
  const manualCashInputId = useId()
  const [contributionAmountInput, setContributionAmountInput] = useState('')
  const [submittedContributionAmount, setSubmittedContributionAmount] = useState<string | null>(null)
  const [contributionPlanRevision, setContributionPlanRevision] = useState(0)
  const [contributionPlannerActionError, setContributionPlannerActionError] = useState<string | null>(null)
  const [manualEquitiesInput, setManualEquitiesInput] = useState('')
  const [manualBondsInput, setManualBondsInput] = useState('')
  const [manualCashInput, setManualCashInput] = useState('')
  const [manualContributionActionError, setManualContributionActionError] = useState<string | null>(null)
  const [isManualSectionOpen, setIsManualSectionOpen] = useState(false)
  const contributionPlanQuery = usePortfolioContributionPlan(submittedContributionAmount, contributionPlanRevision)
  const manualContributionPreviewMutation = usePortfolioManualContributionPreview()

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

    submitContributionPlanAmount(numericAmount.toFixed(2))
  }

  function handleManualContributionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setManualContributionActionError(null)

    if (!allocation?.configured) {
      setManualContributionActionError(t('targets.noConfigDescription'))
      return
    }

    const {
      sanitizedEquities,
      sanitizedBonds,
      sanitizedCash,
      totalContribution,
    } = manualContributionInputsSummary(
      manualEquitiesInput,
      manualBondsInput,
      manualCashInput,
    )

    if (totalContribution <= 0) {
      setManualContributionActionError(t('targets.manualContributionAmountInvalid'))
      return
    }

    setIsManualSectionOpen(true)
    setManualEquitiesInput(sanitizedEquities)
    setManualBondsInput(sanitizedBonds)
    setManualCashInput(sanitizedCash)
    manualContributionPreviewMutation.mutate({
      equitiesAmountPln: toMoneyPayload(sanitizedEquities),
      bondsAmountPln: toMoneyPayload(sanitizedBonds),
      cashAmountPln: toMoneyPayload(sanitizedCash),
    })
  }

  function copySuggestedSplitToManualPreview() {
    if (!contributionPlanQuery.data) {
      return
    }

    const equitiesAmount = plannedContributionForAssetClass(contributionPlanQuery.data.buckets, 'EQUITIES')
    const bondsAmount = plannedContributionForAssetClass(contributionPlanQuery.data.buckets, 'BONDS')
    const cashAmount = plannedContributionForAssetClass(contributionPlanQuery.data.buckets, 'CASH')

    setIsManualSectionOpen(true)
    setManualContributionActionError(null)
    setManualEquitiesInput(equitiesAmount)
    setManualBondsInput(bondsAmount)
    setManualCashInput(cashAmount)
    manualContributionPreviewMutation.mutate({
      equitiesAmountPln: equitiesAmount,
      bondsAmountPln: bondsAmount,
      cashAmountPln: cashAmount,
    })
  }

  function clearManualContributionInputs() {
    setManualContributionActionError(null)
    setManualEquitiesInput('')
    setManualBondsInput('')
    setManualCashInput('')
    manualContributionPreviewMutation.reset()
  }

  function submitContributionPlanAmount(amountPln: string) {
    setContributionAmountInput(amountPln)
    setSubmittedContributionAmount(amountPln)
    setContributionPlanRevision((current) => current + 1)
  }

  const currentMix = buildCurrentMix(allocation)
  const suggestedSplitBuckets = visibleContributionSplit(contributionPlanQuery.data?.buckets)
  const manualSplitBuckets = visibleContributionSplit(manualContributionPreviewMutation.data?.buckets)

  return (
    <div className="space-y-6">
      <section className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">{t('targets.contributionSuggestedTitle')}</h4>
          <p className="mt-1 text-sm text-zinc-400">{t('targets.contributionPlannerDescription')}</p>
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
            <ContributionResultCard
              mode="suggested"
              amountPln={contributionPlanQuery.data.amountPln}
              splitBuckets={suggestedSplitBuckets}
              currentMix={currentMix}
              projectedMix={buildProjectedMix(contributionPlanQuery.data.buckets)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={copySuggestedSplitToManualPreview}
                disabled={manualContributionPreviewMutation.isPending}
              >
                {t('targets.manualContributionUseSuggested')}
              </button>
            </div>
          </div>
        ) : (
          <StatePanel
            eyebrow={t('targets.contributionSuggestedTitle')}
            title={t('targets.contributionPlannerEmptyTitle')}
            description={t('targets.contributionPlannerEmptyDescription')}
            className="border-0 bg-transparent px-0 py-6"
          />
        )}
      </section>

      <section className="rounded-lg border border-zinc-800/50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">{t('targets.manualContributionTitle')}</h4>
            <p className="mt-1 text-sm text-zinc-400">{t('targets.manualContributionDescription')}</p>
          </div>
          <button
            type="button"
            className={`${btnSecondary} w-full sm:w-auto sm:shrink-0`}
            onClick={() => setIsManualSectionOpen((current) => !current)}
          >
            {isManualSectionOpen ? t('targets.manualContributionHide') : t('targets.manualContributionReveal')}
          </button>
        </div>

        {isManualSectionOpen ? (
          <div className="mt-4 space-y-4">
            <form className="space-y-3" onSubmit={handleManualContributionSubmit}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MoneyField
                  id={manualEquitiesInputId}
                  label={t('targets.manualContributionEquities')}
                  value={manualEquitiesInput}
                  onChange={setManualEquitiesInput}
                />
                <MoneyField
                  id={manualBondsInputId}
                  label={t('targets.manualContributionBonds')}
                  value={manualBondsInput}
                  onChange={setManualBondsInput}
                />
                <MoneyField
                  id={manualCashInputId}
                  label={t('targets.manualContributionCash')}
                  value={manualCashInput}
                  onChange={setManualCashInput}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={manualContributionPreviewMutation.isPending}
                >
                  {manualContributionPreviewMutation.isPending ? t('targets.manualContributionCalculating') : t('targets.manualContributionCalculate')}
                </button>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={clearManualContributionInputs}
                  disabled={manualContributionPreviewMutation.isPending}
                >
                  {t('targets.manualContributionClear')}
                </button>
              </div>
            </form>

            {manualContributionActionError ? <p className="text-sm text-red-400">{manualContributionActionError}</p> : null}
            {manualContributionPreviewMutation.isError ? (
              <p className="text-sm text-red-400">
                {manualContributionPreviewMutation.error instanceof Error
                  ? manualContributionPreviewMutation.error.message
                  : t('targets.manualContributionFailed')}
              </p>
            ) : null}

            {manualContributionPreviewMutation.isPending ? (
              <p className="text-sm text-zinc-500">{t('targets.manualContributionCalculating')}</p>
            ) : manualContributionPreviewMutation.data ? (
              <ContributionResultCard
                mode="manual"
                amountPln={manualContributionPreviewMutation.data.amountPln}
                splitBuckets={manualSplitBuckets}
                currentMix={currentMix}
                projectedMix={buildProjectedMix(manualContributionPreviewMutation.data.buckets)}
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function ContributionResultCard({
  mode,
  amountPln,
  splitBuckets,
  currentMix,
  projectedMix,
}: {
  mode: 'suggested' | 'manual'
  amountPln: string
  splitBuckets: ContributionBucket[]
  currentMix: MixSegment[]
  projectedMix: MixSegment[]
}) {
  const splitText = splitBuckets
    .map((bucket) => `${labelAssetClass(bucket.assetClass)} ${formatCurrencyPln(bucket.plannedContributionPln)}`)
    .join(' · ')

  return (
    <article className="space-y-4 rounded-lg border border-zinc-800/50 bg-zinc-950/40 p-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-100">
          {mode === 'suggested' ? t('targets.resultSuggestedIntro') : t('targets.resultManualIntro')} {splitText}.
        </p>
        <p className="text-sm text-zinc-400">
          {t('targets.resultProjectedMix')} {formatMixSentence(projectedMix)}
        </p>
        <p className="text-xs text-zinc-500">
          {t('targets.contributionAmount')}: {formatCurrencyPln(amountPln)}
        </p>
      </div>

      <MixComparisonCard currentMix={currentMix} projectedMix={projectedMix} />
    </article>
  )
}

function MixComparisonCard({
  currentMix,
  projectedMix,
}: {
  currentMix: MixSegment[]
  projectedMix: MixSegment[]
}) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/60 p-4">
      <h5 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
        {t('targets.currentVsProjected')}
      </h5>
      <MixRow label={t('targets.current')} mix={currentMix} />
      <MixRow label={t('targets.afterContribution')} mix={projectedMix} />
      <dl className="divide-y divide-zinc-800/60 rounded-lg border border-zinc-800/60 text-xs md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
        {projectedMix.map((segment) => {
          const currentWeight = currentMix.find((item) => item.assetClass === segment.assetClass)?.weightPct ?? '0.00'
          const diff = Number(segment.weightPct) - Number(currentWeight)
          return (
            <div
              key={segment.assetClass}
              className="flex items-center justify-between gap-3 px-3 py-2 md:flex-col md:items-start md:gap-1"
            >
              <dt className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${mixSegmentColor(segment.assetClass)}`}
                  aria-hidden="true"
                />
                <span className="font-medium text-zinc-300">{labelAssetClass(segment.assetClass)}</span>
              </dt>
              <dd className="flex items-baseline gap-2">
                <span className="text-zinc-400">
                  {formatPercent(currentWeight, { maximumFractionDigits: 1 })} → {formatPercent(segment.weightPct, { maximumFractionDigits: 1 })}
                </span>
                <span className={`font-medium ${diffColor(diff)}`}>
                  {formatPercent(diff, { signed: true, maximumFractionDigits: 1, suffix: ' pp' })}
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

function MixRow({
  label,
  mix,
}: {
  label: string
  mix: MixSegment[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="text-xs text-zinc-400">{formatMixSentence(mix)}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
        {mix.map((segment) => (
          <div
            key={segment.assetClass}
            className={mixSegmentColor(segment.assetClass)}
            style={{ width: `${Number(segment.weightPct)}%` }}
            title={`${labelAssetClass(segment.assetClass)} ${formatPercent(segment.weightPct, { maximumFractionDigits: 1 })}`}
          />
        ))}
      </div>
    </div>
  )
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
        <input
          id={id}
          className={`${input} pr-14`}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(sanitizeMoneyInput(event.target.value))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
          {t('targets.contributionCurrency')}
        </span>
      </div>
    </div>
  )
}

function sanitizeMoneyInput(value: string) {
  return value.replace(',', '.').replace(/[^0-9.]/g, '')
}

function toMoneyPayload(value: string) {
  const numeric = Number(value || '0')
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00'
}

function manualContributionInputsSummary(
  equitiesInput: string,
  bondsInput: string,
  cashInput: string,
) {
  const sanitizedEquities = sanitizeMoneyInput(equitiesInput)
  const sanitizedBonds = sanitizeMoneyInput(bondsInput)
  const sanitizedCash = sanitizeMoneyInput(cashInput)
  const totalContribution = [sanitizedEquities, sanitizedBonds, sanitizedCash]
    .map((value) => Number(value || '0'))
    .reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)

  return {
    sanitizedEquities,
    sanitizedBonds,
    sanitizedCash,
    totalContribution,
  }
}

function visibleContributionSplit(
  buckets: PortfolioContributionPlan['buckets'] | PortfolioManualContributionPreview['buckets'] | undefined,
) {
  return (buckets ?? []).filter((bucket) => {
    if (bucket.assetClass !== 'CASH') {
      return true
    }
    return Number(bucket.plannedContributionPln) > 0
  })
}

function plannedContributionForAssetClass(
  buckets: PortfolioContributionPlan['buckets'] | undefined,
  assetClass: ContributionBucket['assetClass'],
) {
  return toMoneyPayload(
    buckets?.find((bucket) => bucket.assetClass === assetClass)?.plannedContributionPln ?? '0.00',
  )
}

function buildCurrentMix(allocation: PortfolioAllocationSummary | undefined): MixSegment[] {
  if (!allocation) {
    return MIX_ASSET_CLASSES.map((assetClass) => ({ assetClass, weightPct: '0.00' }))
  }

  return MIX_ASSET_CLASSES.map((assetClass) => ({
    assetClass,
    weightPct: allocation.buckets.find((bucket) => bucket.assetClass === assetClass)?.currentWeightPct ?? '0.00',
  }))
}

function buildProjectedMix(
  buckets: PortfolioContributionPlan['buckets'] | PortfolioManualContributionPreview['buckets'],
): MixSegment[] {
  return MIX_ASSET_CLASSES.map((assetClass) => ({
    assetClass,
    weightPct: buckets.find((bucket) => bucket.assetClass === assetClass)?.projectedWeightPct ?? '0.00',
  }))
}

function formatMixSentence(mix: MixSegment[]) {
  return mix
    .map((segment) => `${formatPercent(segment.weightPct, { maximumFractionDigits: 1 })} ${labelAssetClass(segment.assetClass).toLowerCase()}`)
    .join(' · ')
}

function mixSegmentColor(assetClass: ContributionBucket['assetClass']) {
  switch (assetClass) {
    case 'EQUITIES':
      return 'bg-blue-500'
    case 'BONDS':
      return 'bg-amber-500'
    case 'CASH':
      return 'bg-zinc-500'
    default:
      return 'bg-zinc-700'
  }
}

function diffColor(value: number) {
  if (value > 0) {
    return 'text-emerald-400'
  }
  if (value < 0) {
    return 'text-red-400'
  }
  return 'text-zinc-500'
}
