import type { UiLanguage } from './i18n'
import { t, tFor } from './messages'

export function unavailableLabel(language: UiLanguage) {
  return tFor('common.unavailable', language)
}

export function notApplicableLabel(language: UiLanguage) {
  return tFor('common.na', language)
}

export function missingDataLabel(language: UiLanguage) {
  return tFor('common.missingData', language)
}

export function activeUnavailableLabel() {
  return t('common.unavailable')
}

export function activeNotApplicableLabel() {
  return t('common.na')
}

export function activeMissingDataLabel() {
  return t('common.missingData')
}
