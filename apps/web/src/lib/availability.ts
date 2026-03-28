import { tFor } from './messages'
import type { UiLanguage } from './i18n'
import { t } from './messages'

export function unavailableLabel(isPolish: boolean) {
  return tFor('common.unavailable', toLanguage(isPolish))
}

export function notApplicableLabel(isPolish: boolean) {
  return tFor('common.na', toLanguage(isPolish))
}

export function missingDataLabel(isPolish: boolean) {
  return tFor('common.missingData', toLanguage(isPolish))
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

function toLanguage(isPolish: boolean): UiLanguage {
  return isPolish ? 'pl' : 'en'
}
