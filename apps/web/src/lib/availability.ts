import { getActiveUiLanguage } from './i18n'

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
  return unavailableLabel(getActiveUiLanguage() === 'pl')
}

export function activeNotApplicableLabel() {
  return notApplicableLabel(getActiveUiLanguage() === 'pl')
}

export function activeMissingDataLabel() {
  return missingDataLabel(getActiveUiLanguage() === 'pl')
}
