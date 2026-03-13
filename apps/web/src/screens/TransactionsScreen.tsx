import { PageIntro } from '../components/PageIntro'
import { TransactionsSection } from '../components/TransactionsSection'

export function TransactionsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Write model"
        title="Transactions"
        description="Maintain the canonical event stream for the portfolio. Imports, edits and deletes flow from here into valuation, history, returns and backups."
      />
      <TransactionsSection />
    </div>
  )
}
