import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PortfolioAllocationSummary, PortfolioContributionPlan } from '../../api/read-model'
import { I18nProvider } from '../../lib/i18n'
import { usePortfolioContributionPlan } from '../../hooks/use-read-model'
import { DashboardTargetDriftCard } from './DashboardSections'

vi.mock('../../hooks/use-read-model', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/use-read-model')>('../../hooks/use-read-model')
  return {
    ...actual,
    usePortfolioContributionPlan: vi.fn(),
  }
})

function setLanguage(language: 'pl' | 'en') {
  const locale = language === 'pl' ? 'pl-PL' : 'en-GB'
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: locale,
  })
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: [locale],
  })
}

function contributionPlanQueryStub(
  amountPln: string | null,
  { equitiesTargetWeightPct }: { equitiesTargetWeightPct?: string | null } = {},
) {
  const simulated = equitiesTargetWeightPct != null
  return {
    data: amountPln
      ? ({
          amountPln: '120000.00',
          targetMix: {
            equitiesTargetWeightPct: simulated ? equitiesTargetWeightPct : '80.00',
            bondsTargetWeightPct: simulated ? '25.00' : '20.00',
            cashTargetWeightPct: '0.00',
            overridden: simulated,
          },
          projected: {
            asOf: '2026-03-13',
            valuationState: 'MARK_TO_MARKET',
            configured: true,
            toleranceBandPctPoints: '2.00',
            rebalancingMode: 'CONTRIBUTIONS_ONLY',
            targetWeightSumPct: '100.00',
            totalCurrentValuePln: '447135.00',
            availableCashPln: '4.48',
            breachedBucketCount: 0,
            largestBandBreachPctPoints: null,
            recommendedAction: 'WITHIN_TOLERANCE',
            recommendedAssetClass: null,
            recommendedContributionPln: '0.00',
            remainingContributionGapPln: '0.00',
            fullRebalanceBuyAmountPln: '0.00',
            fullRebalanceSellAmountPln: '0.00',
            requiresSelling: false,
            buckets: [],
          },
          minimalContributionToTolerancePln: simulated ? '60000.00' : '7800.00',
          scenarios: [
            {
              amountPln: '60000.00',
              withinTolerance: true,
              breachedBucketCount: 0,
              remainingContributionGapPln: '0.00',
              projectedAction: 'WITHIN_TOLERANCE',
              buckets: [
                {
                  assetClass: 'EQUITIES',
                  plannedContributionPln: simulated ? '45000.00' : '46800.00',
                  projectedWeightPct: simulated ? '75.00' : '80.00',
                  projectedDriftPctPoints: '0.00',
                  projectedStatus: 'ON_TARGET',
                },
                {
                  assetClass: 'BONDS',
                  plannedContributionPln: simulated ? '15000.00' : '13200.00',
                  projectedWeightPct: simulated ? '25.00' : '20.00',
                  projectedDriftPctPoints: '0.00',
                  projectedStatus: 'ON_TARGET',
                },
              ],
            },
            {
              amountPln: '120000.00',
              withinTolerance: true,
              breachedBucketCount: 0,
              remainingContributionGapPln: '0.00',
              projectedAction: 'WITHIN_TOLERANCE',
              buckets: [
                {
                  assetClass: 'EQUITIES',
                  plannedContributionPln: simulated ? '90000.00' : '92246.02',
                  projectedWeightPct: simulated ? '75.00' : '80.17',
                  projectedDriftPctPoints: simulated ? '0.00' : '0.17',
                  projectedStatus: 'ON_TARGET',
                },
                {
                  assetClass: 'BONDS',
                  plannedContributionPln: simulated ? '30000.00' : '27753.98',
                  projectedWeightPct: simulated ? '25.00' : '19.83',
                  projectedDriftPctPoints: simulated ? '0.00' : '-0.17',
                  projectedStatus: 'ON_TARGET',
                },
              ],
            },
          ],
          buckets: [
            {
              assetClass: 'EQUITIES',
              plannedContributionPln: simulated ? '90000.00' : '92246.02',
              projectedValuePln: '438642.44',
              projectedWeightPct: simulated ? '75.00' : '80.17',
              projectedDriftPctPoints: simulated ? '0.00' : '0.17',
              projectedGapValuePln: '-934.01',
              projectedStatus: 'ON_TARGET',
            },
            {
              assetClass: 'BONDS',
              plannedContributionPln: simulated ? '30000.00' : '27753.98',
              projectedValuePln: '108488.62',
              projectedWeightPct: simulated ? '25.00' : '19.83',
              projectedDriftPctPoints: simulated ? '0.00' : '-0.17',
              projectedGapValuePln: '938.49',
              projectedStatus: 'ON_TARGET',
            },
            {
              assetClass: 'CASH',
              plannedContributionPln: '0.00',
              projectedValuePln: '4.48',
              projectedWeightPct: '0.00',
              projectedDriftPctPoints: null,
              projectedGapValuePln: null,
              projectedStatus: 'UNCONFIGURED',
            },
          ],
        } satisfies PortfolioContributionPlan)
      : undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as const
}

const allocation = {
  asOf: '2026-03-13',
  valuationState: 'MARK_TO_MARKET',
  configured: true,
  toleranceBandPctPoints: '2.00',
  rebalancingMode: 'CONTRIBUTIONS_ONLY',
  targetWeightSumPct: '100.00',
  totalCurrentValuePln: '427135.54',
  availableCashPln: '4.48',
  breachedBucketCount: 0,
  largestBandBreachPctPoints: null,
  recommendedAction: 'WITHIN_TOLERANCE',
  recommendedAssetClass: null,
  recommendedContributionPln: '0.00',
  remainingContributionGapPln: '0.00',
  fullRebalanceBuyAmountPln: '0.00',
  fullRebalanceSellAmountPln: '0.00',
  requiresSelling: false,
  buckets: [
    {
      assetClass: 'EQUITIES',
      currentValuePln: '346396.42',
      currentWeightPct: '81.10',
      targetWeightPct: '80.00',
      targetValuePln: '341708.43',
      driftPctPoints: '1.10',
      gapValuePln: '-4687.99',
      toleranceLowerPct: '78.00',
      toleranceUpperPct: '82.00',
      withinTolerance: true,
      suggestedContributionPln: '0.00',
      rebalanceAction: 'HOLD',
      status: 'ON_TARGET',
    },
    {
      assetClass: 'BONDS',
      currentValuePln: '80734.64',
      currentWeightPct: '18.90',
      targetWeightPct: '20.00',
      targetValuePln: '85427.11',
      driftPctPoints: '-1.10',
      gapValuePln: '4692.47',
      toleranceLowerPct: '18.00',
      toleranceUpperPct: '22.00',
      withinTolerance: true,
      suggestedContributionPln: '0.00',
      rebalanceAction: 'HOLD',
      status: 'ON_TARGET',
    },
    {
      assetClass: 'CASH',
      currentValuePln: '4.48',
      currentWeightPct: '0.00',
      targetWeightPct: null,
      targetValuePln: null,
      driftPctPoints: null,
      gapValuePln: null,
      toleranceLowerPct: null,
      toleranceUpperPct: null,
      withinTolerance: false,
      suggestedContributionPln: '0.00',
      rebalanceAction: 'UNCONFIGURED',
      status: 'UNCONFIGURED',
    },
  ],
} satisfies PortfolioAllocationSummary

describe('DashboardTargetDriftCard', () => {
  it('opens the contribution planner modal, shows scenarios and simulates another target mix', async () => {
    setLanguage('en')
    vi.mocked(usePortfolioContributionPlan).mockImplementation((amountPln, _revision, options) => (
      contributionPlanQueryStub(amountPln, options)
    ) as unknown as ReturnType<typeof usePortfolioContributionPlan>)

    render(
      <MemoryRouter>
        <I18nProvider>
          <DashboardTargetDriftCard
            isPolish={false}
            allocation={allocation}
            isLoading={false}
            isError={false}
            onRetry={vi.fn()}
          />
        </I18nProvider>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Plan contribution' }))
    expect(await screen.findByRole('dialog', { name: 'Contribution planner' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Contribution amount'), {
      target: { value: '120000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Calculate contribution plan' }))

    expect((await screen.findAllByText('Post-contribution value')).length).toBeGreaterThan(0)
    expect(screen.getByText('Minimum to return within band')).toBeInTheDocument()
    expect(screen.getByText('Scenario comparison')).toBeInTheDocument()
    expect(screen.queryByText('UNCONFIGURED')).not.toBeInTheDocument()
    expect(screen.queryByText('Cash')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Equities %'), {
      target: { value: '75' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simulate another target' }))

    expect(await screen.findByText('Simulated target')).toBeInTheDocument()
    expect(screen.getByText('75% / 25%')).toBeInTheDocument()
  })
})
