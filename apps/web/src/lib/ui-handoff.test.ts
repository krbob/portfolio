import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStorageMock } from '../test/app-smoke-fixtures'
import { initializeUiHandoff } from './ui-handoff'

describe('UI handoff', () => {
  beforeEach(() => {
    const storage = createStorageMock()
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
    window.history.replaceState(null, '', '/')
    delete document.documentElement.dataset.uiTheme
    delete document.documentElement.dataset.uiLocale
  })

  afterEach(() => window.localStorage.clear())

  it('accepts only neutral theme and canonical BCP47 locale parameters', () => {
    window.history.replaceState(null, '', '/performance?range=1Y&uiTheme=dark&uiLocale=pl-pl#returns')

    expect(initializeUiHandoff()).toEqual({ theme: 'dark', locale: 'pl-PL' })
    expect(window.localStorage.getItem('portfolio:ui-theme')).toBe('dark')
    expect(window.localStorage.getItem('portfolio:ui-locale')).toBe('pl-PL')
    expect(document.documentElement.dataset.uiTheme).toBe('dark')
    expect(document.documentElement.dataset.uiLocale).toBe('pl-PL')
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/performance?range=1Y#returns')
  })

  it('discards invalid handoff values without overwriting saved preferences', () => {
    window.localStorage.setItem('portfolio:ui-theme', 'system')
    window.localStorage.setItem('portfolio:ui-locale', 'en-GB')
    window.history.replaceState(null, '', '/?uiTheme=sepia&uiLocale=../../secret')

    expect(initializeUiHandoff()).toEqual({ theme: 'system', locale: 'en-GB' })
    expect(window.localStorage.getItem('portfolio:ui-theme')).toBe('system')
    expect(window.localStorage.getItem('portfolio:ui-locale')).toBe('en-GB')
    expect(window.location.search).toBe('')
  })
})
