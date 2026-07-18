import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import type {
  Account,
  PortfolioWithdrawalAccountPlan,
  PortfolioWithdrawalAccountRule,
  PortfolioWithdrawalPlan,
  PortfolioWithdrawalPlanBucket,
  WithdrawalTaxWrapper,
} from '../api/write-model'
import {
  useAccounts,
  usePortfolioWithdrawalSettings,
  usePreviewPortfolioWithdrawalPlan,
  useSavePortfolioWithdrawalSettings,
} from '../hooks/use-write-model'
import { formatCurrencyPln, formatDate, formatPercent } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAccountType, labelAssetClass } from '../lib/labels'
import { labelPortfolioValuationState } from '../lib/portfolio-presentation'
import { formatMessage, t, type MessageKey } from '../lib/messages'
import { btnGhost, btnPrimary, input, label as labelClass } from '../lib/styles'
import { Badge, Card, SectionHeader, SegmentedControl, StatePanel } from './ui'

type WithdrawalInputMode = 'amount' | 'percentage'
type AccountRuleDraft = PortfolioWithdrawalAccountRule

const TAX_WRAPPERS: WithdrawalTaxWrapper[] = ['STANDARD', 'OKI', 'IKE', 'IKZE', 'NONE', 'CUSTOM']

const WRAPPER_MESSAGE_KEYS: Record<WithdrawalTaxWrapper, MessageKey> = {
  STANDARD: 'withdrawals.wrapperStandard',
  OKI: 'withdrawals.wrapperOki',
  IKE: 'withdrawals.wrapperIke',
  IKZE: 'withdrawals.wrapperIkze',
  NONE: 'withdrawals.wrapperNone',
  CUSTOM: 'withdrawals.wrapperCustom',
}

const WARNING_MESSAGE_KEYS: Partial<Record<string, MessageKey>> = {
  TARGET_ALLOCATION_NOT_CONFIGURED: 'withdrawals.warningTargetMissing',
  NO_ENABLED_WITHDRAWAL_ACCOUNTS: 'withdrawals.warningNoEnabledAccounts',
  STALE_VALUATIONS: 'withdrawals.warningStaleValuations',
  UNVALUED_HOLDINGS_ESTIMATED_AT_BOOK_VALUE: 'withdrawals.warningBookValueEstimate',
  INCOMPLETE_VALUATION: 'withdrawals.warningIncompleteValuation',
  NEGATIVE_CASH_BALANCE: 'withdrawals.warningNegativeCash',
  INSUFFICIENT_LIQUIDITY: 'withdrawals.warningInsufficientLiquidity',
}

export function PortfolioWithdrawalPlannerSection() {
  const [settingsState, setSettingsState] = useState({ dirty: false, revision: 0 })

  function handleSettingsDirtyChange(dirty: boolean) {
    setSettingsState((current) => {
      if (current.dirty === dirty) {
        return current
      }
      return {
        dirty,
        revision: dirty ? current.revision + 1 : current.revision,
      }
    })
  }

  return (
    <div className="space-y-5">
      <WithdrawalPlanCard
        settingsDirty={settingsState.dirty}
        settingsRevision={settingsState.revision}
      />
      <WithdrawalSettingsCard onDirtyChange={handleSettingsDirtyChange} />
    </div>
  )
}

function WithdrawalPlanCard({
  settingsDirty,
  settingsRevision,
}: {
  settingsDirty: boolean
  settingsRevision: number
}) {
  const { language } = useI18n()
  const amountInputId = useId()
  const percentageInputId = useId()
  const [mode, setMode] = useState<WithdrawalInputMode>('amount')
  const [amountInput, setAmountInput] = useState('')
  const [percentageInput, setPercentageInput] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [resultSettingsRevision, setResultSettingsRevision] = useState<number | null>(null)
  const planMutation = usePreviewPortfolioWithdrawalPlan()
  const resetPlanMutation = planMutation.reset

  useEffect(() => {
    setActionError(null)
    setResultSettingsRevision(null)
    resetPlanMutation()
  }, [resetPlanMutation, settingsRevision])

  function resetResult() {
    setActionError(null)
    setResultSettingsRevision(null)
    resetPlanMutation()
  }

  function handleModeChange(value: WithdrawalInputMode) {
    setMode(value)
    resetResult()
  }

  function handleInputChange(value: string) {
    const normalized = normalizeDecimalInput(value)
    if (mode === 'amount') {
      setAmountInput(normalized)
    } else {
      setPercentageInput(normalized)
    }
    resetResult()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError(null)

    if (settingsDirty) {
      setActionError(t('withdrawals.settingsMustBeSaved'))
      return
    }

    if (mode === 'amount') {
      if (!validPositiveDecimal(amountInput)) {
        setActionError(t('withdrawals.invalidAmount'))
        return
      }
      setResultSettingsRevision(settingsRevision)
      planMutation.mutate({ amountPln: formatDecimalPayload(amountInput) })
      return
    }

    if (!validPercentage(percentageInput)) {
      setActionError(t('withdrawals.invalidPercentage'))
      return
    }
    setResultSettingsRevision(settingsRevision)
    planMutation.mutate({ portfolioPercentagePct: formatDecimalPayload(percentageInput) })
  }

  const modeOptions: Array<{ value: WithdrawalInputMode; label: string }> = [
    { value: 'amount', label: t('withdrawals.modeAmount') },
    { value: 'percentage', label: t('withdrawals.modePercentage') },
  ]
  const activeValue = mode === 'amount' ? amountInput : percentageInput
  const activeInputId = mode === 'amount' ? amountInputId : percentageInputId

  return (
    <Card as="section" id="withdrawals">
      <SectionHeader
        eyebrow={t('withdrawals.eyebrow')}
        title={t('withdrawals.title')}
        description={t('withdrawals.description')}
      />

      <div className="mb-5 rounded-ui-field border border-ui-action/25 bg-ui-action/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{t('withdrawals.readOnlyBadge')}</Badge>
          <p className="text-sm text-ui-text-secondary">{t('withdrawals.readOnlyDescription')}</p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(220px,300px)_auto] lg:items-end">
          <div>
            <span className={labelClass}>{t('withdrawals.modeLabel')}</span>
            <SegmentedControl
              value={mode}
              onChange={handleModeChange}
              options={modeOptions}
              ariaLabel={t('withdrawals.modeLabel')}
            />
          </div>

          <div>
            <label htmlFor={activeInputId} className={labelClass}>
              {mode === 'amount' ? t('withdrawals.amountLabel') : t('withdrawals.percentageLabel')}
            </label>
            <span className="relative block">
              <input
                id={activeInputId}
                className={`${input} pr-14`}
                inputMode="decimal"
                value={activeValue}
                onChange={(event) => handleInputChange(event.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ui-text-muted">
                {mode === 'amount' ? 'zł' : '%'}
              </span>
            </span>
          </div>

          <button
            type="submit"
            className={`${btnPrimary} lg:mb-px`}
            disabled={planMutation.isPending || settingsDirty}
          >
            {planMutation.isPending ? t('withdrawals.calculating') : t('withdrawals.calculate')}
          </button>
        </div>

        {actionError ? <p role="alert" className="text-sm text-ui-danger">{actionError}</p> : null}
        {planMutation.isError ? (
          <p role="alert" className="text-sm text-ui-danger">
            {planMutation.error instanceof Error ? planMutation.error.message : t('withdrawals.planFailed')}
          </p>
        ) : null}
      </form>

      <div className="mt-6">
        {settingsDirty ? (
          <StatePanel
            eyebrow={t('withdrawals.settingsEyebrow')}
            title={t('withdrawals.settingsChangedTitle')}
            description={t('withdrawals.settingsChangedDescription')}
            className="border-ui-highlight/25 bg-ui-highlight/5 py-8"
          />
        ) : planMutation.isPending ? (
          <p className="py-6 text-sm text-ui-text-muted">{t('withdrawals.calculating')}</p>
        ) : planMutation.data && resultSettingsRevision === settingsRevision ? (
          <WithdrawalPlanResult plan={planMutation.data} language={language} />
        ) : (
          <StatePanel
            eyebrow={t('withdrawals.readOnlyBadge')}
            title={t('withdrawals.emptyTitle')}
            description={t('withdrawals.emptyDescription')}
            className="border-0 bg-transparent px-0 py-8"
          />
        )}
      </div>
    </Card>
  )
}

function WithdrawalPlanResult({
  plan,
  language,
}: {
  plan: PortfolioWithdrawalPlan
  language: 'pl' | 'en'
}) {
  return (
    <div className="space-y-5" aria-live="polite">
      <section className="rounded-ui-card border border-ui-border bg-ui-surface p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-sm font-semibold text-ui-text">{t('withdrawals.summaryTitle')}</h4>
          <Badge variant={plan.feasible ? 'success' : 'warning'}>
            {plan.feasible ? t('withdrawals.feasible') : t('withdrawals.incomplete')}
          </Badge>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label={t('withdrawals.requested')} value={formatCurrencyPln(plan.requestedWithdrawalPln)} />
          <SummaryMetric label={t('withdrawals.planned')} value={formatCurrencyPln(plan.plannedWithdrawalPln)} />
          <SummaryMetric
            label={t('withdrawals.shortfall')}
            value={formatCurrencyPln(plan.shortfallPln)}
            tone={Number(plan.shortfallPln) > 0 ? 'warning' : 'default'}
          />
          <SummaryMetric label={t('withdrawals.projectedPortfolio')} value={formatCurrencyPln(plan.projectedTotalValuePln)} />
          <SummaryMetric label={t('withdrawals.cashUsed')} value={formatCurrencyPln(plan.cashUsedPln)} />
          <SummaryMetric label={t('withdrawals.grossSales')} value={formatCurrencyPln(plan.grossSalesPln)} />
          <SummaryMetric label={t('withdrawals.taxBuffer')} value={formatCurrencyPln(plan.estimatedTaxBufferPln)} />
          <SummaryMetric
            label={t('withdrawals.asOf')}
            value={`${formatDate(plan.asOf)} · ${labelPortfolioValuationState(plan.valuationState, language)}`}
          />
        </dl>
      </section>

      {plan.warnings.length > 0 ? (
        <section className="rounded-ui-field border border-ui-highlight/30 bg-ui-highlight/5 p-4">
          <h4 className="text-sm font-semibold text-ui-highlight">{t('withdrawals.warningsTitle')}</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ui-text-secondary">
            {plan.warnings.map((warning) => <li key={warning}>{labelWithdrawalWarning(warning)}</li>)}
          </ul>
        </section>
      ) : null}

      <section>
        <h4 className="text-sm font-semibold text-ui-text">{t('withdrawals.accountPlanTitle')}</h4>
        <p className="mt-1 text-sm text-ui-text-muted">{t('withdrawals.accountPlanDescription')}</p>
        <div className="mt-3 space-y-3">
          {plan.accountPlans.map((accountPlan, index) => (
            <AccountPlanCard key={accountPlan.accountId} plan={accountPlan} index={index} />
          ))}
        </div>
      </section>

      {plan.buckets.length > 0 ? <AllocationImpactTable buckets={plan.buckets} /> : null}
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'warning'
}) {
  return (
    <div className="rounded-ui-field border border-ui-border/70 bg-ui-surface-raised p-3">
      <dt className="text-xs text-ui-text-muted">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold tabular-nums ${tone === 'warning' ? 'text-ui-highlight' : 'text-ui-text'}`}>
        {value}
      </dd>
    </div>
  )
}

function AccountPlanCard({ plan, index }: { plan: PortfolioWithdrawalAccountPlan; index: number }) {
  return (
    <article className="rounded-ui-field border border-ui-border/70 bg-ui-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{formatMessage(t('withdrawals.accountStep'), { number: index + 1 })}</Badge>
            <strong className="text-sm text-ui-text">{plan.accountName}</strong>
            <Badge variant="info">{labelTaxWrapper(plan.taxWrapper)}</Badge>
          </div>
          <p className="mt-2 text-xs text-ui-text-muted">
            {t('withdrawals.taxBufferLabel')}: {formatPercent(plan.taxBufferRatePct, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <strong className="text-base text-ui-text tabular-nums">
          {t('withdrawals.fromAccount')}: {formatCurrencyPln(plan.withdrawalPln)}
        </strong>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <CompactMetric label={t('withdrawals.currentValue')} value={formatCurrencyPln(plan.currentValuePln)} />
        <CompactMetric label={t('withdrawals.projectedValue')} value={formatCurrencyPln(plan.projectedValuePln)} />
        <CompactMetric label={t('withdrawals.cashUsed')} value={formatCurrencyPln(plan.cashUsedPln)} />
        <CompactMetric label={t('withdrawals.grossSales')} value={formatCurrencyPln(plan.grossSalesPln)} />
        <CompactMetric label={t('withdrawals.taxBuffer')} value={formatCurrencyPln(plan.estimatedTaxBufferPln)} />
        <CompactMetric label={t('withdrawals.fromAccount')} value={formatCurrencyPln(plan.withdrawalPln)} />
      </dl>

      <div className="mt-4 border-t border-ui-border/70 pt-3">
        <span className="text-xs font-medium uppercase tracking-wider text-ui-text-muted">{t('withdrawals.salesTitle')}</span>
        {plan.sales.every((sale) => Number(sale.amountPln) <= 0) ? (
          <p className="mt-1 text-sm text-ui-text-muted">{t('withdrawals.noSales')}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {plan.sales.filter((sale) => Number(sale.amountPln) > 0).map((sale) => (
              <li key={`${sale.assetClass}-${sale.amountPln}`}>
                <Badge variant={assetClassBadgeVariant(sale.assetClass)}>
                  {labelAssetClass(sale.assetClass)} · {formatCurrencyPln(sale.amountPln)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ui-text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ui-text tabular-nums">{value}</dd>
    </div>
  )
}

function AllocationImpactTable({ buckets }: { buckets: PortfolioWithdrawalPlanBucket[] }) {
  return (
    <section>
      <h4 className="text-sm font-semibold text-ui-text">{t('withdrawals.allocationTitle')}</h4>
      <p className="mt-1 text-sm text-ui-text-muted">{t('withdrawals.allocationDescription')}</p>
      <div className="mt-3 overflow-x-auto rounded-ui-field border border-ui-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-ui-surface">
            <tr className="border-b border-ui-border text-xs uppercase tracking-wider text-ui-text-muted">
              <th className="px-4 py-3 font-medium">{t('withdrawals.assetClass')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('withdrawals.currentValue')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('withdrawals.plannedSale')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('withdrawals.projectedValue')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('withdrawals.projectedWeight')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('withdrawals.targetWeight')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('withdrawals.projectedDrift')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ui-border/70">
            {buckets.map((bucket) => (
              <tr key={bucket.assetClass}>
                <th scope="row" className="px-4 py-3 font-medium text-ui-text">{labelAssetClass(bucket.assetClass)}</th>
                <td className="px-4 py-3 text-right tabular-nums text-ui-text-secondary">{formatCurrencyPln(bucket.currentValuePln)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ui-text-secondary">{formatCurrencyPln(bucket.plannedSalePln)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ui-text">{formatCurrencyPln(bucket.projectedValuePln)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ui-text">
                  {bucket.projectedWeightPct == null ? '—' : formatPercent(bucket.projectedWeightPct)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ui-text-secondary">
                  {bucket.targetWeightPct == null ? '—' : formatPercent(bucket.targetWeightPct)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ui-text-secondary">
                  {bucket.projectedDriftPctPoints == null
                    ? '—'
                    : formatPercent(bucket.projectedDriftPctPoints, { signed: true, suffix: ' pp' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function WithdrawalSettingsCard({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const settingsQuery = usePortfolioWithdrawalSettings()
  const accountsQuery = useAccounts()
  const saveMutation = useSavePortfolioWithdrawalSettings()
  const [rules, setRules] = useState<AccountRuleDraft[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])

  useEffect(() => {
    if (!settingsQuery.data || !accountsQuery.data || isDirty) {
      return
    }
    setRules(mergeRulesWithAccounts(settingsQuery.data.accountRules, accountsQuery.data))
  }, [accountsQuery.data, isDirty, settingsQuery.data])

  function updateRules(updater: (current: AccountRuleDraft[]) => AccountRuleDraft[]) {
    setFeedback(null)
    setActionError(null)
    setIsDirty(true)
    onDirtyChange(true)
    setRules(updater)
  }

  function moveRule(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= rules.length) {
      return
    }
    updateRules((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(destination, 0, moved)
      return next
    })
  }

  function updateRule(accountId: string, update: Partial<AccountRuleDraft>) {
    updateRules((current) => current.map((rule) => (
      rule.accountId === accountId ? { ...rule, ...update } : rule
    )))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setActionError(null)

    if (rules.some((rule) => !validTaxBuffer(rule.taxBufferRatePct))) {
      setActionError(t('withdrawals.bufferInvalid'))
      return
    }

    try {
      const result = await saveMutation.mutateAsync({
        accountRules: rules.map((rule) => ({
          ...rule,
          taxBufferRatePct: formatDecimalPayload(rule.taxBufferRatePct),
        })),
      })
      setRules(mergeRulesWithAccounts(result.accountRules, accounts))
      setIsDirty(false)
      onDirtyChange(false)
      setFeedback(t('withdrawals.settingsSaved'))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('withdrawals.settingsSaveFailed'))
    }
  }

  const isLoading = settingsQuery.isLoading || accountsQuery.isLoading
  const loadError = settingsQuery.error ?? accountsQuery.error

  return (
    <Card as="section">
      <SectionHeader
        eyebrow={t('withdrawals.settingsEyebrow')}
        title={t('withdrawals.settingsTitle')}
        description={t('withdrawals.settingsDescription')}
        actions={(
          <button
            type="submit"
            form="portfolio-withdrawal-settings-form"
            className={btnPrimary}
            disabled={saveMutation.isPending || isLoading || rules.length === 0 || !isDirty}
          >
            {saveMutation.isPending ? t('common.saving') : t('withdrawals.saveSettings')}
          </button>
        )}
      />

      <div className="grid gap-3 text-sm lg:grid-cols-2">
        <p className="rounded-ui-field border border-ui-border bg-ui-surface p-3 text-ui-text-muted">
          {t('withdrawals.wrapperHint')}
        </p>
        <p className="rounded-ui-field border border-ui-border bg-ui-surface p-3 text-ui-text-muted">
          {t('withdrawals.bufferHint')}
        </p>
      </div>

      {isLoading ? <p className="mt-5 text-sm text-ui-text-muted">{t('withdrawals.settingsLoading')}</p> : null}
      {loadError ? (
        <p role="alert" className="mt-5 text-sm text-ui-danger">
          {loadError instanceof Error ? loadError.message : t('withdrawals.settingsLoadFailed')}
        </p>
      ) : null}

      {!isLoading && !loadError && rules.length === 0 ? (
        <StatePanel
          eyebrow={t('withdrawals.settingsEyebrow')}
          title={t('withdrawals.noAccounts')}
          description={t('withdrawals.settingsDescription')}
          className="mt-5 py-8"
        />
      ) : null}

      {!isLoading && !loadError && rules.length > 0 ? (
        <form id="portfolio-withdrawal-settings-form" className="mt-5 space-y-3" onSubmit={handleSubmit}>
          {rules.map((rule, index) => {
            const account = accountsById.get(rule.accountId)
            if (!account) {
              return null
            }
            return (
              <AccountRuleRow
                key={rule.accountId}
                account={account}
                rule={rule}
                index={index}
                count={rules.length}
                onMove={moveRule}
                onChange={updateRule}
              />
            )
          })}

          {feedback ? <p className="text-sm text-ui-positive">{feedback}</p> : null}
          {actionError ? <p role="alert" className="text-sm text-ui-danger">{actionError}</p> : null}
        </form>
      ) : null}
    </Card>
  )
}

function AccountRuleRow({
  account,
  rule,
  index,
  count,
  onMove,
  onChange,
}: {
  account: Account
  rule: AccountRuleDraft
  index: number
  count: number
  onMove: (index: number, direction: -1 | 1) => void
  onChange: (accountId: string, update: Partial<AccountRuleDraft>) => void
}) {
  const wrapperInputId = useId()
  const bufferInputId = useId()

  return (
    <article className={`rounded-ui-field border p-4 ${rule.enabled ? 'border-ui-border bg-ui-surface' : 'border-ui-border/60 bg-ui-surface/50'}`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_auto_minmax(190px,240px)_minmax(150px,190px)] xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{index + 1}</Badge>
            <strong className="text-sm text-ui-text">{account.name}</strong>
            {!account.isActive ? (
              <Badge variant="default">{t('withdrawals.accountInactive')}</Badge>
            ) : !rule.enabled ? (
              <Badge variant="default">{t('withdrawals.accountDisabled')}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ui-text-muted">
            {account.institution} · {labelAccountType(account.type)} · {account.baseCurrency}
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-ui-text-secondary">
            <input
              type="checkbox"
              checked={rule.enabled}
              disabled={!account.isActive}
              onChange={(event) => onChange(rule.accountId, { enabled: event.target.checked })}
              className="h-4 w-4 rounded border-ui-border-strong bg-ui-surface accent-ui-action"
            />
            {t('withdrawals.accountEnabled')}
          </label>
        </div>

        <div className="flex gap-1 xl:pb-px">
          <button
            type="button"
            className={`${btnGhost} min-w-10 border border-ui-border`}
            disabled={index === 0}
            aria-label={formatMessage(t('withdrawals.moveUp'), { account: account.name })}
            title={formatMessage(t('withdrawals.moveUp'), { account: account.name })}
            onClick={() => onMove(index, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className={`${btnGhost} min-w-10 border border-ui-border`}
            disabled={index === count - 1}
            aria-label={formatMessage(t('withdrawals.moveDown'), { account: account.name })}
            title={formatMessage(t('withdrawals.moveDown'), { account: account.name })}
            onClick={() => onMove(index, 1)}
          >
            ↓
          </button>
        </div>

        <div>
          <label htmlFor={wrapperInputId} className={labelClass}>{t('withdrawals.taxWrapperLabel')}</label>
          <select
            id={wrapperInputId}
            className={input}
            value={rule.taxWrapper}
            onChange={(event) => onChange(rule.accountId, { taxWrapper: event.target.value as WithdrawalTaxWrapper })}
          >
            {TAX_WRAPPERS.map((wrapper) => (
              <option key={wrapper} value={wrapper}>{labelTaxWrapper(wrapper)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={bufferInputId} className={labelClass}>{t('withdrawals.taxBufferLabel')}</label>
          <span className="relative block">
            <input
              id={bufferInputId}
              className={`${input} pr-10`}
              inputMode="decimal"
              value={rule.taxBufferRatePct}
              onChange={(event) => onChange(rule.accountId, { taxBufferRatePct: normalizeDecimalInput(event.target.value) })}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ui-text-muted">%</span>
          </span>
        </div>
      </div>
    </article>
  )
}

function mergeRulesWithAccounts(
  savedRules: PortfolioWithdrawalAccountRule[],
  accounts: Account[],
): AccountRuleDraft[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const savedAccountIds = new Set<string>()
  const knownSavedRules = savedRules.flatMap((rule) => {
    const account = accountsById.get(rule.accountId)
    if (!account || savedAccountIds.has(rule.accountId)) {
      return []
    }
    savedAccountIds.add(rule.accountId)
    return [{
      ...rule,
      enabled: account.isActive && rule.enabled,
    }]
  })

  const newAccountRules = accounts
    .filter((account) => !savedAccountIds.has(account.id))
    .map((account) => ({
      accountId: account.id,
      enabled: account.isActive,
      taxWrapper: defaultTaxWrapper(account),
      taxBufferRatePct: '0.00',
    }))

  return [...knownSavedRules, ...newAccountRules]
}

function defaultTaxWrapper(account: Account): WithdrawalTaxWrapper {
  return account.type === 'BROKERAGE' ? 'STANDARD' : 'NONE'
}

function labelTaxWrapper(wrapper: WithdrawalTaxWrapper) {
  return t(WRAPPER_MESSAGE_KEYS[wrapper])
}

function labelWithdrawalWarning(warning: string) {
  const messageKey = WARNING_MESSAGE_KEYS[warning]
  return messageKey ? t(messageKey) : warning.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

function assetClassBadgeVariant(assetClass: string): 'equity' | 'bond' | 'cash' | 'default' {
  if (assetClass === 'EQUITIES') return 'equity'
  if (assetClass === 'BONDS') return 'bond'
  if (assetClass === 'CASH') return 'cash'
  return 'default'
}

const DECIMAL_LITERAL_PATTERN = /^\d+(?:\.\d{1,2})?$/

function normalizeDecimalInput(value: string) {
  return value.replaceAll(',', '.')
}

function validTaxBuffer(value: string) {
  return DECIMAL_LITERAL_PATTERN.test(value) && compareDecimalLiterals(value, '100') < 0
}

function validPositiveDecimal(value: string) {
  return DECIMAL_LITERAL_PATTERN.test(value) && compareDecimalLiterals(value, '0') > 0
}

function validPercentage(value: string) {
  return validPositiveDecimal(value) && compareDecimalLiterals(value, '100') <= 0
}

function formatDecimalPayload(value: string) {
  const [whole, fraction = ''] = value.split('.')
  return `${normalizeWholeDigits(whole)}.${fraction.padEnd(2, '0')}`
}

function compareDecimalLiterals(left: string, right: string) {
  const [leftWhole, leftFraction = ''] = left.split('.')
  const [rightWhole, rightFraction = ''] = right.split('.')
  const normalizedLeftWhole = normalizeWholeDigits(leftWhole)
  const normalizedRightWhole = normalizeWholeDigits(rightWhole)

  if (normalizedLeftWhole.length !== normalizedRightWhole.length) {
    return normalizedLeftWhole.length > normalizedRightWhole.length ? 1 : -1
  }
  if (normalizedLeftWhole !== normalizedRightWhole) {
    return normalizedLeftWhole > normalizedRightWhole ? 1 : -1
  }

  const normalizedLeftFraction = leftFraction.padEnd(2, '0')
  const normalizedRightFraction = rightFraction.padEnd(2, '0')
  if (normalizedLeftFraction === normalizedRightFraction) {
    return 0
  }
  return normalizedLeftFraction > normalizedRightFraction ? 1 : -1
}

function normalizeWholeDigits(value: string) {
  return value.replace(/^0+(?=\d)/, '')
}
