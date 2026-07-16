export type UiThemePreference = 'system' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'portfolio:ui-theme'
const LEGACY_LOCALE_STORAGE_KEY = 'portfolio:ui-locale'
const UI_THEME_VALUES = new Set<UiThemePreference>(['system', 'light', 'dark'])

export interface UiHandoffPreferences {
  theme: UiThemePreference | null
  locale: string | null
}

/** Consumes the non-sensitive UI handoff contract and removes it from the address bar. */
export function initializeUiHandoff(): UiHandoffPreferences {
  const url = new URL(window.location.href)
  const hasThemeParameter = url.searchParams.has('uiTheme')
  const hasLocaleParameter = url.searchParams.has('uiLocale')
  const queryTheme = parseUiTheme(url.searchParams.get('uiTheme'))
  const queryLocale = parseUiLocale(url.searchParams.get('uiLocale'))

  if (queryTheme) writePreference(THEME_STORAGE_KEY, queryTheme)
  removePreference(LEGACY_LOCALE_STORAGE_KEY)

  const theme = queryTheme ?? parseUiTheme(readPreference(THEME_STORAGE_KEY))
  const locale = queryLocale

  if (theme) document.documentElement.dataset.uiTheme = theme
  if (locale) document.documentElement.dataset.uiLocale = locale
  else delete document.documentElement.dataset.uiLocale

  if (hasThemeParameter || hasLocaleParameter) {
    url.searchParams.delete('uiTheme')
    url.searchParams.delete('uiLocale')
    const cleanUrl = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, '', cleanUrl)
  }

  return { theme, locale }
}

export function readUiThemePreference(): UiThemePreference | null {
  return parseUiTheme(readPreference(THEME_STORAGE_KEY))
}

function parseUiTheme(value: string | null): UiThemePreference | null {
  return value && UI_THEME_VALUES.has(value as UiThemePreference)
    ? value as UiThemePreference
    : null
}

function parseUiLocale(value: string | null): string | null {
  if (!value || value.length > 35 || !/^[A-Za-z0-9-]+$/.test(value)) return null
  try {
    return Intl.getCanonicalLocales(value)[0] ?? null
  } catch {
    return null
  }
}

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // The handoff remains valid for this page even when storage is unavailable.
  }
}

function removePreference(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // A blocked storage API must not prevent the transient handoff.
  }
}
