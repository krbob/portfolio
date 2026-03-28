import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorState, LoadingState, SectionHeader } from './ui'
import { t } from '../lib/messages'
import {
  useAccounts,
  useCreateTransactionImportProfile,
  useDeleteTransactionImportProfile,
  useImportTransactions,
  useImportTransactionsCsv,
  usePreviewTransactionsImport,
  usePreviewTransactionsCsvImport,
  useTransactionImportProfiles,
  useUpdateTransactionImportProfile,
} from '../hooks/use-write-model'
import {
  NEW_IMPORT_PROFILE_ID,
} from '../screens/transactions/transactions-helpers'
import { TransactionImport } from '../screens/transactions/TransactionImport'
import { TransactionImportProfiles } from '../screens/transactions/TransactionImportProfiles'

export function TransactionImportSection() {
  const accountsQuery = useAccounts()
  const transactionImportProfilesQuery = useTransactionImportProfiles()
  const createImportProfileMutation = useCreateTransactionImportProfile()
  const updateImportProfileMutation = useUpdateTransactionImportProfile()
  const deleteImportProfileMutation = useDeleteTransactionImportProfile()
  const previewTransactionsCsvImportMutation = usePreviewTransactionsCsvImport()
  const importTransactionsCsvMutation = useImportTransactionsCsv()
  const previewTransactionsImportMutation = usePreviewTransactionsImport()
  const importTransactionsMutation = useImportTransactions()

  const [selectedImportProfileId, setSelectedImportProfileId] = useState<string | null>(null)
  const [pendingSavedImportProfile, setPendingSavedImportProfile] = useState<import('../api/write-model').TransactionImportProfile | null>(null)
  const [importProfileDirty, setImportProfileDirty] = useState(false)
  const [importProfileTemplate, setImportProfileTemplate] = useState('')

  const accountOptions = accountsQuery.data ?? []
  const importProfiles = useMemo(() => transactionImportProfilesQuery.data ?? [], [transactionImportProfilesQuery.data])

  const selectedImportProfile = useMemo(
    () =>
      selectedImportProfileId && selectedImportProfileId !== NEW_IMPORT_PROFILE_ID
        ? importProfiles.find((profile) => profile.id === selectedImportProfileId) ??
          (pendingSavedImportProfile?.id === selectedImportProfileId ? pendingSavedImportProfile : null)
        : null,
    [importProfiles, pendingSavedImportProfile, selectedImportProfileId],
  )
  const selectedImportProfileSyncKey = selectedImportProfile
    ? `${selectedImportProfile.id}:${selectedImportProfile.updatedAt}`
    : selectedImportProfileId

  const importProfileBlockingReason =
    selectedImportProfileId == null
      ? t('transactionsOrch.loadingProfiles')
      : selectedImportProfileId === NEW_IMPORT_PROFILE_ID
        ? t('transactionsOrch.saveProfileBeforeAction')
        : selectedImportProfile == null
          ? t('transactionsOrch.profileUnavailable')
          : importProfileDirty
            ? t('transactionsOrch.saveProfileChanges')
            : null

  useEffect(() => {
    if (selectedImportProfileId === null) {
      setSelectedImportProfileId(importProfiles[0]?.id ?? NEW_IMPORT_PROFILE_ID)
    }
  }, [importProfiles, selectedImportProfileId])

  const handleImportProfileDirtyChange = useCallback((dirty: boolean) => {
    setImportProfileDirty(dirty)
  }, [])

  const handleImportProfileTemplateChange = useCallback((template: string) => {
    setImportProfileTemplate(template)
  }, [])

  const hasData = accountsQuery.data != null || transactionImportProfilesQuery.data != null
  const error = accountsQuery.error ?? transactionImportProfilesQuery.error

  if (!hasData && (accountsQuery.isLoading || transactionImportProfilesQuery.isLoading)) {
    return (
      <LoadingState
        title={t('settings.csvImport')}
        description={t('settings.csvImportDescription')}
        blocks={3}
      />
    )
  }

  if (!hasData && error) {
    return (
      <ErrorState
        title={t('settings.csvImport')}
        description={t('settings.csvImportDescription')}
        onRetry={() => {
          void Promise.all([accountsQuery.refetch(), transactionImportProfilesQuery.refetch()])
        }}
      />
    )
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t('settings.csvImport')}
        title={t('settings.csvImport')}
        description={t('settings.csvImportDescription')}
      />

      <TransactionImportProfiles
        accounts={accountOptions}
        importProfiles={importProfiles}
        selectedImportProfileId={selectedImportProfileId}
        setSelectedImportProfileId={setSelectedImportProfileId}
        selectedImportProfile={selectedImportProfile}
        selectedImportProfileSyncKey={selectedImportProfileSyncKey}
        pendingSavedImportProfile={pendingSavedImportProfile}
        setPendingSavedImportProfile={setPendingSavedImportProfile}
        transactionImportProfilesQuery={transactionImportProfilesQuery}
        createImportProfileMutation={createImportProfileMutation}
        updateImportProfileMutation={updateImportProfileMutation}
        deleteImportProfileMutation={deleteImportProfileMutation}
        onDirtyChange={handleImportProfileDirtyChange}
        onTemplateChange={handleImportProfileTemplateChange}
      />

      <TransactionImport
        selectedImportProfile={selectedImportProfile}
        importProfileBlockingReason={importProfileBlockingReason}
        importProfileTemplate={importProfileTemplate}
        previewTransactionsCsvImportMutation={previewTransactionsCsvImportMutation}
        importTransactionsCsvMutation={importTransactionsCsvMutation}
        previewTransactionsImportMutation={previewTransactionsImportMutation}
        importTransactionsMutation={importTransactionsMutation}
      />
    </div>
  )
}
