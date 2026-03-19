import { PageIntro } from '../components/PageIntro'
import { TransactionsSection } from '../components/TransactionsSection'

export function TransactionsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Operations"
        title="Transactions"
        description="Work through the canonical event stream in focused modes: journal review, batch import and saved parsing profiles."
      />
      <TransactionsSection />
    </div>
  )
}
