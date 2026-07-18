import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import type {
  PortfolioTargetSchedulePhase,
  ReplacePortfolioTargetSchedulePayload,
} from '../api/write-model'
import {
  usePortfolioTargetSchedule,
  useReplacePortfolioTargetSchedule,
} from '../hooks/use-write-model'
import { formatDate, formatPercent } from '../lib/format'
import { labelAssetClass } from '../lib/labels'
import { t } from '../lib/messages'
import {
  badge,
  badgeVariants,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  input,
  label as labelClass,
} from '../lib/styles'
import { Badge, ConfirmDialog, SectionHeader, StatePanel } from './ui'

type AssetClass = 'EQUITIES' | 'BONDS' | 'CASH'
type SaveConfirmation = 'empty' | 'history' | null

interface DraftPhase {
  key: string
  id?: string
  effectiveFrom: string
  weights: Record<AssetClass, string>
}

interface PhaseValidation {
  dateError: string | null
  weightsError: string | null
  valid: boolean
}

const ASSET_CLASSES: AssetClass[] = ['EQUITIES', 'BONDS', 'CASH']
const EMPTY_WEIGHTS: Record<AssetClass, string> = {
  EQUITIES: '0',
  BONDS: '0',
  CASH: '0',
}
let draftKeySequence = 0

export function PortfolioTargetScheduleEditor() {
  const formId = useId()
  const scheduleQuery = usePortfolioTargetSchedule()
  const replaceScheduleMutation = useReplacePortfolioTargetSchedule()
  const [phases, setPhases] = useState<DraftPhase[]>([])
  const [originalPhases, setOriginalPhases] = useState<DraftPhase[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [saveConfirmation, setSaveConfirmation] = useState<SaveConfirmation>(null)
  const [presetConfirmationOpen, setPresetConfirmationOpen] = useState(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!scheduleQuery.data || dirtyRef.current) {
      return
    }

    const loaded = scheduleQuery.data
      .slice()
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      .map(toDraftPhase)
    setPhases(loaded)
    setOriginalPhases(loaded)
  }, [scheduleQuery.data])

  const today = utcDateIso()
  const duplicateDates = useMemo(() => duplicatedEffectiveDates(phases), [phases])
  const validations = useMemo(
    () => new Map(phases.map((phase) => [phase.key, validatePhase(phase, duplicateDates)])),
    [duplicateDates, phases],
  )
  const scheduleIsValid = phases.every((phase) => validations.get(phase.key)?.valid)
  const dirty = canonicalDraftSchedule(phases) !== canonicalDraftSchedule(originalPhases)
  dirtyRef.current = dirty
  const changesPast = pastScheduleChanged(originalPhases, phases, today)
  const { currentPhase, nextPhase } = activeAndNextPhase(phases, today)

  function addPhase() {
    setFeedback(null)
    setActionError(null)
    const source = latestDatedPhase(phases)
    setPhases((current) => [
      ...current,
      {
        key: nextDraftKey(),
        effectiveFrom: '',
        weights: source ? { ...source.weights } : { ...EMPTY_WEIGHTS },
      },
    ])
  }

  function duplicatePhase(phaseKey: string) {
    setFeedback(null)
    setActionError(null)
    setPhases((current) => {
      const sourceIndex = current.findIndex((phase) => phase.key === phaseKey)
      if (sourceIndex < 0) {
        return current
      }
      const source = current[sourceIndex]
      return [
        ...current.slice(0, sourceIndex + 1),
        {
          key: nextDraftKey(),
          effectiveFrom: '',
          weights: { ...source.weights },
        },
        ...current.slice(sourceIndex + 1),
      ]
    })
  }

  function removePhase(phaseKey: string) {
    setFeedback(null)
    setActionError(null)
    setPhases((current) => current.filter((phase) => phase.key !== phaseKey))
  }

  function updateEffectiveFrom(phaseKey: string, effectiveFrom: string) {
    updatePhase(phaseKey, (phase) => ({ ...phase, effectiveFrom }))
  }

  function updateWeight(phaseKey: string, assetClass: AssetClass, value: string) {
    updatePhase(phaseKey, (phase) => ({
      ...phase,
      weights: {
        ...phase.weights,
        [assetClass]: sanitizePercentInput(value),
      },
    }))
  }

  function updatePhase(phaseKey: string, transform: (phase: DraftPhase) => DraftPhase) {
    setFeedback(null)
    setActionError(null)
    setPhases((current) => current.map((phase) => phase.key === phaseKey ? transform(phase) : phase))
  }

  function requestPreset() {
    if (phases.length > 0 || dirty) {
      setPresetConfirmationOpen(true)
      return
    }
    applyPreset()
  }

  function applyPreset() {
    const startDate = today
    const generated = [0, 1, 2, 3, 4].map((step) => ({
      key: nextDraftKey(),
      effectiveFrom: addYears(startDate, step * 5),
      weights: {
        EQUITIES: String(80 - step * 5),
        BONDS: String(20 + step * 5),
        CASH: '0',
      },
    }))
    setPhases(generated)
    setFeedback(null)
    setActionError(null)
    setPresetConfirmationOpen(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    if (!scheduleIsValid) {
      setActionError(t('targets.scheduleValidationFailed'))
      return
    }
    if (phases.length === 0) {
      setSaveConfirmation('empty')
      return
    }
    if (changesPast) {
      setSaveConfirmation('history')
      return
    }
    void saveSchedule()
  }

  async function saveSchedule() {
    setSaveConfirmation(null)
    setFeedback(null)
    setActionError(null)
    try {
      const result = await replaceScheduleMutation.mutateAsync(toPayload(phases))
      const saved = result
        .slice()
        .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
        .map(toDraftPhase)
      dirtyRef.current = false
      setPhases(saved)
      setOriginalPhases(saved)
      setFeedback(result.length === 0
        ? t('targets.scheduleClearedFeedback')
        : t('targets.scheduleSavedFeedback'))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('targets.scheduleSaveFailed'))
    }
  }

  return (
    <section>
      <SectionHeader
        eyebrow={t('targets.eyebrow')}
        title={t('targets.scheduleTitle')}
        description={t('targets.scheduleDescription')}
        actions={(
          <>
            <button type="button" className={btnSecondary} onClick={requestPreset}>
              {t('targets.schedulePreset')}
            </button>
            <button
              type="submit"
              form={formId}
              className={btnPrimary}
              disabled={replaceScheduleMutation.isPending || !dirty || !scheduleIsValid}
            >
              {replaceScheduleMutation.isPending ? t('common.saving') : t('targets.scheduleSave')}
            </button>
          </>
        )}
      />

      {scheduleQuery.isLoading ? (
        <p className="text-sm text-ui-text-muted">{t('targets.scheduleLoading')}</p>
      ) : null}
      {scheduleQuery.isError ? (
        <p className="text-sm text-ui-danger">{scheduleQuery.error.message}</p>
      ) : null}

      {!scheduleQuery.isLoading && !scheduleQuery.isError ? (
        <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <ScheduleMilestone
              label={t('targets.scheduleCurrent')}
              phase={currentPhase}
              fallback={nextPhase
                ? `${t('targets.scheduleStarts')} ${formatDate(nextPhase.effectiveFrom)}`
                : t('targets.scheduleNoCurrent')}
              variant="info"
            />
            <ScheduleMilestone
              label={t('targets.scheduleNext')}
              phase={nextPhase}
              fallback={t('targets.scheduleNoNext')}
              variant="default"
            />
          </div>

          {changesPast ? (
            <div className="rounded-ui-field border border-ui-highlight/40 bg-ui-highlight/10 p-4" role="alert">
              <p className="text-sm font-medium text-ui-highlight">{t('targets.schedulePastWarningTitle')}</p>
              <p className="mt-1 text-sm text-ui-text-secondary">{t('targets.schedulePastWarningDescription')}</p>
            </div>
          ) : null}

          {phases.length === 0 ? (
            <StatePanel
              eyebrow={t('targets.scheduleEmptyEyebrow')}
              title={t('targets.scheduleEmptyTitle')}
              description={t('targets.scheduleEmptyDescription')}
              className="border-ui-border/70 bg-ui-surface px-4 py-6"
            />
          ) : (
            <div className="space-y-3">
              {phases.map((phase, index) => {
                const validation = validations.get(phase.key)
                const phaseStatus = statusForPhase(phase, currentPhase, nextPhase, today)
                const dateErrorId = `${formId}-${phase.key}-date-error`
                const weightsErrorId = `${formId}-${phase.key}-weights-error`
                return (
                  <article key={phase.key} className="rounded-ui-field border border-ui-border bg-ui-surface p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-ui-text">
                          {t('targets.schedulePhase')} {index + 1}
                        </h4>
                        {phaseStatus ? <Badge variant={phaseStatus.variant}>{phaseStatus.label}</Badge> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => duplicatePhase(phase.key)}
                        >
                          {t('targets.scheduleDuplicate')}
                        </button>
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => removePhase(phase.key)}
                        >
                          {t('targets.scheduleRemove')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(190px,0.8fr)_repeat(3,minmax(130px,1fr))]">
                      <label>
                        <span className={labelClass}>{t('targets.scheduleEffectiveFrom')}</span>
                        <input
                          type="date"
                          className={input}
                          value={phase.effectiveFrom}
                          onChange={(event) => updateEffectiveFrom(phase.key, event.target.value)}
                          aria-invalid={Boolean(validation?.dateError)}
                          aria-describedby={validation?.dateError ? dateErrorId : undefined}
                        />
                        {validation?.dateError ? (
                          <p id={dateErrorId} className="mt-1.5 text-xs text-ui-danger">{validation.dateError}</p>
                        ) : null}
                      </label>

                      {ASSET_CLASSES.map((assetClass) => (
                        <label key={assetClass}>
                          <span className={labelClass}>{labelAssetClass(assetClass)}</span>
                          <div className="relative">
                            <input
                              className={`${input} pr-10`}
                              inputMode="decimal"
                              value={phase.weights[assetClass]}
                              onChange={(event) => updateWeight(phase.key, assetClass, event.target.value)}
                              aria-invalid={Boolean(validation?.weightsError)}
                              aria-describedby={validation?.weightsError ? weightsErrorId : undefined}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ui-text-muted">
                              %
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className={`${badge} ${validation?.weightsError ? badgeVariants.warning : badgeVariants.success}`}>
                        {t('targets.sum')} {formatPercent(phaseWeightSum(phase), { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-sm text-ui-text-muted">{formatDraftMix(phase)}</span>
                    </div>
                    {validation?.weightsError ? (
                      <p id={weightsErrorId} className="mt-2 text-xs text-ui-danger">{validation.weightsError}</p>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btnSecondary} onClick={addPhase}>
              {t('targets.scheduleAdd')}
            </button>
            {dirty ? <Badge variant="warning">{t('targets.scheduleUnsaved')}</Badge> : null}
            <span className="text-xs text-ui-text-muted">{t('targets.schedulePresetHint')}</span>
          </div>

          {feedback ? <p className="text-sm text-ui-positive">{feedback}</p> : null}
          {actionError ? <p className="text-sm text-ui-danger">{actionError}</p> : null}
        </form>
      ) : null}

      <ConfirmDialog
        open={saveConfirmation != null}
        onCancel={() => setSaveConfirmation(null)}
        onConfirm={() => { void saveSchedule() }}
        title={saveConfirmation === 'empty'
          ? t('targets.scheduleClearConfirmTitle')
          : t('targets.schedulePastConfirmTitle')}
        message={saveConfirmation === 'empty'
          ? t('targets.scheduleClearConfirmDescription')
          : t('targets.schedulePastConfirmDescription')}
        confirmLabel={saveConfirmation === 'empty'
          ? t('targets.scheduleClearConfirmAction')
          : t('targets.schedulePastConfirmAction')}
        variant={saveConfirmation === 'empty' ? 'danger' : 'default'}
      />

      <ConfirmDialog
        open={presetConfirmationOpen}
        onCancel={() => setPresetConfirmationOpen(false)}
        onConfirm={applyPreset}
        title={t('targets.schedulePresetConfirmTitle')}
        message={t('targets.schedulePresetConfirmDescription')}
        confirmLabel={t('targets.schedulePresetConfirmAction')}
      />
    </section>
  )
}

function ScheduleMilestone({
  label,
  phase,
  fallback,
  variant,
}: {
  label: string
  phase: DraftPhase | null
  fallback: string
  variant: 'info' | 'default'
}) {
  return (
    <article className="rounded-ui-field border border-ui-border bg-ui-surface p-4">
      <div className="flex items-center gap-2">
        <Badge variant={variant}>{label}</Badge>
        {phase ? <span className="text-xs text-ui-text-muted">{formatDate(phase.effectiveFrom)}</span> : null}
      </div>
      <p className="mt-2 text-sm font-medium text-ui-text">
        {phase ? formatDraftMix(phase) : fallback}
      </p>
    </article>
  )
}

function toDraftPhase(phase: PortfolioTargetSchedulePhase): DraftPhase {
  const weights = { ...EMPTY_WEIGHTS }
  for (const item of phase.items) {
    if (ASSET_CLASSES.includes(item.assetClass as AssetClass)) {
      weights[item.assetClass as AssetClass] = fractionToPercentLiteral(item.targetWeight)
    }
  }
  return {
    key: `saved-${phase.id}`,
    id: phase.id,
    effectiveFrom: phase.effectiveFrom,
    weights,
  }
}

function toPayload(phases: DraftPhase[]): ReplacePortfolioTargetSchedulePayload {
  return {
    phases: phases
      .slice()
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      .map((phase) => ({
        ...(phase.id ? { id: phase.id } : {}),
        effectiveFrom: phase.effectiveFrom,
        items: ASSET_CLASSES
          .map((assetClass) => ({
            assetClass,
            numericWeight: toNumber(phase.weights[assetClass]),
          }))
          .filter((item) => item.numericWeight > 0)
          .map((item) => ({
            assetClass: item.assetClass,
            targetWeight: (item.numericWeight / 100).toFixed(6),
          })),
      })),
  }
}

function validatePhase(phase: DraftPhase, duplicateDates: Set<string>): PhaseValidation {
  let dateError: string | null = null
  if (!isValidIsoDate(phase.effectiveFrom)) {
    dateError = t('targets.scheduleDateRequired')
  } else if (duplicateDates.has(phase.effectiveFrom)) {
    dateError = t('targets.scheduleDateUnique')
  }

  const values = ASSET_CLASSES.map((assetClass) => phase.weights[assetClass])
  const parsed = values.map(toNumber)
  let weightsError: string | null = null
  if (values.some((value) => value.trim() === '') || parsed.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    weightsError = t('targets.scheduleWeightsRange')
  } else if (parsed.every((value) => value === 0)) {
    weightsError = t('targets.scheduleRequiresItem')
  } else if (Math.abs(parsed.reduce((sum, value) => sum + value, 0) - 100) >= 0.0001) {
    weightsError = t('targets.mustSum100')
  } else if (parsed.reduce((sum, value) => sum + serializedWeightUnits(value), 0) !== 1_000_000) {
    weightsError = t('targets.scheduleWeightsPrecision')
  }

  return {
    dateError,
    weightsError,
    valid: dateError == null && weightsError == null,
  }
}

function activeAndNextPhase(phases: DraftPhase[], today: string) {
  const dated = phases
    .filter((phase) => isValidIsoDate(phase.effectiveFrom))
    .slice()
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
  return {
    currentPhase: dated.filter((phase) => phase.effectiveFrom <= today).at(-1) ?? null,
    nextPhase: dated.find((phase) => phase.effectiveFrom > today) ?? null,
  }
}

function statusForPhase(
  phase: DraftPhase,
  currentPhase: DraftPhase | null,
  nextPhase: DraftPhase | null,
  today: string,
) {
  if (phase.key === currentPhase?.key) {
    return { label: t('targets.scheduleCurrentBadge'), variant: 'info' as const }
  }
  if (phase.key === nextPhase?.key) {
    return { label: t('targets.scheduleNextBadge'), variant: 'default' as const }
  }
  if (isValidIsoDate(phase.effectiveFrom) && phase.effectiveFrom < today) {
    return { label: t('targets.scheduleHistoricalBadge'), variant: 'default' as const }
  }
  if (isValidIsoDate(phase.effectiveFrom)) {
    return { label: t('targets.schedulePlannedBadge'), variant: 'default' as const }
  }
  return null
}

function duplicatedEffectiveDates(phases: DraftPhase[]) {
  const counts = new Map<string, number>()
  for (const phase of phases) {
    if (phase.effectiveFrom) {
      counts.set(phase.effectiveFrom, (counts.get(phase.effectiveFrom) ?? 0) + 1)
    }
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([date]) => date))
}

function pastScheduleChanged(original: DraftPhase[], current: DraftPhase[], today: string) {
  const originalPast = canonicalHistoricalSchedule(original, today)
  const currentPast = canonicalHistoricalSchedule(current, today)
  return originalPast !== currentPast
}

function canonicalHistoricalSchedule(phases: DraftPhase[], today: string) {
  return canonicalDraftSchedule(phases.filter((phase) => phase.effectiveFrom < today))
}

function canonicalDraftSchedule(phases: DraftPhase[]) {
  return JSON.stringify(phases
    .map((phase) => ({
      id: phase.id ?? null,
      effectiveFrom: phase.effectiveFrom,
      weights: ASSET_CLASSES.map((assetClass) => [assetClass, normalizedWeight(phase.weights[assetClass])]),
    }))
    .sort((left, right) => {
      const byDate = left.effectiveFrom.localeCompare(right.effectiveFrom)
      return byDate !== 0 ? byDate : String(left.id).localeCompare(String(right.id))
    }))
}

function normalizedWeight(value: string) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(6) : value
}

function phaseWeightSum(phase: DraftPhase) {
  return ASSET_CLASSES.reduce((sum, assetClass) => sum + toNumber(phase.weights[assetClass]), 0)
}

function formatDraftMix(phase: DraftPhase) {
  return ASSET_CLASSES
    .map((assetClass) => `${labelAssetClass(assetClass)} ${formatPercent(phase.weights[assetClass], { maximumFractionDigits: 2 })}`)
    .join(' · ')
}

function latestDatedPhase(phases: DraftPhase[]) {
  return phases
    .filter((phase) => isValidIsoDate(phase.effectiveFrom))
    .slice()
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
    .at(-1)
}

function sanitizePercentInput(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '')
  const [whole = '', ...decimalParts] = normalized.split('.')
  return decimalParts.length > 0 ? `${whole}.${decimalParts.join('')}` : whole
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function utcDateIso(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function serializedWeightUnits(percent: number) {
  return Math.round(Number((percent / 100).toFixed(6)) * 1_000_000)
}

function fractionToPercentLiteral(value: string) {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim())
  if (!match) {
    return value
  }

  const [, whole, fraction = ''] = match
  const decimalPlaces = Math.max(0, fraction.length - 2)
  const shiftedDigits = `${whole}${fraction}${'0'.repeat(Math.max(0, 2 - fraction.length))}`
    .replace(/^0+(?=\d)/, '')
    .padStart(decimalPlaces + 1, '0')
  if (decimalPlaces === 0) {
    return shiftedDigits
  }

  const splitAt = shiftedDigits.length - decimalPlaces
  const integerPart = shiftedDigits.slice(0, splitAt)
  const fractionalPart = shiftedDigits.slice(splitAt).replace(/0+$/, '')
  return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart
}

function addYears(value: string, years: number) {
  const [year, month, day] = value.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate()
  return `${year + years}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function nextDraftKey() {
  draftKeySequence += 1
  return `draft-${draftKeySequence}`
}

export const targetScheduleTestHelpers = {
  addYears,
  activeAndNextPhase,
  pastScheduleChanged,
  toPayload,
  validatePhase,
}
