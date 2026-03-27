import { useState, type FormEvent } from 'react'
import { Card, SectionHeader } from './ui'
import { useAccounts, useCreateAccount } from '../hooks/use-write-model'
import { t } from '../lib/messages'
import { labelAccountType } from '../lib/labels'
import { label as labelClass, input, btnPrimary, badge, badgeVariants } from '../lib/styles'

const initialForm = {
  name: '',
  institution: '',
  type: 'BROKERAGE',
  baseCurrency: 'PLN',
}

export function AccountsSection() {
  const accountsQuery = useAccounts()
  const createAccountMutation = useCreateAccount()
  const [form, setForm] = useState(initialForm)
  const sortedAccounts = [...(accountsQuery.data ?? [])].sort(compareAccountsByDisplayOrder)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createAccountMutation.mutate(form, {
      onSuccess: () => setForm(initialForm),
    })
  }

  return (
    <Card>
      <SectionHeader
        eyebrow={t('accounts.eyebrow')}
        title={t('accounts.title')}
        description={t('accounts.description')}
      />

      <form className="grid grid-cols-2 gap-3" onSubmit={handleSubmit}>
        <div>
          <span className={labelClass}>{t('accounts.name')}</span>
          <input
            className={input}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Interactive Brokers"
            required
          />
        </div>

        <div>
          <span className={labelClass}>{t('accounts.institution')}</span>
          <input
            className={input}
            value={form.institution}
            onChange={(event) =>
              setForm((current) => ({ ...current, institution: event.target.value }))
            }
            placeholder="Interactive Brokers"
            required
          />
        </div>

        <div>
          <span className={labelClass}>{t('accounts.type')}</span>
          <select
            className={input}
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
          >
            <option value="BROKERAGE">{labelAccountType('BROKERAGE')}</option>
            <option value="BOND_REGISTER">{labelAccountType('BOND_REGISTER')}</option>
            <option value="CASH">{labelAccountType('CASH')}</option>
          </select>
        </div>

        <div>
          <span className={labelClass}>{t('accounts.baseCurrency')}</span>
          <input
            className={input}
            value={form.baseCurrency}
            onChange={(event) =>
              setForm((current) => ({ ...current, baseCurrency: event.target.value.toUpperCase() }))
            }
            maxLength={3}
            required
          />
        </div>

        <div className="col-span-full flex items-center gap-3 mt-2">
          <button className={btnPrimary} type="submit" disabled={createAccountMutation.isPending}>
            {createAccountMutation.isPending ? t('common.saving') : t('accounts.addAccount')}
          </button>
          {createAccountMutation.error && <p className="text-sm text-red-400">{createAccountMutation.error.message}</p>}
        </div>
      </form>

      <div className="space-y-3 mt-4">
        {accountsQuery.isLoading && <p className="text-sm text-zinc-500">{t('accounts.loading')}</p>}
        {accountsQuery.isError && <p className="text-sm text-red-400">{accountsQuery.error.message}</p>}
        {sortedAccounts.length === 0 && !accountsQuery.isLoading && <p className="text-sm text-zinc-500">{t('accounts.empty')}</p>}
        {sortedAccounts.map((account) => (
          <article className="rounded-lg border border-zinc-800/50 p-4 flex items-center justify-between" key={account.id}>
            <div>
              <strong className="text-sm text-zinc-100">{account.name}</strong>
              <p className="text-sm text-zinc-500">
                {account.institution} · {labelAccountType(account.type)}
              </p>
            </div>
            <span className={`${badge} ${badgeVariants.default}`}>{account.baseCurrency}</span>
          </article>
        ))}
      </div>
    </Card>
  )
}

function compareAccountsByDisplayOrder(
  left: { displayOrder?: number; createdAt: string; name: string },
  right: { displayOrder?: number; createdAt: string; name: string },
) {
  const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt)
  }

  return left.name.localeCompare(right.name)
}
