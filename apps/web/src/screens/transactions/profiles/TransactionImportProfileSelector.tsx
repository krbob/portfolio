import { DangerConfirmInline } from '../../../components/DangerConfirmInline'
import { formatMessage, t } from '../../../lib/messages'
import { btnDanger, btnSecondary, filterInput, label as labelClass } from '../../../lib/styles'
import type { TransactionImportProfile } from '../../../api/write-model'
import { NEW_IMPORT_PROFILE_ID } from '../transactions-helpers'

interface TransactionImportProfileSelectorProps {
  importProfiles: TransactionImportProfile[]
  selectedImportProfileId: string | null
  selectedImportProfile: TransactionImportProfile | null
  pendingDeleteImportProfileId: string | null
  deletePending: boolean
  onSelectImportProfile: (id: string) => void
  onCreateNewImportProfile: () => void
  onDeleteImportProfile: () => void
  onCancelDeleteImportProfile: () => void
  onConfirmDeleteImportProfile: () => void
}

export function TransactionImportProfileSelector({
  importProfiles,
  selectedImportProfileId,
  selectedImportProfile,
  pendingDeleteImportProfileId,
  deletePending,
  onSelectImportProfile,
  onCreateNewImportProfile,
  onDeleteImportProfile,
  onCancelDeleteImportProfile,
  onConfirmDeleteImportProfile,
}: TransactionImportProfileSelectorProps) {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <label>
          <span className={labelClass}>{t('importProfiles.savedProfile')}</span>
          <select
            className={filterInput}
            value={selectedImportProfileId ?? ''}
            onChange={(event) => onSelectImportProfile(event.target.value)}
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
          <button type="button" className={btnSecondary} onClick={onCreateNewImportProfile}>
            {t('importProfiles.newProfile')}
          </button>
          <button
            type="button"
            className={btnDanger}
            onClick={onDeleteImportProfile}
            disabled={selectedImportProfile == null || deletePending}
          >
            {deletePending ? t('importProfiles.deleting') : t('importProfiles.deleteProfile')}
          </button>
        </div>
      </div>

      {selectedImportProfile && pendingDeleteImportProfileId === selectedImportProfile.id && (
        <DangerConfirmInline
          title={formatMessage(t('importProfiles.deleteConfirmTitle'), { name: selectedImportProfile.name })}
          description={t('importProfiles.deleteConfirmDescription')}
          confirmLabel={t('importProfiles.deleteProfile')}
          confirmPendingLabel={t('importProfiles.deleting')}
          isPending={deletePending}
          onCancel={onCancelDeleteImportProfile}
          onConfirm={onConfirmDeleteImportProfile}
        />
      )}
    </>
  )
}
