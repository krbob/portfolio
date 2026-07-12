import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const keyViews = [
  { name: 'dashboard', path: '/' },
  { name: 'portfolio accounts', path: '/portfolio/accounts' },
  { name: 'performance', path: '/performance' },
  { name: 'transactions', path: '/transactions' },
  { name: 'system diagnostics', path: '/system' },
]

function formatViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary,
    })),
  }))
}

test.describe('WCAG A/AA accessibility', () => {
  for (const view of keyViews) {
    test(`${view.name} has no automated WCAG A/AA violations`, async ({ page }) => {
      await page.goto(view.path)
      await expect(page.locator('main')).toBeVisible()
      await expect(page.getByText(/Loading|Ładowanie/)).toHaveCount(0, { timeout: 20_000 })

      const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze()

      expect(formatViolations(results.violations)).toEqual([])
    })
  }
})
