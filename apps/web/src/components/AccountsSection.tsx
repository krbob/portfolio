import { useState, type FormEvent } from 'react'
import { Card, SectionHeader } from './ui'
import { useAccounts, useCreateAccount } from '../hooks/use-write-model'
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createAccountMutation.mutate(form, {
      onSuccess: () => setForm(initialForm),
    })
  }

  return (
    <Card>
      <SectionHeader
        eyebrow="Write model"
        title="Accounts"
        description="Capture where assets are held before layering portfolio analytics on top."
      />

      <form className="grid grid-cols-2 gap-3" onSubmit={handleSubmit}>
        <div>
          <span className={labelClass}>Name</span>
          <input
            className={input}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Interactive Brokers"
            required
          />
        </div>

        <div>
          <span className={labelClass}>Institution</span>
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
          <span className={labelClass}>Type</span>
          <select
            className={input}
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
          >
            <option value="BROKERAGE">BROKERAGE</option>
            <option value="BOND_REGISTER">BOND_REGISTER</option>
            <option value="CASH">CASH</option>
          </select>
        </div>

        <div>
          <span className={labelClass}>Base currency</span>
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
            {createAccountMutation.isPending ? 'Saving...' : 'Add account'}
          </button>
          {createAccountMutation.error && <p className="text-sm text-red-400">{createAccountMutation.error.message}</p>}
        </div>
      </form>

      <div className="space-y-3 mt-4">
        {accountsQuery.isLoading && <p className="text-sm text-zinc-500">Loading accounts...</p>}
        {accountsQuery.isError && <p className="text-sm text-red-400">{accountsQuery.error.message}</p>}
        {accountsQuery.data?.length === 0 && <p className="text-sm text-zinc-500">No accounts yet.</p>}
        {accountsQuery.data?.map((account) => (
          <article className="rounded-lg border border-zinc-800/50 p-4 flex items-center justify-between" key={account.id}>
            <div>
              <strong className="text-sm text-zinc-100">{account.name}</strong>
              <p className="text-sm text-zinc-500">
                {account.institution} · {account.type}
              </p>
            </div>
            <span className={`${badge} ${badgeVariants.default}`}>{account.baseCurrency}</span>
          </article>
        ))}
      </div>
    </Card>
  )
}
