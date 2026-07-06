import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  usePortfolioAlertSettings,
  useSavePortfolioAlertSettings,
} from '../hooks/use-write-model'
import { formatPercent } from '../lib/format'
import { formatMessage, t, type MessageKey } from '../lib/messages'
import {
  badge,
  badgeVariants,
  btnPrimary,
  btnSecondary,
  input,
  label as labelClass,
} from '../lib/styles'
import { Card, SectionHeader } from './ui'

type AlertType = 'ALLOCATION_DRIFT' | 'MARKET_DATA_STALE' | 'BENCHMARK_UNDERPERFORMANCE'

interface AlertSettingsForm {
  enabled: boolean
  pushEnabled: boolean
  enabledTypes: Record<AlertType, boolean>
  allocationDriftThresholdPctPoints: string
  benchmarkUnderperformanceThresholdPctPoints: string
}

const ALERT_TYPES: Array<{
  value: AlertType
  titleKey: MessageKey
  descriptionKey: MessageKey
}> = [
  {
    value: 'ALLOCATION_DRIFT',
    titleKey: 'alertSettings.typeAllocation',
    descriptionKey: 'alertSettings.typeAllocationDescription',
  },
  {
    value: 'MARKET_DATA_STALE',
    titleKey: 'alertSettings.typeMarketData',
    descriptionKey: 'alertSettings.typeMarketDataDescription',
  },
  {
    value: 'BENCHMARK_UNDERPERFORMANCE',
    titleKey: 'alertSettings.typeBenchmark',
    descriptionKey: 'alertSettings.typeBenchmarkDescription',
  },
]

const DEFAULT_FORM: AlertSettingsForm = {
  enabled: true,
  pushEnabled: true,
  enabledTypes: {
    ALLOCATION_DRIFT: true,
    MARKET_DATA_STALE: true,
    BENCHMARK_UNDERPERFORMANCE: true,
  },
  allocationDriftThresholdPctPoints: '5.00',
  benchmarkUnderperformanceThresholdPctPoints: '5.00',
}

export function PortfolioAlertSettingsSection() {
  const settingsQuery = usePortfolioAlertSettings()
  const saveMutation = useSavePortfolioAlertSettings()
  const [form, setForm] = useState<AlertSettingsForm>(DEFAULT_FORM)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }

    const enabledTypeSet = new Set(settingsQuery.data.enabledTypes as AlertType[])
    setForm({
      enabled: settingsQuery.data.enabled,
      pushEnabled: settingsQuery.data.pushEnabled,
      enabledTypes: {
        ALLOCATION_DRIFT: enabledTypeSet.has('ALLOCATION_DRIFT'),
        MARKET_DATA_STALE: enabledTypeSet.has('MARKET_DATA_STALE'),
        BENCHMARK_UNDERPERFORMANCE: enabledTypeSet.has('BENCHMARK_UNDERPERFORMANCE'),
      },
      allocationDriftThresholdPctPoints: settingsQuery.data.allocationDriftThresholdPctPoints,
      benchmarkUnderperformanceThresholdPctPoints: settingsQuery.data.benchmarkUnderperformanceThresholdPctPoints,
    })
  }, [settingsQuery.data])

  const enabledTypeCount = useMemo(
    () => ALERT_TYPES.filter((type) => form.enabledTypes[type.value]).length,
    [form.enabledTypes],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    const allocationThreshold = parsePositiveThreshold(form.allocationDriftThresholdPctPoints)
    const benchmarkThreshold = parsePositiveThreshold(form.benchmarkUnderperformanceThresholdPctPoints)
    if (allocationThreshold == null || benchmarkThreshold == null) {
      setActionError(t('alertSettings.thresholdInvalid'))
      return
    }

    try {
      const result = await saveMutation.mutateAsync({
        enabled: form.enabled,
        pushEnabled: form.pushEnabled,
        enabledTypes: ALERT_TYPES
          .filter((type) => form.enabledTypes[type.value])
          .map((type) => type.value),
        allocationDriftThresholdPctPoints: allocationThreshold.toFixed(2),
        benchmarkUnderperformanceThresholdPctPoints: benchmarkThreshold.toFixed(2),
      })
      setFeedback(
        formatMessage(t('alertSettings.savedFeedback'), {
          types: String(result.enabledTypes.length),
        }),
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('alertSettings.saveFailed'))
    }
  }

  function updateForm(update: Partial<AlertSettingsForm>) {
    setFeedback(null)
    setActionError(null)
    setForm((current) => ({ ...current, ...update }))
  }

  function toggleType(type: AlertType) {
    setFeedback(null)
    setActionError(null)
    setForm((current) => ({
      ...current,
      enabledTypes: {
        ...current.enabledTypes,
        [type]: !current.enabledTypes[type],
      },
    }))
  }

  const isSaving = saveMutation.isPending

  return (
    <Card as="section">
      <SectionHeader
        eyebrow={t('alertSettings.eyebrow')}
        title={t('alertSettings.title')}
        description={t('alertSettings.description')}
      />

      {settingsQuery.isLoading ? (
        <p className="mt-5 text-sm text-zinc-500">{t('alertSettings.loading')}</p>
      ) : settingsQuery.isError ? (
        <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-200">{t('alertSettings.loadFailed')}</p>
          <button
            type="button"
            className={`mt-3 ${btnSecondary}`}
            onClick={() => {
              void settingsQuery.refetch()
            }}
          >
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <TogglePanel
              checked={form.enabled}
              title={t('alertSettings.globalAlerts')}
              description={t('alertSettings.globalAlertsDescription')}
              onChange={() => updateForm({ enabled: !form.enabled })}
            />
            <TogglePanel
              checked={form.pushEnabled}
              title={t('alertSettings.globalPush')}
              description={t('alertSettings.globalPushDescription')}
              onChange={() => updateForm({ pushEnabled: !form.pushEnabled })}
            />
          </div>

          <section className="rounded-lg border border-zinc-800/50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">{t('alertSettings.typesTitle')}</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{t('alertSettings.typesDescription')}</p>
              </div>
              <span className={`${badge} ${enabledTypeCount === 0 ? badgeVariants.warning : badgeVariants.info}`}>
                {formatMessage(t('alertSettings.enabledTypeCount'), { count: String(enabledTypeCount) })}
              </span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {ALERT_TYPES.map((type) => (
                <TogglePanel
                  key={type.value}
                  checked={form.enabledTypes[type.value]}
                  compact
                  title={t(type.titleKey)}
                  description={t(type.descriptionKey)}
                  onChange={() => toggleType(type.value)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800/50 p-4">
            <h3 className="text-sm font-semibold text-zinc-100">{t('alertSettings.thresholdsTitle')}</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500">{t('alertSettings.thresholdsDescription')}</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClass}>{t('alertSettings.allocationThreshold')}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.allocationDriftThresholdPctPoints}
                  onChange={(event) => updateForm({
                    allocationDriftThresholdPctPoints: sanitizeThresholdInput(event.target.value),
                  })}
                  className={input}
                  disabled={isSaving}
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  {formatMessage(t('alertSettings.thresholdPreview'), {
                    value: formatPercent(form.allocationDriftThresholdPctPoints || '0', {
                      maximumFractionDigits: 2,
                      suffix: ' pp',
                    }),
                  })}
                </span>
              </label>

              <label>
                <span className={labelClass}>{t('alertSettings.benchmarkThreshold')}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.benchmarkUnderperformanceThresholdPctPoints}
                  onChange={(event) => updateForm({
                    benchmarkUnderperformanceThresholdPctPoints: sanitizeThresholdInput(event.target.value),
                  })}
                  className={input}
                  disabled={isSaving}
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  {formatMessage(t('alertSettings.thresholdPreview'), {
                    value: formatPercent(form.benchmarkUnderperformanceThresholdPctPoints || '0', {
                      maximumFractionDigits: 2,
                      suffix: ' pp',
                    }),
                  })}
                </span>
              </label>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5">
              {feedback && <p className="text-sm text-emerald-400">{feedback}</p>}
              {actionError && <p className="text-sm text-red-400">{actionError}</p>}
            </div>
            <button type="submit" className={btnPrimary} disabled={isSaving}>
              {isSaving ? t('common.saving') : t('alertSettings.save')}
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}

function TogglePanel({
  checked,
  compact = false,
  description,
  title,
  onChange,
}: {
  checked: boolean
  compact?: boolean
  description: string
  title: string
  onChange: () => void
}) {
  return (
    <label className={`flex gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/40 ${compact ? 'p-3' : 'p-4'}`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
        checked={checked}
        onChange={onChange}
      />
      <span>
        <span className="block text-sm font-medium text-zinc-100">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-zinc-500">{description}</span>
      </span>
    </label>
  )
}

function sanitizeThresholdInput(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '')
  const [whole, ...rest] = normalized.split('.')
  return rest.length === 0 ? whole : `${whole}.${rest.join('')}`
}

function parsePositiveThreshold(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
