import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { usePortfolioBenchmarkSettings, useSavePortfolioBenchmarkSettings } from '../hooks/use-write-model'
import { useI18n } from '../lib/i18n'
import { badge, badgeVariants, btnPrimary, input, label as labelClass } from '../lib/styles'
import { Card, SectionHeader } from './ui'

type BenchmarkKey =
  | 'VWRA'
  | 'INFLATION'
  | 'TARGET_MIX'
  | 'V80A'
  | 'V60A'
  | 'V40A'
  | 'V20A'
  | 'CUSTOM'

export function PortfolioBenchmarkSettingsSection() {
  const { isPolish } = useI18n()
  const settingsQuery = usePortfolioBenchmarkSettings()
  const saveMutation = useSavePortfolioBenchmarkSettings()

  const [enabledKeys, setEnabledKeys] = useState<BenchmarkKey[]>([])
  const [pinnedKeys, setPinnedKeys] = useState<BenchmarkKey[]>([])
  const [customLabel, setCustomLabel] = useState('')
  const [customSymbol, setCustomSymbol] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }
    setEnabledKeys(settingsQuery.data.enabledKeys as BenchmarkKey[])
    setPinnedKeys(settingsQuery.data.pinnedKeys as BenchmarkKey[])
    setCustomLabel(settingsQuery.data.customLabel ?? '')
    setCustomSymbol(settingsQuery.data.customSymbol ?? '')
  }, [settingsQuery.data])

  const options = settingsQuery.data?.options ?? []
  const groupedOptions = useMemo(() => {
    return {
      system: options.filter((option) => option.kind === 'SYSTEM'),
      multiAsset: options.filter((option) => option.kind === 'MULTI_ASSET'),
      custom: options.filter((option) => option.kind === 'CUSTOM'),
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    try {
      const result = await saveMutation.mutateAsync({
        enabledKeys,
        pinnedKeys,
        customLabel: customLabel.trim() || null,
        customSymbol: customSymbol.trim() || null,
      })
      setFeedback(
        isPolish
          ? `Zapisano ${result.enabledKeys.length} aktywnych benchmarków i ${result.pinnedKeys.length} przypiętych.`
          : `Saved ${result.enabledKeys.length} active benchmarks and ${result.pinnedKeys.length} pinned ones.`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : isPolish ? 'Nie udało się zapisać benchmarków.' : 'Saving benchmarks failed.')
    }
  }

  return (
    <Card as="section" id="benchmarks">
      <SectionHeader
        eyebrow={isPolish ? 'Benchmarki' : 'Benchmarks'}
        title={isPolish ? 'Konfiguracja benchmarków' : 'Benchmark configuration'}
        description={isPolish
          ? 'Wybierz benchmarki aktywne w zakładce Wyniki i przypnij te, które chcesz widzieć jako pierwsze.'
          : 'Choose which benchmarks stay active in Performance and pin the ones that should appear first.'}
        actions={(
          <button
            type="submit"
            form="portfolio-benchmark-settings-form"
            className={btnPrimary}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (isPolish ? 'Zapisywanie...' : 'Saving...') : (isPolish ? 'Zapisz benchmarki' : 'Save benchmarks')}
          </button>
        )}
      />

      {settingsQuery.isLoading ? (
        <p className="text-sm text-zinc-500">{isPolish ? 'Ładowanie konfiguracji benchmarków...' : 'Loading benchmark settings...'}</p>
      ) : settingsQuery.isError ? (
        <p className="text-sm text-red-400">{settingsQuery.error.message}</p>
      ) : (
        <form id="portfolio-benchmark-settings-form" className="space-y-6" onSubmit={handleSubmit}>
          <BenchmarkGroup
            title={isPolish ? 'Systemowe' : 'System'}
            description={isPolish ? 'Benchmark portfela, inflacji i alokacji docelowej.' : 'Portfolio, inflation and target-mix references.'}
            options={groupedOptions.system}
            enabledKeys={enabledKeys}
            pinnedKeys={pinnedKeys}
            onToggleEnabled={toggleEnabled}
            onTogglePinned={togglePinned}
            isPolish={isPolish}
          />

          <BenchmarkGroup
            title={isPolish ? 'ETF-y wieloassetowe' : 'Multi-asset ETFs'}
            description={isPolish ? 'Gotowe portfele 80/20, 60/40, 40/60 i 20/80 do porównań strategii.' : 'Ready-made 80/20, 60/40, 40/60 and 20/80 portfolios for strategy comparisons.'}
            options={groupedOptions.multiAsset}
            enabledKeys={enabledKeys}
            pinnedKeys={pinnedKeys}
            onToggleEnabled={toggleEnabled}
            onTogglePinned={togglePinned}
            isPolish={isPolish}
          />

          <div className="rounded-lg border border-zinc-800/50 p-4">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-100">{isPolish ? 'Własny benchmark' : 'Custom benchmark'}</h4>
              <p className="mt-1 text-sm text-zinc-500">
                {isPolish
                  ? 'Dodaj jeden własny symbol rynkowy i przypnij go tak samo jak benchmarki wbudowane.'
                  : 'Add one custom market symbol and pin it like any other benchmark.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end">
              <label>
                <span className={labelClass}>{isPolish ? 'Etykieta' : 'Label'}</span>
                <input
                  className={input}
                  value={customLabel}
                  onChange={(event) => setCustomLabel(event.target.value)}
                  placeholder={isPolish ? 'np. FTSE Europe' : 'e.g. FTSE Europe'}
                />
              </label>
              <label>
                <span className={labelClass}>{isPolish ? 'Symbol' : 'Symbol'}</span>
                <input
                  className={input}
                  value={customSymbol}
                  onChange={(event) => setCustomSymbol(event.target.value.toUpperCase())}
                  placeholder="EXUS.DE"
                />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
                  checked={enabledKeys.includes('CUSTOM')}
                  onChange={() => toggleEnabled('CUSTOM')}
                />
                {isPolish ? 'Aktywny' : 'Enabled'}
              </label>
              {enabledKeys.includes('CUSTOM') && (
                <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
                    checked={pinnedKeys.includes('CUSTOM')}
                    onChange={() => togglePinned('CUSTOM')}
                  />
                  {isPolish ? 'Przypięty' : 'Pinned'}
                </label>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`${badge} ${badgeVariants.info}`}>
              {isPolish ? 'Aktywne' : 'Enabled'} {enabledKeys.length}
            </span>
            <span className={`${badge} ${badgeVariants.default}`}>
              {isPolish ? 'Przypięte' : 'Pinned'} {pinnedKeys.length}
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
  isPolish,
}: {
  title: string
  description: string
  options: Array<{ key: string; label: string; symbol?: string | null }>
  enabledKeys: BenchmarkKey[]
  pinnedKeys: BenchmarkKey[]
  onToggleEnabled: (key: BenchmarkKey) => void
  onTogglePinned: (key: BenchmarkKey) => void
  isPolish: boolean
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
                  <div className="text-sm font-medium text-zinc-100">{translateBenchmarkLabel(option.label, isPolish)}</div>
                  {option.symbol ? <div className="mt-1 text-xs text-zinc-500">{option.symbol}</div> : null}
                </div>
                <span className={`${badge} ${enabled ? badgeVariants.info : badgeVariants.default}`}>
                  {enabled ? (isPolish ? 'Aktywny' : 'Enabled') : (isPolish ? 'Wyłączony' : 'Off')}
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
                  {isPolish ? 'Aktywny' : 'Enabled'}
                </span>
                {enabled && (
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
                      checked={pinned}
                      onChange={() => onTogglePinned(key)}
                    />
                    {isPolish ? 'Przypięty' : 'Pinned'}
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

function translateBenchmarkLabel(label: string, isPolish: boolean) {
  if (!isPolish) {
    return label
  }

  switch (label) {
    case 'VWRA benchmark':
      return 'Benchmark VWRA'
    case 'Inflation benchmark':
      return 'Benchmark inflacji'
    case 'Configured target mix':
      return 'Skonfigurowany podział docelowy'
    case 'Custom benchmark':
      return 'Własny benchmark'
    default:
      return label
  }
}
