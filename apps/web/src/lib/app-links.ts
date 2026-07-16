import {
  readUiThemePreference,
  type UiThemePreference,
} from './ui-handoff'

export interface AppLinkPreferences {
  theme: UiThemePreference
  locale: string
}

export interface StockAnalystLinkOptions {
  symbol?: string | null
  preferences?: AppLinkPreferences
  currentOrigin?: string
}

export function appLinkPreferencesForLocale(locale: string): AppLinkPreferences {
  return {
    theme: readUiThemePreference() ?? 'system',
    locale: canonicalLocale(locale),
  }
}

export function currentAppLinkPreferences(): AppLinkPreferences {
  const activeLocale = document.documentElement.lang.trim() || navigator.language || 'en'
  return appLinkPreferencesForLocale(activeLocale)
}

/** Builds a navigation-only link; domain/auth/portfolio state is never forwarded. */
export function buildStockAnalystHref(
  configuredUrl: string | null | undefined,
  options: StockAnalystLinkOptions = {},
): string | null {
  const raw = configuredUrl?.trim()
  if (!raw || hasControlCharacter(raw)) return null

  const isRootRelative = raw.startsWith('/') && !raw.startsWith('//')
  const isHttpAbsolute = /^https?:\/\//i.test(raw)
  if (!isRootRelative && !isHttpAbsolute) return null

  try {
    const currentOrigin = options.currentOrigin ?? window.location.origin
    const target = new URL(raw, currentOrigin)
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null
    if (target.username || target.password) return null

    const preferences = options.preferences ?? currentAppLinkPreferences()
    target.searchParams.set('uiTheme', preferences.theme)
    target.searchParams.set('uiLocale', canonicalLocale(preferences.locale))
    const symbol = cleanSymbol(options.symbol)
    if (symbol) target.searchParams.set('s', symbol)

    if (isRootRelative && target.origin === currentOrigin) {
      return `${target.pathname}${target.search}${target.hash}`
    }
    return target.toString()
  } catch {
    return null
  }
}

function canonicalLocale(locale: string) {
  try {
    return Intl.getCanonicalLocales(locale.trim())[0] ?? 'en'
  } catch {
    return 'en'
  }
}

function cleanSymbol(symbol: string | null | undefined) {
  const normalized = symbol?.trim()
  return normalized ? normalized.slice(0, 40) : null
}

function hasControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}
