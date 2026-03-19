import { PageIntro } from '../components/PageIntro'
import { TransactionsSection } from '../components/TransactionsSection'

export function TransactionsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Operations"
        title="Transactions"
        description="Maintain the canonical event stream through journal, import and profile workflows."
      />
      <TransactionsSection />
    </div>
  )
}
