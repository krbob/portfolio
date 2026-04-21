import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { BenchmarkOption, PortfolioBenchmarkSettings } from '../api/write-model'
import { usePortfolioBenchmarkSettings, useSavePortfolioBenchmarkSettings } from '../hooks/use-write-model'
import { useI18n } from '../lib/i18n'
import { translateBenchmarkLabel } from '../lib/labels'
import { t } from '../lib/messages'
import {
  badge,
  badgeVariants,
  btnDanger,
  btnPrimary,
  btnSecondary,
  input,
  label as labelClass,
} from '../lib/styles'
import { Card, SectionHeader } from './ui'
import { IconPlus } from './ui/icons'

const CUSTOM_KIND = 'CUSTOM'
const SYMBOL_FORMAT_PATTERN = /^[A-Z0-9._-]+$/

type BenchmarkFormRow = {
  key: string
  label: string
  symbol: string
  kind: string
  enabled: boolean
  pinned: boolean
  removable: boolean
}

export function PortfolioBenchmarkSettingsSection() {
  const { isPolish } = useI18n()
  const settingsQuery = usePortfolioBenchmarkSettings()
  const saveMutation = useSavePortfolioBenchmarkSettings()

  const [rows, setRows] = useState<BenchmarkFormRow[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }
    setRows(buildBenchmarkRows(settingsQuery.data))
  }, [settingsQuery.data])

  const counts = useMemo(() => {
    const enabledCount = rows.filter((row) => row.enabled).length
    const pinnedCount = rows.filter((row) => row.enabled && row.pinned).length
    return { enabledCount, pinnedCount }
  }, [rows])

  const groupedRows = useMemo(() => ({
    system: rows.filter((row) => row.kind === 'SYSTEM'),
    multiAsset: rows.filter((row) => row.kind === 'MULTI_ASSET'),
    custom: rows.filter((row) => row.removable),
  }), [rows])

  function toggleEnabled(key: string) {
    setFeedback(null)
    setActionError(null)
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) {
          return row
        }
        const enabled = !row.enabled
        return {
          ...row,
          enabled,
          pinned: enabled ? row.pinned : false,
        }
      }),
    )
  }

  function togglePinned(key: string) {
    setFeedback(null)
    setActionError(null)
    setRows((current) =>
      current.map((row) => (
        row.key === key && row.enabled
          ? { ...row, pinned: !row.pinned }
          : row
      )),
    )
  }

  function updateCustomBenchmark(key: string, field: 'label' | 'symbol', value: string) {
    setFeedback(null)
    setActionError(null)
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) {
          return row
        }
        return {
          ...row,
          [field]: field === 'symbol' ? value.toUpperCase() : value,
        }
      }),
    )
  }

  function addCustomBenchmark() {
    setFeedback(null)
    setActionError(null)
    setRows((current) => [...current, createEmptyCustomBenchmark(new Set(current.map((row) => row.key)))])
  }

  function removeCustomBenchmark(key: string) {
    setFeedback(null)
    setActionError(null)
    setRows((current) => current.filter((row) => row.key !== key))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    const customRowStates = rows.filter((row) => row.removable).map(customRowState)
    if (customRowStates.some((state) => state.kind === 'invalid')) {
      setActionError(t('benchmarks.symbolFormatInvalidGlobal'))
      return
    }
    if (customRowStates.some((state) => state.kind === 'incomplete')) {
      setActionError(t('benchmarks.rowIncompleteGlobal'))
      return
    }

    try {
      const result = await saveMutation.mutateAsync({
        enabledKeys: rows.filter((row) => row.enabled).map((row) => row.key),
        pinnedKeys: rows.filter((row) => row.enabled && row.pinned).map((row) => row.key),
        customBenchmarks: rows
          .filter((row) => row.removable)
          .map((row) => ({
            key: row.key,
            label: row.label.trim(),
            symbol: row.symbol.trim().toUpperCase(),
          }))
          .filter((row) => row.label.length > 0 || row.symbol.length > 0),
      })
      setRows(buildBenchmarkRows(result))
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
            rows={groupedRows.system}
            onToggleEnabled={toggleEnabled}
            onTogglePinned={togglePinned}
            onUpdateCustomBenchmark={updateCustomBenchmark}
            onRemoveCustomBenchmark={removeCustomBenchmark}
          />

          <BenchmarkGroup
            title={t('benchmarks.multiAsset')}
            description={t('benchmarks.multiAssetDescription')}
            rows={groupedRows.multiAsset}
            onToggleEnabled={toggleEnabled}
            onTogglePinned={togglePinned}
            onUpdateCustomBenchmark={updateCustomBenchmark}
            onRemoveCustomBenchmark={removeCustomBenchmark}
          />

          <BenchmarkGroup
            title={t('benchmarks.customTitle')}
            description={t('benchmarks.customDescription')}
            rows={groupedRows.custom}
            emptyCopy={t('benchmarks.customEmpty')}
            footer={(
              <button
                type="button"
                className={`${btnSecondary} inline-flex items-center gap-2`}
                onClick={addCustomBenchmark}
                disabled={saveMutation.isPending}
              >
                <IconPlus className="h-4 w-4" />
                {t('benchmarks.addBenchmark')}
              </button>
            )}
            onToggleEnabled={toggleEnabled}
            onTogglePinned={togglePinned}
            onUpdateCustomBenchmark={updateCustomBenchmark}
            onRemoveCustomBenchmark={removeCustomBenchmark}
          />

          <div className="rounded-lg border border-zinc-800/50 bg-zinc-950/40 p-4 text-xs text-zinc-500">
            {t('benchmarks.pinnedHint')}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`${badge} ${badgeVariants.info}`}>
              {t('benchmarks.enabledCount')} {counts.enabledCount}
            </span>
            <span className={`${badge} ${badgeVariants.default}`}>
              {t('benchmarks.pinnedCount')} {counts.pinnedCount}
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
  rows,
  emptyCopy,
  footer,
  onToggleEnabled,
  onTogglePinned,
  onUpdateCustomBenchmark,
  onRemoveCustomBenchmark,
}: {
  title: string
  description: string
  rows: BenchmarkFormRow[]
  emptyCopy?: string
  footer?: ReactNode
  onToggleEnabled: (key: string) => void
  onTogglePinned: (key: string) => void
  onUpdateCustomBenchmark: (key: string, field: 'label' | 'symbol', value: string) => void
  onRemoveCustomBenchmark: (key: string) => void
}) {
  return (
    <div className="rounded-lg border border-zinc-800/50 p-4">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <div className="space-y-3">
        {rows.length > 0 ? rows.map((row) => (
          <BenchmarkRowCard
            key={row.key}
            row={row}
            onToggleEnabled={onToggleEnabled}
            onTogglePinned={onTogglePinned}
            onUpdateCustomBenchmark={onUpdateCustomBenchmark}
            onRemoveCustomBenchmark={onRemoveCustomBenchmark}
          />
        )) : emptyCopy ? (
          <p className="text-sm text-zinc-500">{emptyCopy}</p>
        ) : null}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  )
}

function BenchmarkRowCard({
  row,
  onToggleEnabled,
  onTogglePinned,
  onUpdateCustomBenchmark,
  onRemoveCustomBenchmark,
}: {
  row: BenchmarkFormRow
  onToggleEnabled: (key: string) => void
  onTogglePinned: (key: string) => void
  onUpdateCustomBenchmark: (key: string, field: 'label' | 'symbol', value: string) => void
  onRemoveCustomBenchmark: (key: string) => void
}) {
  const rowState = row.removable ? customRowState(row) : null
  const title = row.removable
    ? (row.label.trim().length > 0 ? row.label : t('benchmarks.translateCustom'))
    : translateBenchmarkLabel(row.label)

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-sm font-semibold text-zinc-100">{title}</h5>
            <span className={`${badge} ${row.enabled ? badgeVariants.info : badgeVariants.default}`}>
              {row.enabled ? t('benchmarks.enabled') : t('benchmarks.off')}
            </span>
          </div>
          {row.symbol ? <p className="mt-1 text-xs text-zinc-500">{row.symbol}</p> : null}
        </div>

        {row.removable ? (
          <button
            type="button"
            className={btnDanger}
            onClick={() => onRemoveCustomBenchmark(row.key)}
          >
            {t('benchmarks.removeBenchmark')}
          </button>
        ) : null}
      </div>

      {row.removable ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-start">
            <label>
              <span className={labelClass}>{t('benchmarks.label')}</span>
              <input
                className={input}
                value={row.label}
                onChange={(event) => onUpdateCustomBenchmark(row.key, 'label', event.target.value)}
                placeholder={t('benchmarks.labelPlaceholder')}
              />
            </label>
            <label>
              <span className={labelClass}>{t('benchmarks.symbol')}</span>
              <input
                className={input}
                value={row.symbol}
                onChange={(event) => onUpdateCustomBenchmark(row.key, 'symbol', event.target.value)}
                placeholder="EXUS.DE"
              />
            </label>
            <ToggleField
              checked={row.enabled}
              label={t('benchmarks.enabled')}
              onChange={() => onToggleEnabled(row.key)}
            />
            <ToggleField
              checked={row.pinned}
              disabled={!row.enabled}
              label={t('benchmarks.pinned')}
              title={t('benchmarks.pinnedHint')}
              onChange={() => onTogglePinned(row.key)}
            />
          </div>
          <p className={`mt-3 text-xs ${rowState!.colorClass}`}>
            {rowState!.message}
          </p>
        </>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <ToggleField
            checked={row.enabled}
            label={t('benchmarks.enabled')}
            onChange={() => onToggleEnabled(row.key)}
          />
          <ToggleField
            checked={row.pinned}
            disabled={!row.enabled}
            label={t('benchmarks.pinned')}
            title={t('benchmarks.pinnedHint')}
            onChange={() => onTogglePinned(row.key)}
          />
        </div>
      )}
    </article>
  )
}

function ToggleField({
  checked,
  disabled = false,
  label,
  title,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  title?: string
  onChange: () => void
}) {
  return (
    <label
      className={`flex items-center gap-2 text-sm ${disabled ? 'text-zinc-600' : 'text-zinc-300'}`}
      title={title}
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      {label}
    </label>
  )
}

function buildBenchmarkRows(settings: PortfolioBenchmarkSettings): BenchmarkFormRow[] {
  const enabledKeys = new Set(settings.enabledKeys)
  const pinnedKeys = new Set(settings.pinnedKeys)

  const builtInRows = settings.options
    .filter((option) => option.kind !== CUSTOM_KIND)
    .map((option) => buildBuiltInRow(option, enabledKeys, pinnedKeys))
  const customRows = (settings.customBenchmarks ?? []).map((benchmark) => ({
    key: benchmark.key,
    label: benchmark.label,
    symbol: benchmark.symbol,
    kind: CUSTOM_KIND,
    enabled: enabledKeys.has(benchmark.key),
    pinned: pinnedKeys.has(benchmark.key),
    removable: true,
  }))

  return [...builtInRows, ...customRows]
}

function buildBuiltInRow(option: BenchmarkOption, enabledKeys: Set<string>, pinnedKeys: Set<string>): BenchmarkFormRow {
  return {
    key: option.key,
    label: option.label,
    symbol: option.symbol ?? '',
    kind: option.kind,
    enabled: enabledKeys.has(option.key),
    pinned: pinnedKeys.has(option.key),
    removable: false,
  }
}

function createEmptyCustomBenchmark(existingKeys: Set<string>): BenchmarkFormRow {
  return {
    key: nextCustomBenchmarkKey(existingKeys),
    label: '',
    symbol: '',
    kind: CUSTOM_KIND,
    enabled: false,
    pinned: false,
    removable: true,
  }
}

function nextCustomBenchmarkKey(existingKeys: Set<string>): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0').toUpperCase()
    const candidate = `CUSTOM_${suffix}`
    if (!existingKeys.has(candidate)) {
      return candidate
    }
  }
  return `CUSTOM_${Date.now().toString(16).toUpperCase()}`
}

function isValidCustomSymbol(symbol: string) {
  return SYMBOL_FORMAT_PATTERN.test(symbol.trim().toUpperCase())
}

type CustomRowState =
  | { kind: 'empty'; colorClass: string; message: string }
  | { kind: 'incomplete'; colorClass: string; message: string }
  | { kind: 'invalid'; colorClass: string; message: string }
  | { kind: 'valid'; colorClass: string; message: string }

function customRowState(row: BenchmarkFormRow): CustomRowState {
  const label = row.label.trim()
  const symbol = row.symbol.trim()

  if (label.length === 0 && symbol.length === 0) {
    return {
      kind: 'empty',
      colorClass: 'text-zinc-500',
      message: t('benchmarks.symbolFormatHint'),
    }
  }

  if (label.length === 0 || symbol.length === 0) {
    return {
      kind: 'incomplete',
      colorClass: 'text-amber-400',
      message: t('benchmarks.rowIncomplete'),
    }
  }

  if (!isValidCustomSymbol(symbol)) {
    return {
      kind: 'invalid',
      colorClass: 'text-red-400',
      message: t('benchmarks.symbolFormatInvalid'),
    }
  }

  return {
    kind: 'valid',
    colorClass: 'text-emerald-400',
    message: t('benchmarks.symbolFormatValid'),
  }
}
