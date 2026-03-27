import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DangerConfirmInline } from '../../components/DangerConfirmInline'
import { useI18n } from '../../lib/i18n'
import { t } from '../../lib/messages'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  filterInput,
  input,
  label as labelClass,
} from '../../lib/styles'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type {
  Account,
  SaveTransactionImportProfilePayload,
  TransactionImportProfile,
  UpdateTransactionImportProfilePayload,
} from '../../api/write-model'
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

  const sortedAccountOptions = useMemo(
    () => [...accounts].sort(compareAccountsByDisplayOrder),
    [accounts],
  )
  const localizedImportMappingFields = useMemo(
    () => getImportMappingFields(isPolish),
    [isPolish],
  )
  const importProfilePayload = useMemo(
    () => buildImportProfilePayload(importProfileForm),
    [importProfileForm],
  )
  const selectedImportProfilePayload = useMemo(
    () =>
      selectedImportProfile
        ? buildImportProfilePayload(importProfileToForm(selectedImportProfile))
        : null,
    [selectedImportProfile],
  )
  const importProfileDirty = useMemo(() => {
    if (selectedImportProfileId === NEW_IMPORT_PROFILE_ID) {
      return serializeImportProfilePayload(importProfilePayload) !== serializeImportProfilePayload(buildImportProfilePayload(createInitialImportProfileForm()))
    }
    if (selectedImportProfilePayload == null) {
      return false
    }
    return serializeImportProfilePayload(importProfilePayload) !== serializeImportProfilePayload(selectedImportProfilePayload)
  }, [importProfilePayload, selectedImportProfileId, selectedImportProfilePayload])
  const importProfileTemplate = useMemo(
    () => buildImportProfileTemplate(importProfileForm),
    [importProfileForm],
  )

  // Report dirty state and template back to orchestrator
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
      const nextForm = createInitialImportProfileForm()
      setImportProfileForm(nextForm)
      // skip-duplicates default is now managed by the import tab itself
      return
    }
    if (selectedImportProfile) {
      const nextForm = importProfileToForm(selectedImportProfile)
      setImportProfileForm(nextForm)
      // skip-duplicates default is now managed by the import tab itself
    }
  }, [selectedImportProfileSyncKey])

  function updateImportProfileField(name: keyof Omit<ImportProfileFormState, 'headerMappings' | 'defaults'>, value: string | boolean) {
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
              isPolish
                ? `Zaktualizowano profil importu "${profile.name}".`
                : `Updated import profile "${profile.name}".`,
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
          isPolish
            ? `Utworzono profil importu "${profile.name}".`
            : `Created import profile "${profile.name}".`,
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
          isPolish
            ? `Usunięto profil importu "${selectedImportProfile.name}".`
            : `Deleted import profile "${selectedImportProfile.name}".`,
        )
        setSelectedImportProfileId(nextProfileId)
      },
    })
  }

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
        <p className="mt-1 text-sm text-zinc-500">
          {t('importProfiles.description')}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label>
          <span className={labelClass}>{t('importProfiles.savedProfile')}</span>
          <select
            className={filterInput}
            value={selectedImportProfileId ?? ''}
            onChange={(event) => {
              setImportProfileFeedback(null)
              setPendingDeleteImportProfileId(null)
              setSelectedImportProfileId(event.target.value)
            }}
          >
            {selectedImportProfileId === null && <option value="">{t('importProfiles.loadingProfiles')}</option>}
            {importProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
            <option value={NEW_IMPORT_PROFILE_ID}>{t('importProfiles.newProfile')}</option>
          </select>
        </label>

        <div className="flex items-center gap-3">
          <button type="button" className={btnSecondary} onClick={handleCreateNewImportProfile}>
            {t('importProfiles.newProfile')}
          </button>
          <button
            type="button"
            className={btnDanger}
            onClick={handleDeleteImportProfile}
            disabled={selectedImportProfile == null || deleteImportProfileMutation.isPending}
          >
            {deleteImportProfileMutation.isPending
              ? t('importProfiles.deleting')
              : t('importProfiles.deleteProfile')}
          </button>
        </div>
      </div>

      {selectedImportProfile && pendingDeleteImportProfileId === selectedImportProfile.id && (
        <DangerConfirmInline
          title={isPolish ? `Usunąć profil "${selectedImportProfile.name}"?` : `Delete profile "${selectedImportProfile.name}"?`}
          description={t('importProfiles.deleteConfirmDescription')}
          confirmLabel={t('importProfiles.deleteProfile')}
          confirmPendingLabel={t('importProfiles.deleting')}
          isPending={deleteImportProfileMutation.isPending}
          onCancel={() => setPendingDeleteImportProfileId(null)}
          onConfirm={confirmDeleteImportProfile}
        />
      )}

      <form className="grid grid-cols-2 gap-3 mt-4 lg:grid-cols-4" onSubmit={handleImportProfileSubmit}>
        <label>
          <span className={labelClass}>{t('importProfiles.name')}</span>
          <input
            className={input}
            value={importProfileForm.name}
            onChange={(event) => updateImportProfileField('name', event.target.value)}
            placeholder={t('importProfiles.namePlaceholder')}
            required
          />
        </label>

        <label>
          <span className={labelClass}>{t('importProfiles.descriptionField')}</span>
          <input
            className={input}
            value={importProfileForm.description}
            onChange={(event) => updateImportProfileField('description', event.target.value)}
            placeholder={t('importProfiles.descriptionPlaceholder')}
          />
        </label>

        <label>
          <span className={labelClass}>{t('importProfiles.delimiter')}</span>
          <select
            className={input}
            value={importProfileForm.delimiter}
            onChange={(event) => updateImportProfileField('delimiter', event.target.value)}
          >
            <option value="COMMA">{t('importProfiles.comma')}</option>
            <option value="SEMICOLON">{t('importProfiles.semicolon')}</option>
            <option value="TAB">{t('importProfiles.tab')}</option>
          </select>
        </label>

        <label>
          <span className={labelClass}>{t('importProfiles.dateFormat')}</span>
          <select
            className={input}
            value={importProfileForm.dateFormat}
            onChange={(event) => updateImportProfileField('dateFormat', event.target.value)}
          >
            <option value="ISO_LOCAL_DATE">YYYY-MM-DD</option>
            <option value="DMY_DOTS">DD.MM.YYYY</option>
            <option value="DMY_SLASH">DD/MM/YYYY</option>
            <option value="MDY_SLASH">MM/DD/YYYY</option>
          </select>
        </label>

        <label>
          <span className={labelClass}>{t('importProfiles.decimalSeparator')}</span>
          <select
            className={input}
            value={importProfileForm.decimalSeparator}
            onChange={(event) => updateImportProfileField('decimalSeparator', event.target.value)}
          >
            <option value="DOT">{t('importProfiles.dot')}</option>
            <option value="COMMA">{t('importProfiles.comma')}</option>
          </select>
        </label>

        <label>
          <span className={labelClass}>{t('importProfiles.defaultAccount')}</span>
          <select
            className={input}
            value={importProfileForm.defaults.accountId}
            onChange={(event) => updateImportProfileDefault('accountId', event.target.value)}
          >
            <option value="">{t('importProfiles.csvProvidesAccount')}</option>
            {sortedAccountOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={labelClass}>{t('importProfiles.defaultCurrency')}</span>
          <input
            className={input}
            value={importProfileForm.defaults.currency}
            onChange={(event) => updateImportProfileDefault('currency', event.target.value.toUpperCase())}
            placeholder="USD"
            maxLength={3}
          />
        </label>

        <label className="flex items-start gap-3 col-span-full">
          <input
            type="checkbox"
            className="accent-blue-500 mt-1"
            checked={importProfileForm.skipDuplicatesByDefault}
            onChange={(event) => updateImportProfileField('skipDuplicatesByDefault', event.target.checked)}
          />
          <div>
            <span className={labelClass}>{t('importProfiles.skipDuplicatesByDefault')}</span>
            <p className="text-sm text-zinc-500">
              {t('importProfiles.skipDuplicatesHint')}
            </p>
          </div>
        </label>

        <div className="col-span-full">
          <div className="mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t('importProfiles.headerMappingsEyebrow')}</p>
            <h5 className="mt-1 text-sm font-semibold text-zinc-100">{t('importProfiles.headerMappingsTitle')}</h5>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {localizedImportMappingFields.map((field) => (
              <label key={field.key}>
                <span className={labelClass}>{field.label}</span>
                <input
                  className={input}
                  value={importProfileForm.headerMappings[field.key]}
                  onChange={(event) => updateImportProfileMapping(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
                {field.required && (
                  <small className="text-xs text-zinc-600">
                    {t('importProfiles.requiredByParser')}
                  </small>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="col-span-full">
          <div className="mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t('importProfiles.templateEyebrow')}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {t('importProfiles.templateDescription')}
            </p>
          </div>
          <pre className="mt-2 rounded-lg bg-zinc-800 p-3 text-xs text-zinc-400 font-mono overflow-x-auto">{importProfileTemplate}</pre>
        </div>

        <div className="col-span-full flex items-center gap-3">
          <button
            className={btnPrimary}
            type="submit"
            disabled={
              importProfileForm.name.trim() === '' ||
              createImportProfileMutation.isPending ||
              updateImportProfileMutation.isPending
            }
          >
            {createImportProfileMutation.isPending || updateImportProfileMutation.isPending
              ? t('importProfiles.saving')
              : selectedImportProfileId === NEW_IMPORT_PROFILE_ID
                ? t('importProfiles.createProfile')
                : t('importProfiles.saveProfile')}
          </button>
        </div>

        {importProfileFeedback && <p className="col-span-full text-sm text-zinc-500">{importProfileFeedback}</p>}
        {(transactionImportProfilesQuery.error ||
          createImportProfileMutation.error ||
          updateImportProfileMutation.error ||
          deleteImportProfileMutation.error) && (
          <p className="col-span-full text-sm text-red-400">
            {transactionImportProfilesQuery.error?.message ??
              createImportProfileMutation.error?.message ??
              updateImportProfileMutation.error?.message ??
              deleteImportProfileMutation.error?.message}
          </p>
        )}
      </form>
    </section>
  )
}
