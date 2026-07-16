import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'

export type UiLanguage = 'pl' | 'en'

interface I18nValue {
  language: UiLanguage
  localeTag: string
}

const LOCALE_TAGS: Record<UiLanguage, string> = {
  pl: 'pl-PL',
  en: 'en-GB',
}

let activeLanguage: UiLanguage = detectUiLanguage()

const I18nContext = createContext<I18nValue>({
  language: activeLanguage,
  localeTag: LOCALE_TAGS[activeLanguage],
})

export function I18nProvider({
  children,
  localeOverride = null,
}: {
  children: ReactNode
  localeOverride?: string | null
}) {
  const value = useMemo<I18nValue>(() => {
    activeLanguage = detectUiLanguage(localeOverride)
    return {
      language: activeLanguage,
      localeTag: LOCALE_TAGS[activeLanguage],
    }
  }, [localeOverride])

  useEffect(() => {
    document.documentElement.lang = value.language
  }, [value.language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export function getActiveUiLanguage(): UiLanguage {
  return activeLanguage
}

export function getActiveLocaleTag() {
  return LOCALE_TAGS[activeLanguage]
}

function detectUiLanguage(localeOverride: string | null = null): UiLanguage {
  if (typeof navigator === 'undefined') {
    return 'en'
  }

  const candidates = localeOverride
    ? [localeOverride]
    : navigator.languages?.length ? navigator.languages : [navigator.language]
  return candidates.some((language) => language?.toLowerCase().startsWith('pl')) ? 'pl' : 'en'
}
