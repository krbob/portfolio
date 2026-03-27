import { t } from './messages'

export function unavailableLabel(isPolish: boolean) {
  return isPolish ? 'Niedostępne' : 'Unavailable'
}

export function notApplicableLabel(isPolish: boolean) {
  return isPolish ? 'n/d' : 'n/a'
}

export function missingDataLabel(isPolish: boolean) {
  return isPolish ? 'b/d' : 'N/A'
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
