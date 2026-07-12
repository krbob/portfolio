import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppSwitcherLink } from './AppSwitcher'

afterEach(cleanup)

describe('AppSwitcherLink', () => {
  const preferences = { theme: 'dark' as const, locale: 'pl-PL' }

  it('renders a safe same-tab handoff with an accessible name', () => {
    const view = render(
      <AppSwitcherLink
        configuredUrl="https://stocks.example/app?tenant=personal"
        preferences={preferences}
        currentOrigin="https://portfolio.example"
      />,
    )

    const link = view.getByRole('link', { name: /stock analyst/i })
    expect(link).toHaveAttribute(
      'href',
      'https://stocks.example/app?tenant=personal&uiTheme=dark&uiLocale=pl-PL',
    )
    expect(link).not.toHaveAttribute('target')
    expect(link).toHaveTextContent('Stock Analyst')
  })

  it('retains the accessible label when the visible label is compacted', () => {
    const view = render(
      <AppSwitcherLink
        configuredUrl="/stocks"
        preferences={preferences}
        currentOrigin="https://portfolio.example"
        compact
      />,
    )

    expect(view.getByRole('link', { name: /stock analyst/i })).toHaveAttribute(
      'href',
      '/stocks?uiTheme=dark&uiLocale=pl-PL',
    )
    expect(view.getByText('Stock Analyst')).toHaveClass('sr-only')
  })

  it('does not render an unsafe runtime URL', () => {
    const { container } = render(
      <AppSwitcherLink
        configuredUrl="javascript:alert(1)"
        preferences={preferences}
        currentOrigin="https://portfolio.example"
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
