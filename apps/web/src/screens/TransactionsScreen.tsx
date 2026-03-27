import { PageHeader } from '../components/layout'
import { TransactionsSection } from '../components/TransactionsSection'
import { t } from '../lib/messages'

export function TransactionsScreen() {
  return (
    <>
      <PageHeader title={t('transactions.title')} />
      <TransactionsSection />
    </>
  )
}
