import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Card, SectionHeader } from './ui'
import {
  useAccounts,
  useExportPortfolioState,
  useImportPortfolioState,
  useInstruments,
  usePortfolioTargets,
  usePreviewPortfolioStateImport,
  useTransactionImportProfiles,
  useTransactions,
} from '../hooks/use-write-model'
import type { PortfolioStateSnapshot, PreviewPortfolioStateImportResult } from '../api/write-model'
import { useI18n } from '../lib/i18n'
import { label as labelClass, input, btnPrimary, btnSecondary, badge, badgeVariants } from '../lib/styles'

export function PortfolioStateSection() {
  const { isPolish } = useI18n()
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const targetsQuery = usePortfolioTargets()
  const importProfilesQuery = useTransactionImportProfiles()
  const transactionsQuery = useTransactions()
  const exportMutation = useExportPortfolioState()
  const previewMutation = usePreviewPortfolioStateImport()
  const importMutation = useImportPortfolioState()

  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE')
  const [replaceConfirmation, setReplaceConfirmation] = useState('')
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [selectedFileContent, setSelectedFileContent] = useState<string>('')
  const [previewResult, setPreviewResult] = useState<PreviewPortfolioStateImportResult | null>(null)
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleExportClick() {
    setImportFeedback(null)
    setImportError(null)

    try {
      const snapshot = await exportMutation.mutateAsync()
      downloadSnapshot(snapshot)
      setImportFeedback(
        isPolish
          ? `Wyeksportowano ${snapshot.accounts.length} kont, ${snapshot.appPreferences?.length ?? 0} ustawień aplikacji, ${snapshot.instruments.length} instrumentów, ${snapshot.targets?.length ?? 0} celów, ${snapshot.transactions.length} transakcji i ${snapshot.importProfiles?.length ?? 0} profili importu.`
          : `Exported ${snapshot.accounts.length} accounts, ${snapshot.appPreferences?.length ?? 0} app settings, ${snapshot.instruments.length} instruments, ${snapshot.targets?.length ?? 0} targets, ${snapshot.transactions.length} transactions and ${snapshot.importProfiles?.length ?? 0} import profiles.`,
      )
    } catch (error) {
      setImportError(error instanceof Error ? error.message : isPolish ? 'Eksport nie powiódł się.' : 'Export failed.')
    }
  }

  async function handlePreviewClick() {
    setImportFeedback(null)
    setImportError(null)

    if (selectedFileContent.trim() === '') {
      setImportError(isPolish ? 'Najpierw wybierz plik zrzutu stanu w formacie JSON.' : 'Choose a JSON snapshot file first.')
      setPreviewResult(null)
      return
    }

    try {
      const snapshot = parseSelectedSnapshot(selectedFileContent, isPolish)
      const result = await previewMutation.mutateAsync({
        mode: importMode,
        snapshot,
      })
      setPreviewResult(result)
      setImportFeedback(
        result.isValid
          ? isPolish
            ? 'Podgląd gotowy. Zrzut stanu przeszedł walidację.'
            : 'Preview ready. The snapshot passed validation.'
          : isPolish
            ? 'Podgląd gotowy. Rozwiąż blokujące problemy przed importem.'
            : 'Preview ready. Resolve blocking issues before importing.',
      )
    } catch (error) {
      setPreviewResult(null)
      setImportError(error instanceof Error ? error.message : isPolish ? 'Nie udało się przygotować podglądu.' : 'Preview failed.')
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setSelectedFileName('')
      setSelectedFileContent('')
      setPreviewResult(null)
      return
    }

    setSelectedFileName(file.name)
    setSelectedFileContent(await file.text())
    setPreviewResult(null)
    setImportFeedback(null)
    setImportError(null)
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setImportFeedback(null)
    setImportError(null)

    if (selectedFileContent.trim() === '') {
      setImportError(isPolish ? 'Najpierw wybierz plik zrzutu stanu w formacie JSON.' : 'Choose a JSON snapshot file first.')
      return
    }

    if (previewResult == null) {
      setImportError(isPolish ? 'Najpierw uruchom podgląd wybranego zrzutu stanu.' : 'Preview the selected snapshot before importing.')
      return
    }

    if (!previewResult.isValid) {
      setImportError(
        isPolish
          ? 'Wybrany zrzut stanu ma blokujące problemy. Napraw je przed importem.'
          : 'The selected snapshot has blocking issues. Fix them before importing.',
      )
      return
    }

    try {
      const snapshot = parseSelectedSnapshot(selectedFileContent, isPolish)
      const result = await importMutation.mutateAsync({
        mode: importMode,
        confirmation: importMode === 'REPLACE' ? replaceConfirmation : undefined,
        snapshot,
      })
      setPreviewResult(null)
      setImportFeedback(
        isPolish
          ? `Zaimportowano ${result.accountCount} kont, ${result.appPreferenceCount} ustawień aplikacji, ${result.instrumentCount} instrumentów, ${result.targetCount} celów, ${result.transactionCount} transakcji i ${result.importProfileCount} profili importu w trybie ${result.mode}.${result.safetyBackupFileName ? ` Kopia bezpieczeństwa: ${result.safetyBackupFileName}.` : ''}`
          : `Imported ${result.accountCount} accounts, ${result.appPreferenceCount} app settings, ${result.instrumentCount} instruments, ${result.targetCount} targets, ${result.transactionCount} transactions and ${result.importProfileCount} import profiles in ${result.mode} mode.${result.safetyBackupFileName ? ` Safety backup: ${result.safetyBackupFileName}.` : ''}`,
      )
      setReplaceConfirmation('')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : isPolish ? 'Import nie powiódł się.' : 'Import failed.')
    }
  }

  return (
    <Card>
      <SectionHeader
        eyebrow={isPolish ? 'Import / eksport' : 'Transfer'}
        title={isPolish ? 'Eksport i przywracanie stanu' : 'Backup and restore'}
        description={
          isPolish
            ? 'Wyeksportuj kompletny stan aplikacji do pliku JSON albo przywróć wcześniej zapisany zrzut w trybie MERGE lub REPLACE.'
            : 'Export the canonical write model as a JSON snapshot or import a previously exported snapshot in merge or replace mode.'
        }
      />

      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Konta' : 'Accounts'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{accountsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Instrumenty' : 'Instruments'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{instrumentsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Cele' : 'Targets'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{targetsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Transakcje' : 'Transactions'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{transactionsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Profile importu' : 'Import profiles'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{importProfilesQuery.data?.length ?? '...'}</strong>
        </article>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-800/50 p-4">
          <div className="mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{isPolish ? 'Eksport' : 'Export'}</p>
            <h4 className="mt-1 text-base font-semibold text-zinc-100">{isPolish ? 'Pobierz zrzut stanu' : 'Download snapshot'}</h4>
            <p className="mt-1 text-sm text-zinc-500">
              {isPolish
                ? 'Generuje kompletny plik JSON z kontami, instrumentami, transakcjami, ustawieniami aplikacji i profilami importu wraz z oryginalnymi identyfikatorami oraz znacznikami czasu.'
                : 'Generates a canonical JSON snapshot that includes the ledger, app settings and import profiles with original ids and timestamps.'}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button className={btnPrimary} type="button" onClick={handleExportClick} disabled={exportMutation.isPending}>
              {exportMutation.isPending
                ? isPolish
                  ? 'Eksportowanie...'
                  : 'Exporting...'
                : isPolish
                  ? 'Eksportuj JSON'
                  : 'Export JSON'}
            </button>
          </div>
        </div>

        <form className="rounded-lg border border-zinc-800/50 p-4" onSubmit={handleImportSubmit}>
          <div className="mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{isPolish ? 'Import' : 'Import'}</p>
            <h4 className="mt-1 text-base font-semibold text-zinc-100">{isPolish ? 'Przywróć zrzut stanu' : 'Restore snapshot'}</h4>
            <p className="mt-1 text-sm text-zinc-500">
              {isPolish
                ? '`MERGE` aktualizuje istniejące rekordy po identyfikatorach i kluczach. `REPLACE` czyści bieżący stan, ustawienia aplikacji i profile importu przed wczytaniem pliku.'
                : '`MERGE` upserts by id/key. `REPLACE` clears the current write model, app settings and import profiles before loading the snapshot.'}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {isPolish
                ? '`REPLACE` wymaga wpisania `REPLACE` i automatycznie tworzy kopię bezpieczeństwa.'
                : '`REPLACE` import requires typing `REPLACE` and creates a safety backup automatically.'}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <span className={labelClass}>{isPolish ? 'Tryb importu' : 'Import mode'}</span>
              <select
                className={input}
                value={importMode}
                onChange={(event) => {
                  setImportMode(event.target.value as 'MERGE' | 'REPLACE')
                  setReplaceConfirmation('')
                  setPreviewResult(null)
                  setImportFeedback(null)
                  setImportError(null)
                }}
              >
                <option value="MERGE">MERGE</option>
                <option value="REPLACE">REPLACE</option>
              </select>
            </div>

            {importMode === 'REPLACE' && (
              <div>
                <span className={labelClass}>{isPolish ? 'Wpisz REPLACE' : 'Type REPLACE'}</span>
                <input
                  className={input}
                  type="text"
                  value={replaceConfirmation}
                  onChange={(event) => setReplaceConfirmation(event.target.value)}
                  placeholder="REPLACE"
                />
              </div>
            )}

            <div>
              <span className={labelClass}>{isPolish ? 'Plik zrzutu stanu' : 'Snapshot file'}</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-300 hover:file:bg-zinc-700"
              />
            </div>
          </div>

          <p className="text-sm text-zinc-500 mt-2">
            {selectedFileName !== ''
              ? isPolish
                ? `Wybrany plik: ${selectedFileName}`
                : `Selected file: ${selectedFileName}`
              : isPolish
                ? 'Nie wybrano jeszcze pliku zrzutu stanu.'
                : 'No snapshot file selected yet.'}
          </p>

          {previewResult && (
            <div className="mt-4 rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-zinc-100">{isPolish ? 'Podsumowanie podglądu importu' : 'Preview summary'}</h5>
                <span className={`${badge} ${previewResult.isValid ? badgeVariants.success : badgeVariants.error}`}>
                  {previewResult.isValid
                    ? isPolish
                      ? 'POPRAWNY'
                      : 'VALID'
                    : isPolish
                      ? 'ZABLOKOWANY'
                      : 'BLOCKED'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <PreviewMetricCard
                  label={isPolish ? 'Konta' : 'Accounts'}
                  snapshotCount={previewResult.snapshotAccountCount}
                  existingCount={previewResult.existingAccountCount}
                  matchingCount={previewResult.matchingAccountCount}
                />
                <PreviewMetricCard
                  label={isPolish ? 'Ustawienia' : 'App settings'}
                  snapshotCount={previewResult.snapshotAppPreferenceCount}
                  existingCount={previewResult.existingAppPreferenceCount}
                  matchingCount={previewResult.matchingAppPreferenceCount}
                />
                <PreviewMetricCard
                  label={isPolish ? 'Instrumenty' : 'Instruments'}
                  snapshotCount={previewResult.snapshotInstrumentCount}
                  existingCount={previewResult.existingInstrumentCount}
                  matchingCount={previewResult.matchingInstrumentCount}
                />
                <PreviewMetricCard
                  label={isPolish ? 'Cele' : 'Targets'}
                  snapshotCount={previewResult.snapshotTargetCount}
                  existingCount={previewResult.existingTargetCount}
                  matchingCount={previewResult.matchingTargetCount}
                />
                <PreviewMetricCard
                  label={isPolish ? 'Transakcje' : 'Transactions'}
                  snapshotCount={previewResult.snapshotTransactionCount}
                  existingCount={previewResult.existingTransactionCount}
                  matchingCount={previewResult.matchingTransactionCount}
                />
                <PreviewMetricCard
                  label={isPolish ? 'Profile importu' : 'Import profiles'}
                  snapshotCount={previewResult.snapshotImportProfileCount}
                  existingCount={previewResult.existingImportProfileCount}
                  matchingCount={previewResult.matchingImportProfileCount}
                />
              </div>

              <p className="text-sm text-zinc-500 mt-3">
                {previewResult.mode === 'REPLACE'
                  ? isPolish
                    ? `REPLACE najpierw wyczyści bieżący stan: ${previewResult.existingAccountCount} kont, ${previewResult.existingAppPreferenceCount} ustawień aplikacji, ${previewResult.existingInstrumentCount} instrumentów, ${previewResult.existingTargetCount} celów, ${previewResult.existingTransactionCount} transakcji i ${previewResult.existingImportProfileCount} profili importu.`
                    : `REPLACE will clear the current state first: ${previewResult.existingAccountCount} accounts, ${previewResult.existingAppPreferenceCount} app settings, ${previewResult.existingInstrumentCount} instruments, ${previewResult.existingTargetCount} targets, ${previewResult.existingTransactionCount} transactions and ${previewResult.existingImportProfileCount} import profiles.`
                  : isPolish
                    ? `MERGE zaktualizuje po identyfikatorach i kluczach: ${previewResult.matchingAccountCount} kont, ${previewResult.matchingAppPreferenceCount} ustawień aplikacji, ${previewResult.matchingInstrumentCount} instrumentów, ${previewResult.matchingTargetCount} celów, ${previewResult.matchingTransactionCount} transakcji i ${previewResult.matchingImportProfileCount} profili importu.`
                    : `MERGE will upsert ${previewResult.matchingAccountCount} accounts, ${previewResult.matchingAppPreferenceCount} app settings, ${previewResult.matchingInstrumentCount} instruments, ${previewResult.matchingTargetCount} targets, ${previewResult.matchingTransactionCount} transactions and ${previewResult.matchingImportProfileCount} import profiles by id/key.`}
              </p>

              {previewResult.issues.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {previewResult.issues.map((issue) => (
                    <li
                      key={`${issue.code}:${issue.message}`}
                      className={`rounded-lg px-3 py-2 text-sm ${issue.severity === 'ERROR' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}
                    >
                      <strong>{issue.code}</strong>
                      <span className="ml-2">{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button className={btnSecondary} type="button" onClick={handlePreviewClick} disabled={previewMutation.isPending || selectedFileContent.trim() === ''}>
              {previewMutation.isPending
                ? isPolish
                  ? 'Przygotowywanie podglądu...'
                  : 'Previewing...'
                : isPolish
                  ? 'Podgląd importu'
                  : 'Preview snapshot'}
            </button>
            <button
              className={btnPrimary}
              type="submit"
              disabled={
                importMutation.isPending ||
                previewMutation.isPending ||
                selectedFileContent.trim() === '' ||
                previewResult == null ||
                !previewResult.isValid ||
                (importMode === 'REPLACE' && replaceConfirmation.trim().toUpperCase() !== 'REPLACE')
              }
            >
              {importMutation.isPending
                ? isPolish
                  ? 'Importowanie...'
                  : 'Importing...'
                : isPolish
                  ? 'Importuj JSON'
                  : 'Import JSON'}
            </button>
          </div>
        </form>
      </div>

      {(importFeedback || importError || exportMutation.error || previewMutation.error || importMutation.error) && (
        <div className="mt-4 space-y-1">
          {importFeedback && <p className="text-sm text-zinc-500">{importFeedback}</p>}
          {(importError || exportMutation.error || previewMutation.error || importMutation.error) && (
            <p className="text-sm text-red-400">
              {importError ?? exportMutation.error?.message ?? previewMutation.error?.message ?? importMutation.error?.message}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function PreviewMetricCard({
  label,
  snapshotCount,
  existingCount,
  matchingCount,
}: {
  label: string
  snapshotCount: number
  existingCount: number
  matchingCount: number
}) {
  const { isPolish } = useI18n()
  return (
    <article className="rounded-lg border border-zinc-800/50 p-3">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-500">{isPolish ? 'Zrzut stanu' : 'Snapshot'}</dt>
          <dd className="text-zinc-100 tabular-nums">{snapshotCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">{isPolish ? 'Bieżący stan' : 'Current'}</dt>
          <dd className="text-zinc-100 tabular-nums">{existingCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">{isPolish ? 'Pasujące id' : 'Matching ids'}</dt>
          <dd className="text-zinc-100 tabular-nums">{matchingCount}</dd>
        </div>
      </dl>
    </article>
  )
}

function downloadSnapshot(snapshot: PortfolioStateSnapshot) {
  const payload = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `portfolio-state-${snapshot.exportedAt.slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}

function parseSelectedSnapshot(rawSnapshot: string, isPolish: boolean): PortfolioStateSnapshot {
  try {
    return JSON.parse(rawSnapshot) as PortfolioStateSnapshot
  } catch {
    throw new Error(isPolish ? 'Plik zrzutu stanu musi zawierać poprawny JSON.' : 'Snapshot file must contain valid JSON.')
  }
}
