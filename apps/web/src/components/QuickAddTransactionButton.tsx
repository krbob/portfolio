import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../lib/messages'
import { IconPlus } from './ui/icons'

export function QuickAddTransactionButton() {
  const location = useLocation()
  const navigate = useNavigate()

  // Hide on transactions page (composer is already accessible there)
  if (location.pathname === '/transactions') return null

  return (
    <button
      onClick={() => navigate('/transactions', { state: { transactionDraft: {} } })}
      className="fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-transform hover:scale-105 active:scale-95 sm:h-12 sm:w-auto sm:rounded-xl sm:px-5 sm:gap-2"
      style={{ bottom: 'max(2rem, calc(var(--safe-bottom, 0px) + 2rem))', right: 'max(2rem, calc(var(--safe-right, 0px) + 2rem))' }}
      aria-label={t('layout.quickAddTransaction')}
    >
      <IconPlus className="h-6 w-6 sm:h-5 sm:w-5" />
      <span className="hidden text-sm font-medium sm:inline">{t('layout.quickAddTransaction')}</span>
    </button>
  )
}
