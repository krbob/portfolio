import type { FormEvent } from 'react'
import type { Account } from '../../../api/write-model'
import { t } from '../../../lib/messages'
import { btnPrimary, input, label as labelClass } from '../../../lib/styles'
import {
  NEW_IMPORT_PROFILE_ID,
  type ImportMappingField,
  type ImportProfileFormState,
} from '../transactions-helpers'

interface TransactionImportProfileEditorProps {
  importProfileForm: ImportProfileFormState
  sortedAccountOptions: Account[]
  localizedImportMappingFields: Array<{ key: ImportMappingField; label: string; placeholder: string; required?: boolean }>
  importProfileTemplate: string
  importProfileFeedback: string | null
  importProfileErrorMessage: string | null
  selectedImportProfileId: string | null
  savePending: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onUpdateImportProfileField: (
    name: keyof Omit<ImportProfileFormState, 'headerMappings' | 'defaults'>,
    value: string | boolean,
  ) => void
  onUpdateImportProfileMapping: (name: ImportMappingField, value: string) => void
  onUpdateImportProfileDefault: (name: keyof ImportProfileFormState['defaults'], value: string) => void
}

export function TransactionImportProfileEditor({
  importProfileForm,
  sortedAccountOptions,
  localizedImportMappingFields,
  importProfileTemplate,
  importProfileFeedback,
  importProfileErrorMessage,
  selectedImportProfileId,
  savePending,
  onSubmit,
  onUpdateImportProfileField,
  onUpdateImportProfileMapping,
  onUpdateImportProfileDefault,
}: TransactionImportProfileEditorProps) {
  return (
    <form className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" onSubmit={onSubmit}>
      <label>
        <span className={labelClass}>{t('importProfiles.name')}</span>
        <input
          className={input}
          value={importProfileForm.name}
          onChange={(event) => onUpdateImportProfileField('name', event.target.value)}
          placeholder={t('importProfiles.namePlaceholder')}
          required
        />
      </label>

      <label>
        <span className={labelClass}>{t('importProfiles.descriptionField')}</span>
        <input
          className={input}
          value={importProfileForm.description}
          onChange={(event) => onUpdateImportProfileField('description', event.target.value)}
          placeholder={t('importProfiles.descriptionPlaceholder')}
        />
      </label>

      <label>
        <span className={labelClass}>{t('importProfiles.delimiter')}</span>
        <select
          className={input}
          value={importProfileForm.delimiter}
          onChange={(event) => onUpdateImportProfileField('delimiter', event.target.value)}
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
          onChange={(event) => onUpdateImportProfileField('dateFormat', event.target.value)}
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
          onChange={(event) => onUpdateImportProfileField('decimalSeparator', event.target.value)}
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
          onChange={(event) => onUpdateImportProfileDefault('accountId', event.target.value)}
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
          onChange={(event) => onUpdateImportProfileDefault('currency', event.target.value.toUpperCase())}
          placeholder="USD"
          maxLength={3}
        />
      </label>

      <label className="col-span-full flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 accent-blue-500"
          checked={importProfileForm.skipDuplicatesByDefault}
          onChange={(event) => onUpdateImportProfileField('skipDuplicatesByDefault', event.target.checked)}
        />
        <div>
          <span className={labelClass}>{t('importProfiles.skipDuplicatesByDefault')}</span>
          <p className="text-sm text-zinc-500">{t('importProfiles.skipDuplicatesHint')}</p>
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
                onChange={(event) => onUpdateImportProfileMapping(field.key, event.target.value)}
                placeholder={field.placeholder}
              />
              {field.required && <small className="text-xs text-zinc-600">{t('importProfiles.requiredByParser')}</small>}
            </label>
          ))}
        </div>
      </div>

      <div className="col-span-full">
        <div className="mb-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t('importProfiles.templateEyebrow')}</p>
          <p className="mt-1 text-sm text-zinc-500">{t('importProfiles.templateDescription')}</p>
        </div>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-800 p-3 font-mono text-xs text-zinc-400">
          {importProfileTemplate}
        </pre>
      </div>

      <div className="col-span-full flex items-center gap-3">
        <button
          className={btnPrimary}
          type="submit"
          disabled={importProfileForm.name.trim() === '' || savePending}
        >
          {savePending
            ? t('importProfiles.saving')
            : selectedImportProfileId === NEW_IMPORT_PROFILE_ID
              ? t('importProfiles.createProfile')
              : t('importProfiles.saveProfile')}
        </button>
      </div>

      {importProfileFeedback && <p className="col-span-full text-sm text-zinc-500">{importProfileFeedback}</p>}
      {importProfileErrorMessage && <p className="col-span-full text-sm text-red-400">{importProfileErrorMessage}</p>}
    </form>
  )
}
