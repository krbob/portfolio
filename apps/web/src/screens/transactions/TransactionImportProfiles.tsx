import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type {
  Account,
  SaveTransactionImportProfilePayload,
  TransactionImportProfile,
  UpdateTransactionImportProfilePayload,
} from '../../api/write-model'
import { useI18n } from '../../lib/i18n'
import { t } from '../../lib/messages'
import { card } from '../../lib/styles'
import {
  buildImportProfilePayload,
  buildImportProfileTemplate,
  compareAccountsByDisplayOrder,
  createInitialImportProfileForm,
  getImportMappingFields,
  importProfileToForm,
  NEW_IMPORT_PROFILE_ID,
  serializeImportProfilePayload,
  type ImportMappingField,
  type ImportProfileFormState,
} from './transactions-helpers'
import { TransactionImportProfileEditor } from './profiles/TransactionImportProfileEditor'
import { TransactionImportProfileSelector } from './profiles/TransactionImportProfileSelector'

export interface TransactionImportProfilesProps {
  accounts: Account[]
  importProfiles: TransactionImportProfile[]
  selectedImportProfileId: string | null
  setSelectedImportProfileId: (id: string) => void
  selectedImportProfile: TransactionImportProfile | null
  selectedImportProfileSyncKey: string | null
  pendingSavedImportProfile: TransactionImportProfile | null
  setPendingSavedImportProfile: (profile: TransactionImportProfile | null) => void
  transactionImportProfilesQuery: UseQueryResult<TransactionImportProfile[], Error>
  createImportProfileMutation: UseMutationResult<TransactionImportProfile, Error, SaveTransactionImportProfilePayload>
  updateImportProfileMutation: UseMutationResult<TransactionImportProfile, Error, UpdateTransactionImportProfilePayload>
  deleteImportProfileMutation: UseMutationResult<void, Error, string>
  onDirtyChange: (dirty: boolean) => void
  onTemplateChange: (template: string) => void
}

export function TransactionImportProfiles({
  accounts,
  importProfiles,
  selectedImportProfileId,
  setSelectedImportProfileId,
  selectedImportProfile,
  selectedImportProfileSyncKey,
  pendingSavedImportProfile,
  setPendingSavedImportProfile,
  transactionImportProfilesQuery,
  createImportProfileMutation,
  updateImportProfileMutation,
  deleteImportProfileMutation,
  onDirtyChange,
  onTemplateChange,
}: TransactionImportProfilesProps) {
  const { isPolish } = useI18n()

  const [importProfileForm, setImportProfileForm] = useState<ImportProfileFormState>(createInitialImportProfileForm)
  const [importProfileFeedback, setImportProfileFeedback] = useState<string | null>(null)
  const [pendingDeleteImportProfileId, setPendingDeleteImportProfileId] = useState<string | null>(null)

  const sortedAccountOptions = useMemo(() => [...accounts].sort(compareAccountsByDisplayOrder), [accounts])
  const localizedImportMappingFields = useMemo(() => getImportMappingFields(isPolish), [isPolish])
  const importProfilePayload = useMemo(() => buildImportProfilePayload(importProfileForm), [importProfileForm])
  const selectedImportProfilePayload = useMemo(
    () => (selectedImportProfile ? buildImportProfilePayload(importProfileToForm(selectedImportProfile)) : null),
    [selectedImportProfile],
  )
  const importProfileDirty = useMemo(() => {
    if (selectedImportProfileId === NEW_IMPORT_PROFILE_ID) {
      return (
        serializeImportProfilePayload(importProfilePayload) !==
        serializeImportProfilePayload(buildImportProfilePayload(createInitialImportProfileForm()))
      )
    }
    if (selectedImportProfilePayload == null) {
      return false
    }
    return serializeImportProfilePayload(importProfilePayload) !== serializeImportProfilePayload(selectedImportProfilePayload)
  }, [importProfilePayload, selectedImportProfileId, selectedImportProfilePayload])
  const importProfileTemplate = useMemo(() => buildImportProfileTemplate(importProfileForm), [importProfileForm])

  useEffect(() => {
    onDirtyChange(importProfileDirty)
  }, [importProfileDirty, onDirtyChange])

  useEffect(() => {
    onTemplateChange(importProfileTemplate)
  }, [importProfileTemplate, onTemplateChange])

  useEffect(() => {
    if (
      pendingSavedImportProfile &&
      (selectedImportProfileId !== pendingSavedImportProfile.id ||
        importProfiles.some((profile) => profile.id === pendingSavedImportProfile.id))
    ) {
      setPendingSavedImportProfile(null)
    }
  }, [importProfiles, pendingSavedImportProfile, selectedImportProfileId, setPendingSavedImportProfile])

  useEffect(() => {
    if (selectedImportProfileId === NEW_IMPORT_PROFILE_ID) {
      setImportProfileForm(createInitialImportProfileForm())
      return
    }
    if (selectedImportProfile) {
      setImportProfileForm(importProfileToForm(selectedImportProfile))
    }
  }, [selectedImportProfile, selectedImportProfileId, selectedImportProfileSyncKey])

  function updateImportProfileField(
    name: keyof Omit<ImportProfileFormState, 'headerMappings' | 'defaults'>,
    value: string | boolean,
  ) {
    setImportProfileFeedback(null)
    setImportProfileForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function updateImportProfileMapping(name: ImportMappingField, value: string) {
    setImportProfileFeedback(null)
    setImportProfileForm((current) => ({
      ...current,
      headerMappings: {
        ...current.headerMappings,
        [name]: value,
      },
    }))
  }

  function updateImportProfileDefault(name: keyof ImportProfileFormState['defaults'], value: string) {
    setImportProfileFeedback(null)
    setImportProfileForm((current) => ({
      ...current,
      defaults: {
        ...current.defaults,
        [name]: value,
      },
    }))
  }

  function handleCreateNewImportProfile() {
    setImportProfileFeedback(null)
    setPendingDeleteImportProfileId(null)
    setPendingSavedImportProfile(null)
    setSelectedImportProfileId(NEW_IMPORT_PROFILE_ID)
  }

  function handleImportProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = buildImportProfilePayload(importProfileForm)
    setImportProfileFeedback(null)

    if (selectedImportProfileId && selectedImportProfileId !== NEW_IMPORT_PROFILE_ID) {
      updateImportProfileMutation.mutate(
        {
          id: selectedImportProfileId,
          ...payload,
        },
        {
          onSuccess: (profile) => {
            setPendingSavedImportProfile(profile)
            setImportProfileFeedback(
              isPolish ? `Zaktualizowano profil importu "${profile.name}".` : `Updated import profile "${profile.name}".`,
            )
            setSelectedImportProfileId(profile.id)
            setImportProfileForm(importProfileToForm(profile))
          },
        },
      )
      return
    }

    createImportProfileMutation.mutate(payload, {
      onSuccess: (profile) => {
        setPendingSavedImportProfile(profile)
        setImportProfileFeedback(
          isPolish ? `Utworzono profil importu "${profile.name}".` : `Created import profile "${profile.name}".`,
        )
        setSelectedImportProfileId(profile.id)
        setImportProfileForm(importProfileToForm(profile))
      },
    })
  }

  function handleDeleteImportProfile() {
    if (!selectedImportProfile) {
      return
    }
    setPendingDeleteImportProfileId(selectedImportProfile.id)
  }

  function confirmDeleteImportProfile() {
    if (!selectedImportProfile) {
      return
    }

    const nextProfileId =
      importProfiles.find((profile) => profile.id !== selectedImportProfile.id)?.id ?? NEW_IMPORT_PROFILE_ID

    deleteImportProfileMutation.mutate(selectedImportProfile.id, {
      onSuccess: () => {
        setPendingSavedImportProfile(null)
        setPendingDeleteImportProfileId(null)
        setImportProfileFeedback(
          isPolish ? `Usunięto profil importu "${selectedImportProfile.name}".` : `Deleted import profile "${selectedImportProfile.name}".`,
        )
        setSelectedImportProfileId(nextProfileId)
      },
    })
  }

  const importProfileErrorMessage =
    transactionImportProfilesQuery.error?.message ??
    createImportProfileMutation.error?.message ??
    updateImportProfileMutation.error?.message ??
    deleteImportProfileMutation.error?.message ??
    null

  return (
    <section
      className={card}
      role="tabpanel"
      id="transactions-workspace-panel-profiles"
      aria-labelledby="transactions-workspace-tab-profiles"
    >
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t('importProfiles.eyebrow')}</p>
        <h4 className="mt-1 text-lg font-semibold text-zinc-100">{t('importProfiles.title')}</h4>
        <p className="mt-1 text-sm text-zinc-500">{t('importProfiles.description')}</p>
      </div>

      <TransactionImportProfileSelector
        importProfiles={importProfiles}
        selectedImportProfileId={selectedImportProfileId}
        selectedImportProfile={selectedImportProfile}
        pendingDeleteImportProfileId={pendingDeleteImportProfileId}
        deletePending={deleteImportProfileMutation.isPending}
        onSelectImportProfile={(id) => {
          setImportProfileFeedback(null)
          setPendingDeleteImportProfileId(null)
          setSelectedImportProfileId(id)
        }}
        onCreateNewImportProfile={handleCreateNewImportProfile}
        onDeleteImportProfile={handleDeleteImportProfile}
        onCancelDeleteImportProfile={() => setPendingDeleteImportProfileId(null)}
        onConfirmDeleteImportProfile={confirmDeleteImportProfile}
      />

      <TransactionImportProfileEditor
        importProfileForm={importProfileForm}
        sortedAccountOptions={sortedAccountOptions}
        localizedImportMappingFields={localizedImportMappingFields}
        importProfileTemplate={importProfileTemplate}
        importProfileFeedback={importProfileFeedback}
        importProfileErrorMessage={importProfileErrorMessage}
        selectedImportProfileId={selectedImportProfileId}
        savePending={createImportProfileMutation.isPending || updateImportProfileMutation.isPending}
        onSubmit={handleImportProfileSubmit}
        onUpdateImportProfileField={updateImportProfileField}
        onUpdateImportProfileMapping={updateImportProfileMapping}
        onUpdateImportProfileDefault={updateImportProfileDefault}
      />
    </section>
  )
}
