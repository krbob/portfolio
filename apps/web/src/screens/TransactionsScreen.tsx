import { PageHeader } from '../components/layout'
import { TransactionsSection } from '../components/TransactionsSection'
import { useI18n } from '../lib/i18n'

export function TransactionsScreen() {
  const { isPolish } = useI18n()
  return (
    <>
      <PageHeader title={isPolish ? 'Transakcje' : 'Transactions'} />
      <TransactionsSection />
    </>
  )
}
