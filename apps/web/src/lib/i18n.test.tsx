import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStorageMock } from '../test/app-smoke-fixtures'
import { I18nProvider, useI18n } from './i18n'
import { initializeUiHandoff } from './ui-handoff'

function LanguageProbe() {
  const { language, localeTag } = useI18n()
  return <output>{`${language}:${localeTag}`}</output>
}

describe('UI language resolution', () => {
  beforeEach(() => {
    const storage = createStorageMock()
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
    window.history.replaceState(null, '', '/')
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'pl-PL',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['pl-PL'],
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('uses the Polish browser locale after removing a legacy saved English handoff', () => {
    window.localStorage.setItem('portfolio:ui-locale', 'en-GB')
    const handoff = initializeUiHandoff()

    render(
      <I18nProvider localeOverride={handoff.locale}>
        <LanguageProbe />
      </I18nProvider>,
    )

    expect(window.localStorage.getItem('portfolio:ui-locale')).toBeNull()
    expect(screen.getByText('pl:pl-PL')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('pl')
  })

  it('applies an inbound locale only to the current page lifetime', () => {
    window.history.replaceState(null, '', '/?uiLocale=en-gb')
    const handoff = initializeUiHandoff()

    render(
      <I18nProvider localeOverride={handoff.locale}>
        <LanguageProbe />
      </I18nProvider>,
    )

    expect(screen.getByText('en:en-GB')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem('portfolio:ui-locale')).toBeNull()
    expect(window.location.search).toBe('')
  })
})
