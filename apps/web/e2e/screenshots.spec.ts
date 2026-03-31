import { expect, test, type Page } from '@playwright/test'

test.use({
  locale: 'en-GB',
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
})

const SCREENSHOT_DIR = '../../docs/screenshots'
const API = '/api/v1'

let originalState: unknown

// ── helpers ──────────────────────────────────────────────────────────

function id() {
  return crypto.randomUUID()
}

function ts(date: string) {
  return `${date}T12:00:00.000Z`
}

async function apiPost(page: Page, path: string, body: unknown) {
  return page.evaluate(
    async ([url, payload]) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    },
    [API + path, body] as const,
  )
}

async function waitForContent(page: Page) {
  await expect(page.locator('text=Loading')).toHaveCount(0, { timeout: 20_000 })
  await page.waitForTimeout(500)
}

// ── demo data ────────────────────────────────────────────────────────

const ACC_IKE = id()
const ACC_IBKR = id()
const ACC_BONDS = id()

const INS_VWRA = id()
const INS_ISAC = id()
const INS_CSPX = id()
const INS_EIMI = id()
const INS_CDR = id()
const INS_KGH = id()
const INS_EDO1125 = id()
const INS_EDO0326 = id()
const INS_EDO0925 = id()
const INS_DTLA = id()

const accounts = [
  { id: ACC_IKE, name: 'IKE', institution: 'mBank', type: 'BROKERAGE', baseCurrency: 'PLN', displayOrder: 0, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: ACC_IBKR, name: 'Interactive Brokers', institution: 'Interactive Brokers', type: 'BROKERAGE', baseCurrency: 'USD', displayOrder: 1, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: ACC_BONDS, name: 'Obligacje Skarbowe', institution: 'PKO BP', type: 'BOND_REGISTER', baseCurrency: 'PLN', displayOrder: 2, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
]

const instruments = [
  { id: INS_VWRA, name: 'Vanguard FTSE All-World UCITS ETF', kind: 'ETF', assetClass: 'EQUITIES', symbol: 'VWRA.L', currency: 'USD', valuationSource: 'STOCK_ANALYST', edoTerms: null, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_ISAC, name: 'iShares MSCI ACWI UCITS ETF', kind: 'ETF', assetClass: 'EQUITIES', symbol: 'ISAC.L', currency: 'USD', valuationSource: 'STOCK_ANALYST', edoTerms: null, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_CSPX, name: 'iShares Core S&P 500 UCITS ETF', kind: 'ETF', assetClass: 'EQUITIES', symbol: 'CSPX.L', currency: 'USD', valuationSource: 'STOCK_ANALYST', edoTerms: null, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_EIMI, name: 'iShares Core MSCI EM IMI UCITS ETF', kind: 'ETF', assetClass: 'EQUITIES', symbol: 'EIMI.L', currency: 'USD', valuationSource: 'STOCK_ANALYST', edoTerms: null, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_CDR, name: 'CD Projekt', kind: 'STOCK', assetClass: 'EQUITIES', symbol: 'CDR.WA', currency: 'PLN', valuationSource: 'STOCK_ANALYST', edoTerms: null, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_KGH, name: 'KGHM Polska Miedź', kind: 'STOCK', assetClass: 'EQUITIES', symbol: 'KGH.WA', currency: 'PLN', valuationSource: 'STOCK_ANALYST', edoTerms: null, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_DTLA, name: 'SPDR Bloomberg 20+ Year US Treasury Bond ETF', kind: 'ETF', assetClass: 'BONDS', symbol: 'DTLA.L', currency: 'USD', valuationSource: 'STOCK_ANALYST', edoTerms: null, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_EDO1125, name: 'EDO1125', kind: 'BOND_EDO', assetClass: 'BONDS', symbol: null, currency: 'PLN', valuationSource: 'EDO_CALCULATOR', edoTerms: { seriesMonth: '2025-11', firstPeriodRateBps: 575, marginBps: 200 }, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_EDO0326, name: 'EDO0326', kind: 'BOND_EDO', assetClass: 'BONDS', symbol: null, currency: 'PLN', valuationSource: 'EDO_CALCULATOR', edoTerms: { seriesMonth: '2026-03', firstPeriodRateBps: 560, marginBps: 200 }, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: INS_EDO0925, name: 'EDO0925', kind: 'BOND_EDO', assetClass: 'BONDS', symbol: null, currency: 'PLN', valuationSource: 'EDO_CALCULATOR', edoTerms: { seriesMonth: '2025-09', firstPeriodRateBps: 585, marginBps: 200 }, isActive: true, createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
]

const targets = [
  { id: id(), assetClass: 'EQUITIES', targetWeight: '0.60', createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: id(), assetClass: 'BONDS', targetWeight: '0.35', createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
  { id: id(), assetClass: 'CASH', targetWeight: '0.05', createdAt: ts('2024-01-01'), updatedAt: ts('2024-01-01') },
]

function txn(overrides: Record<string, unknown>) {
  return {
    id: id(),
    accountId: '',
    instrumentId: null,
    type: 'DEPOSIT',
    tradeDate: '2024-01-01',
    settlementDate: null,
    quantity: null,
    unitPrice: null,
    grossAmount: '0',
    feeAmount: '0',
    taxAmount: '0',
    currency: 'PLN',
    fxRateToPln: null,
    notes: '',
    createdAt: ts('2024-01-01'),
    updatedAt: ts('2024-01-01'),
    ...overrides,
  }
}

const transactions = [
  // ── IKE deposits & buys ────────────────────────────────────────
  txn({ accountId: ACC_IKE, type: 'DEPOSIT', tradeDate: '2024-01-15', grossAmount: '30000', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, instrumentId: INS_CDR, type: 'BUY', tradeDate: '2024-01-16', quantity: '50', unitPrice: '128.50', grossAmount: '6425', feeAmount: '19.28', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, instrumentId: INS_KGH, type: 'BUY', tradeDate: '2024-01-16', quantity: '30', unitPrice: '142.80', grossAmount: '4284', feeAmount: '12.85', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, type: 'DEPOSIT', tradeDate: '2024-06-01', grossAmount: '20000', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, instrumentId: INS_CDR, type: 'BUY', tradeDate: '2024-06-03', quantity: '30', unitPrice: '145.00', grossAmount: '4350', feeAmount: '13.05', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, instrumentId: INS_KGH, type: 'SELL', tradeDate: '2024-09-15', quantity: '15', unitPrice: '158.20', grossAmount: '2373', feeAmount: '7.12', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, type: 'DEPOSIT', tradeDate: '2025-01-10', grossAmount: '25000', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, instrumentId: INS_CDR, type: 'BUY', tradeDate: '2025-01-13', quantity: '25', unitPrice: '195.00', grossAmount: '4875', feeAmount: '14.63', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, instrumentId: INS_KGH, type: 'BUY', tradeDate: '2025-02-10', quantity: '40', unitPrice: '165.50', grossAmount: '6620', feeAmount: '19.86', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, type: 'FEE', tradeDate: '2025-06-30', grossAmount: '49.90', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, type: 'DEPOSIT', tradeDate: '2025-07-01', grossAmount: '15000', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, instrumentId: INS_CDR, type: 'BUY', tradeDate: '2025-07-02', quantity: '20', unitPrice: '210.00', grossAmount: '4200', feeAmount: '12.60', currency: 'PLN' }),
  txn({ accountId: ACC_IKE, instrumentId: INS_KGH, type: 'BUY', tradeDate: '2025-12-15', quantity: '20', unitPrice: '178.00', grossAmount: '3560', feeAmount: '10.68', currency: 'PLN' }),

  // ── IBKR deposits & ETF buys ───────────────────────────────────
  txn({ accountId: ACC_IBKR, type: 'DEPOSIT', tradeDate: '2024-02-01', grossAmount: '50000', currency: 'PLN' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_VWRA, type: 'BUY', tradeDate: '2024-02-05', quantity: '30', unitPrice: '110.80', grossAmount: '3324', feeAmount: '1.60', currency: 'USD', fxRateToPln: '4.02' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_ISAC, type: 'BUY', tradeDate: '2024-02-05', quantity: '40', unitPrice: '72.50', grossAmount: '2900', feeAmount: '1.40', currency: 'USD', fxRateToPln: '4.02' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_CSPX, type: 'BUY', tradeDate: '2024-03-10', quantity: '8', unitPrice: '518.00', grossAmount: '4144', feeAmount: '2.00', currency: 'USD', fxRateToPln: '3.97' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_EIMI, type: 'BUY', tradeDate: '2024-03-10', quantity: '100', unitPrice: '29.30', grossAmount: '2930', feeAmount: '1.40', currency: 'USD', fxRateToPln: '3.97' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_DTLA, type: 'BUY', tradeDate: '2024-04-15', quantity: '200', unitPrice: '3.92', grossAmount: '784', feeAmount: '1.00', currency: 'USD', fxRateToPln: '4.05' }),
  txn({ accountId: ACC_IBKR, type: 'DEPOSIT', tradeDate: '2024-09-01', grossAmount: '40000', currency: 'PLN' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_VWRA, type: 'BUY', tradeDate: '2024-09-03', quantity: '25', unitPrice: '120.50', grossAmount: '3012.50', feeAmount: '1.50', currency: 'USD', fxRateToPln: '3.88' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_CSPX, type: 'BUY', tradeDate: '2024-09-03', quantity: '5', unitPrice: '565.00', grossAmount: '2825', feeAmount: '1.40', currency: 'USD', fxRateToPln: '3.88' }),
  txn({ accountId: ACC_IBKR, type: 'DEPOSIT', tradeDate: '2025-03-01', grossAmount: '35000', currency: 'PLN' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_VWRA, type: 'BUY', tradeDate: '2025-03-05', quantity: '20', unitPrice: '135.20', grossAmount: '2704', feeAmount: '1.30', currency: 'USD', fxRateToPln: '3.92' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_ISAC, type: 'BUY', tradeDate: '2025-03-05', quantity: '30', unitPrice: '84.00', grossAmount: '2520', feeAmount: '1.20', currency: 'USD', fxRateToPln: '3.92' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_EIMI, type: 'SELL', tradeDate: '2025-06-20', quantity: '50', unitPrice: '31.80', grossAmount: '1590', feeAmount: '1.00', currency: 'USD', fxRateToPln: '3.85' }),
  txn({ accountId: ACC_IBKR, type: 'DEPOSIT', tradeDate: '2025-09-01', grossAmount: '30000', currency: 'PLN' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_VWRA, type: 'BUY', tradeDate: '2025-09-03', quantity: '15', unitPrice: '148.60', grossAmount: '2229', feeAmount: '1.10', currency: 'USD', fxRateToPln: '3.80' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_DTLA, type: 'BUY', tradeDate: '2025-09-03', quantity: '300', unitPrice: '4.15', grossAmount: '1245', feeAmount: '1.00', currency: 'USD', fxRateToPln: '3.80' }),
  txn({ accountId: ACC_IBKR, type: 'INTEREST', tradeDate: '2025-12-31', grossAmount: '42.18', currency: 'USD', fxRateToPln: '4.10' }),
  txn({ accountId: ACC_IBKR, type: 'DEPOSIT', tradeDate: '2026-01-15', grossAmount: '25000', currency: 'PLN' }),
  txn({ accountId: ACC_IBKR, instrumentId: INS_CSPX, type: 'BUY', tradeDate: '2026-01-17', quantity: '4', unitPrice: '610.00', grossAmount: '2440', feeAmount: '1.20', currency: 'USD', fxRateToPln: '4.08' }),

  // ── Bond register deposits & EDO buys ──────────────────────────
  txn({ accountId: ACC_BONDS, type: 'DEPOSIT', tradeDate: '2024-05-01', grossAmount: '40000', currency: 'PLN' }),
  txn({ accountId: ACC_BONDS, instrumentId: INS_EDO0925, type: 'BUY', tradeDate: '2024-05-02', quantity: '100', unitPrice: '100', grossAmount: '10000', currency: 'PLN' }),
  txn({ accountId: ACC_BONDS, instrumentId: INS_EDO1125, type: 'BUY', tradeDate: '2024-05-02', quantity: '150', unitPrice: '100', grossAmount: '15000', currency: 'PLN' }),
  txn({ accountId: ACC_BONDS, type: 'DEPOSIT', tradeDate: '2025-03-10', grossAmount: '30000', currency: 'PLN' }),
  txn({ accountId: ACC_BONDS, instrumentId: INS_EDO0326, type: 'BUY', tradeDate: '2025-03-11', quantity: '200', unitPrice: '100', grossAmount: '20000', currency: 'PLN' }),
  txn({ accountId: ACC_BONDS, type: 'INTEREST', tradeDate: '2025-09-01', grossAmount: '287.50', currency: 'PLN' }),
  txn({ accountId: ACC_BONDS, instrumentId: INS_EDO0925, type: 'BUY', tradeDate: '2025-11-05', quantity: '50', unitPrice: '100', grossAmount: '5000', currency: 'PLN' }),
]

// ── test setup & teardown ────────────────────────────────────────

test.describe.serial('generate README screenshots', () => {

  test('seed demo data', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/')

    // Back up current state
    const exportRes = await apiPost(page, '/portfolio/state/export', {})
    originalState = exportRes.body

    // Import demo snapshot
    const snapshot = {
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      accounts,
      instruments,
      transactions,
      targets,
      importProfiles: [],
      appPreferences: [],
    }

    const importRes = await apiPost(page, '/portfolio/state/import', {
      mode: 'REPLACE',
      confirmation: 'REPLACE',
      snapshot,
    })
    if (importRes.status !== 200) {
      console.error('Import failed:', JSON.stringify(importRes.body, null, 2))
    }
    expect(importRes.status).toBe(200)

    // Trigger read model refresh and wait for it
    await apiPost(page, '/portfolio/read-model-refresh/run', {})
    await page.waitForTimeout(5_000)

    // Poll until refresh completes
    for (let i = 0; i < 20; i++) {
      const status = await page.evaluate(async (url) => {
        const res = await fetch(url)
        return res.json()
      }, API + '/portfolio/read-model-refresh')
      if ((status as { status: string }).status === 'IDLE') break
      await page.waitForTimeout(1_000)
    }
  })

  test('capture dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeVisible()
    await waitForContent(page)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard.png`, fullPage: false })
  })

  test('capture portfolio holdings', async ({ page }) => {
    await page.goto('/portfolio')
    await expect(page.getByRole('heading', { level: 2, name: 'Portfolio' })).toBeVisible()
    await waitForContent(page)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/portfolio-holdings.png`, fullPage: false })
  })

  test('capture performance charts', async ({ page }) => {
    await page.goto('/performance')
    await expect(page.getByRole('heading', { level: 2, name: 'Performance' })).toBeVisible()
    await waitForContent(page)
    // Nudge down so chart bottom aligns with viewport bottom
    await page.evaluate(() => document.querySelector('main')?.scrollBy(0, 120))
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/performance.png`, fullPage: false })
  })

  test('capture performance returns', async ({ page }) => {
    await page.goto('/performance')
    await expect(page.getByRole('heading', { level: 2, name: 'Performance' })).toBeVisible()
    await waitForContent(page)
    // Switch to Returns tab
    await page.getByRole('tab', { name: 'Returns' }).click()
    await page.waitForTimeout(600)
    // Scroll so the period selector is near the top
    await page.evaluate(() => {
      const tab = document.querySelector('[aria-selected="true"][role="tab"]')
      tab?.scrollIntoView({ block: 'start' })
      document.querySelector('main')?.scrollBy(0, -20)
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/performance-returns.png`, fullPage: false })
  })

  test('capture transactions', async ({ page }) => {
    await page.goto('/transactions')
    await expect(page.getByRole('heading', { level: 2, name: 'Transactions' })).toBeVisible()
    await waitForContent(page)
    // Scroll past summary and filters to show transaction rows (main is the scroll container)
    await page.evaluate(() => document.querySelector('main')?.scrollBy(0, 800))
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/transactions.png`, fullPage: false })
  })

  test('restore original data', async ({ page }) => {
    if (!originalState) return
    await page.goto('/')

    const res = await apiPost(page, '/portfolio/state/import', {
      mode: 'REPLACE',
      confirmation: 'REPLACE',
      snapshot: originalState,
    })
    expect(res.status).toBe(200)

    // Refresh read model with original data
    await apiPost(page, '/portfolio/read-model-refresh/run', {})
    await page.waitForTimeout(3_000)
  })
})
