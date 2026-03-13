import { useState, type FormEvent } from 'react'
import { SectionCard } from './SectionCard'
import { useAccounts, useCreateAccount } from '../hooks/use-write-model'

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
    <SectionCard
      eyebrow="Write model"
      title="Accounts"
      description="Capture where assets are held before layering portfolio analytics on top."
    >
      <div className="section-body">
        <form className="entity-form" onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Interactive Brokers"
              required
            />
          </label>

          <label>
            <span>Institution</span>
            <input
              value={form.institution}
              onChange={(event) =>
                setForm((current) => ({ ...current, institution: event.target.value }))
              }
              placeholder="Interactive Brokers"
              required
            />
          </label>

          <label>
            <span>Type</span>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="BROKERAGE">BROKERAGE</option>
              <option value="BOND_REGISTER">BOND_REGISTER</option>
              <option value="CASH">CASH</option>
            </select>
          </label>

          <label>
            <span>Base currency</span>
            <input
              value={form.baseCurrency}
              onChange={(event) =>
                setForm((current) => ({ ...current, baseCurrency: event.target.value.toUpperCase() }))
              }
              maxLength={3}
              required
            />
          </label>

          <button type="submit" disabled={createAccountMutation.isPending}>
            {createAccountMutation.isPending ? 'Saving...' : 'Add account'}
          </button>
          {createAccountMutation.error && <p className="form-error">{createAccountMutation.error.message}</p>}
        </form>

        <div className="entity-list">
          {accountsQuery.isLoading && <p className="muted-copy">Loading accounts...</p>}
          {accountsQuery.isError && <p className="form-error">{accountsQuery.error.message}</p>}
          {accountsQuery.data?.length === 0 && <p className="muted-copy">No accounts yet.</p>}
          {accountsQuery.data?.map((account) => (
            <article className="list-item" key={account.id}>
              <div>
                <strong>{account.name}</strong>
                <p>
                  {account.institution} · {account.type}
                </p>
              </div>
              <span className="list-badge">{account.baseCurrency}</span>
            </article>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
