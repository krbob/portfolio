import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { usePortfolioBenchmarkSettings, useSavePortfolioBenchmarkSettings } from '../hooks/use-write-model'
import { useI18n } from '../lib/i18n'
import { translateBenchmarkLabel } from '../lib/labels'
import { formatMessage, t } from '../lib/messages'
import { badge, badgeVariants, btnPrimary, input, label as labelClass } from '../lib/styles'
import { Card, SectionHeader } from './ui'

const CUSTOM_BENCHMARK_KEYS = ['CUSTOM_1', 'CUSTOM_2', 'CUSTOM_3'] as const

type CustomBenchmarkKey = typeof CUSTOM_BENCHMARK_KEYS[number]

type BenchmarkKey =
  | 'VWRA'
  | 'INFLATION'
  | 'TARGET_MIX'
  | 'V80A'
  | 'V60A'
  | 'V40A'
  | 'V20A'
  | 'VAGF'
  | CustomBenchmarkKey

type CustomBenchmarkFormRow = {
  key: CustomBenchmarkKey
  label: string
  symbol: string
}

function buildEmptyCustomBenchmarks(): CustomBenchmarkFormRow[] {
  return CUSTOM_BENCHMARK_KEYS.map((key) => ({
    key,
    label: '',
    symbol: '',
  }))
}

export function PortfolioBenchmarkSettingsSection() {
  const { isPolish } = useI18n()
  const settingsQuery = usePortfolioBenchmarkSettings()
  const saveMutation = useSavePortfolioBenchmarkSettings()

  const [enabledKeys, setEnabledKeys] = useState<BenchmarkKey[]>([])
  const [pinnedKeys, setPinnedKeys] = useState<BenchmarkKey[]>([])
  const [customBenchmarks, setCustomBenchmarks] = useState<CustomBenchmarkFormRow[]>(() => buildEmptyCustomBenchmarks())
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }
    const customByKey = new Map(
      (settingsQuery.data.customBenchmarks ?? []).map((benchmark) => [benchmark.key, benchmark]),
    )

    setEnabledKeys(settingsQuery.data.enabledKeys as BenchmarkKey[])
    setPinnedKeys(settingsQuery.data.pinnedKeys as BenchmarkKey[])
    setCustomBenchmarks(
      CUSTOM_BENCHMARK_KEYS.map((key) => ({
        key,
        label: customByKey.get(key)?.label ?? '',
        symbol: customByKey.get(key)?.symbol ?? '',
      })),
    )
  }, [settingsQuery.data])

  const options = useMemo(() => settingsQuery.data?.options ?? [], [settingsQuery.data?.options])
  const groupedOptions = useMemo(() => {
    return {
      system: options.filter((option) => option.kind === 'SYSTEM'),
      multiAsset: options.filter((option) => option.kind === 'MULTI_ASSET'),
    }
  }, [options])

  function toggleEnabled(key: BenchmarkKey) {
    setFeedback(null)
    setActionError(null)
    setEnabledKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
    setPinnedKeys((current) => current.filter((item) => item !== key))
  }

  function togglePinned(key: BenchmarkKey) {
    setFeedback(null)
    setActionError(null)
    if (!enabledKeys.includes(key)) {
      return
    }
    setPinnedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
  }

  function updateCustomBenchmark(key: CustomBenchmarkKey, field: 'label' | 'symbol', value: string) {
    setFeedback(null)
    setActionError(null)
    setCustomBenchmarks((current) =>
      current.map((benchmark) => {
        if (benchmark.key !== key) {
          return benchmark
        }
        return {
          ...benchmark,
          [field]: field === 'symbol' ? value.toUpperCase() : value,
        }
      }),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    try {
      const result = await saveMutation.mutateAsync({
        enabledKeys,
        pinnedKeys,
        customBenchmarks: customBenchmarks
          .map((benchmark) => ({
            key: benchmark.key,
            label: benchmark.label.trim(),
            symbol: benchmark.symbol.trim().toUpperCase(),
          }))
          .filter((benchmark) => benchmark.label.length > 0 || benchmark.symbol.length > 0),
      })
      setFeedback(
        isPolish
          ? `Zapisano ${result.enabledKeys.length} aktywnych benchmarków i ${result.pinnedKeys.length} przypiętych.`
          : `Saved ${result.enabledKeys.length} active benchmarks and ${result.pinnedKeys.length} pinned ones.`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('benchmarks.saveFailed'))
    }
  }

  return (
    <Card as="section" id="benchmarks">
      <SectionHeader
        eyebrow={t('benchmarks.eyebrow')}
        title={t('benchmarks.title')}
        description={t('benchmarks.description')}
        actions={(
          <button
            type="submit"
            form="portfolio-benchmark-settings-form"
            className={btnPrimary}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? t('common.saving') : t('benchmarks.saveBenchmarks')}
          </button>
        )}
      />

      {settingsQuery.isLoading ? (
        <p className="text-sm text-zinc-500">{t('benchmarks.loading')}</p>
      ) : settingsQuery.isError ? (
        <p className="text-sm text-red-400">{settingsQuery.error.message}</p>
      ) : (
        <form id="portfolio-benchmark-settings-form" className="space-y-6" onSubmit={handleSubmit}>
          <BenchmarkGroup
            title={t('benchmarks.system')}
            description={t('benchmarks.systemDescription')}
            options={groupedOptions.system}
            enabledKeys={enabledKeys}
            pinnedKeys={pinnedKeys}
            onToggleEnabled={toggleEnabled}
            onTogglePinned={togglePinned}
          />

          <BenchmarkGroup
            title={t('benchmarks.multiAsset')}
            description={t('benchmarks.multiAssetDescription')}
            options={groupedOptions.multiAsset}
            enabledKeys={enabledKeys}
            pinnedKeys={pinnedKeys}
            onToggleEnabled={toggleEnabled}
            onTogglePinned={togglePinned}
          />

          <div className="space-y-4 rounded-lg border border-zinc-800/50 p-4">
            <div>
              <h4 className="text-sm font-semibold text-zinc-100">{t('benchmarks.customTitle')}</h4>
              <p className="mt-1 text-sm text-zinc-500">
                {t('benchmarks.customDescription')}
              </p>
            </div>

            {customBenchmarks.map((benchmark, index) => {
              const enabled = enabledKeys.includes(benchmark.key)
              const pinned = pinnedKeys.includes(benchmark.key)

              return (
                <div key={benchmark.key} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-sm font-medium text-zinc-100">
                        {formatMessage(t('benchmarks.customSlotTitle'), { index: index + 1 })}
                      </h5>
                      <p className="mt-1 text-xs text-zinc-500">{benchmark.key}</p>
                    </div>
                    <span className={`${badge} ${enabled ? badgeVariants.info : badgeVariants.default}`}>
                      {enabled ? t('benchmarks.enabled') : t('benchmarks.off')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end">
                    <label>
                      <span className={labelClass}>{t('benchmarks.label')}</span>
                      <input
                        className={input}
                        value={benchmark.label}
                        onChange={(event) => updateCustomBenchmark(benchmark.key, 'label', event.target.value)}
                        placeholder={t('benchmarks.labelPlaceholder')}
                      />
                    </label>
                    <label>
                      <span className={labelClass}>{t('benchmarks.symbol')}</span>
                      <input
                        className={input}
                        value={benchmark.symbol}
                        onChange={(event) => updateCustomBenchmark(benchmark.key, 'symbol', event.target.value)}
                        placeholder="EXUS.DE"
                      />
                    </label>
                    <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
                        checked={enabled}
                        onChange={() => toggleEnabled(benchmark.key)}
                      />
                      {t('benchmarks.enabled')}
                    </label>
                    {enabled && (
                      <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
                          checked={pinned}
                          onChange={() => togglePinned(benchmark.key)}
                        />
                        {t('benchmarks.pinned')}
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`${badge} ${badgeVariants.info}`}>
              {t('benchmarks.enabledCount')} {enabledKeys.length}
            </span>
            <span className={`${badge} ${badgeVariants.default}`}>
              {t('benchmarks.pinnedCount')} {pinnedKeys.length}
            </span>
          </div>

          {feedback && <p className="text-sm text-emerald-400">{feedback}</p>}
          {actionError && <p className="text-sm text-red-400">{actionError}</p>}
        </form>
      )}
    </Card>
  )
}

function BenchmarkGroup({
  title,
  description,
  options,
  enabledKeys,
  pinnedKeys,
  onToggleEnabled,
  onTogglePinned,
}: {
  title: string
  description: string
  options: Array<{ key: string; label: string; symbol?: string | null }>
  enabledKeys: BenchmarkKey[]
  pinnedKeys: BenchmarkKey[]
  onToggleEnabled: (key: BenchmarkKey) => void
  onTogglePinned: (key: BenchmarkKey) => void
}) {
  if (options.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-zinc-800/50 p-4">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {options.map((option) => {
          const key = option.key as BenchmarkKey
          const enabled = enabledKeys.includes(key)
          const pinned = pinnedKeys.includes(key)
          return (
            <label key={option.key} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-zinc-100">{translateBenchmarkLabel(option.label)}</div>
                  {option.symbol ? <div className="mt-1 text-xs text-zinc-500">{option.symbol}</div> : null}
                </div>
                <span className={`${badge} ${enabled ? badgeVariants.info : badgeVariants.default}`}>
                  {enabled ? t('benchmarks.enabled') : t('benchmarks.off')}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-300">
                <span className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
                    checked={enabled}
                    onChange={() => onToggleEnabled(key)}
                  />
                  {t('benchmarks.enabled')}
                </span>
                {enabled && (
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
                      checked={pinned}
                      onChange={() => onTogglePinned(key)}
                    />
                    {t('benchmarks.pinned')}
                  </span>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
