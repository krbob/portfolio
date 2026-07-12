import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStorageMock } from '../test/app-smoke-fixtures'
import {
  buildStockAnalystHref,
  currentAppLinkPreferences,
} from './app-links'

describe('Stock Analyst app links', () => {
  const preferences = { theme: 'dark' as const, locale: 'pl-pl' }

  beforeEach(() => {
    const storage = createStorageMock()
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  })

  afterEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = 'en'
  })

  it('preserves configured path query and hash while adding portable UI preferences', () => {
    expect(buildStockAnalystHref(
      'https://stocks.example/app?tenant=personal#chart',
      { preferences, currentOrigin: 'https://portfolio.example' },
    )).toBe('https://stocks.example/app?tenant=personal&uiTheme=dark&uiLocale=pl-PL#chart')
  })

  it('supports a same-origin root-relative deployment and an explicit symbol', () => {
    expect(buildStockAnalystHref('/stocks', {
      symbol: 'VWRA.L',
      preferences: { theme: 'system', locale: 'en-GB' },
      currentOrigin: 'https://apps.example',
    })).toBe('/stocks?uiTheme=system&uiLocale=en-GB&s=VWRA.L')
  })

  it.each([
    undefined,
    '',
    'stocks.example',
    '//stocks.example',
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://user:secret@stocks.example',
    'https://stocks.example/\nmalformed',
  ])('rejects unsafe or ambiguous runtime URL %s', (url) => {
    expect(buildStockAnalystHref(url, { preferences, currentOrigin: 'https://portfolio.example' })).toBeNull()
  })

  it('replaces untrusted handoff and symbol parameters already present in configuration', () => {
    expect(buildStockAnalystHref(
      'https://stocks.example/?uiTheme=evil&uiLocale=evil&s=EVIL',
      { symbol: 'PLN=X', preferences, currentOrigin: 'https://portfolio.example' },
    )).toBe('https://stocks.example/?uiTheme=dark&uiLocale=pl-PL&s=PLN%3DX')
  })

  it('maps persisted UI preferences to the active Portfolio locale', () => {
    window.localStorage.setItem('portfolio:ui-theme', 'light')
    window.localStorage.setItem('portfolio:ui-locale', 'pl-pl')
    document.documentElement.lang = 'en'

    expect(currentAppLinkPreferences()).toEqual({ theme: 'light', locale: 'pl-PL' })
  })
})
