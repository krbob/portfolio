import { PageHeader } from '../components/layout'
import { TransactionsSection } from '../components/TransactionsSection'

export function TransactionsScreen() {
  return (
    <>
      <PageHeader title="Transactions" />
      <TransactionsSection />
    </>
  )
}
