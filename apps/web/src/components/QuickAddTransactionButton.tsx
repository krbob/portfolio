import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../lib/messages'

export function QuickAddTransactionButton() {
  const location = useLocation()
  const navigate = useNavigate()

  // Hide on transactions page (composer is already accessible there)
  if (location.pathname === '/transactions') return null

  return (
    <button
      onClick={() => navigate('/transactions', { state: { transactionDraft: {} } })}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-transform hover:scale-105 active:scale-95 sm:h-12 sm:w-auto sm:rounded-xl sm:px-4 sm:gap-2"
      style={{ bottom: 'max(1.5rem, calc(var(--safe-bottom, 0px) + 1.5rem))' }}
      aria-label={t('layout.quickAddTransaction')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 sm:h-5 sm:w-5">
        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
      </svg>
      <span className="hidden text-sm font-medium sm:inline">{t('layout.quickAddTransaction')}</span>
    </button>
  )
}
